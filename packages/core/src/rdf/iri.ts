/**
 * IRI parsing utilities — extract local names and domain segments.
 *
 * These are the inverse of `iri()` from `./prefixes.ts`: given a full
 * IRI, decompose it into its constituent parts. Used throughout the
 * search package (schema-queries, property-paths, concept-expansion)
 * wherever a raw IRI from a SPARQL binding needs to be split into a
 * human-readable local name or matched to a domain.
 */

/**
 * Extract the local name (fragment or last path segment) from a full IRI.
 *
 * Examples:
 * - `http://example.org/ontology#AssetClass` → `"AssetClass"`
 * - `http://example.org/ontology/v1/hasFormat` → `"hasFormat"`
 */
export function extractLocalName(iri: string): string {
  const idx = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'))
  return idx >= 0 ? iri.substring(idx + 1) : iri
}

/**
 * Extract the domain name from a namespace-following IRI.
 *
 * Strategy:
 * 1. If a `domainForIri` resolver is provided, use longest-prefix matching
 *    against known domain namespaces (most accurate).
 * 2. Fallback: extract the path segment before `/vN/` by convention
 *    (e.g., `".../asset-domain/v1/AssetClass"` → `"asset-domain"`).
 *
 * Returns empty string when neither strategy matches.
 */
export function extractDomain(
  iri: string,
  domainForIri?: (iri: string) => string | undefined
): string {
  if (domainForIri) {
    return domainForIri(iri) ?? ''
  }
  const match = iri.match(/\/([^/]+)\/v\d+\//)
  return match?.[1] ?? ''
}
