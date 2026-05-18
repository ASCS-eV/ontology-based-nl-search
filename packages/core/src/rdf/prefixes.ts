/**
 * Standard RDF namespace IRIs.
 *
 * Sourced from the community-maintained `@zazuko/prefixes` set (the
 * JavaScript equivalent of `linkml/prefixmaps`) for the W3C and OBO
 * standards we use. Project-specific namespaces the community list
 * doesn't include (currently only `gx:` for GAIA-X development) are
 * layered on top. This is the "don't redefine well-known constants"
 * principle — same reason we don't hand-maintain HTTP MIME types or
 * ISO country codes.
 *
 * Single source of truth for the prefixes that appear across the
 * codebase: SPARQL query strings, the SPARQL policy allowlist, the
 * domain registry's standard-prefix map, and tests. Inline
 * `'http://www.w3.org/...'` literals belong in this module and nowhere
 * else.
 *
 * These IRIs are protocol identifiers (W3C / GAIA-X / community
 * vocabularies), not ontology-specific names.
 */

import zazukoPrefixes from '@zazuko/prefixes/prefixes.js'

/** Project-specific prefixes the community list does not include. */
const CUSTOM_PREFIXES = {
  /** GAIA-X development namespace (`gx:name`, `gx:license`, …). */
  gx: 'https://w3id.org/gaia-x/development#',
} as const

export const RDF_PREFIXES = {
  ...zazukoPrefixes,
  ...CUSTOM_PREFIXES,
} as const

/** Symbolic name of a known RDF prefix. */
export type RdfPrefix = keyof typeof RDF_PREFIXES

/**
 * Format a single SPARQL `PREFIX foo: <iri>` declaration line.
 *
 * Use this inside SPARQL template strings instead of inlining the IRI:
 *
 * ```ts
 * const query = `
 *   ${sparqlPrefix('sh')}
 *   SELECT ?cls WHERE { ?cls sh:targetClass ?type }
 * `
 * ```
 */
export function sparqlPrefix(prefix: RdfPrefix): string {
  return `PREFIX ${prefix}: <${RDF_PREFIXES[prefix]}>`
}

/**
 * Format multiple SPARQL `PREFIX` declarations, one per line. Order is
 * preserved so output is deterministic for snapshot tests.
 */
export function sparqlPrefixes(...prefixes: RdfPrefix[]): string {
  return prefixes.map(sparqlPrefix).join('\n')
}

/**
 * Expand a known prefix's local name into a full IRI literal suitable
 * for embedding inside SPARQL property paths or VALUES clauses:
 *
 * ```ts
 * iri('xsd', 'string')        // → 'http://www.w3.org/2001/XMLSchema#string'
 * `<${iri('skos', 'broader')}>` // → '<http://.../skos/core#broader>'
 * ```
 */
export function iri(prefix: RdfPrefix, localName: string): string {
  return `${RDF_PREFIXES[prefix]}${localName}`
}
