/**
 * Schema Queries — thin re-export barrel.
 *
 * The SHACL/RDFS SPARQL-query functions were split into cohesive families
 * (ADR 0003) to satisfy CONTRIBUTING #15 (<400 LOC): `-domains` (property/asset
 * discovery + the shared `extractDomainFromRegistry` helper), `-references`
 * (cross-domain reference chains), `-shapes` (shape-group + 2D-range), and
 * `-instances` (SKOS / subclass / value-distribution probes). Consumers import
 * the same symbols from this path unchanged. Sibling deps form a DAG rooted at
 * `-domains`; no cycle.
 *
 * @see https://www.w3.org/TR/sparql11-query/
 * @see https://www.w3.org/TR/shacl/
 */
export {
  type AssetDomainInfo,
  type PropertyDomainInfo,
  queryAssetDomains,
  queryPropertyDomains,
} from './schema-queries-domains.js'
export {
  type PropertyValueDistribution,
  queryInstanceValueDistribution,
  querySkosConcepts,
  querySubClassEdges,
  type SkosConceptInfo,
  type SubClassEdge,
} from './schema-queries-instances.js'
export { type DomainReferenceInfo, queryDomainReferences } from './schema-queries-references.js'
export {
  type PropertyShapeGroupInfo,
  queryPropertyShapeGroups,
  queryRange2DProperties,
  type Range2DPropertyInfo,
} from './schema-queries-shapes.js'
