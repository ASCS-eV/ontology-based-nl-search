/**
 * Compiler emit helpers — the SPARQL-emit + classification leaf functions the
 * compiler core depends on.
 *
 * Extracted verbatim from `compiler.ts` (ADR 0003, decomposition step 1b) to
 * retire the god-file: this module owns the downward-closed cluster of pure
 * emit/lookup/partition helpers (query assembly, prefix/predicate resolution,
 * path-driven filter emission, reference-chain emission, domain partitioning).
 * The dependency is one-way (compiler → helpers): nothing here imports the
 * compile core, so there is no cycle. Pure move — no logic changed; the
 * determinism snapshot + no-drift suites are the guard.
 *
 * The `log` component label is intentionally `'compiler'` (not
 * `'compiler-helpers'`) so the moved functions' diagnostic output stays
 * byte-identical to before the move.
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 */
import { getConfig } from '@ontology-search/core/config'
import { CompileError } from '@ontology-search/core/errors'
import { createComponentLogger } from '@ontology-search/core/logging'
import { iri, sparqlPrefix } from '@ontology-search/core/rdf/prefixes'
import {
  buildDomainRegistry,
  type DomainDescriptor,
  type DomainRegistry,
} from '@ontology-search/ontology/domain-registry'
import { escapeSparqlLiteral, isIri } from '@ontology-search/sparql/escape'

import { type CompilerProperty, type CompilerVocab, getDomainReferences } from './compiler-vocab.js'
import { type PropertyPath, type ReferenceChain } from './property-paths.js'
import { type DataReferenceEdge, type ReferenceIndex } from './reference-index.js'
import type { TraceabilityStep } from './slots.js'
import { validateSparql } from './sparql-validator.js'

const log = createComponentLogger('compiler')

/**
 * Assemble a complete SPARQL SELECT query from its constituent parts.
 * Centralizes the query-tail pattern used by both single-domain and
 * cross-domain compilation. The LIMIT defaults to the operator-tunable
 * `SPARQL_DEFAULT_LIMIT` config field; the policy gate enforces the
 * separate `SPARQL_MAX_LIMIT` ceiling (the Zod schema rejects configs
 * where the default would exceed the ceiling).
 */
export function assembleQuery(
  prefixes: string,
  selectVars: string[] | Set<string>,
  patterns: string[],
  optionals: string[],
  filters: string[],
  limit: number = getConfig().SPARQL_DEFAULT_LIMIT,
  distinctSubjectVar?: string
): string {
  const vars = selectVars instanceof Set ? [...selectVars] : selectVars
  const selectClause = `SELECT ${vars.join(' ')}`
  const whereBody = [...patterns, ...optionals, ...filters].join('\n  ')

  let query: string
  if (distinctSubjectVar) {
    // Limit DISTINCT subjects, not rows. A cross-reference JOIN fans out (one
    // row per referenced asset), so a plain row-level LIMIT would silently
    // truncate distinct matching assets (a trace with 2 referenced maps eats 2
    // of the LIMIT). Select the limited distinct subjects in a sub-SELECT, then
    // re-state the body to bind every projected column for exactly those
    // subjects. The outer row cap is a safety net (SPARQL_MAX_LIMIT, which the
    // policy enforces anyway); the inner LIMIT is the real distinct-asset bound.
    const maxLimit = getConfig().SPARQL_MAX_LIMIT
    query =
      `${prefixes}\n${selectClause} WHERE {\n` +
      `  { SELECT DISTINCT ${distinctSubjectVar} WHERE {\n  ${whereBody}\n  } LIMIT ${limit} }\n` +
      `  ${whereBody}\n}\nLIMIT ${maxLimit}`
  } else {
    query = `${prefixes}\n${selectClause} WHERE {\n  ${whereBody}\n}\nLIMIT ${limit}`
  }

  // Post-assembly validation: catch syntax errors and W3C compliance issues
  const validation = validateSparql(query)
  if (!validation.valid) {
    log.error('Generated SPARQL has errors', undefined, { errors: validation.errors })
  }
  if (validation.warnings.length > 0) {
    log.warn('Generated SPARQL has warnings', { warnings: validation.warnings })
  }

  return query
}

/**
 * Detect whether the given domains have a parent-child referencing
 * relationship (one asset domain references another). Returns true only when
 * at least one domain in the set references another domain in the set.
 */
