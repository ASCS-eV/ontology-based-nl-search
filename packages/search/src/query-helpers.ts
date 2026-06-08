/**
 * Schema query helper — builds and executes SPARQL queries against the
 * schema graph with standardized prefix declarations.
 *
 * Reduces the repeated pattern of:
 *   1. Build prefix declarations
 *   2. Wrap body in `GRAPH <SCHEMA_GRAPH> { ... }`
 *   3. Execute via `store.query()`
 *   4. Extract binding values
 *
 * Each query function still owns its SELECT clause and WHERE body —
 * this helper just eliminates the boilerplate envelope.
 */
import type { RdfPrefix } from '@ontology-search/core/rdf/prefixes'
import { sparqlPrefixes } from '@ontology-search/core/rdf/prefixes'
import type { SparqlBinding, SparqlStore } from '@ontology-search/sparql/types'

import { SCHEMA_GRAPH } from './schema-loader.js'

/**
 * Build a SPARQL query string that targets the schema named graph.
 *
 * Generates the prefix declarations and wraps the body in a
 * `GRAPH <urn:graph:schema> { ... }` clause.
 *
 * @param prefixes - RDF prefixes needed by the query body
 * @param selectClause - The SELECT line (e.g. `SELECT DISTINCT ?iri ?class`)
 * @param body - The graph pattern body (triple patterns, FILTERs, etc.)
 * @param options - Optional ORDER BY, LIMIT, or extra clauses outside the GRAPH
 */
export function buildSchemaQuery(
  prefixes: RdfPrefix[],
  selectClause: string,
  body: string,
  options?: { orderBy?: string; limit?: number; extra?: string }
): string {
  const parts = [
    sparqlPrefixes(...prefixes),
    '',
    selectClause,
    'WHERE {',
    `  GRAPH <${SCHEMA_GRAPH}> {`,
    body,
    '  }',
  ]

  if (options?.extra) parts.push(options.extra)
  parts.push('}')
  if (options?.orderBy) parts.push(`ORDER BY ${options.orderBy}`)
  if (options?.limit) parts.push(`LIMIT ${options.limit}`)

  return parts.join('\n')
}

/**
 * Execute a SPARQL query against the schema graph and return raw bindings.
 *
 * Convenience wrapper: builds the query with `buildSchemaQuery`, executes
 * it, and returns the bindings array directly.
 */
export async function querySchemaGraph(
  store: SparqlStore,
  prefixes: RdfPrefix[],
  selectClause: string,
  body: string,
  options?: { orderBy?: string; limit?: number; extra?: string }
): Promise<SparqlBinding[]> {
  const sparql = buildSchemaQuery(prefixes, selectClause, body, options)
  const result = await store.query(sparql)
  return result.results.bindings
}

/**
 * Extract a string value from a SPARQL binding row.
 * Returns undefined if the variable is not bound.
 */
export function bindingValue(row: SparqlBinding, variable: string): string | undefined {
  return row[variable]?.value
}
