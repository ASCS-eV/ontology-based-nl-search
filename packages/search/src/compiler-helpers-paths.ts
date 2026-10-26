/**
 * Path-driven filter emission (ADR 0003 step 22d): walks SHACL-discovered
 * property paths to emit shallow shape-group and deep-chain filters, plus the
 * step-predicate lookups they use. Depends only on the primitives leaf.
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 */
import {
  type DomainDescriptor,
  type DomainRegistry,
} from '@ontology-search/ontology/domain-registry'

import {
  addEnumFilter,
  addLocationFilter,
  findDomainForIri,
  leafVariable,
  prefixedPredicate,
} from './compiler-helpers-primitives.js'
import { type CompilerVocab } from './compiler-vocab.js'
import { pathsThatCanHold } from './property-keys.js'
import { type PropertyPath } from './property-paths.js'

/** How a slot key resolves (ADR 0009). */
export type KeyResolution =
  | { kind: 'path'; path: PropertyPath }
  | { kind: 'alternatives'; paths: PropertyPath[] }
  | { kind: 'none' }

/**
 * Resolve a slot key against a keyed path index: the one path a key names;
 * or, for a bare name the index reaches through several chains, the chains
 * that can hold `value` ({@link pathsThatCanHold}) — collapsing to a single
 * path when only one can. Without a value (a range), every chain.
 */
export function resolveKey(
  paths: ReadonlyMap<string, PropertyPath>,
  alternatives: ReadonlyMap<string, PropertyPath[]> | undefined,
  indexKey: string,
  value?: string | string[]
): KeyResolution {
  const path = paths.get(indexKey)
  if (path) return { kind: 'path', path }
  const chains = alternatives?.get(indexKey)
  if (!chains || chains.length === 0) return { kind: 'none' }
  const candidates = value === undefined ? chains : pathsThatCanHold(chains, value)
  return candidates.length === 1
    ? { kind: 'path', path: candidates[0]! }
    : { kind: 'alternatives', paths: candidates }
}

/** {@link resolveKey} for a domain of the compiler vocabulary. */
export function resolveDomainKey(
  vocabIndex: CompilerVocab,
  domainName: string,
  key: string,
  value?: string | string[]
): KeyResolution {
  return resolveKey(vocabIndex.paths, vocabIndex.alternatives, `${domainName}:${key}`, value)
}

/**
 * Pick the step-N predicate to emit for the path of ANY property in the
 * given (domain, group) — used to discover the asset→spec and spec→group
 * predicates without hard-coding any specification/group predicate names.
 *
 * All filter/range properties classified into the same shape group share
 * the same step-N predicate (they live behind the same intermediate
 * shape in SHACL), so any of them is a valid representative. We pick
 * deterministically by sorting property names so the choice doesn't
 * shift across compiler invocations.
 */
export function lookupStepPredicate(
  vocabIndex: CompilerVocab,
  domain: DomainDescriptor,
  candidatePropNames: string[],
  stepIdx: number
): string | null {
  for (const propName of [...candidatePropNames].sort()) {
    const path = breadthFirstPathOf(vocabIndex, `${domain.name}:${propName}`)
    if (!path) continue
    const step = path.steps[stepIdx]
    if (step) return prefixedPredicate(step.predicate, domain)
  }
  return null
}

/**
 * The one path a name has apart from its alternate routes: the path a key
 * names, or the breadth-first chain of a bare name that only further routes
 * to the same class made ambiguous. A name with several chains of its own
 * has none, as before those routes were searched.
 */
function breadthFirstPathOf(vocabIndex: CompilerVocab, indexKey: string): PropertyPath | undefined {
  const path = vocabIndex.paths.get(indexKey)
  if (path) return path
  const own = (vocabIndex.alternatives?.get(indexKey) ?? []).filter((p) => !p.alternateRoute)
  return own.length === 1 ? own[0] : undefined
}

/**
 * The `sh:datatype` ([SHACL] §4.1.2) of a domain's leaf property, or
 * `undefined` when the domain has no discovered path to it or the shape
 * declares none. Keeps the comparison chosen for a leaf tied to the schema.
 */
export function lookupLeafDatatype(
  vocabIndex: CompilerVocab,
  domainName: string,
  propName: string
): string | undefined {
  return vocabIndex.paths.get(`${domainName}:${propName}`)?.datatype
}