export function detectHierarchy(domains: string[], domainRefs: Map<string, Set<string>>): boolean {
  const domainSet = new Set(domains)
  for (const [parent, children] of domainRefs.entries()) {
    if (domainSet.has(parent)) {
      for (const child of children) {
        if (domainSet.has(child)) return true
      }
    }
  }
  return false
}

/**
 * Compress a full predicate IRI to a `prefix:localName` form when the
 * predicate lives in the given domain's namespace. Falls back to an
 * angle-bracketed full IRI so cross-namespace predicates (those in another
 * domain's namespace) still parse.
 *
 * Used by the path-driven emission to keep the wire output stable as
 * `prefix:localName` strings.
 */
export function prefixedPredicate(predicateIri: string, domain: DomainDescriptor): string {
  if (predicateIri.startsWith(domain.namespace)) {
    return `${domain.prefix}:${predicateIri.slice(domain.namespace.length)}`
  }
  return `<${predicateIri}>`
}

/**
 * Find the DomainDescriptor whose namespace matches a predicate IRI.
 * Used to resolve cross-domain predicates (a predicate IRI whose namespace
 * differs from the primary domain's) to their prefix for SPARQL emission.
 */
export function findDomainForIri(
  iri: string,
  registry: DomainRegistry
): DomainDescriptor | undefined {
  let bestDesc: DomainDescriptor | undefined
  let bestLen = 0
  for (const desc of registry.domains.values()) {
    if (iri.startsWith(desc.namespace) && desc.namespace.length > bestLen) {
      bestDesc = desc
      bestLen = desc.namespace.length
    }
  }
  return bestDesc
}

/**
 * Pick the cross-domain reference chain to use when joining `parentDomain`
 * to `childDomain` (or to any child, if `childDomain` is undefined).
 *
 * Strategy:
 *   1. Prefer a `class:`-typed chain whose declared child class matches
 *      the requested domain — that's a SHACL-declared direct reference
 *      to exactly the child asset class, no extra type constraint needed.
 *   2. Otherwise fall back to the shortest `iri`-typed chain — the
 *      compiler will pair it with a `?ref a <ChildClass>` constraint.
 *
 * Returns `null` when the ontology declares no cross-reference path from
 * the parent. The caller skips reference emission rather than inventing
 * a literal predicate chain.
 */
/**
 * Pick a data-driven reference edge from `parentDomain` to `childDomain`,
 * preferring the shortest predicate path (fewer hops → cheaper JOIN) and
 * breaking ties by sample count (more data backing → more likely the
 * intended link). Returns null when the index has observed no
 * connection between the two domains.
 */
export function pickDataReferenceEdge(
  index: ReferenceIndex,
  parentDomain: string,
  childDomain: string
): DataReferenceEdge | null {
  const edges = index.get(parentDomain)
  if (!edges) return null
  let best: DataReferenceEdge | null = null
  for (const e of edges) {
    if (e.targetDomain !== childDomain) continue
    if (
      !best ||
      e.predicatePath.length < best.predicatePath.length ||
      (e.predicatePath.length === best.predicatePath.length && e.sampleCount > best.sampleCount)
    ) {
      best = e
    }
  }
  return best
}

/**
 * Fallback for {@link pickDataReferenceEdge}: when no exact target match
 * exists, pick any sibling edge from the same parent domain. The reference
 * IRI edge is generic — the discovered chain
 * can point to any asset type. If the data index observed the parent
 * reaching *some* other domain via that path, the same path is valid for
 * the requested target (the caller adds the type constraint separately).
 *
 * Returns the shortest, highest-sample sibling edge, or null if the parent
 * has no outgoing edges at all.
 */
export function pickSiblingDataEdge(
  index: ReferenceIndex,
  parentDomain: string,
  excludeDomain?: string
): DataReferenceEdge | null {
  const edges = index.get(parentDomain)
  if (!edges) return null
  let best: DataReferenceEdge | null = null
  for (const e of edges) {
    if (excludeDomain && e.targetDomain === excludeDomain) continue
    if (
      !best ||
      e.predicatePath.length < best.predicatePath.length ||
      (e.predicatePath.length === best.predicatePath.length && e.sampleCount > best.sampleCount)
    ) {
      best = e
    }
  }
  // If nothing remained after excluding, pick from ALL edges (the excluded
  // domain's path is still the right structural template).
  if (!best) {
    for (const e of edges) {
      if (
        !best ||
        e.predicatePath.length < best.predicatePath.length ||
        (e.predicatePath.length === best.predicatePath.length && e.sampleCount > best.sampleCount)
      ) {
        best = e
      }
    }
  }
  return best
}

