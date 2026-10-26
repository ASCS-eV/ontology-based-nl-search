/**
 * Per-domain SPARQL pattern builder — the shape-group / deep / direct filter
 * dispatcher for one asset domain.
 *
 * Extracted verbatim from `compiler.ts` (ADR 0003 step 22c) to bring the
 * compiler core under the file-size budget. Pure move: `buildDomainPatterns`
 * reads only the discovered SHACL structure (paths, shape groups) via the
 * helpers and emits triples/filters for a single domain. One-way dep
 * (compiler / cross-domain → domain-patterns → helpers); nothing here imports
 * the compile core, so there is no cycle.
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 */
import { CompileError } from '@ontology-search/core/errors'
import {
  buildDomainRegistry,
  type DomainDescriptor,
} from '@ontology-search/ontology/domain-registry'

import { classifyProperty, resolvePropertyPrefix } from './compiler-helpers-domains.js'
import {
  emitAlternativeConstraints,
  emitDeepFilters,
  emitDirectPathFilters,
  lookupDomainSpecPredicate,
  lookupLeafDatatype,
  resolveDomainKey,
  SHALLOW_PATH_MAX_STEPS,
} from './compiler-helpers-paths.js'
import {
  addEnumFilter,
  findDomainForIri,
  groupPredicate,
  groupVariableName,
  isNonEmpty,
  leafVariable,
  prefixedPredicate,
} from './compiler-helpers-primitives.js'
import { type CompilerVocab } from './compiler-vocab.js'
import { type PropertyPath } from './property-paths.js'

/**
 * Build patterns for a single domain's filters within the discovered
 * SHACL graph structure. Returns the set of foreign domain names whose
 * prefixes were used in patterns (i.e., properties that belong to a
 * different domain than domainName).
 *
 * Filters split into two emission paths:
 *
 *   - **Shallow** (path ≤ 3 steps): emitted via the shape-group
 *     machinery — properties classified by their SHACL parent shape's
 *     `rdfs:subClassOf` superclass, then grouped into `asset → spec →
 *     hasGroup → leaf` triples that share intermediate variables.
 *   - **Deep** (path > 3 steps): emitted by walking the full
 *     SHACL-discovered chain via {@link emitDeepFilters}, grouped by
 *     shared path prefix so multiple deep filters under the same
 *     intermediate (e.g. two leaves under the same intermediate node)
 *     reuse the same chain emission.
 *
 * No ontology-specific field names are referenced. The compiler reads
 * which filters are "deep" purely from the SHACL graph at runtime.
 */
