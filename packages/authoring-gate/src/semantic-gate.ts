/**
 * The SHACL semantic gate — the design-time half of authoring validation.
 *
 * It lowers a validated {@link AuthoringIR} to an RDF instance graph and enforces
 * the qc rules the runtime WASM checker cannot: **referential**
 * resolution (`entityRef`, honoring `$param` indirection), **uniqueness** of
 * element names, and **cross-file** `.xosc`→`.xodr` resolution over a single
 * merged graph. These run as **real SPARQL over the in-process Oxigraph store**
 * (not `sh:sparql` — the repo's SHACL engine is Core-only), before anything is
 * serialized, so many violations are caught earlier and more precisely than a
 * per-file checker can.
 *
 * Every violation carries a rule UID (from {@link QC_RULES}) and the offending
 * focus node, so the repair loop cites the exact rule. Two of the three checks
 * here are attributed to real ASAM `reference_control` rules; the cross-file one
 * is attributed to a repo rule, because no file-scoped bundle can express it.
 *
 * [QC-XOSC] ASAM OpenSCENARIO XML checker bundle — `reference_control` rules.
 * The bundle is not vendored in this repo; its rule list is pinned and
 * checksummed in `qc-bundles/qc-openscenarioxml.bundle.json`, which
 * `__tests__/qc-rules.test.ts` gates every `origin: 'asam'` UID against.
 * [SPARQL11] SPARQL 1.1 Query (docs/specs/references/sparql11-query.md) — the
 * referential/cross-file checks run as SPARQL SELECT.
 * [OWL2] OWL 2 Web Ontology Language — the cross-file road check is grounded
 * in ASAM's real OpenDRIVE `T_road` / `T_road.id` (`opendrive-ontology.ts`),
 * not an invented namespace.
 */
import type { AuthoringIR } from '@ontology-search/authoring-ir'
import { OxigraphStore, type SparqlBinding } from '@ontology-search/sparql'

import { GATE_NS, irToRdf, OSC_NS } from './ir-to-rdf.js'
import { resolveOpenDriveRoadGrounding } from './opendrive-ontology.js'
import { liftOpenDriveRoadFacts } from './opendrive-road-lift.js'
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

// Namespaces come from the single source (ir-to-rdf) so the gate's SPARQL and
// the lifted instance graph cannot disagree on the ontology IRI.
const PREFIXES = `PREFIX os: <${OSC_NS}>
PREFIX gate: <${GATE_NS}>`

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

/**
 * Cross-file: a scenario road id must resolve to a road in the road network.
 * The road class/property are the REAL ASAM OpenDRIVE ontology's `T_road` /
 * `T_road.id` [OWL2], resolved by label (never hand-typed) — see
 * `opendrive-ontology.ts`. Built as a function (not a module-level constant)
 * so resolution only runs when a road network is actually supplied, matching
 * `runSemanticGate`'s existing "never a false pass" lazy cross-file gating.
 */
function roadRefsQuery(): string {
  const { roadClassIri, roadIdPropertyIri } = resolveOpenDriveRoadGrounding()
  return `${PREFIXES}
SELECT ?actor ?roadId WHERE {
  ?r a gate:RoadReference ; gate:roadId ?roadId ; gate:referencedBy ?actor .
  FILTER NOT EXISTS {
    ?road a <${roadClassIri}> ; <${roadIdPropertyIri}> ?rid .
    FILTER(STR(?rid) = STR(?roadId))
  }
}`
}

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
    await store.loadTurtle(liftOpenDriveRoadFacts(options.roadNetworkXodr))
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
    for (const row of await select(roadRefsQuery())) {
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
