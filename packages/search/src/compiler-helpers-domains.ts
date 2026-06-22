/**
 * Domain partitioning, classification, prefix generation, and primary-domain
 * resolution (ADR 0003 step 22d). Self-contained (no sibling imports).
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 */
import { CompileError } from '@ontology-search/core/errors'
import { createComponentLogger } from '@ontology-search/core/logging'
import { sparqlPrefix } from '@ontology-search/core/rdf/prefixes'
import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'

import { type CompilerProperty, type CompilerVocab, getDomainReferences } from './compiler-vocab.js'

const log = createComponentLogger('compiler')

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