/**
 * Emit a SPARQL JOIN that walks the discovered predicate path step by
 * step, using fresh blank-node intermediates. The final step binds the
 * supplied `refVar` so the caller can constrain the child's type and
 * pull its label.
 *
 * Each predicate is emitted as a full `<IRI>` literal — that's the only
 * way to guarantee the query carries the exact path the index observed,
 * regardless of whether the prefix is registered.
 */
export function emitDataReferencePath(
  edge: DataReferenceEdge,
  sourceVar: string,
  refVar: string,
  patterns: string[],
  registry: DomainRegistry,
  prefixDomains: Set<string>,
  traceSteps?: TraceabilityStep[],
  // Intermediate-variable prefix. Each reference in a multi-reference query
  // MUST use a distinct prefix, otherwise the second reference's chain reuses
  // the first's step variables and forces one manifest artifact to be two
  // different asset types (an unsatisfiable JOIN). Defaults to `ref` so the
  // single-reference output is unchanged.
  stepPrefix: string = 'ref'
): void {
  let cursor = sourceVar
  for (let i = 0; i < edge.predicatePath.length; i++) {
    const isLast = i === edge.predicatePath.length - 1
    const next = isLast ? refVar : `?${stepPrefix}_step_${i + 1}`
    const predicate = edge.predicatePath[i]!
    // Mirror `emitReferenceChainTriples`: prefer the registered prefix
    // form when the predicate's namespace resolves, fall back to a full
    // `<IRI>` literal otherwise. Keeps the emitted SPARQL readable and
    // pulls in the predicate's domain prefix so the final PREFIX block
    // lists every namespace the query actually uses.
    const desc = findDomainForIri(predicate, registry)
    const pred = desc ? prefixedPredicate(predicate, desc) : `<${predicate}>`
    if (desc) prefixDomains.add(desc.name)
    patterns.push(`${cursor} ${pred} ${next} .`)
    traceSteps?.push({ variable: next.slice(1), predicate })
    cursor = next
  }
}

export function pickReferenceChain(
  vocabIndex: CompilerVocab,
  parentDomain: string,
  childDomain?: string
): ReferenceChain | null {
  const chains = vocabIndex.referenceChains.get(parentDomain)
  if (!chains || chains.length === 0) return null

  // Strategy 1: direct class-typed match.
  if (childDomain) {
    for (const chain of chains) {
      if (chain.kind === 'class' && chain.childDomain === childDomain) return chain
    }
  }

  // Strategy 2: shortest IRI-typed chain.
  for (const chain of chains) {
    if (chain.kind === 'iri') return chain
  }

  // Strategy 3: any class-typed chain (may resolve to a different child).
  return chains[0] ?? null
}

/**
 * Emit SPARQL triples for a cross-domain reference join driven by a
 * discovered {@link ReferenceChain}.
 *
 * Generates fresh intermediate variables for each step, binds the final
 * step's value to `boundVar`, and (for IRI-typed chains) adds a `?bound
 * a <childTargetClass>` constraint so the caller can filter to the
 * intended child asset domain.
 *
 * `idTag` disambiguates the intermediate variables when multiple
 * reference joins co-exist in the same query.
 */
export function emitReferenceChainTriples(
  chain: ReferenceChain,
  assetVar: string,
  boundVar: string,
  childTargetClass: string | null,
  registry: DomainRegistry,
  idTag: string,
  patterns: string[],
  prefixDomains: Set<string>,
  traceSteps?: TraceabilityStep[]
): void {
  let cursor = assetVar
  for (let i = 0; i < chain.steps.length; i++) {
    const step = chain.steps[i]!
    const isLast = i === chain.steps.length - 1
    const next = isLast ? boundVar : `?_${idTag}_${i}`
    const desc = findDomainForIri(step.predicate, registry)
    const pred = desc ? prefixedPredicate(step.predicate, desc) : `<${step.predicate}>`
    if (desc) prefixDomains.add(desc.name)
    patterns.push(`${cursor} ${pred} ${next} .`)
    traceSteps?.push({ variable: next.slice(1), predicate: step.predicate })
    cursor = next
  }
  if (childTargetClass && chain.kind === 'iri') {
    patterns.push(`${boundVar} a ${childTargetClass} .`)
  }
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
    const path = vocabIndex.paths.get(`${domain.name}:${propName}`)
    if (!path) continue
    const step = path.steps[stepIdx]
    if (step) return prefixedPredicate(step.predicate, domain)
  }
  return null
}