/**
 * An asset → specification predicate (a first hop) for a domain: that of the
 * alphabetically-first shape-group property with a discovered path. A domain
 * need not nest every shape-group property under one specification node —
 * `sh:path` decides where each lives ([SHACL] §2.3), and `buildDomainPatterns`
 * emits one specification variable per distinct first hop — so this is only
 * the generic fallback for when the properties in a query have no path of
 * their own, which keeps the predicate from ever being hard-coded. Returns
 * null only when the domain declares no shape-group property with a
 * discovered path at all.
 */
export function lookupDomainSpecPredicate(
  vocabIndex: CompilerVocab,
  domain: DomainDescriptor
): string | null {
  return lookupStepPredicate(vocabIndex, domain, [...vocabIndex.shapeGroupPropertyNames], 0)
}

/**
 * Threshold (in path steps) above which a filter property is treated as
 * "deep" and emitted via {@link emitDeepFilters} rather than the
 * shape-group machinery.
 *
 * The shape-group emission assumes the canonical 3-hop shape
 * `asset → spec → group → leaf` — the depth produced by a
 * domain-specification meta-model. Paths longer than that
 * (e.g. a location leaf reached via `asset → spec → georef → loc → leaf`)
 * would route to a misclassified group predicate. Generic deep
 * emission walks the actual SHACL-discovered chain instead.
 */
export const SHALLOW_PATH_MAX_STEPS = 3

/**
 * Bucket key for intermediate-variable sharing: every non-leaf step's
 * predicate AND the SHACL class it reaches. Leaves owned by different node
 * shapes behind the same multi-valued predicate (e.g. several `sh:or`
 * alternatives of one content list — [SHACL] §4.6.3 `sh:or`, §4.7.1
 * `sh:node`) describe DIFFERENT value nodes; binding them to one SPARQL
 * variable would demand a single node conforming to all shapes at once and
 * return zero rows. Leaves of the same class still share the node.
 *
 * A leaf inherited from a superclass of the class reached (`inheritedLeaf`)
 * may sit on any value node of the hop, so it gets a bucket of its own: one
 * node per leaf matches data that splits the leaves across value nodes as well
 * as data that puts them on one (a solution maps each variable to one term,
 * [SPARQL11] §18.1.8).
 */
export function pathPrefixKey(path: PropertyPath): string {
  const prefix = pathNodeKey(path, path.steps.length - 1)
  return path.inheritedLeaf ? `${prefix}|${path.propertyIri}` : prefix
}

/**
 * Identity of the RDF node a discovered path reaches after `depth` hops: the
 * predicate and the class reached of every step walked so far. Two paths may
 * share a SPARQL variable for that node only when these agree — otherwise
 * they reach different nodes and binding them together is unsatisfiable. A
 * property shape is identified by its `sh:path` ([SHACL] §2.3), so the path —
 * not a property's name or group — decides node identity. {@link pathPrefixKey}
 * is this key for the node the leaf hangs off, so the deep-chain buckets and
 * the specification / group variables of `buildDomainPatterns` agree on what
 * one node is.
 */
export function pathNodeKey(path: Pick<PropertyPath, 'steps'>, depth: number): string {
  return path.steps
    .slice(0, depth)
    .map((s) => `${s.predicate}@${s.intermediate ?? ''}`)
    .join('|')
}

/**
 * Emit MANDATORY patterns for "direct" properties — those with a discovered
 * path but NO shape group anywhere (a flat ontology's `asset → leaf`, or any
 * schema not shaped like the specification meta-model).
 *
 * Each property's discovered path is walked straight from the asset variable;
 * properties that share a path prefix reuse the intermediate variables for a
 * compact query. Every emitted predicate comes from a discovered PathStep —
 * no specification/group predicate is fabricated. This is
 * the emission path that makes the compiler genuinely ontology-agnostic; the
 * shape-group machinery above stays the path for specification-shaped domains
 * so their output (and the determinism snapshots) are unchanged.
 */
