/**
 * Lineage seam — the asset-metadata + cross-reference + traceability surface of
 * `search`.
 *
 * These modules answer "what is linked to what" over the loaded instance data:
 * per-domain metadata aggregates and facets, the data-driven reference index
 * (including multi-hop manifest links), and bounded lineage exploration. Grouped
 * here as a `@ontology-search/search/lineage` subpath export (ADR 0003, step 4)
 * to make the seam explicit and importable on its own; the root `.` surface still
 * re-exports everything for back-compat.
 *
 * This is an export barrel only — no logic lives here.
 */
export type {
  AssetMetadata,
  DomainGroupAggregate,
  FacetValue,
  PropertyStats,
} from './metadata-index.js'
export { getAssetMetadata, getDomainMetadataAggregate } from './metadata-index.js'
export type { DataReferenceEdge, ReferenceIndex } from './reference-index.js'
export { getReferenceIndex, resetReferenceIndex } from './reference-index.js'
export type { LineageOptions, TraceabilityEdge, TraceabilityNode } from './traceability.js'
export { DEFAULT_LINEAGE_DEPTH, exploreLineage, MAX_LINEAGE_DEPTH } from './traceability.js'
