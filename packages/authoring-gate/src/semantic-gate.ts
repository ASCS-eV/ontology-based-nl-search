/**
 * The SHACL semantic gate — the design-time half of authoring validation.
 *
 * It lowers a validated {@link AuthoringIR} to an RDF instance graph and enforces
 * the qc rules the runtime WASM checker (task 04) cannot: **referential**
 * resolution (`entityRef`, honoring `$param` indirection), **uniqueness** of
 * element names, and **cross-file** `.xosc`→`.xodr` resolution over a single
 * merged graph. These run as **real SPARQL over the in-process Oxigraph store**
 * (not `sh:sparql` — the repo's SHACL engine is Core-only), before anything is
 * serialized, so many violations are caught earlier and more precisely than a
 * per-file checker can.
 *
 * Every violation carries the canonical qc rule UID (from {@link QC_RULES}) and
 * the offending focus node, so the repair loop (task 05) cites the exact ASAM
 * rule — traceable to the standard without running the framework.
 *
 * [QC-XOSC] ASAM OpenSCENARIO checker bundle — reference_control rules.
 * [SPARQL] W3C SPARQL 1.1 — the referential/cross-file checks.
 */
import type { AuthoringIR } from '@ontology-search/authoring-ir'
import { liftXmlToRdf } from '@ontology-search/ontology/xml-to-rdf'
import { OxigraphStore, type SparqlBinding } from '@ontology-search/sparql'
import type { DatasetCore } from '@rdfjs/types'
import { Writer } from 'n3'

import { irToRdf, OPENDRIVE_NS } from './ir-to-rdf.js'
import { QC_RULES, type QcRule } from './qc-rules.js'
import type { AuthoringGap, GateResult } from './types.js'

/** Per-call options for {@link runSemanticGate}. */
export interface SemanticGateOptions {
  /**
   * The referenced OpenDRIVE road network (`.xodr` content). When provided, it is
   * lifted into the same graph and the cross-file road-resolution check runs;
   * omitted ⇒ that check is skipped (never a false pass).
   */
  readonly roadNetworkXodr?: string
  /** Cooperative cancellation, honoured at the query boundary. */
  readonly signal?: AbortSignal
}

const PREFIXES = `PREFIX os: <https://w3id.org/ascs-ev/envited-x/openscenario/v1/>
PREFIX gate: <urn:authoring-gate:>
PREFIX opendrive: <${OPENDRIVE_NS}>`

/** Resolvable entity references, expanding `$param` indirection. */
const Q_RESOLVABLE_ENTITY_REFS = `${PREFIXES}
SELECT ?actor ?raw ?resolved WHERE {
  ?ref a gate:EntityReference ;
       gate:referenceValue ?raw ;
       gate:referencedBy ?actor .
  BIND(IF(STRSTARTS(?raw, "$"), SUBSTR(?raw, 2), "") AS ?pname)
  OPTIONAL { ?p a os:ParameterDeclaration ; os:name ?pname ; os:value ?pv . }
  BIND(COALESCE(?pv, ?raw) AS ?resolved)
  FILTER NOT EXISTS { ?o a os:ScenarioObject ; os:name ?resolved }
}`

/** Duplicate entity names (the reachable half of unique_element_names — parameter
 * names come from a Record and are unique by construction). */
const Q_UNIQUE_ENTITY_NAMES = `${PREFIXES}
SELECT ?name (COUNT(?o) AS ?n) WHERE {
  ?o a os:ScenarioObject ; os:name ?name .
} GROUP BY ?name HAVING (COUNT(?o) > 1)`

/** Cross-file: a scenario road id must resolve to a road in the road network. */
const Q_RESOLVABLE_ROAD_REFS = `${PREFIXES}
SELECT ?actor ?roadId WHERE {
  ?r a gate:RoadReference ; gate:roadId ?roadId ; gate:referencedBy ?actor .
  FILTER NOT EXISTS {
    ?road a opendrive:road ; opendrive:id ?rid .
    FILTER(STR(?rid) = STR(?roadId))
  }
}`

function value(binding: SparqlBinding, key: string): string {
  return binding[key]?.value ?? ''
}

function gap(rule: QcRule, focusNode: string, reason: string): AuthoringGap {
  return {
    term: focusNode,
    reason,
    ruleUid: rule.uid,
    gate: 'semantic',
    focusNode,
  }
}

/** Serialize a lifted RDF dataset to Turtle for loading into the store. */
function datasetToTurtle(dataset: DatasetCore): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new Writer()
    for (const quad of dataset) writer.addQuad(quad)
    writer.end((error, result) => (error ? reject(error) : resolve(result)))
  })
}

/**
 * Run the semantic gate over a validated authoring IR. Returns UID-attributed
 * violations; `ok` is true iff none. Uses a fresh in-process Oxigraph store per
 * call (no shared state, no worker thread) so gate runs are fully isolated.
 */
export async function runSemanticGate(
  ir: AuthoringIR,
  options: SemanticGateOptions = {}
): Promise<GateResult> {
  const store = new OxigraphStore()
  await store.loadTurtle(irToRdf(ir))

  let crossFile = false
  if (options.roadNetworkXodr !== undefined) {
    const lifted = liftXmlToRdf(options.roadNetworkXodr, { namespace: OPENDRIVE_NS })
    await store.loadTurtle(await datasetToTurtle(lifted))
    crossFile = true
  }

  const gaps: AuthoringGap[] = []
  const select = async (sparql: string): Promise<SparqlBinding[]> => {
    const result = await store.query(sparql, { signal: options.signal })
    return result.results.bindings
  }

  for (const row of await select(Q_RESOLVABLE_ENTITY_REFS)) {
    const raw = value(row, 'raw')
    const actor = value(row, 'actor')
    gaps.push(
      gap(
        QC_RULES.resolvableEntityReferences,
        raw,
        `${QC_RULES.resolvableEntityReferences.message} "${raw}" (referenced by "${actor}") does not resolve to any declared entity.`
      )
    )
  }

  for (const row of await select(Q_UNIQUE_ENTITY_NAMES)) {
    const name = value(row, 'name')
    gaps.push(
      gap(
        QC_RULES.uniqueElementNames,
        name,
        `Duplicate entity name "${name}" — names must be unique.`
      )
    )
  }

  if (crossFile) {
    for (const row of await select(Q_RESOLVABLE_ROAD_REFS)) {
      const roadId = value(row, 'roadId')
      const actor = value(row, 'actor')
      gaps.push(
        gap(
          QC_RULES.resolvableRoadReference,
          roadId,
          `${QC_RULES.resolvableRoadReference.message} Road "${roadId}" (referenced by "${actor}") is not in the road network.`
        )
      )
    }
  }

  return { ok: gaps.length === 0, gaps }
}
