/**
 * Domain-registry TTL parsers (ADR 0003) — pure string/RDF parsing helpers that
 * extract prefixes, namespaces, target classes, versions, subclass edges, and
 * primary-asset-class selection from ontology Turtle. No registry/IO state;
 * consumed by `buildDomainRegistry` in `./domain-registry.js`.
 */
import { RDF_PREFIXES } from '@ontology-search/core/rdf/prefixes'
import { Parser as N3Parser } from 'n3'

const RDFS_SUBCLASS_OF = `${RDF_PREFIXES.rdfs}subClassOf`

/**
 * Extract all @prefix declarations from a TTL file.
 * Returns a map of prefix → namespace IRI.
 */
export function extractPrefixes(ttlContent: string): Record<string, string> {
  const result: Record<string, string> = {}
  const regex = /@prefix\s+([\w-]+):\s*<([^>]+)>/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(ttlContent)) !== null) {
    if (match[1] && match[2]) {
      result[match[1]] = match[2]
    }
  }
  return result
}

/**
 * Extract namespace IRI from an OWL or SHACL TTL file by finding the ontology declaration
 * or the dominant @prefix with the directory name.
 */
export function extractNamespace(ttlContent: string, domainName: string): string | null {
  // Look for @prefix with the domain name
  const prefixRegex = new RegExp(`@prefix\\s+${domainName}:\\s*<([^>]+)>`, 'i')
  const match = ttlContent.match(prefixRegex)
  if (match && match[1]) return match[1]

  // Fallback: try underscore variant (e.g., directory "openlabel-v2" → TTL prefix "openlabel_v2")
  if (domainName.includes('-')) {
    const underscoreVariant = domainName.replace(/-/g, '_')
    const underscoreRegex = new RegExp(`@prefix\\s+${underscoreVariant}:\\s*<([^>]+)>`, 'i')
    const underscoreMatch = ttlContent.match(underscoreRegex)
    if (underscoreMatch && underscoreMatch[1]) return underscoreMatch[1]
  }

  // Fallback: look for owl:Ontology IRI
  const ontologyMatch = ttlContent.match(/<([^>]+)>\s+a\s+owl:Ontology/)
  if (ontologyMatch && ontologyMatch[1]) return ontologyMatch[1]

  return null
}

/**
 * Find the TTL prefix alias that maps to the given namespace.
 * When the directory name differs from the TTL prefix (e.g.,
 * directory "openlabel-v2" → TTL prefix "openlabel_v2"), this
 * resolves the actual alias used in the file.
 */
export function findPrefixAlias(
  declaredPrefixes: Record<string, string>,
  namespace: string
): { alias: string; resolvedNs: string } | null {
  // Exact match first
  for (const [alias, ns] of Object.entries(declaredPrefixes)) {
    if (ns === namespace) return { alias, resolvedNs: ns }
  }
  // Trailing-slash/hash normalization: owl:Ontology IRIs often omit the
  // separator that the @prefix declaration includes (e.g. an ontology IRI
  // without a trailing slash vs a prefix that ends in one).
  const withSlash = namespace.endsWith('/') || namespace.endsWith('#') ? null : namespace + '/'
  const withHash = namespace.endsWith('/') || namespace.endsWith('#') ? null : namespace + '#'
  for (const [alias, ns] of Object.entries(declaredPrefixes)) {
    if (ns === withSlash || ns === withHash) return { alias, resolvedNs: ns }
  }
  return null
}

/**
 * Extract target classes from SHACL file using regex (fast, no SPARQL needed).
 * Pattern: `sh:targetClass domain:ClassName`
 */
export function extractTargetClasses(
  ttlContent: string,
  namespace: string,
  prefix: string
): { localName: string; iri: string }[] {
  const results: { localName: string; iri: string }[] = []
  const regex = new RegExp(`sh:targetClass\\s+${prefix}:(\\w+)`, 'g')
  let match: RegExpExecArray | null

  while ((match = regex.exec(ttlContent)) !== null) {
    const localName = match[1]
    if (!localName) continue
    results.push({
      localName,
      iri: namespace + localName,
    })
  }

  return results
}

/**
 * Extract version from namespace IRI (e.g. "v6" from ".../<domain>/v6/")
 */
export function extractVersion(namespace: string): string {
  const match = namespace.match(/\/(v\d+)\/?$/)
  return match?.[1] ?? 'unknown'
}

