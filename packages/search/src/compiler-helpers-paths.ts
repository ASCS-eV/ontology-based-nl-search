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
  prefixedPredicate,
} from './compiler-helpers-primitives.js'
import { type CompilerVocab } from './compiler-vocab.js'
import { type PropertyPath } from './property-paths.js'

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
