/**
 * Cross-domain + peer-domain query emission.
 *
 * Extracted verbatim from `compiler.ts` (ADR 0003 step 22c). Holds the
 * multi-domain query forms: the peer-domain UNION (`compilePeerDomainUnion`),
 * the all-asset cross-domain query (`compileCrossDomainQuery`), and its filter
 * emission (`emitCrossDomainFilters`). Pure move. One-way dep (compiler →
 * cross-domain → domain-patterns → helpers); nothing here imports the compile
 * core, so there is no cycle.
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 */
import { createComponentLogger } from '@ontology-search/core/logging'
import { sparqlPrefix } from '@ontology-search/core/rdf/prefixes'
import { type DomainRegistry } from '@ontology-search/ontology/domain-registry'
import type { SearchSlots } from '@ontology-search/slots/slots'

import { buildDomainPatterns } from './compiler-domain-patterns.js'
import { buildPrefixes } from './compiler-helpers-domains.js'
import { pathPrefixKey, resolveDomainKey } from './compiler-helpers-paths.js'
import {
  addEnumFilter,
  addLocationFilter,
  findDomainForIri,
  isNonEmpty,
  leafVariable,
  prefixedPredicate,
} from './compiler-helpers-primitives.js'
import { assembleQuery, ASSET_LABEL_PATTERN } from './compiler-helpers-query.js'
import { buildStandaloneArms } from './compiler-standalone.js'
import { type CompilerVocab } from './compiler-vocab.js'
import { vocabularyContentFilter } from './compiler-vocabulary-scope.js'
import { type PropertyPath } from './property-paths.js'

const log = createComponentLogger('compiler')

/**
 * Compile a UNION query for peer domains — independent asset types that
 * share similar properties (the same property local name in more than one
 * domain).
 *
 * Generates one UNION arm per domain, each with the domain-specific
 * patterns, filters, and location constraints. Shared FILTER clauses
 * (location, license) are placed outside the UNION.
 *
 * `standaloneDomains` are requested support vocabularies with discovered
 * entry classes; each adds the arms built by `buildStandaloneArms` (documents
 * of that vocabulary not attached to any asset) after the asset arms.
 * `carried` maps an asset domain a vocabulary scope added to the vocabularies
 * its assets must carry (see `compiler-vocabulary-scope.ts`).
 */