/**
 * The asset → specification predicate (the first hop) for a domain, derived
 * from any of its shape-group properties' discovered paths. Every shape-group
 * property in a domain nests under the same specification node, so they all
 * share this first hop — any one with a discovered path is a valid
 * representative. Used as a generic fallback when the specific properties in a
 * query have no path of their own, so the predicate is never hard-coded.
 * Returns null only when the domain declares no shape-group property with a
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
    const prefixKey = entry.path.steps
      .slice(0, -1)
      .map((s) => s.predicate)
      .join('|')
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
        const v = `?${entry.name}${suffix}`
        patterns.push(`${cursor} ${leafPred} ${v} .`)
        if (entry.path.leafKind === 'literal') {
          addEnumFilter(patterns, filters, v, entry.value)
        } else {
          addLocationFilter(filters, v, entry.value)
        }
        selectVars.add(v)
      } else {
        const range2D = vocabIndex.range2DProperties.get(entry.name)
        if (range2D) {
          const rangeNode = `?${entry.name}Range${suffix}`
          patterns.push(`${cursor} ${leafPred} ${rangeNode} .`)
          const minPred = emitPredicate(range2D.minPredicate)
          const maxPred = emitPredicate(range2D.maxPredicate)
          if (entry.range.min !== undefined) {
            const maxVar = `?${entry.name}Max${suffix}`
            patterns.push(`${rangeNode} ${maxPred} ${maxVar} .`)
            filters.push(`FILTER(xsd:float(${maxVar}) >= ${entry.range.min})`)
            selectVars.add(maxVar)
          }
          if (entry.range.max !== undefined) {
            const minVar = `?${entry.name}Min${suffix}`
            patterns.push(`${rangeNode} ${minPred} ${minVar} .`)
            filters.push(`FILTER(xsd:float(${minVar}) <= ${entry.range.max})`)
            selectVars.add(minVar)
          }
        } else {
          const v = `?${entry.name}${suffix}`
          patterns.push(`${cursor} ${leafPred} ${v} .`)
          selectVars.add(v)
          if (entry.range.min !== undefined) {
            filters.push(`FILTER(xsd:float(${v}) >= ${entry.range.min})`)
          }
          if (entry.range.max !== undefined) {
            filters.push(`FILTER(xsd:float(${v}) <= ${entry.range.max})`)
          }
        }
      }
    }
    bucketIdx++
  }
}

/**
 * Emit a deep-chain filter group. Each entry's discovered path has
 * `> SHALLOW_PATH_MAX_STEPS` steps; emission walks every step from
 * `?specVar` to the leaf, sharing intermediate variables whenever
 * multiple entries agree on a path prefix.
 *
 * Generic over which properties qualify as "deep" — driven entirely by
 * the SHACL property-path discovery, with no hard-coded field names.
 *
 * Variable naming: intermediates use `?_dN_${suffix}` where N is the
 * depth from `specVar` (which is itself step 1's source — the
 * compiler has already emitted the asset → spec hop). Leaves use the
 * filter property's local name, suffixed for cross-domain queries.
 */
export function emitDeepFilters(
  domainName: string,
  domain: DomainDescriptor,
  entries: [string, string | string[], PropertyPath][],
  specVar: string,
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
    const prefixKey = path.steps
      .slice(0, -1)
      .map((s) => s.predicate)
      .join('|')
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
    // per-entry emission below.
    let cursor = specVar
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
      const v = `?${propName}${suffix}`
      patterns.push(`${cursor} ${leafPredicate} ${v} .`)
      // Use the filter helper that matches the leaf's value kind.
      // `class:` leaves are IRI-typed and want STR/LCASE matching;
      // `iri` leaves likewise. Literal leaves want exact equality.
      if (path.leafKind === 'literal') {
        addEnumFilter(patterns, filters, v, value)
      } else {
        addLocationFilter(filters, v, value)
      }
      selectVars.add(v)
    }
    bucketIdx++
  }
  // The reference to `domain` is intentional for future extension —
  // currently only the leaf domain matters, but `domain` is the
  // primary asset domain context for any cross-domain warnings.
  void domain
}

/**
 * Partition filters into per-domain groups based on ontology graph.
 * Uses the ontology's property definitions to determine which domain each filter belongs to.
 * Handles properties that exist in multiple domains by checking against detected domains.
 */
