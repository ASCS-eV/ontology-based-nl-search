/**
 * Schema Loader — loads ontology OWL + SHACL files into a named graph.
 *
 * The ontology schema (class hierarchies, property definitions, sh:in
 * enumerations) lives in a dedicated named graph so it can be queried
 * separately from instance data.
 *
 * @see https://www.w3.org/TR/sparql11-query/#namedGraphs
 */
import { createComponentLogger } from '@ontology-search/core/logging'
import { discoverShapeFiles } from '@ontology-search/ontology/sources'
import type { SparqlStore } from '@ontology-search/sparql/types'
import { readFileSync } from 'fs'
import { basename } from 'path'

/** Named graph IRI for ontology schema triples */
export const SCHEMA_GRAPH = 'urn:graph:schema'

const log = createComponentLogger('schema-loader')

/**
 * Load all ontology schema files (OWL + SHACL) into the store's schema named graph.
 * Called once at startup. Returns metadata about what was loaded.
 */
export async function loadSchemaGraph(
  store: SparqlStore
): Promise<{ domains: string[]; fileCount: number }> {
  const files = discoverShapeFiles({ includeOwl: true })
  const domains = new Set<string>()
  let fileCount = 0

  for (const { path: filePath, domain } of files) {
    try {
      const ttl = readFileSync(filePath, 'utf-8')
      await store.loadTurtle(ttl, SCHEMA_GRAPH)
      domains.add(domain)
      fileCount++
    } catch (err) {
      log.warn('Failed to load schema file', { file: basename(filePath), error: String(err) })
    }
  }

  log.info('Loaded schema files', {
    fileCount,
    domainCount: domains.size,
    graph: SCHEMA_GRAPH,
  })

  return { domains: [...domains], fileCount }
}
