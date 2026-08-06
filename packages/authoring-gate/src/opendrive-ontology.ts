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
 * Resolve {@link OpenDriveRoadGrounding} from the pinned ontology cache.
 * Pure over the file path so it is unit-testable against a fixture ontology
 * without touching the real 423 KB pinned file on every call.
 */
export function resolveOpenDriveRoadGroundingFrom(quads: Quad[]): OpenDriveRoadGrounding {
  let roadClassIri: string | undefined
  for (const q of quads) {
    if (
      q.predicate.value === RDF_TYPE &&
      q.object.value === OWL_CLASS &&
      q.subject.termType === 'NamedNode'
    ) {
      const hasLabel = quads.some(
        (l) =>
          l.subject.value === q.subject.value &&
          l.predicate.value === RDFS_LABEL &&
          l.object.value === ROAD_CLASS_LABEL
      )
      if (hasLabel) {
        roadClassIri = q.subject.value
        break
      }
    }
  }
  if (!roadClassIri) {
    throw new OpenDriveGroundingError(
      `No owl:Class with rdfs:label "${ROAD_CLASS_LABEL}" found in the OpenDRIVE ontology.`
    )
  }

  let roadIdPropertyIri: string | undefined
  for (const q of quads) {
    if (
      q.predicate.value === RDF_TYPE &&
      q.object.value === OWL_DATATYPE_PROPERTY &&
      q.subject.termType === 'NamedNode'
    ) {
      const domainMatches = quads.some(
        (d) =>
          d.subject.value === q.subject.value &&
          d.predicate.value === RDFS_DOMAIN &&
          d.object.value === roadClassIri
      )
      const labelMatches = quads.some(
        (l) =>
          l.subject.value === q.subject.value &&
          l.predicate.value === RDFS_LABEL &&
          l.object.value === ROAD_ID_PROPERTY_LABEL
      )
      if (domainMatches && labelMatches) {
        roadIdPropertyIri = q.subject.value
        break
      }
    }
  }
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