export function partitionFiltersByDomain(
  filters: Record<string, string | string[]>,
  detectedDomains: string[],
  vocabIndex: CompilerVocab
): Record<string, Record<string, string | string[]>> {
  const result: Record<string, Record<string, string | string[]>> = {}

  // Defense-in-depth: drop any filter key the schema doesn't know about.
  // The slot validator should already have caught these and emitted a gap;
  // the compiler is the last gate before SPARQL so a non-existent property
  // never produces a `?asset domain:fakeProp ?x` triple that would match
  // zero results without explanation.
  const known: Record<string, string | string[]> = {}
  for (const [propName, value] of Object.entries(filters)) {
    if (isKnownProperty(propName, vocabIndex)) known[propName] = value
  }

  // Single domain — all known filters belong to it
  if (detectedDomains.length === 1) {
    result[detectedDomains[0]!] = { ...known }
    return result
  }

  // Multi-domain: find which detected domain owns each property. A
  // property local name may exist in MULTIPLE domains. Assign it to ALL
  // matching domains so UNION
  // queries work. Deep-chain leaves (which appear in `vocabIndex.paths`
  // but not in `vocabIndex.properties` because their owning shape's
  // target class lives in a different domain) are matched via the path
  // index so they reach the compiler.
  for (const [propName, value] of Object.entries(known)) {
    const owningDomains = ownersOf(propName, vocabIndex)
    const matchingDomains = detectedDomains.filter((d) => owningDomains.has(d))
    for (const matchingDomain of matchingDomains) {
      if (!result[matchingDomain]) result[matchingDomain] = {}
      result[matchingDomain]![propName] = value
    }
    // If property is not in any detected domain, drop it — the slot
    // validator should have already emitted a gap upstream.
  }

  return result
}

/**
 * Domains that "own" a given property local name — i.e. the set of
 * detected-domain candidates a multi-domain query partition should
 * consider. Combines the `queryPropertyDomains` index with the
 * property-path BFS so deep-chain leaves are matched the same way as
 * shallow leaves.
 */
function ownersOf(propName: string, vocabIndex: CompilerVocab): Set<string> {
  const owners = new Set<string>()
  const propInfo = vocabIndex.properties.get(propName)
  if (propInfo) {
    for (const d of propInfo.domains) owners.add(d)
  }
  for (const key of vocabIndex.paths.keys()) {
    const [pathDomain, pathProp] = key.split(':')
    if (pathProp === propName && pathDomain) owners.add(pathDomain)
  }
  return owners
}

/**
 * Partition ranges into per-domain groups based on ontology graph.
 * Similar to partitionFiltersByDomain but for numeric range properties.
 */
export function partitionRangesByDomain(
  ranges: Record<string, { min?: number; max?: number }>,
  detectedDomains: string[],
  vocabIndex: CompilerVocab
): Record<string, Record<string, { min?: number; max?: number }>> {
  const result: Record<string, Record<string, { min?: number; max?: number }>> = {}

  // Defense-in-depth: drop any range key the schema doesn't know about.
  // Same reasoning as partitionFiltersByDomain — without this gate the LLM
  // can invent numeric properties (e.g. `numberLanes`) that compile into
  // a dead `?qty domain:invented ?x` triple and return 0 results silently.
  const known: Record<string, { min?: number; max?: number }> = {}
  for (const [propName, range] of Object.entries(ranges)) {
    if (isKnownProperty(propName, vocabIndex)) known[propName] = range
  }

  // Single domain — all known ranges belong to it
  if (detectedDomains.length === 1) {
    result[detectedDomains[0]!] = { ...known }
    return result
  }

  // Multi-domain: find which detected domain owns each property. Mirrors
  // partitionFiltersByDomain (including the deep-chain path lookup).
  for (const [propName, range] of Object.entries(known)) {
    const owningDomains = ownersOf(propName, vocabIndex)
    const matchingDomains = detectedDomains.filter((d) => owningDomains.has(d))
    for (const matchingDomain of matchingDomains) {
      if (!result[matchingDomain]) result[matchingDomain] = {}
      result[matchingDomain]![propName] = range
    }
    // If property is not in any detected domain, drop it — the slot
    // validator should have already emitted a gap upstream.
  }

  return result
}

/**
 * Determine the primary domain — the composite one that references others.
 * E.g., if two domains' filters are present and one references the other,
 * the referencing domain is primary.
 */