export function buildDomainPatterns(
  domainName: string,
  domain: DomainDescriptor,
  domainFilters: Record<string, string | string[]>,
  ranges: Record<string, { min?: number; max?: number }>,
  patterns: string[],
  filters: string[],
  optionals: string[],
  selectVars: Set<string>,
  vocabIndex: CompilerVocab,
  registry: Awaited<ReturnType<typeof buildDomainRegistry>>,
  assetVar: string,
  specVar: string
): Set<string> {
  const foreignDomains = new Set<string>()
  const allFilterEntries = Object.entries(domainFilters)
  const rangeEntries = Object.entries(ranges)

  // Partition filter entries by path depth. Deep filters skip the shape-
  // group classification entirely — they walk their own discovered chain.
  // Empty values (empty string, empty array) are dropped before partition
  // — a dangling triple with no FILTER would otherwise return zero rows
  // silently. This is the analogue of the `isNonEmpty` gate the previous
  // typed-location code applied per field.
  // Partition entries into three emission strategies, all driven by the
  // SHACL-discovered property path:
  //   - SHAPE-GROUP: a property classified into a discovered shape group
  //     (the `asset → specification → group → leaf` meta-model). Emitted
  //     by the shape-group machinery below.
  //   - DEEP: a path longer than the shape-group standard — walked from the
  //     spec variable via emitDeepFilters. Only a deep path that starts with
  //     the domain's asset → specification hop can hang off the spec
  //     variable; one that starts elsewhere (a leaf inherited from a
  //     superclass shape under another hop, say) is walked from the asset
  //     like a direct property, with its own first hop.
  //   - DIRECT: a property with NO shape group anywhere (a flat ontology's
  //     `asset → leaf`, or any non-meta-model schema). Walked straight from
  //     the asset variable — no fabricated specification/group hops. This is
  //     what makes the compiler work on a schema that is not shaped like the
  //     specification meta-model.
  // Empty values are dropped (a dangling triple with no FILTER returns zero
  // rows silently); a property with no discoverable path is left to the
  // shape-group fallback rather than walked.
  //
  // Every key is resolved first (ADR 0009). A bare name the domain reaches
  // through several chains, of which more than one can hold the value, is
  // ALTERNATIVE: emitted as one UNION group. Every other key resolves to one
  // path (or none) and goes to the strategies above; its leaf name — what the
  // shape-group machinery classifies and builds the leaf predicate from — is
  // the path's, not the key's, since a qualified key is not a leaf name.
  const shapeGroupFilterEntries: [string, string | string[], PropertyPath | undefined][] = []
  const deepFilterEntries: [string, string | string[], PropertyPath][] = []
  const directFilterEntries: [string, string | string[], PropertyPath][] = []
  const alternativeFilterEntries: [string, string | string[], PropertyPath[]][] = []
  const domainSpecPredicate = lookupDomainSpecPredicate(vocabIndex, domain)
  const startsAtSpecHop = (path: PropertyPath) =>
    domainSpecPredicate === null ||
    (path.steps[0] !== undefined &&
      prefixedPredicate(path.steps[0].predicate, domain) === domainSpecPredicate)
  for (const [key, value] of allFilterEntries) {
    if (!isNonEmpty(value)) continue
    const resolved = resolveDomainKey(vocabIndex, domainName, key, value)
    if (resolved.kind === 'alternatives') {
      alternativeFilterEntries.push([key, value, resolved.paths])
      continue
    }
    const path = resolved.kind === 'path' ? resolved.path : undefined
    if (path && path.steps.length > SHALLOW_PATH_MAX_STEPS) {
      if (startsAtSpecHop(path)) deepFilterEntries.push([key, value, path])
      else directFilterEntries.push([key, value, path])
    } else if (path && !vocabIndex.shapeGroupPropertyNames.has(path.propertyName)) {
      directFilterEntries.push([key, value, path])
    } else {
      shapeGroupFilterEntries.push([key, value, path])
    }
  }

  const shapeGroupRangeEntries: [
    string,
    { min?: number; max?: number },
    PropertyPath | undefined,
  ][] = []
  const directRangeEntries: [string, { min?: number; max?: number }, PropertyPath][] = []
  const alternativeRangeEntries: [string, { min?: number; max?: number }, PropertyPath[]][] = []
  for (const [key, range] of rangeEntries) {
    const resolved = resolveDomainKey(vocabIndex, domainName, key)
    if (resolved.kind === 'alternatives') {
      alternativeRangeEntries.push([key, range, resolved.paths])
      continue
    }
    const path = resolved.kind === 'path' ? resolved.path : undefined
    if (path && !vocabIndex.shapeGroupPropertyNames.has(path.propertyName)) {
      directRangeEntries.push([key, range, path])
    } else {
      shapeGroupRangeEntries.push([key, range, path])
    }
  }
  /** The leaf name a shape-group entry classifies and emits by. */
  const leafNameOf = (key: string, path: PropertyPath | undefined) => path?.propertyName ?? key
  /**
   * The step-`idx` predicate of the first entry (by key) that has that step:
   * its resolved path, else the domain's path of that key. Every property of
   * one shape group shares its leading hops, so any one is representative.
   */
  const stepPredicateOf = (
    entries: { key: string; path: PropertyPath | undefined }[],
    idx: number
  ): string | null => {
    for (const { key, path } of [...entries].sort((a, b) => a.key.localeCompare(b.key))) {
      const step = (path ?? vocabIndex.paths.get(`${domainName}:${key}`))?.steps[idx]
      if (step) return prefixedPredicate(step.predicate, domain)
    }
    return null
  }
  /**
   * The leaf predicate of a shape-group entry: the resolved path's own leaf
   * when the key named one (a qualified key is no local name to build a
   * predicate from), else `<prefix>:<leaf name>` by convention.
   */
  const leafPredicateOf = (propPrefix: string, key: string, path: PropertyPath | undefined) => {
    const leaf = path?.steps[path.steps.length - 1]
    if (!leaf) return `${propPrefix}:${key}`
    const desc = findDomainForIri(leaf.predicate, registry)
    // The leaf may live in another domain's namespace; its prefix must then be
    // declared, like every other foreign predicate the query emits.
    if (desc && desc.name !== domainName) foreignDomains.add(desc.name)
    return desc ? prefixedPredicate(leaf.predicate, desc) : `<${leaf.predicate}>`
  }

  // Group shallow filter entries AND range entries by their classified
  // shape group, discovered from the SHACL graph at runtime (see
  // `queryPropertyShapeGroups`). There is no enumerated allow-list and no
  // privileged group — any shape group declared in the ontology is
  // handled uniformly, and each property's range is routed to the group
  // the SHACL graph actually puts it in.
  type FilterEntry = [string, string | string[], PropertyPath | undefined]
  type RangeEntry = [string, { min?: number; max?: number }, PropertyPath | undefined]
  const filterPropsByGroup = new Map<string, FilterEntry[]>()
  const rangePropsByGroup = new Map<string, RangeEntry[]>()
  // Properties the domain classifies into no shape group AND whose key has no
  // discovered path: nothing says how to reach them, so they are walked from
  // the asset by the domain prefix convention (`prefix:propName`). A key that
  // DID resolve to a path never lands here — see `unclassified` below.
  const directFallbackFilters: FilterEntry[] = []
  const directFallbackRanges: RangeEntry[] = []
  /**
   * A property whose leaf name carries a shape group in SOME domain, but not
   * in THIS one, still reaches its leaf through the chain its own path
   * declares. Walking it from the asset by its leaf predicate alone would drop
   * every intermediate hop and match nothing (a leaf nested two hops down is
   * not a property of the asset). Route it to the path-walking emission and
   * keep the prefix-convention fallback for keys with no path at all.
   */
  const unclassified = <V>(
    entry: [string, V, PropertyPath | undefined],
    withPath: [string, V, PropertyPath][],
    withoutPath: [string, V, PropertyPath | undefined][]
  ): void => {
    const [key, value, path] = entry
    if (path) withPath.push([key, value, path])
    else withoutPath.push(entry)
  }

  for (const entry of shapeGroupFilterEntries) {
    const shape = classifyProperty(leafNameOf(entry[0], entry[2]), domainName, vocabIndex)
    if (shape === null) {
      unclassified(entry, directFilterEntries, directFallbackFilters)
      continue
    }
    let bucket = filterPropsByGroup.get(shape)
    if (!bucket) {
      bucket = []
      filterPropsByGroup.set(shape, bucket)
    }
    bucket.push(entry)
  }

  for (const entry of shapeGroupRangeEntries) {
    const shape = classifyProperty(leafNameOf(entry[0], entry[2]), domainName, vocabIndex)
    if (shape === null) {
      unclassified(entry, directRangeEntries, directFallbackRanges)
      continue
    }
    let bucket = rangePropsByGroup.get(shape)
    if (!bucket) {
      bucket = []
      rangePropsByGroup.set(shape, bucket)
    }
    bucket.push(entry)
  }

  // The asset → DomainSpecification hop is needed only by the shape-group and
  // deep strategies (both route through `specVar`); direct properties walk
  // straight from the asset, so a purely-flat domain emits no spec hop at all.
  const needsSpecHop =
    filterPropsByGroup.size > 0 || rangePropsByGroup.size > 0 || deepFilterEntries.length > 0
  const hasAnyEntry =
    needsSpecHop ||
    directFilterEntries.length > 0 ||
    directRangeEntries.length > 0 ||
    alternativeFilterEntries.length > 0 ||
    alternativeRangeEntries.length > 0 ||
    directFallbackFilters.length > 0 ||
    directFallbackRanges.length > 0

  if (!hasAnyEntry) return foreignDomains

  const suffix = assetVar === '?asset' ? '' : `_${domainName.replace(/-/g, '_')}`

  /**
   * Identity of the RDF node a discovered path reaches after `depth` hops:
   * the predicate and the intermediate class of every step walked so far.
   * Two paths may share a SPARQL variable only when these agree — otherwise
   * they reach different nodes and binding them together is unsatisfiable.
   * A property shape is identified by its `sh:path` ([SHACL] §2.3), so the
   * path — not a property's name or group — decides node identity.
   */
  const nodeKey = (path: PropertyPath | undefined, depth: number): string =>
    path === undefined
      ? ''
      : path.steps
          .slice(0, depth)
          .map((s) => `${s.predicate}@${s.intermediate ?? ''}`)
          .join('|')

  /** First-hop node identity → the spec variable bound by that hop. */
  const specVarByFirstHop = new Map<string, string>()

  if (needsSpecHop) {
    // First hop: asset → specification node. The predicate is discovered from
    // the properties' own paths. A domain need NOT funnel everything through
    // a single specification node: `sh:path` ([SHACL] §2.3) is the only
    // authority on where a property lives, and a schema may hang its
    // properties off several top-level containers. Each distinct first hop
    // then reaches a different node and gets its own variable and its own
    // triple. Collapsing them onto one variable would demand that one node
    // satisfy every container's constraints at once — an unsatisfiable query
    // that silently returns nothing. When the properties in this query have
    // no path of their own, fall back to any shape-group property in the same
    // domain — never to a hard-coded predicate name.
    const candidatePaths = [
      ...shapeGroupFilterEntries.map(([key, , path]) => ({ key, path })),
      ...deepFilterEntries.map(([key, , path]) => ({ key, path })),
      ...shapeGroupRangeEntries.map(([key, , path]) => ({ key, path })),
    ]
    const firstHops = new Map<string, string>()
    for (const { key, path } of [...candidatePaths].sort((a, b) => a.key.localeCompare(b.key))) {
      const resolved = path ?? vocabIndex.paths.get(`${domainName}:${key}`)
      const step = resolved?.steps[0]
      if (!step) continue
      const hopKey = nodeKey(resolved, 1)
      if (!firstHops.has(hopKey)) firstHops.set(hopKey, prefixedPredicate(step.predicate, domain))
    }
    if (firstHops.size === 0) {
      const fallback = lookupDomainSpecPredicate(vocabIndex, domain)
      if (!fallback) {
        throw new CompileError(
          `Cannot determine the asset→specification predicate for domain "${domainName}": ` +
            `no shape-group property has a discovered SHACL path. The schema declares shape ` +
            `groups whose property paths could not be resolved.`
        )
      }
      firstHops.set('', fallback)
    }
    let hopIdx = 0
    for (const [hopKey, predicate] of firstHops) {
      const hopVar = hopIdx === 0 ? specVar : `${specVar}_s${hopIdx + 1}`
      specVarByFirstHop.set(hopKey, hopVar)
      patterns.push(`${assetVar} ${predicate} ${hopVar} .`)
      hopIdx++
    }
  }

  /** The spec variable a path's chain continues from. */
  const primarySpecVar = [...specVarByFirstHop.values()][0] ?? specVar
  const specVarOf = (path: PropertyPath | undefined): string =>
    specVarByFirstHop.get(nodeKey(path, 1)) ?? primarySpecVar

  const groupsToEmit = new Set<string>([...filterPropsByGroup.keys(), ...rangePropsByGroup.keys()])

  /** Base group-variable name → how many buckets have already claimed it. */
  const groupVarUses = new Map<string, number>()

  for (const group of [...groupsToEmit].sort()) {
    // Pre-resolve all property prefixes and sub-group by prefix AND by the
    // node each property's discovered path actually reaches.
    // Properties from different ontology domains may live on separate RDF
    // nodes even when they share the same shape group (two domains' group
    // nodes reachable via the same group predicate). Binding them
    // to the same SPARQL variable would produce an unsatisfiable pattern.
    // The same is true within one domain: a shape group is identified by the
    // shape that declares it and its `sh:path` ([SHACL] §2.3), so it names a
    // CLASS of node, not a singleton — one asset may reach many nodes of that
    // class through different predicates. Keying the bucket on the path
    // prefix as well as the prefix ensures each type-disjoint node gets its
    // own variable and its own group triple.
    const prefixBuckets = new Map<
      string,
      {
        foreignDomain: string | null
        prefix: string
        specVar: string
        filters: FilterEntry[]
        ranges: RangeEntry[]
      }
    >()

    const ensureBucket = (prefix: string, fd: string | null, path: PropertyPath | undefined) => {
      const bucketKey = `${prefix}\u0000${nodeKey(path, 2)}`
      let b = prefixBuckets.get(bucketKey)
      if (!b) {
        b = {
          foreignDomain: fd,
          prefix,
          specVar: specVarOf(path),
          filters: [],
          ranges: [],
        }
        prefixBuckets.set(bucketKey, b)
      }
      return b
    }

    for (const entry of filterPropsByGroup.get(group) ?? []) {
      const { prefix: pp, foreignDomain: fd } = resolvePropertyPrefix(
        leafNameOf(entry[0], entry[2]),
        domainName,
        vocabIndex,
        registry
      )
      ensureBucket(pp, fd, entry[2]).filters.push(entry)
    }

    for (const entry of rangePropsByGroup.get(group) ?? []) {
      const { prefix: pp, foreignDomain: fd } = resolvePropertyPrefix(
        leafNameOf(entry[0], entry[2]),
        domainName,
        vocabIndex,
        registry
      )
      ensureBucket(pp, fd, entry[2]).ranges.push(entry)
    }

    // Emit each bucket with its own hasGroup binding variable.
    for (const [, bucket] of [...prefixBuckets].sort(([a], [b]) => a.localeCompare(b))) {
      const propPrefix = bucket.prefix
      // Foreign-domain properties get a prefix-qualified variable name to
      // avoid colliding with the native domain's group variable.
      const pfxTag = bucket.foreignDomain ? `_${propPrefix.replace(/-/g, '_')}` : ''
      // Sibling buckets of one group share a base name; the first keeps it
      // (so single-node schemas emit exactly as before) and each further
      // bucket is numbered.
      const groupVarBase = `?${groupVariableName(group)}${pfxTag}`
      const taken = groupVarUses.get(groupVarBase) ?? 0
      groupVarUses.set(groupVarBase, taken + 1)
      const groupVar = `${groupVarBase}${taken === 0 ? '' : `_${taken + 1}`}${suffix}`

      // Second hop: DomainSpecification → group sub-resource. Use
      // path-discovery (stepPredicateOf) for native-domain properties;
      // fall back to conventional `${prefix}:has${Group}` for foreign
      // domains or when discovery hasn't been run.
      const bucketEntries = [
        ...bucket.filters.map(([key, , path]) => ({ key, path })),
        ...bucket.ranges.map(([key, , path]) => ({ key, path })),
      ]
      const specToGroupPredicate = bucket.foreignDomain
        ? `${propPrefix}:${groupPredicate(group)}`
        : (stepPredicateOf(bucketEntries, 1) ?? `${domain.prefix}:${groupPredicate(group)}`)
      patterns.push(`${bucket.specVar} ${specToGroupPredicate} ${groupVar} .`)

      if (bucket.foreignDomain) foreignDomains.add(bucket.foreignDomain)

      // Filter properties in this bucket.
      for (const [key, value, path] of bucket.filters) {
        const varName = leafVariable(key, suffix)
        patterns.push(`${groupVar} ${leafPredicateOf(propPrefix, key, path)} ${varName} .`)
        addEnumFilter(
          filters,
          varName,
          value,
          path?.datatype ?? lookupLeafDatatype(vocabIndex, domainName, key)
        )
        selectVars.add(varName)
      }

      // Range properties in this bucket. Range2D properties (detected from
      // SHACL via `sh:node → Range2DShape`) use nested `min`/`max`; simple
      // numeric properties are filtered directly.
      for (const [key, range, path] of bucket.ranges) {
        const leafPredicate = leafPredicateOf(propPrefix, key, path)
        const range2D = vocabIndex.range2DProperties.get(leafNameOf(key, path))
        if (range2D) {
          const rangeNode = leafVariable(key, suffix, 'Range')
          patterns.push(`${groupVar} ${leafPredicate} ${rangeNode} .`)
          // Emit the SHACL-discovered min/max sub-predicates (prefix-compressed
          // when they live in a known namespace; full IRI otherwise). The
          // bound-overlap semantics are unchanged: a user `min` constrains the
          // interval's upper predicate, and vice-versa.
          const minDesc = findDomainForIri(range2D.minPredicate, registry)
          const maxDesc = findDomainForIri(range2D.maxPredicate, registry)
          const minPred = minDesc
            ? prefixedPredicate(range2D.minPredicate, minDesc)
            : `<${range2D.minPredicate}>`
          const maxPred = maxDesc
            ? prefixedPredicate(range2D.maxPredicate, maxDesc)
            : `<${range2D.maxPredicate}>`
          if (minDesc) foreignDomains.add(minDesc.name)
          if (maxDesc) foreignDomains.add(maxDesc.name)
          if (range.min !== undefined) {
            const maxVar = leafVariable(key, suffix, 'Max')
            patterns.push(`${rangeNode} ${maxPred} ${maxVar} .`)
            filters.push(`FILTER(xsd:float(${maxVar}) >= ${range.min})`)
            selectVars.add(maxVar)
          }
          if (range.max !== undefined) {
            const minVar = leafVariable(key, suffix, 'Min')
            patterns.push(`${rangeNode} ${minPred} ${minVar} .`)
            filters.push(`FILTER(xsd:float(${minVar}) <= ${range.max})`)
            selectVars.add(minVar)
          }
        } else {
          const varName = leafVariable(key, suffix)
          patterns.push(`${groupVar} ${leafPredicate} ${varName} .`)
          selectVars.add(varName)
          if (range.min !== undefined) {
            filters.push(`FILTER(xsd:float(${varName}) >= ${range.min})`)
          }
          if (range.max !== undefined) {
            filters.push(`FILTER(xsd:float(${varName}) <= ${range.max})`)
          }
        }
      }
    }
  }

  // Deep filters — paths longer than the shape-group standard. Emit
  // by walking each filter's discovered chain. Filters sharing a path
  // prefix (e.g. two location leaves under the same intermediate node)
  // reuse the same intermediate
  // variables for a compact query.
  if (deepFilterEntries.length > 0) {
    emitDeepFilters(
      domainName,
      domain,
      deepFilterEntries,
      specVarOf,
      suffix,
      patterns,
      filters,
      selectVars,
      foreignDomains,
      registry
    )
  }

  // Alternatives: a bare name for several chains — one UNION group per key,
  // each branch walking its whole chain from the asset.
  if (alternativeFilterEntries.length > 0 || alternativeRangeEntries.length > 0) {
    emitAlternativeConstraints(
      domainName,
      alternativeFilterEntries,
      alternativeRangeEntries,
      assetVar,
      suffix,
      patterns,
      selectVars,
      foreignDomains,
      registry,
      vocabIndex
    )
  }

  // Direct properties: no shape group anywhere, so walk each one's discovered
  // path straight from the asset variable (flat / non-meta-model schemas).
  if (directFilterEntries.length > 0 || directRangeEntries.length > 0) {
    emitDirectPathFilters(
      domainName,
      directFilterEntries,
      directRangeEntries,
      assetVar,
      suffix,
      patterns,
      filters,
      selectVars,
      foreignDomains,
      registry,
      vocabIndex
    )
  }

  // Emit direct-fallback properties: those with no discovered path AND no
  // shape group (flat ontology, unknown property). Walk directly from the
  // asset using the domain prefix convention: `prefix:propName`.
  if (directFallbackFilters.length > 0 || directFallbackRanges.length > 0) {
    for (const [key, value, path] of directFallbackFilters) {
      const varName = leafVariable(key, suffix)
      patterns.push(`${assetVar} ${leafPredicateOf(domain.prefix, key, path)} ${varName} .`)
      addEnumFilter(
        filters,
        varName,
        value,
        path?.datatype ?? lookupLeafDatatype(vocabIndex, domainName, key)
      )
      selectVars.add(varName)
    }
    for (const [key, range, path] of directFallbackRanges) {
      const varName = leafVariable(key, suffix)
      patterns.push(`${assetVar} ${leafPredicateOf(domain.prefix, key, path)} ${varName} .`)
      if (range.min !== undefined) {
        filters.push(`FILTER(${varName} >= ${range.min})`)
      }
      if (range.max !== undefined) {
        filters.push(`FILTER(${varName} <= ${range.max})`)
      }
      selectVars.add(varName)
    }
  }

  return foreignDomains
}