export async function compilePeerDomainUnion(
  slots: SearchSlots,
  domains: string[],
  filtersByDomain: Record<string, Record<string, string | string[]>>,
  rangesByDomain: Record<string, Record<string, { min?: number; max?: number }>>,
  registry: DomainRegistry,
  vocabIndex: CompilerVocab,
  standaloneDomains: string[] = [],
  carried: ReadonlyMap<string, readonly string[]> = new Map()
): Promise<string> {
  const prefixDomains = new Set<string>()
  const selectVars = new Set(['?asset', '?name'])
  const outerFilters: string[] = []

  // Build UNION arms
  const unionArms: string[] = []
  const hasFilters = Object.values(filtersByDomain).some((f) => Object.keys(f).length > 0)
  const hasRanges = Object.values(rangesByDomain).some((r) => Object.keys(r).length > 0)
  const queryHasConstraints = hasFilters || hasRanges

  for (const domainName of domains) {
    const domain = registry.domains.get(domainName)
    if (!domain) continue

    const domainFilters = filtersByDomain[domainName] || {}
    const domainRanges = rangesByDomain[domainName] || {}
    const domainHasConstraints =
      Object.keys(domainFilters).length > 0 || Object.keys(domainRanges).length > 0

    // Skip domains with zero applicable constraints when the query
    // clearly intends to filter. This prevents UNION arms that return
    // ALL assets from a domain unrelated to the search intent.
    //
    // Log the skip so a consumer auditing the trace can correlate
    // their selected-domain set with what actually got compiled —
    // silently dropping a domain is the worst kind of misclassification
    // because the user can't tell from the SPARQL why their query
    // returned fewer rows than expected. The slot validator surfaces
    // a per-key gap upstream when filters are dropped at the value
    // level; this log covers the complementary case where the key was
    // valid but the discovery found no chain to it in this domain.
    if (queryHasConstraints && !domainHasConstraints) {
      log.warn('UNION arm skipped — domain has no discovered property path for any filter', {
        domain: domainName,
        requestedFilters: Object.keys(filtersByDomain).concat(Object.keys(rangesByDomain)),
      })
      continue
    }

    prefixDomains.add(domainName)

    const armPatterns: string[] = []
    const armFilters: string[] = []
    const armOptionals: string[] = []
    const armSelectVars = new Set<string>()

    // Base pattern — asset type; the label is optional (see ASSET_LABEL_PATTERN)
    armPatterns.push(`?asset a ${domain.targetClass} .`)
    armOptionals.push(ASSET_LABEL_PATTERN)

    // Build domain-specific patterns
    const foreignDomains = buildDomainPatterns(
      domainName,
      domain,
      domainFilters,
      domainRanges,
      armPatterns,
      armFilters,
      armOptionals,
      armSelectVars,
      vocabIndex,
      registry,
      '?asset',
      '?domSpec'
    )
    for (const fd of foreignDomains) prefixDomains.add(fd)
    for (const v of armSelectVars) selectVars.add(v)
    // An owner added by a vocabulary scope answers only with assets that
    // carry the vocabulary's content (see `compiler-vocabulary-scope.ts`).
    const carriedVocabularies = carried.get(domainName)
    const content =
      carriedVocabularies &&
      vocabularyContentFilter(domainName, carriedVocabularies, registry, vocabIndex)
    if (content) armFilters.push(content)

    // Combine arm into a single block
    const armBody = [...armPatterns, ...armOptionals, ...armFilters]
      .map((line) => `    ${line}`)
      .join('\n')
    unionArms.push(`  {\n${armBody}\n  }`)
  }

  for (const domainName of standaloneDomains) {
    unionArms.push(
      ...buildStandaloneArms(domainName, slots, registry, vocabIndex, prefixDomains, selectVars)
    )
  }

  // License is handled as a normal `filters` entry keyed by the SHACL leaf
  // local name. License chains are emitted by the generic deep-filter
  // machinery inside `buildDomainPatterns` (one chain per UNION arm). No
  // outer license OPTIONAL block needed.

  // Build the UNION body. When no requested domain can satisfy the query the
  // result must be EMPTY: an empty group pattern has exactly one (unbound)
  // solution ([SPARQL11] §5.2.1), which would surface as a phantom row.
  const unionBody = unionArms.length > 0 ? unionArms.join('\n  UNION\n') : 'FILTER(false)'
  const patterns = [unionBody]
  const optionals: string[] = []

  // Generate prefixes
  const prefixes = buildPrefixes(registry, [...prefixDomains])

  return assembleQuery(prefixes, selectVars, patterns, optionals, outerFilters)
}

/**
 * Compile a cross-domain query across every discovered asset type.
 *
 * Used when no specific domain is detected, or when domain ambiguity
 * exists. Filters are applied as OPTIONAL patterns since different
 * domains have different properties.
 *
 * The query enumerates concrete asset target classes via a SPARQL
 * `VALUES` clause derived from the discovered asset-domain set and
 * the registry, rather than relying on a superclass match with
 * implicit `rdfs:subClassOf*` inference. The store may not perform
 * inference and the sample data tags each asset only with its
 * concrete class, so a superclass-only form returned zero rows even
 * when assets were present. Enumerating the discovered target
 * classes makes the query work against any SPARQL store regardless
 * of inference support.
 *
 * Target classes are emitted as full `<IRI>` literals in the VALUES
 * clause so no per-domain `PREFIX` declarations are needed for them,
 * keeping the policy allowlist independent of which domains the
 * registry happens to discover.
 */
