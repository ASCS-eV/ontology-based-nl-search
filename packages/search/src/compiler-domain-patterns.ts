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

import {
  addEnumFilter,
  classifyProperty,
  emitDeepFilters,
  emitDirectPathFilters,
  findDomainForIri,
  groupPredicate,
  groupVariableName,
  isNonEmpty,
  lookupDomainSpecPredicate,
  lookupStepPredicate,
  prefixedPredicate,
  resolvePropertyPrefix,
  SHALLOW_PATH_MAX_STEPS,
} from './compiler-helpers.js'
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
  //     spec variable via emitDeepFilters.
  //   - DIRECT: a property with NO shape group anywhere (a flat ontology's
  //     `asset → leaf`, or any non-meta-model schema). Walked straight from
  //     the asset variable — no fabricated specification/group hops. This is
  //     what makes the compiler work on a schema that is not shaped like the
  //     specification meta-model.
  // Empty values are dropped (a dangling triple with no FILTER returns zero
  // rows silently); a property with no discoverable path is left to the
  // shape-group fallback rather than walked.
  const shapeGroupFilterEntries: [string, string | string[]][] = []
  const deepFilterEntries: [string, string | string[], PropertyPath][] = []
  const directFilterEntries: [string, string | string[], PropertyPath][] = []
  for (const [propName, value] of allFilterEntries) {
    if (!isNonEmpty(value)) continue
    const path = vocabIndex.paths.get(`${domainName}:${propName}`)
    if (path && path.steps.length > SHALLOW_PATH_MAX_STEPS) {
      deepFilterEntries.push([propName, value, path])
    } else if (path && !vocabIndex.shapeGroupPropertyNames.has(propName)) {
      directFilterEntries.push([propName, value, path])
    } else {
      shapeGroupFilterEntries.push([propName, value])
    }
  }

  const shapeGroupRangeEntries: [string, { min?: number; max?: number }][] = []
  const directRangeEntries: [string, { min?: number; max?: number }, PropertyPath][] = []
  for (const [propName, range] of rangeEntries) {
    const path = vocabIndex.paths.get(`${domainName}:${propName}`)
    if (path && !vocabIndex.shapeGroupPropertyNames.has(propName)) {
      directRangeEntries.push([propName, range, path])
    } else {
      shapeGroupRangeEntries.push([propName, range])
    }
  }

  // Group shallow filter entries AND range entries by their classified
  // shape group, discovered from the SHACL graph at runtime (see
  // `queryPropertyShapeGroups`). There is no enumerated allow-list and no
  // privileged group — any shape group declared in the ontology is
  // handled uniformly, and each property's range is routed to the group
  // the SHACL graph actually puts it in.
  const filterPropsByGroup = new Map<string, [string, string | string[]][]>()
  const rangePropsByGroup = new Map<string, [string, { min?: number; max?: number }][]>()
  // Properties whose domain has no shape groups at all — emitted directly
  // on the asset variable (flat ontology pattern).
  const directFallbackFilters: [string, string | string[]][] = []
  const directFallbackRanges: [string, { min?: number; max?: number }][] = []

  for (const [propName, value] of shapeGroupFilterEntries) {
    const shape = classifyProperty(propName, domainName, vocabIndex)
    if (shape === null) {
      directFallbackFilters.push([propName, value])
      continue
    }
    let bucket = filterPropsByGroup.get(shape)
    if (!bucket) {
      bucket = []
      filterPropsByGroup.set(shape, bucket)
    }
    bucket.push([propName, value])
  }

  for (const [propName, range] of shapeGroupRangeEntries) {
    const shape = classifyProperty(propName, domainName, vocabIndex)
    if (shape === null) {
      directFallbackRanges.push([propName, range])
      continue
    }
    let bucket = rangePropsByGroup.get(shape)
    if (!bucket) {
      bucket = []
      rangePropsByGroup.set(shape, bucket)
    }
    bucket.push([propName, range])
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
    directFallbackFilters.length > 0 ||
    directFallbackRanges.length > 0

  if (!hasAnyEntry) return foreignDomains

  const suffix = assetVar === '?asset' ? '' : `_${domainName.replace(/-/g, '_')}`

  if (needsSpecHop) {
    // First hop: asset → specification node. The predicate is discovered from
    // any shape-group/deep property's path (every such property in this domain
    // shares the first step). When the specific properties in this query have
    // no path of their own, fall back to any shape-group property in the same
    // domain — never to a hard-coded predicate name.
    const candidatePropertyNames = [
      ...shapeGroupFilterEntries.map(([n]) => n),
      ...deepFilterEntries.map(([n]) => n),
      ...shapeGroupRangeEntries.map(([n]) => n),
    ]
    const assetToSpecPredicate =
      lookupStepPredicate(vocabIndex, domain, candidatePropertyNames, 0) ??
      lookupDomainSpecPredicate(vocabIndex, domain)
    if (!assetToSpecPredicate) {
      throw new CompileError(
        `Cannot determine the asset→specification predicate for domain "${domainName}": ` +
          `no shape-group property has a discovered SHACL path. The schema declares shape ` +
          `groups whose property paths could not be resolved.`
      )
    }
    patterns.push(`${assetVar} ${assetToSpecPredicate} ${specVar} .`)
  }

  const groupsToEmit = new Set<string>([...filterPropsByGroup.keys(), ...rangePropsByGroup.keys()])

  for (const group of [...groupsToEmit].sort()) {
    // Pre-resolve all property prefixes and sub-group by prefix.
    // Properties from different ontology domains may live on separate RDF
    // nodes even when they share the same shape group (two domains' group
    // nodes reachable via the same group predicate). Binding them
    // to the same SPARQL variable would produce an unsatisfiable pattern.
    // Sub-grouping by prefix ensures each type-disjoint node gets its own
    // variable and its own `hasGroup` triple.
    const prefixBuckets = new Map<
      string,
      {
        foreignDomain: string | null
        filters: [string, string | string[]][]
        ranges: [string, { min?: number; max?: number }][]
      }
    >()

    const ensureBucket = (prefix: string, fd: string | null) => {
      let b = prefixBuckets.get(prefix)
      if (!b) {
        b = { foreignDomain: fd, filters: [], ranges: [] }
        prefixBuckets.set(prefix, b)
      }
      return b
    }

    for (const [propName, value] of filterPropsByGroup.get(group) ?? []) {
      const { prefix: pp, foreignDomain: fd } = resolvePropertyPrefix(
        propName,
        domainName,
        vocabIndex,
        registry
      )
      ensureBucket(pp, fd).filters.push([propName, value])
    }

    for (const [propName, range] of rangePropsByGroup.get(group) ?? []) {
      const { prefix: pp, foreignDomain: fd } = resolvePropertyPrefix(
        propName,
        domainName,
        vocabIndex,
        registry
      )
      ensureBucket(pp, fd).ranges.push([propName, range])
    }

    // Emit each prefix bucket with its own hasGroup binding variable.
    for (const [propPrefix, bucket] of [...prefixBuckets].sort(([a], [b]) => a.localeCompare(b))) {
      // Foreign-domain properties get a prefix-qualified variable name to
      // avoid colliding with the native domain's group variable.
      const pfxTag = bucket.foreignDomain ? `_${propPrefix.replace(/-/g, '_')}` : ''
      const groupVar = `?${groupVariableName(group)}${pfxTag}${suffix}`

      // Second hop: DomainSpecification → group sub-resource. Use
      // path-discovery (lookupStepPredicate) for native-domain properties;
      // fall back to conventional `${prefix}:has${Group}` for foreign
      // domains or when discovery hasn't been run.
      const bucketPropNames = [...bucket.filters.map(([n]) => n), ...bucket.ranges.map(([n]) => n)]
      const specToGroupPredicate = bucket.foreignDomain
        ? `${propPrefix}:${groupPredicate(group)}`
        : (lookupStepPredicate(vocabIndex, domain, bucketPropNames, 1) ??
          `${domain.prefix}:${groupPredicate(group)}`)
      patterns.push(`${specVar} ${specToGroupPredicate} ${groupVar} .`)

      if (bucket.foreignDomain) foreignDomains.add(bucket.foreignDomain)

      // Filter properties in this bucket.
      for (const [propName, value] of bucket.filters) {
        const varName = `?${propName}${suffix}`
        patterns.push(`${groupVar} ${propPrefix}:${propName} ${varName} .`)
        addEnumFilter(patterns, filters, varName, value)
        selectVars.add(varName)
      }

      // Range properties in this bucket. Range2D properties (detected from
      // SHACL via `sh:node → Range2DShape`) use nested `min`/`max`; simple
      // numeric properties are filtered directly.
      for (const [propName, range] of bucket.ranges) {
        const range2D = vocabIndex.range2DProperties.get(propName)
        if (range2D) {
          const rangeNode = `?${propName}Range${suffix}`
          patterns.push(`${groupVar} ${propPrefix}:${propName} ${rangeNode} .`)
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
            const maxVar = `?${propName}Max${suffix}`
            patterns.push(`${rangeNode} ${maxPred} ${maxVar} .`)
            filters.push(`FILTER(xsd:float(${maxVar}) >= ${range.min})`)
            selectVars.add(maxVar)
          }
          if (range.max !== undefined) {
            const minVar = `?${propName}Min${suffix}`
            patterns.push(`${rangeNode} ${minPred} ${minVar} .`)
            filters.push(`FILTER(xsd:float(${minVar}) <= ${range.max})`)
            selectVars.add(minVar)
          }
        } else {
          const varName = `?${propName}${suffix}`
          patterns.push(`${groupVar} ${propPrefix}:${propName} ${varName} .`)
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
      specVar,
      suffix,
      patterns,
      filters,
      selectVars,
      foreignDomains,
      registry
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
    for (const [propName, value] of directFallbackFilters) {
      const varName = `?${propName}${suffix}`
      patterns.push(`${assetVar} ${domain.prefix}:${propName} ${varName} .`)
      addEnumFilter(patterns, filters, varName, value)
      selectVars.add(varName)
    }
    for (const [propName, range] of directFallbackRanges) {
      const varName = `?${propName}${suffix}`
      patterns.push(`${assetVar} ${domain.prefix}:${propName} ${varName} .`)
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
