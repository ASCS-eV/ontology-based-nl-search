/**
 * Grounds the "existing maps" cross-file check in the REAL ASAM OpenDRIVE
 * ontology the pinned package vendors — replacing the ad-hoc `urn:opendrive:`
 * namespace and verbatim-tag-name lift this package used while only the raw
 * `.xsd` shipped upstream.
 *
 * Scope is intentionally narrow. The semantic gate's cross-file check
 * (`resolvableRoadReference`) only needs to know which `<road id="…">`
 * elements a `.xodr` declares — never lanes, junctions, or geometry (the
 * residual gate reads those off the XML directly for the G1/G2 continuity
 * check). A full recursive lift would need the per-context class
 * disambiguation ASAM's own README documents for choice/role constructs
 * (`<left>`, `<right>` and `<center>` each contain a `<lane>` element
 * resolving to a DIFFERENT OWL class), which this check does not require.
 *
 * Neither the document nor the entities are hardcoded to a path:
 *
 *   - the DOCUMENT comes from the pinned package's OASIS XML catalog, keyed by
 *     the ontology IRI, so an upstream layout move cannot break it [XMLCAT];
 *   - the ENTITIES are asserted to be declared in that document, so an
 *     upstream rename fails fast with a clear error instead of silently
 *     mismatching and turning the cross-file check into a permanent no-op.
 *
 * Resolution is by IRI, not by `rdfs:label`. `rdfs:label` provides "a
 * human-readable version of a resource's name" [RDFS] §3.6 — an annotation
 * with no uniqueness or stability guarantee, and this ontology declares
 * `rdfs:label "id"` on 35 different entities. The IRI is the identifier
 * [OWL2] §2, so resolving an identifier through an annotation is strictly
 * weaker than resolving it directly.
 *
 * [OWL2] OWL 2 Structural Specification (docs/specs/references/owl2-syntax.md)
 * §2 — entities are named by IRI; `T_road` is an `owl:Class` and `T_road.id`
 * an `owl:DatatypeProperty`.
 * [RDFS] RDF Schema 1.1 (docs/specs/references/rdf-schema.md) §3.6 —
 * `rdfs:label`.
 * [XMLCAT] OASIS XML Catalogs 1.1 — ontology IRI → document resolution.
 */
import { readFile } from 'node:fs/promises'

import { RDF_PREFIXES } from '@ontology-search/core/rdf/prefixes'
import { resolveOntologyPath } from '@ontology-search/ontology/catalog'
import { Parser as N3Parser, type Quad } from 'n3'

const RDF_TYPE = `${RDF_PREFIXES.rdf}type`
const OWL_CLASS = `${RDF_PREFIXES.owl}Class`
const OWL_DATATYPE_PROPERTY = `${RDF_PREFIXES.owl}DatatypeProperty`

/**
 * The ontology this check is grounded in, named by the IRI the pinned catalog
 * resolves. ASAM publishes this IRI; this repo does not choose it.
 */
const OPENDRIVE_ONTOLOGY_IRI = 'http://code.asam.net/simulation/standard/opendrive'

/**
 * The two entities the cross-file road-reference check needs. Naming two IRIs,
 * once, is the floor: the XSD→OWL element mapping that would let them be
 * *discovered* rather than named is not published as data.
 */
const ROAD_CLASS_IRI = `${OPENDRIVE_ONTOLOGY_IRI}#T_road`
const ROAD_ID_PROPERTY_IRI = `${OPENDRIVE_ONTOLOGY_IRI}#T_road.id`

/** The two real-ontology IRIs the cross-file road-reference check needs. */
export interface OpenDriveRoadGrounding {
  /** `odr:T_road`, verified declared in the pinned ontology. */
  readonly roadClassIri: string
  /** `odr:T_road.id`, verified declared in the pinned ontology. */
  readonly roadIdPropertyIri: string
}

export class OpenDriveGroundingError extends Error {
  constructor(message: string) {
    super(
      `${message} The ontology is resolved from <${OPENDRIVE_ONTOLOGY_IRI}> via the pinned ` +
        `package's OASIS catalog (materialized by 'pnpm run fetch:ontology'). If ASAM renamed ` +
        `the class or property, update ROAD_CLASS_IRI / ROAD_ID_PROPERTY_IRI in ` +
        `opendrive-ontology.ts to match.`
    )
    this.name = 'OpenDriveGroundingError'
  }
}

/**
 * Verify both entities are declared in a parsed ontology, and return them.
 * Pure over the quads, so it is testable against a fixture without reading the
 * real pinned document.
 */
export function resolveOpenDriveRoadGroundingFrom(quads: Quad[]): OpenDriveRoadGrounding {
  const declared = new Set<string>()
  for (const q of quads) {
    if (q.predicate.value !== RDF_TYPE) continue
    if (q.object.value !== OWL_CLASS && q.object.value !== OWL_DATATYPE_PROPERTY) continue
    declared.add(`${q.subject.value} ${q.object.value}`)
  }

  if (!declared.has(`${ROAD_CLASS_IRI} ${OWL_CLASS}`)) {
    throw new OpenDriveGroundingError(`<${ROAD_CLASS_IRI}> is not declared as an owl:Class.`)
  }
  if (!declared.has(`${ROAD_ID_PROPERTY_IRI} ${OWL_DATATYPE_PROPERTY}`)) {
    throw new OpenDriveGroundingError(
      `<${ROAD_ID_PROPERTY_IRI}> is not declared as an owl:DatatypeProperty.`
    )
  }

  return { roadClassIri: ROAD_CLASS_IRI, roadIdPropertyIri: ROAD_ID_PROPERTY_IRI }
}

let cached: OpenDriveRoadGrounding | null = null
let inFlight: Promise<OpenDriveRoadGrounding> | null = null

/**
 * Resolve and verify the grounding, once.
 *
 * Memoized on the PROMISE, not only the value: warmup and a first request can
 * race, and two concurrent callers must not both read and parse the ontology.
 * Reading it is tens of milliseconds that have no business on a request thread
 * at all — {@link warmOpenDriveRoadGrounding} exists so startup pays it.
 */
export function resolveOpenDriveRoadGrounding(): Promise<OpenDriveRoadGrounding> {
  if (cached) return Promise.resolve(cached)
  inFlight ??= (async () => {
    try {
      const path = resolveOntologyPath(OPENDRIVE_ONTOLOGY_IRI)
      const quads = new N3Parser().parse(await readFile(path, 'utf-8'))
      cached = resolveOpenDriveRoadGroundingFrom(quads)
      return cached
    } catch (err) {
      if (err instanceof OpenDriveGroundingError) throw err
      throw new OpenDriveGroundingError(
        `Cannot read the OpenDRIVE ontology: ${err instanceof Error ? err.message : String(err)}.`
      )
    } finally {
      // Cleared either way: a failed resolution must be retryable once the
      // operator fixes the cache, not cached as a permanent failure.
      inFlight = null
    }
  })()
  return inFlight
}

/**
 * Resolve the grounding ahead of any request, so a broken pin fails readiness
 * rather than a user's authoring run. Safe to call more than once.
 */
export async function warmOpenDriveRoadGrounding(): Promise<void> {
  await resolveOpenDriveRoadGrounding()
}

/** Reset the memoized grounding. Test-only (the pinned ontology is build-time constant). */
export function resetOpenDriveRoadGroundingCache(): void {
  cached = null
  inFlight = null
}
