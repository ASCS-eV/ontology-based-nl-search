/**
 * Grounds the "existing maps" cross-file check in the REAL ASAM OpenDRIVE
 * ontology OMB v0.4.0 vendors (`.ontology/imports/opendrive/opendrive.owl.ttl`,
 * ASAM's own generated OWL — see that file's README) — replacing the ad-hoc
 * `urn:opendrive:` namespace + verbatim-tag-name lift this package used while
 * OMB shipped only the raw `.xsd` and no native ontology.
 *
 * Scope is intentionally narrow. The semantic gate's cross-file check
 * (`resolvableRoadReference`) only needs to know which `<road id="…">`
 * elements a `.xodr` road network declares — it never needs lanes, junctions,
 * or geometry (the residual gate parses those directly off the XML for the
 * G1/G2 continuity check). A full recursive lift of every OpenDRIVE element
 * would need the same per-context class disambiguation ASAM's own
 * OpenSCENARIO README documents for choice/role constructs (e.g. `<left>` /
 * `<right>` / `<center>` all contain a `<lane>` element that resolves to three
 * DIFFERENT OWL classes depending on the parent) and is not needed here, so
 * this module resolves and emits only the two facts the query uses: the
 * `T_road` class and its `id` property.
 *
 * Both are resolved BY LABEL from the pinned ontology at module load — never
 * hand-typed — so an upstream rename fails fast (a clear startup error)
 * instead of silently mismatching and turning the cross-file check into a
 * permanent no-op.
 *
 * [OWL2] OWL 2 Web Ontology Language Structural Specification
 * (docs/specs/references/owl2-syntax.md) — `odr:T_road` / `odr:T_road.id` are
 * `owl:Class` / `owl:DatatypeProperty` declarations resolved by their
 * `rdfs:label` [RDFS §5.4.2].
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { RDF_PREFIXES } from '@ontology-search/core/rdf/prefixes'
import { getWorkspaceRoot } from '@ontology-search/ontology/sources'
import { Parser as N3Parser, type Quad } from 'n3'

const RDF_TYPE = `${RDF_PREFIXES.rdf}type`
const RDFS_LABEL = `${RDF_PREFIXES.rdfs}label`
const RDFS_DOMAIN = `${RDF_PREFIXES.rdfs}domain`
const OWL_CLASS = `${RDF_PREFIXES.owl}Class`
const OWL_DATATYPE_PROPERTY = `${RDF_PREFIXES.owl}DatatypeProperty`

/** Workspace-relative path to the pinned OpenDRIVE ontology (OMB `imports/`). */
const OPENDRIVE_ONTOLOGY_PATH = ['.ontology', 'imports', 'opendrive', 'opendrive.owl.ttl'] as const

/**
 * The XSD complexType `rdfs:label` bound to the `<road>` element (ASAM's
 * `T_<complexType>` naming convention — see `imports/opendrive/README.md` in
 * the pinned ontology cache). Not itself an IRI or class/property name: it is
 * the label the resolver looks up, so a class rename upstream is caught by
 * {@link resolveOpenDriveRoadGrounding} throwing rather than by a silently
 * wrong IRI.
 */
const ROAD_CLASS_LABEL = 't_road'
const ROAD_ID_PROPERTY_LABEL = 'id'

/** The two real-ontology IRIs the cross-file road-reference check needs. */
export interface OpenDriveRoadGrounding {
  /** `odr:T_road` — resolved by label, never hand-typed. */
  readonly roadClassIri: string
  /** `odr:T_road.id` — resolved by (domain, label), never hand-typed. */
  readonly roadIdPropertyIri: string
}

class OpenDriveGroundingError extends Error {
  constructor(message: string) {
    super(
      `${message} Expected to find it in ${OPENDRIVE_ONTOLOGY_PATH.join('/')} ` +
        `(pinned by ontology-package.json, materialized by 'pnpm run fetch:ontology'). ` +
        `If ASAM renamed the class/property, update ROAD_CLASS_LABEL / ` +
        `ROAD_ID_PROPERTY_LABEL in opendrive-ontology.ts to match.`
    )
    this.name = 'OpenDriveGroundingError'
  }
}

function parseTtl(path: string): Quad[] {
  const content = readFileSync(path, 'utf-8')
  return new N3Parser().parse(content)
}

