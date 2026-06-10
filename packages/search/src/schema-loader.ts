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
import {
  assertOntologySourcesAvailable,
  discoverShapeFiles,
} from '@ontology-search/ontology/sources'
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
  // Fail fast with an actionable message when the ontology source tree is
  // absent (e.g. git submodules not initialized). Without this the loader
  // would log "0 files" and return, the service would start "ready", and
  // every search would silently produce empty/garbage results.
  assertOntologySourcesAvailable()

  const files = discoverShapeFiles({ includeOwl: true })
  const domains = new Set<string>()
  let fileCount = 0

  for (const { path: filePath, domain } of files) {
    try {
      const ttl = readFileSync(filePath, 'utf-8')
      await store.loadTurtle(ttl, SCHEMA_GRAPH)
      domains.add(domain)
      fileCount++
      log.debug('Loaded schema file', { domain, file: basename(filePath) })
    } catch (err) {
      log.error('Failed to load schema file — schema graph is incomplete', {
        file: basename(filePath),
        domain,
        error: String(err),
      })
    }
  }

  if (fileCount === 0) {
    throw new Error(
      'Schema loading failed: no ontology files could be loaded into the schema graph. ' +
        'Check file permissions and ontology source integrity.'
    )
  }

  log.info('Loaded schema files', {
    fileCount,
    domainCount: domains.size,
    domains: [...domains].sort(),
    graph: SCHEMA_GRAPH,
  })

  return { domains: [...domains], fileCount }
}