export async function resolvePrimaryDomain(
  detectedDomains: string[],
  filtersByDomain: Record<string, Record<string, string | string[]>>
): Promise<string> {
  const allDomains = new Set([...detectedDomains, ...Object.keys(filtersByDomain)])

  // A single domain is always its own primary — skip the (global) reference
  // index entirely so single-domain compilation has no cross-domain dependency.
  if (allDomains.size === 1) return detectedDomains[0] ?? [...allDomains][0]!

  const domainRefs = await getDomainReferences()

  // Check if any domain references others that are present
  for (const [parent, children] of domainRefs.entries()) {
    if (allDomains.has(parent)) {
      for (const child of children) {
        if (allDomains.has(child)) {
          return parent
        }
      }
    }
  }

  // Otherwise pick the first detected domain (LLM should have chosen correctly)
  if (detectedDomains.length === 0) {
    throw new CompileError('No domains detected - cannot compile query')
  }
  return detectedDomains[0]!
}

/**
 * Build the PREFIX block for a set of domains.
 * Uses the registry to look up namespaces — no hardcoded domain-specific URIs.
 */
export function buildPrefixes(
  registry: Awaited<ReturnType<typeof buildDomainRegistry>>,
  domains: string[]
): string {
  const prefixSet = new Set<string>()

  // W3C / community-standard prefixes (specification-defined). Always
  // emitted regardless of which domain predicates appear in the query,
  // because the standard prefixes are also referenced by the policy
  // gate's IRI allowlist.
  prefixSet.add(sparqlPrefix('rdfs'))
  prefixSet.add(sparqlPrefix('xsd'))
  prefixSet.add(sparqlPrefix('gx'))

  // Domain-specific prefixes — every domain whose namespace appears in
  // an emitted predicate. The caller accumulates this set as the
  // compiler walks discovered chains and emits patterns, so prefixes
  // for shared or "support" domains (cross-domain join chains, location
  // sub-shapes, etc.) get added the same way as the asset domain's own.
  // No domain name is hard-coded here.
  for (const domainName of domains) {
    const domain = registry.domains.get(domainName) ?? registry.resolveByIriDomain(domainName)
    if (domain) {
      prefixSet.add(`PREFIX ${domain.prefix}: <${domain.namespace}>`)
    }
  }

  return [...prefixSet].join('\n')
}

/**
 * Classify a property into its parent SHACL shape group.
 *
 * Uses graph-queried shape group data from rdfs:subClassOf hierarchy:
 * Shape → sh:targetClass → C, C rdfs:subClassOf base:Content → "Content"
 *
 * Falls back to the first available shape group for the domain, or "Content"
 * as a last resort. Logs a warning when the fallback is used so that missing
 * shape group data is surfaced during development.
 */
export function classifyProperty(
  propName: string,
  domainName: string,
  vocabIndex: CompilerVocab
): string | null {
  const shapeGroup = vocabIndex.shapeGroups.get(`${propName}:${domainName}`)
  if (shapeGroup) return shapeGroup

  // Fallback: find any shape group used by this domain.
  for (const [key, group] of vocabIndex.shapeGroups) {
    if (key.endsWith(`:${domainName}`)) {
      log.warn('No shape group found for property — falling back to first group for domain', {
        property: propName,
        domain: domainName,
        fallback: group,
      })
      return group
    }
  }

  // No shape groups exist for this domain at all — the ontology uses a flat
  // structure where properties live directly on the asset class (no
  // DomainSpecification→Content hierarchy). Return null so the caller can
  // emit the property as a direct triple on the asset variable.
  log.debug('No shape groups for domain — property will be emitted as direct', {
    property: propName,
    domain: domainName,
  })
  return null
}

/**
 * Convert a SHACL shape-group localName into the SPARQL variable name that
 * holds the linked DomainSpecification sub-resource. The convention is
 * lower-camelCase of the localName: `Content → content`, `DataSource →
 * dataSource`, `Quantity → quantity`. Both `?fmt` (old `?fmt` for Format)
 * and `?ds` (old `?ds` for DataSource) used hand-picked abbreviations the
 * are intentionally unabbreviated; the unified rule reads as well or better and
 * works for any future group.
 */
export function groupVariableName(group: string): string {
  if (group.length === 0) return 'group'
  return group[0]!.toLowerCase() + group.slice(1)
}

/**
 * The `hasGroup` predicate linking the specification node to a shape's
 * sub-resource (e.g. group `Content` → predicate `hasContent`).
 *
 * Many SHACL conventions name the predicate `has<Group>`, so it is derivable
 * from the group localName — no hand-maintained map.
 */
export function groupPredicate(group: string): string {
  return `has${group}`
}