/**
 * The three predicates the resolution needs, indexed by subject in one pass.
 * `typed` keeps document order so resolution stays deterministic — the same
 * ontology always resolves to the same IRI, even if upstream ever declared two
 * classes under one label.
 */
interface OntologyIndex {
  /** `rdf:type` object → subjects carrying it, in document order. */
  readonly typed: Map<string, string[]>
  /** subject → its `rdfs:label` values. */
  readonly labels: Map<string, Set<string>>
  /** subject → its `rdfs:domain` values. */
  readonly domains: Map<string, Set<string>>
}

function addTo(index: Map<string, Set<string>>, key: string, value: string): void {
  const existing = index.get(key)
  if (existing) existing.add(value)
  else index.set(key, new Set([value]))
}

/**
 * Index the three predicates in a single O(quads) pass. Resolving by scanning
 * the quad list per candidate instead costs O(declarations × quads), which on
 * ASAM's real ontology (8k quads, 178 classes, 460 datatype properties) is ~70 ms
 * of blocking work on the thread that runs the gate.
 */
function indexQuads(quads: Quad[]): OntologyIndex {
  const typed = new Map<string, string[]>()
  const labels = new Map<string, Set<string>>()
  const domains = new Map<string, Set<string>>()

  for (const q of quads) {
    const subject = q.subject.value
    switch (q.predicate.value) {
      case RDF_TYPE: {
        if (q.subject.termType !== 'NamedNode') break
        const subjects = typed.get(q.object.value)
        if (subjects) subjects.push(subject)
        else typed.set(q.object.value, [subject])
        break
      }
      case RDFS_LABEL:
        addTo(labels, subject, q.object.value)
        break
      case RDFS_DOMAIN:
        addTo(domains, subject, q.object.value)
        break
    }
  }

  return { typed, labels, domains }
}

/**
 * Resolve {@link OpenDriveRoadGrounding} from a parsed ontology.
 * Pure over the quads so it is unit-testable against a fixture ontology
 * without touching the real 423 KB pinned file on every call.
 */
export function resolveOpenDriveRoadGroundingFrom(quads: Quad[]): OpenDriveRoadGrounding {
  const { typed, labels, domains } = indexQuads(quads)

  const roadClassIri = typed
    .get(OWL_CLASS)
    ?.find((subject) => labels.get(subject)?.has(ROAD_CLASS_LABEL))
  if (!roadClassIri) {
    throw new OpenDriveGroundingError(
      `No owl:Class with rdfs:label "${ROAD_CLASS_LABEL}" found in the OpenDRIVE ontology.`
    )
  }

  // Domain-scoped: `id` is a label ~35 elements share upstream, so the label
  // alone would resolve to whichever happens to be declared first.
  const roadIdPropertyIri = typed
    .get(OWL_DATATYPE_PROPERTY)
    ?.find(
      (subject) =>
        domains.get(subject)?.has(roadClassIri) && labels.get(subject)?.has(ROAD_ID_PROPERTY_LABEL)
    )
  if (!roadIdPropertyIri) {
    throw new OpenDriveGroundingError(
      `No owl:DatatypeProperty with rdfs:domain <${roadClassIri}> and rdfs:label ` +
        `"${ROAD_ID_PROPERTY_LABEL}" found in the OpenDRIVE ontology.`
    )
  }

  return { roadClassIri, roadIdPropertyIri }
}

let cached: OpenDriveRoadGrounding | null = null

/**
 * Resolve {@link OpenDriveRoadGrounding} from the pinned ontology cache,
 * memoized (the pinned file is a build-time constant, not per-request data).
 */
export function resolveOpenDriveRoadGrounding(): OpenDriveRoadGrounding {
  if (cached) return cached
  const path = join(getWorkspaceRoot(), ...OPENDRIVE_ONTOLOGY_PATH)
  let quads: Quad[]
  try {
    quads = parseTtl(path)
  } catch (err) {
    throw new OpenDriveGroundingError(
      `Cannot read/parse the OpenDRIVE ontology: ${err instanceof Error ? err.message : String(err)}`
    )
  }
  cached = resolveOpenDriveRoadGroundingFrom(quads)
  return cached
}

/** Reset the memoized grounding. Test-only (the pinned ontology is build-time constant). */
export function resetOpenDriveRoadGroundingCache(): void {
  cached = null
}