/**
 * Extract `rdfs:subClassOf` edges between NAMED classes from a Turtle document,
 * using a real RDF parser (n3) rather than a regex. Blank-node superclasses
 * (`rdfs:subClassOf [ a owl:Restriction … ]`) are skipped — only named
 * class-to-class edges carry the asset/sub-component signal.
 *
 * A real parser is required, not a regex: the upstream Gaia-X OWL
 * (`gx.owl.ttl`) declares superclasses through deeply nested blank-node
 * restrictions interleaved with named ones (e.g. `gx:VirtualResource` has both
 * an `owl:Restriction` super AND a named `gx:Resource` super). A line-oriented
 * regex misreads such a class as a bare root, which then mis-classifies it as a
 * sub-component base. n3 resolves prefixes and blank nodes correctly.
 */
export function extractSubClassOfEdges(ttlContent: string): { sub: string; super: string }[] {
  let quads
  try {
    quads = new N3Parser().parse(ttlContent)
  } catch {
    // A malformed OWL file shouldn't sink registry construction; the SHACL the
    // registry actually compiles against is validated elsewhere. Skip its edges.
    return []
  }
  const edges: { sub: string; super: string }[] = []
  for (const q of quads) {
    if (
      q.predicate.value === RDFS_SUBCLASS_OF &&
      q.subject.termType === 'NamedNode' &&
      q.object.termType === 'NamedNode' &&
      q.subject.value !== q.object.value
    ) {
      edges.push({ sub: q.subject.value, super: q.object.value })
    }
  }
  return edges
}

/** Domain name → PascalCase (the conventional asset-class name). */
function domainPascalCase(domainName: string): string {
  return domainName
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

/**
 * Identify the meta-model SUB-COMPONENT base classes structurally, with no
 * ontology-specific names. A component-base is a class that
 *
 *   1. is the direct `rdfs:subClassOf` target of `sh:targetClass` classes from
 *      **two or more domains** (a shared structural type the domains reuse), AND
 *   2. **is a bare root** — it has no named superclass of its own.
 *
 * Condition 2 separates these reusable STRUCTURE bases (shared component types
 * that several domains reuse) from genuine asset bases (which reach a higher
 * upper-ontology root, e.g. `owl:Thing` or a framework resource class). The
 * set is derived structurally instead of from a hard-coded list of sub-shape
 * names: a class is a "sub-component" — and thus not a domain's primary asset
 * — exactly when it is, or transitively subclasses, a component-base.
 */
export function computeComponentBases(
  subClassEdges: { sub: string; super: string }[],
  targetClassDomain: Map<string, string>
): Set<string> {
  const hasSuper = new Set(subClassEdges.map((e) => e.sub))
  const subDomainsOfSuper = new Map<string, Set<string>>()
  for (const { sub, super: sup } of subClassEdges) {
    const subDomain = targetClassDomain.get(sub)
    if (!subDomain) continue // only count target classes, not intermediate types
    if (!subDomainsOfSuper.has(sup)) subDomainsOfSuper.set(sup, new Set())
    subDomainsOfSuper.get(sup)!.add(subDomain)
  }
  const bases = new Set<string>()
  for (const [sup, domainsOfSup] of subDomainsOfSuper) {
    if (domainsOfSup.size >= 2 && !hasSuper.has(sup)) bases.add(sup)
  }
  return bases
}

/**
 * Select a domain's primary asset class. PascalCase-of-domain match wins
 * first, otherwise the first declared target class that is not a sub-component
 * — with "sub-component" derived structurally from
 * {@link computeComponentBases} instead of a hard-coded name list. A class is
 * a sub-component when it is, or transitively subclasses, a component-base; an
 * asset class (e.g. `<prefix>:<Class>`) subclasses an asset base instead, so
 * it survives the filter even when not named after its domain. `targetClasses`
 * keeps its SHACL declaration order so the
 * first-non-sub-component fallback is deterministic and matches prior behavior.
 */
export function selectPrimaryAssetClass(
  targetClasses: { localName: string; iri: string }[],
  domainName: string,
  componentBases: Set<string>,
  superOf: Map<string, Set<string>>
): { localName: string; iri: string } | null {
  if (targetClasses.length === 0) return null

  const isSubComponent = (iri: string): boolean => {
    if (componentBases.has(iri)) return true
    const seen = new Set<string>()
    const stack = [...(superOf.get(iri) ?? [])]
    while (stack.length) {
      const c = stack.pop()!
      if (seen.has(c)) continue
      seen.add(c)
      if (componentBases.has(c)) return true
      for (const s of superOf.get(c) ?? []) stack.push(s)
    }
    return false
  }

  // PascalCase-of-domain match wins first (a domain name maps to its
  // PascalCase class), even if it is itself a component-base.
  const exact = targetClasses.find((tc) => tc.localName === domainPascalCase(domainName))
  if (exact) return exact

  // Otherwise the first declared non-sub-component target class.
  return targetClasses.find((tc) => !isSubComponent(tc.iri)) ?? targetClasses[0] ?? null
}