/**
 * Resolve which SPARQL prefix should be used for a property.
 *
 * Strategy: Properties can exist in multiple domains (the same property local
 * name in more than one domain).
 * We use the target domain's prefix if the property exists there, otherwise find the correct
 * registry entry by matching the property's full IRI namespace against registered domains.
 *
 * Returns the SPARQL prefix alias (a domain's short prefix) that correctly
 * expands to the property's namespace. This may differ from the domain name used
 * in the vocabulary index (e.g., an IRI-derived domain name maps to a registered prefix).
 */
export function resolvePropertyPrefix(
  propName: string,
  targetDomain: string,
  vocabIndex: { properties: Map<string, CompilerProperty> },
  registry: Awaited<ReturnType<typeof buildDomainRegistry>>
): { prefix: string; foreignDomain: string | null } {
  const propInfo = vocabIndex.properties.get(propName)

  // If the property doesn't exist in vocabulary, use target domain
  if (!propInfo) {
    const d = registry.domains.get(targetDomain)
    return { prefix: d?.prefix ?? targetDomain, foreignDomain: null }
  }

  // If the property exists in the target domain, use its prefix
  if (propInfo.domains.has(targetDomain)) {
    const d = registry.domains.get(targetDomain)
    return { prefix: d?.prefix ?? targetDomain, foreignDomain: null }
  }

  // Property belongs to a foreign domain. Use its IRI to find the correct
  // registry entry (handles cases where IRI-derived name ≠ registry key,
  // e.g., "openlabel" from IRI vs "openlabel-v2" registry key).
  const firstDomain = propInfo.domains.values().next().value as string | undefined
  const propIri = firstDomain ? propInfo.iris.get(firstDomain) : undefined

  if (propIri) {
    // Extract namespace from property IRI (everything up to the local name)
    const lastSlash = propIri.lastIndexOf('/')
    const namespace = lastSlash >= 0 ? propIri.substring(0, lastSlash + 1) : propIri

    // Find registry entry with matching namespace
    for (const desc of registry.domains.values()) {
      if (desc.namespace === namespace) {
        return { prefix: desc.prefix, foreignDomain: desc.name }
      }
    }
  }

  // Fallback: try IRI-derived domain name against registry
  if (firstDomain) {
    const resolved = registry.domains.get(firstDomain) ?? registry.resolveByIriDomain(firstDomain)
    if (resolved) {
      return { prefix: resolved.prefix, foreignDomain: resolved.name }
    }
  }

  // Last resort: use the IRI-derived domain name directly
  return { prefix: firstDomain ?? targetDomain, foreignDomain: firstDomain ?? null }
}

// `isIri` is imported from `@ontology-search/sparql/escape` (see the
// `escapeSparqlLiteral` re-export above for rationale). The previous
// in-file prefix-only check (`^https?://|^urn:`) was both too narrow
// (it missed `did:web:` IRIs in the project's sample data) and too lax
// (it accepted any garbage after the scheme); the lifted version
// enforces the full SPARQL `IRIREF` body grammar.

/**
 * A slot value carries information iff it's a non-empty string or a
 * non-empty array. Used by the compiler to decide whether to emit the
 * graph pattern + filter for a given slot — empty values must produce
 * no triple at all, never a dangling pattern or `IN ()` clause.
 */
export function isNonEmpty(value: string | string[] | undefined): value is string | string[] {
  if (value === undefined) return false
  if (typeof value === 'string') return value.length > 0
  return Array.isArray(value) && value.length > 0
}

/**
 * A property name is "known to the schema" if any of the graph-derived
 * indexes references it. The indexes are populated from disjoint SPARQL
 * patterns (sh:property paths, shape-group nesting, Range2D detection,
 * property-path BFS) so checking only one would under-recognise valid
 * properties.
 *
 * Used as the defense-in-depth filter in `partitionFiltersByDomain` —
 * unknown keys never reach SPARQL compilation.
 *
 * The `paths` index check catches deep-chain leaf properties (e.g.
 * location leaves that live behind a shared chain and don't appear in
 * `queryPropertyDomains` with a domain-specific target class — they're owned
 * by a sub-shape whose `sh:targetClass` is a shared intermediate type).
 * Without this gate
 * deep-chain filters would be dropped by `partitionFiltersByDomain`
 * before reaching the compiler.
 */
function isKnownProperty(propName: string, vocabIndex: CompilerVocab): boolean {
  if (vocabIndex.properties.has(propName)) return true
  if (vocabIndex.range2DProperties.has(propName)) return true
  if (vocabIndex.shapeGroupPropertyNames.has(propName)) return true
  for (const key of vocabIndex.paths.keys()) {
    if (key.endsWith(`:${propName}`)) return true
  }
  return false
}