export function compileCrossDomainQuery(
  slots: SearchSlots,
  registry: DomainRegistry,
  assetDomains: Set<string>,
  vocabIndex: CompilerVocab
): string {
  // The asset-class VALUES uses full IRIs so the cross-domain mode
  // doesn't pin the policy allowlist to specific ontology namespaces.
  // Prefixes are added on-demand based on discovered property paths.
  const usedPrefixes = new Set<string>()
  const prefixLines: string[] = [sparqlPrefix('rdfs'), sparqlPrefix('xsd'), sparqlPrefix('gx')]

  const patterns: string[] = []
  const filters: string[] = []
  const optionals: string[] = []
  const selectVars = ['?asset', '?name']

  // Build the VALUES list of every discovered asset target class as
  // full IRI literals. Sort for deterministic SPARQL output.
  const targetClassIris: string[] = []
  for (const domainName of [...assetDomains].sort()) {
    const desc = registry.domains.get(domainName)
    if (desc?.targetClassIri) targetClassIris.push(`<${desc.targetClassIri}>`)
  }

  // Base pattern — match any instance of a known asset target class.
  if (targetClassIris.length > 0) {
    patterns.push(`VALUES ?assetClass { ${targetClassIris.join(' ')} }`)
  } else {
    patterns.push('VALUES ?assetClass {}')
  }
  patterns.push('?asset a ?assetClass .')
  optionals.push(ASSET_LABEL_PATTERN)

  // Generic filter emission — location and license are ordinary
  // `slots.filters` entries keyed by their SHACL leaf local names. For
  // cross-domain queries (no specific domain selected) each filter
  // emits as an OPTIONAL chain walking whatever property path the
  // schema graph discovers for that leaf in any registered domain.
  // Filters that share a path prefix reuse intermediate variables;
  // filters with no discoverable path are skipped with a logger
  // warning.
  emitCrossDomainFilters(slots.filters, vocabIndex, registry, optionals, filters, selectVars, {
    usedPrefixes,
    prefixLines,
  })

  // Build the query
  const prefixes = prefixLines.join('\n')
  return assembleQuery(prefixes, selectVars, patterns, optionals, filters)
}

/**
 * Emit OPTIONAL chains for every filter in a cross-domain query.
 *
 * For each filter key the compiler picks the first domain (in name order)
 * whose keyed path index holds the key, resolves it there (ADR 0009), then
 * walks the path step by step. Multiple filter keys that share a path prefix
 * (e.g. country and city under `hasGeoreference → hasProjectLocation`)
 * reuse the intermediate variables for a compact OPTIONAL block. A bare name
 * the domain reaches through several chains that can hold the value gets an
 * OPTIONAL of its own around one UNION branch per chain, all binding the
 * key's variable; its value test stays outside, like every other filter's.
 *
 * Ontology-agnostic by design: no filter key is privileged, no
 * predicate name is literal, and the absence of any single path just
 * skips that filter without affecting the rest of the query.
 */
