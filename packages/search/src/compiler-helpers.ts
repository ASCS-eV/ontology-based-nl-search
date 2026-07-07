/**
 * Compiler emit helpers — thin re-export barrel.
 *
 * The implementation was split into cohesive sub-modules (ADR 0003 step 22d) to
 * satisfy CONTRIBUTING #15 (<400 LOC): `-primitives` (leaf), `-paths`,
 * `-references`, `-domains`, `-query`. The consumer files import the same
 * symbols from this path unchanged. The sub-module dependency graph is a DAG
 * rooted at `-primitives` (the sink); no cycle. The `log` component label stays
 * `'compiler'` so diagnostic output is byte-identical.
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 */
export {
  buildPrefixes,
  classifyProperty,
  detectHierarchy,
  partitionFiltersByDomain,
  partitionRangesByDomain,
  resolvePrimaryDomain,
  resolvePropertyPrefix,
} from './compiler-helpers-domains.js'
export {
  emitDeepFilters,
  emitDirectPathFilters,
  lookupDomainSpecPredicate,
  lookupStepPredicate,
  SHALLOW_PATH_MAX_STEPS,
} from './compiler-helpers-paths.js'
export {
  addEnumFilter,
  addLocationFilter,
  findDomainForIri,
  groupPredicate,
  groupVariableName,
  isNonEmpty,
  prefixedPredicate,
} from './compiler-helpers-primitives.js'
export { assembleQuery } from './compiler-helpers-query.js'
export {
  emitDataReferencePath,
  emitReferenceChainTriples,
  pickReferenceChain,
  pickSiblingDataEdge,
} from './compiler-helpers-references.js'