/**
 * Emit a FILTER clause for a location field that may be a single string or
 * an array. Generic — used for every location-style literal slot.
 *
 *  - **Array**: `FILTER(?v IN ("DE","FR","IT"))` — exact equality over a set,
 *    so a region expressed as a list of codes filters precisely.
 *  - **Single string**: `FILTER(CONTAINS(STR(?v), "FR"))` — textual matching
 *    over the string form of the RDF term, so the same filter works for both
 *    literal values and IRI-valued location resources.
 */
export function addLocationFilter(
  filters: string[],
  varName: string,
  value: string | string[]
): void {
  // W3C SPARQL 1.1 §17.4.2: LCASE() requires a string argument.
  // STR() converts IRIs and typed literals to their lexical string form,
  // making this safe for both IRI-valued and literal-valued properties.
  if (Array.isArray(value)) {
    if (value.length === 1) {
      const v = escapeSparqlLiteral(value[0]!.toLowerCase())
      filters.push(`FILTER(LCASE(STR(${varName})) = "${v}")`)
    } else {
      const lits = value.map((v) => `"${escapeSparqlLiteral(v.toLowerCase())}"`).join(', ')
      filters.push(`FILTER(LCASE(STR(${varName})) IN (${lits}))`)
    }
  } else {
    const v = escapeSparqlLiteral(value.toLowerCase())
    filters.push(`FILTER(CONTAINS(LCASE(STR(${varName})), "${v}"))`)
  }
}

/**
 * SPARQL property path that walks reflexive-transitively up SKOS and RDFS
 * hierarchies. Used to expand an IRI-valued filter to include all narrower
 * concepts / subclasses generically — the hierarchies must be declared in
 * the loaded graphs; this code does not name any specific concept scheme.
 *
 *   - `skos:broaderTransitive*` — covers SKOS concept narrower-than chains
 *   - `rdfs:subClassOf*`        — covers OWL/RDFS class subClassOf chains
 *
 * Both predicates are W3C-standard and reflexive in their `*` form, so the
 * expanded set always includes the filter value itself.
 *
 * @see https://www.w3.org/TR/skos-reference/#semantic-relations
 * @see https://www.w3.org/TR/rdf-schema/#ch_subclassof
 */
const HIERARCHY_EXPANSION_PATH = `(<${iri('skos', 'broaderTransitive')}>|<${iri('rdfs', 'subClassOf')}>)*`

/**
 * Add a FILTER (or graph pattern) for an enum value.
 *
 * - **Literal value(s)**: emits the existing `FILTER(?v = "lit")` form.
 * - **IRI value(s)**: emits a reflexive-transitive SPARQL property path,
 *   so the filter matches any concept narrower than the IRI in any
 *   `skos:broaderTransitive` or `rdfs:subClassOf` chain loaded into the
 *   store. This is the generic IRI-expansion gate: no specific hierarchy
 *   is hardcoded; the engine walks whatever is declared.
 *
 *   Example: with `<.../region/europe>` declared as the broader concept of
 *   {`<.../country/DE>`, `<.../country/FR>`, …}, a filter for `europe`
 *   expands to the full country set automatically.
 *
 *   When no hierarchy edges are present in the data, the path matches only
 *   the IRI itself (reflexive case) — same semantics as plain equality.
 */
export function addEnumFilter(
  patterns: string[],
  filters: string[],
  varName: string,
  value: string | string[]
): void {
  const arr = Array.isArray(value) ? value : [value]
  const iriValues = arr.filter(isIri)
  const literalValues = arr.filter((v) => !isIri(v))

  if (literalValues.length === 1) {
    filters.push(`FILTER(${varName} = "${escapeSparqlLiteral(literalValues[0]!)}")`)
  } else if (literalValues.length > 1) {
    const values = literalValues.map((v) => `"${escapeSparqlLiteral(v)}"`).join(', ')
    filters.push(`FILTER(${varName} IN (${values}))`)
  }

  for (const iri of iriValues) {
    // The hierarchy walk is emitted as an additional graph pattern, not a
    // FILTER, so the property path is evaluated by the SPARQL engine against
    // every loaded named graph (schema, codelists, instances, …) generically.
    patterns.push(`${varName} ${HIERARCHY_EXPANSION_PATH} <${iri}> .`)
  }
}