export function emitDirectPathFilters(
  domainName: string,
  filterEntries: [string, string | string[], PropertyPath][],
  rangeEntries: [string, { min?: number; max?: number }, PropertyPath][],
  assetVar: string,
  suffix: string,
  patterns: string[],
  filters: string[],
  selectVars: Set<string>,
  foreignDomains: Set<string>,
  registry: DomainRegistry,
  vocabIndex: CompilerVocab
): void {
  type Entry =
    | { kind: 'filter'; name: string; value: string | string[]; path: PropertyPath }
    | { kind: 'range'; name: string; range: { min?: number; max?: number }; path: PropertyPath }
  const all: Entry[] = [
    ...filterEntries.map(([name, value, path]): Entry => ({ kind: 'filter', name, value, path })),
    ...rangeEntries.map(([name, range, path]): Entry => ({ kind: 'range', name, range, path })),
  ]

  // Compress a predicate IRI to prefix form, registering any foreign domain.
  const emitPredicate = (predicateIri: string): string => {
    const desc = findDomainForIri(predicateIri, registry)
    if (desc && desc.name !== domainName) foreignDomains.add(desc.name)
    return desc ? prefixedPredicate(predicateIri, desc) : `<${predicateIri}>`
  }

  // Bucket by shared path-prefix (every step except the leaf) so siblings
  // reuse intermediates. Sorted keys keep the emitted SPARQL deterministic.
  const buckets = new Map<string, { referencePath: PropertyPath; entries: Entry[] }>()
  for (const entry of all) {
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
    const refPath = bucket.referencePath
    // Walk steps[0..n-2] from the asset, binding shared intermediates.
    let cursor = assetVar
    for (let i = 0; i < refPath.steps.length - 1; i++) {
      const step = refPath.steps[i]!
      const intVar = `?_dp${bucketIdx}_${i}${suffix}`
      patterns.push(`${cursor} ${emitPredicate(step.predicate)} ${intVar} .`)
      cursor = intVar
    }

    for (const entry of [...bucket.entries].sort((a, b) => a.name.localeCompare(b.name))) {
      const leafStep = entry.path.steps[entry.path.steps.length - 1]!
      const leafPred = emitPredicate(leafStep.predicate)
      if (entry.kind === 'filter') {
        emitLeafFilter(
          cursor,
          leafPred,
          entry.name,
          suffix,
          entry.value,
          entry.path,
          patterns,
          filters,
          selectVars
        )
      } else {
        emitLeafRange(
          cursor,
          leafPred,
          entry.name,
          suffix,
          entry.range,
          entry.path,
          patterns,
          filters,
          selectVars,
          emitPredicate,
          vocabIndex
        )
      }
    }
    bucketIdx++
  }
}

/** Bind a filter's leaf from `cursor` and constrain it to `value`. */
function emitLeafFilter(
  cursor: string,
  leafPred: string,
  key: string,
  suffix: string,
  value: string | string[],
  path: PropertyPath,
  patterns: string[],
  filters: string[],
  selectVars: Set<string>
): void {
  const v = leafVariable(key, suffix)
  patterns.push(`${cursor} ${leafPred} ${v} .`)
  if (path.leafKind === 'literal') {
    addEnumFilter(filters, v, value, path.datatype)
  } else {
    addLocationFilter(filters, v, value)
  }
  selectVars.add(v)
}

/**
 * Bind a range's leaf from `cursor` and bound it. An interval leaf
 * (`range2DProperties`, keyed by leaf name) is compared through its
 * SHACL-discovered lower/upper predicates: a user `min` constrains the
 * interval's upper bound and vice versa.
 */
function emitLeafRange(
  cursor: string,
  leafPred: string,
  key: string,
  suffix: string,
  range: { min?: number; max?: number },
  path: PropertyPath,
  patterns: string[],
  filters: string[],
  selectVars: Set<string>,
  emitPredicate: (iri: string) => string,
  vocabIndex: CompilerVocab
): void {
  const range2D = vocabIndex.range2DProperties.get(path.propertyName)
  if (range2D) {
    const rangeNode = leafVariable(key, suffix, 'Range')
    patterns.push(`${cursor} ${leafPred} ${rangeNode} .`)
    if (range.min !== undefined) {
      const maxVar = leafVariable(key, suffix, 'Max')
      patterns.push(`${rangeNode} ${emitPredicate(range2D.maxPredicate)} ${maxVar} .`)
      filters.push(`FILTER(xsd:float(${maxVar}) >= ${range.min})`)
      selectVars.add(maxVar)
    }
    if (range.max !== undefined) {
      const minVar = leafVariable(key, suffix, 'Min')
      patterns.push(`${rangeNode} ${emitPredicate(range2D.minPredicate)} ${minVar} .`)
      filters.push(`FILTER(xsd:float(${minVar}) <= ${range.max})`)
      selectVars.add(minVar)
    }
    return
  }
  const v = leafVariable(key, suffix)
  patterns.push(`${cursor} ${leafPred} ${v} .`)
  selectVars.add(v)
  if (range.min !== undefined) filters.push(`FILTER(xsd:float(${v}) >= ${range.min})`)
  if (range.max !== undefined) filters.push(`FILTER(xsd:float(${v}) <= ${range.max})`)
}

