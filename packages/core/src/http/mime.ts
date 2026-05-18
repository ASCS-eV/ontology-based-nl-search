/**
 * HTTP MIME types used by the SPARQL transport and ontology I/O.
 *
 * Single source of truth for the media types that previously appeared
 * inline in remote-store.ts, oxigraph-store.ts, and vocabulary-index.ts.
 * Inline `'application/sparql-*'` / `'text/turtle'` / `'application/ld+json'`
 * literals in source are forbidden by criterion #2.
 *
 * These are IETF / W3C protocol identifiers, not ontology-specific names.
 */

export const MIME = {
  /** SPARQL 1.1 query body content type. */
  SPARQL_QUERY: 'application/sparql-query',
  /** SPARQL 1.1 update body content type. */
  SPARQL_UPDATE: 'application/sparql-update',
  /** SPARQL 1.1 query results in JSON. */
  SPARQL_RESULTS_JSON: 'application/sparql-results+json',
  /** Turtle RDF serialization (`.ttl` files). */
  TURTLE: 'text/turtle',
  /** JSON-LD RDF serialization (`.jsonld` files). */
  JSONLD: 'application/ld+json',
} as const

export type MimeType = (typeof MIME)[keyof typeof MIME]