export function emitCrossDomainFilters(
  filterMap: Record<string, string | string[]>,
  vocabIndex: CompilerVocab,
  registry: DomainRegistry,
  optionals: string[],
  filters: string[],
  selectVars: string[],
  prefixCtx: { usedPrefixes: Set<string>; prefixLines: string[] }
): void {
  // Resolve each filter key in the first domain that knows it. Skip keys
  // with no path in any registered domain.
  type Entry = { key: string; value: string | string[]; path: PropertyPath }
  const resolved: Entry[] = []
  const alternatives: { key: string; value: string | string[]; paths: PropertyPath[] }[] = []
  const indexKeys = [...vocabIndex.paths.keys(), ...(vocabIndex.alternatives?.keys() ?? [])]
  for (const [key, value] of Object.entries(filterMap)) {
    if (!isNonEmpty(value)) continue
    const domain = indexKeys
      .filter((indexKey) => indexKey.endsWith(`:${key}`))
      .map((indexKey) => indexKey.slice(0, indexKey.indexOf(':')))
      .sort()[0]
    const resolution = domain ? resolveDomainKey(vocabIndex, domain, key, value) : undefined
    if (resolution?.kind === 'path') {
      resolved.push({ key, value, path: resolution.path })
    } else if (resolution?.kind === 'alternatives') {
      alternatives.push({ key, value, paths: resolution.paths })
    } else {
      log.warn('Cross-domain filter skipped — no SHACL property path discovered for key', { key })
    }
  }

  if (resolved.length === 0 && alternatives.length === 0) return

  const ensurePrefix = (predicateIri: string): string => {
    const desc = findDomainForIri(predicateIri, registry)
    if (desc && !prefixCtx.usedPrefixes.has(desc.name)) {
      prefixCtx.usedPrefixes.add(desc.name)
      prefixCtx.prefixLines.push(`PREFIX ${desc.prefix}: <${desc.namespace}>`)
    }
    return desc ? prefixedPredicate(predicateIri, desc) : `<${predicateIri}>`
  }

  // Bucket by path prefix (steps[0..n-2]) so filters that share an
  // intermediate chain reuse variables. Sorted prefix keys keep the
  // emitted SPARQL deterministic across compiler invocations.
  type Bucket = { referencePath: PropertyPath; entries: Entry[] }
  const buckets = new Map<string, Bucket>()
  for (const entry of resolved) {
    const prefixKey = pathPrefixKey(entry.path)
    let bucket = buckets.get(prefixKey)
    if (!bucket) {
      bucket = { referencePath: entry.path, entries: [] }
      buckets.set(prefixKey, bucket)
    }
    bucket.entries.push(entry)
  }

  let bucketIdx = 0
  for (const [, bucket] of [...buckets].sort(([a], [b]) => a.localeCompare(b))) {
    const path = bucket.referencePath
    const optionalLines: string[] = ['OPTIONAL {']
    let cursor = '?asset'
    // Walk all steps except the leaf; the leaf gets per-entry emission.
    for (let i = 0; i < path.steps.length - 1; i++) {
      const step = path.steps[i]!
      const intVar = i === path.steps.length - 2 ? `?_xd${bucketIdx}_end` : `?_xd${bucketIdx}_${i}`
      const pred = ensurePrefix(step.predicate)
      optionalLines.push(`    ${cursor} ${pred} ${intVar} .`)
      cursor = intVar
    }
    // Emit leaves and FILTERs.
    const sortedEntries = [...bucket.entries].sort((a, b) => a.key.localeCompare(b.key))
    for (const { key, value, path: leafPath } of sortedEntries) {
      const leafStep = leafPath.steps[leafPath.steps.length - 1]!
      const leafPred = ensurePrefix(leafStep.predicate)
      const v = leafVariable(key)
      optionalLines.push(`    ${cursor} ${leafPred} ${v} .`)
      if (leafPath.leafKind === 'literal') {
        addEnumFilter(filters, v, value, leafPath.datatype)
      } else {
        addLocationFilter(filters, v, value)
      }
      selectVars.push(v)
    }
    optionalLines.push('  }')
    optionals.push(optionalLines.join('\n'))
    bucketIdx++
  }

  for (const [entryIdx, { key, value, paths }] of alternatives
    .sort((a, b) => a.key.localeCompare(b.key))
    .entries()) {
    const v = leafVariable(key)
    const branches = paths.map((path, branchIdx) => {
      const lines: string[] = []
      let cursor = '?asset'
      for (let i = 0; i < path.steps.length - 1; i++) {
        const intVar = `?_xa${entryIdx}_${branchIdx}_${i}`
        lines.push(`${cursor} ${ensurePrefix(path.steps[i]!.predicate)} ${intVar} .`)
        cursor = intVar
      }
      lines.push(`${cursor} ${ensurePrefix(path.steps[path.steps.length - 1]!.predicate)} ${v} .`)
      return `    { ${lines.join(' ')} }`
    })
    const optionalLines = ['OPTIONAL {', branches.join('\n    UNION\n')]
    // One test for every chain: the comparison a datatype calls for applies
    // only when all chains declare that datatype.
    const datatypes = new Set(paths.map((path) => path.datatype))
    const datatype = datatypes.size === 1 ? paths[0]!.datatype : undefined
    if (paths.every((path) => path.leafKind === 'literal')) {
      addEnumFilter(filters, v, value, datatype)
    } else {
      addLocationFilter(filters, v, value)
    }
    optionalLines.push('  }')
    optionals.push(optionalLines.join('\n'))
    selectVars.push(v)
  }
}