/**
 * Emit the constraints whose key names several chains (a bare leaf name the
 * domain reaches more than one way, ADR 0009) as one `UNION` group each
 * ([SPARQL11] §7): a branch per chain walks the whole chain from the asset
 * with intermediates of its own and carries its own value test, and every
 * branch binds the key's variable, so the value is projected whichever chain
 * holds it. The branches share no node with the query's other constraints —
 * the key does not say which chain, so it cannot say which node either.
 *
 * Except with each other: constraints whose chains end on exactly the same
 * nodes ({@link pathPrefixKey}), the leaves of one class reached by the same
 * routes such as a latitude and a longitude, share one group. Each branch
 * walks one route once and tests every leaf on its node, so the leaves hold
 * on one node, as they do when the class has a single route. Constraints
 * whose nodes only overlap keep a group each.
 *
 * Branches follow the order of the chains (IRI-chain order) and the groups the
 * order of their first keys, so the SPARQL is deterministic.
 */
export function emitAlternativeConstraints(
  domainName: string,
  filterEntries: [string, string | string[], PropertyPath[]][],
  rangeEntries: [string, { min?: number; max?: number }, PropertyPath[]][],
  assetVar: string,
  suffix: string,
  patterns: string[],
  selectVars: Set<string>,
  foreignDomains: Set<string>,
  registry: DomainRegistry,
  vocabIndex: CompilerVocab
): void {
  const emitPredicate = (predicateIri: string): string => {
    const desc = findDomainForIri(predicateIri, registry)
    if (desc && desc.name !== domainName) foreignDomains.add(desc.name)
    return desc ? prefixedPredicate(predicateIri, desc) : `<${predicateIri}>`
  }
  type Entry =
    | { kind: 'filter'; key: string; value: string | string[]; paths: PropertyPath[] }
    | { kind: 'range'; key: string; range: { min?: number; max?: number }; paths: PropertyPath[] }
  const entries: Entry[] = [
    ...filterEntries.map(([key, value, paths]): Entry => ({ kind: 'filter', key, value, paths })),
    ...rangeEntries.map(([key, range, paths]): Entry => ({ kind: 'range', key, range, paths })),
  ].sort((a, b) => a.key.localeCompare(b.key) || a.kind.localeCompare(b.kind))

  // Branch i of a group walks the route of every entry's chain i, so only
  // entries that reach each of their nodes once can share one.
  const groups = new Map<string, Entry[]>()
  entries.forEach((entry, entryIdx) => {
    const nodes = entry.paths.map(pathPrefixKey)
    const group = new Set(nodes).size === nodes.length ? nodes.join('\n') : `#${entryIdx}`
    groups.set(group, [...(groups.get(group) ?? []), entry])
  })
  ;[...groups.values()].forEach((group, groupIdx) => {
    const branches = group[0]!.paths.map((route, branchIdx) => {
      const lines: string[] = []
      const tests: string[] = []
      let cursor = assetVar
      for (let i = 0; i < route.steps.length - 1; i++) {
        const intVar = `?_alt${groupIdx}_${branchIdx}_${i}${suffix}`
        lines.push(`${cursor} ${emitPredicate(route.steps[i]!.predicate)} ${intVar} .`)
        cursor = intVar
      }
      for (const entry of group) {
        const path = entry.paths[branchIdx]!
        const leafPred = emitPredicate(path.steps[path.steps.length - 1]!.predicate)
        if (entry.kind === 'filter') {
          emitLeafFilter(
            cursor,
            leafPred,
            entry.key,
            suffix,
            entry.value,
            path,
            lines,
            tests,
            selectVars
          )
        } else {
          emitLeafRange(
            cursor,
            leafPred,
            entry.key,
            suffix,
            entry.range,
            path,
            lines,
            tests,
            selectVars,
            emitPredicate,
            vocabIndex
          )
        }
      }
      return `{\n    ${[...lines, ...tests].join('\n    ')}\n  }`
    })
    patterns.push(branches.join('\n  UNION\n  '))
  })
}

/**
 * Emit a deep-chain filter group. Each entry's discovered path has
 * `> SHALLOW_PATH_MAX_STEPS` steps; emission walks every step from the
 * specification variable its first hop binds (`specVarOf`) to the leaf,
 * sharing intermediate variables whenever multiple entries agree on a path
 * prefix.
 *
 * Generic over which properties qualify as "deep" — driven entirely by
 * the SHACL property-path discovery, with no hard-coded field names.
 *
 * Variable naming: intermediates use `?_dN_${suffix}` where N is the
 * depth from the bucket's specification variable (which is itself step 1's
 * source — the compiler has already emitted the asset → spec hop). Leaves
 * use the filter property's local name, suffixed for cross-domain queries.
 */
export function emitDeepFilters(
  domainName: string,
  domain: DomainDescriptor,
  entries: [string, string | string[], PropertyPath][],
  specVarOf: (path: PropertyPath) => string,
  suffix: string,
  patterns: string[],
  filters: string[],
  selectVars: Set<string>,
  foreignDomains: Set<string>,
  registry: DomainRegistry
): void {
  // Bucket entries by their full path-prefix (everything except the
  // leaf). Sharing a prefix means sharing intermediate variables.
  type Bucket = {
    referencePath: PropertyPath
    entries: [string, string | string[], PropertyPath][]
  }
  const buckets = new Map<string, Bucket>()
  for (const entry of entries) {
    const path = entry[2]
    const prefixKey = pathPrefixKey(path)
    let bucket = buckets.get(prefixKey)
    if (!bucket) {
      bucket = { referencePath: path, entries: [] }
      buckets.set(prefixKey, bucket)
    }
    bucket.entries.push(entry)
  }

  let bucketIdx = 0
  // Sort by prefix key for deterministic SPARQL output.
  for (const [, bucket] of [...buckets].sort(([a], [b]) => a.localeCompare(b))) {
    const referencePath = bucket.referencePath
    // Walk steps[1..n-2] — step 0 is the asset → spec edge already
    // emitted by buildDomainPatterns, and step n-1 (the leaf) gets a
    // per-entry emission below. The starting node is resolved from this
    // bucket's own path: a domain whose properties hang off several
    // top-level containers has one spec variable per distinct first hop,
    // and binding a chain to the wrong one makes the query unsatisfiable.
    let cursor = specVarOf(referencePath)
    for (let i = 1; i < referencePath.steps.length - 1; i++) {
      const step = referencePath.steps[i]!
      const intVar = `?_d${bucketIdx}_${i}${suffix}`
      const desc = findDomainForIri(step.predicate, registry)
      const pred = desc ? prefixedPredicate(step.predicate, desc) : `<${step.predicate}>`
      if (desc && desc.name !== domainName) foreignDomains.add(desc.name)
      patterns.push(`${cursor} ${pred} ${intVar} .`)
      cursor = intVar
    }
    // Emit leaf for each entry under this shared chain. Sort for
    // determinism so the compiler emits the same SPARQL across
    // invocations regardless of the input map's iteration order.
    const sortedEntries = [...bucket.entries].sort((a, b) => a[0].localeCompare(b[0]))
    for (const [propName, value, path] of sortedEntries) {
      const leafStep = path.steps[path.steps.length - 1]!
      const leafDomain = findDomainForIri(leafStep.predicate, registry)
      const leafPredicate = leafDomain
        ? prefixedPredicate(leafStep.predicate, leafDomain)
        : `<${leafStep.predicate}>`
      if (leafDomain && leafDomain.name !== domainName) foreignDomains.add(leafDomain.name)
      // The leaf value kind picks the test: literal leaves want exact
      // equality, IRI-typed (`iri` / `class:`) leaves STR/LCASE matching.
      emitLeafFilter(
        cursor,
        leafPredicate,
        propName,
        suffix,
        value,
        path,
        patterns,
        filters,
        selectVars
      )
    }
    bucketIdx++
  }
  // The reference to `domain` is intentional for future extension —
  // currently only the leaf domain matters, but `domain` is the
  // primary asset domain context for any cross-domain warnings.
  void domain
}
