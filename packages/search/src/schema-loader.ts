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
import { iri } from '@ontology-search/core/rdf/prefixes'
import {
  artifactBaseIri,
  assertOntologySourcesAvailable,
  diagnoseOntologySources,
  discoverShapeFiles,
} from '@ontology-search/ontology/sources'
import type { SparqlStore } from '@ontology-search/sparql/types'
import { readFileSync } from 'fs'
import { basename } from 'path'

/** Named graph IRI for ontology schema triples */
export const SCHEMA_GRAPH = 'urn:graph:schema'

const log = createComponentLogger('schema-loader')

/**
 * Give a Turtle document its retrieval location as the base IRI
 * ({@link artifactBaseIri}), so relative IRIs resolve instead of failing the
 * parse ([TURTLE] §6.3: absent `@base`, the base is the Retrieval URI).
 * Emitted on the first line so parser error line numbers still match the
 * file; an `@base` in the document itself still takes precedence for
 * everything after it.
 */
export function withDocumentBase(ttl: string, filePath: string): string {
  return `@base <${artifactBaseIri(filePath)}> . ${ttl}`
}

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
  const diag = diagnoseOntologySources()
  assertOntologySourcesAvailable(diag)
  for (const root of diag.roots) {
    if (root.unknownDomains) {
      log.warn('ontology-sources.json selects domains that do not exist in the source root', {
        root: root.path,
        unknownDomains: root.unknownDomains,
      })
    }
  }

  const files = discoverShapeFiles({ includeOwl: true })
  const domains = new Set<string>()
  let fileCount = 0

  for (const { path: filePath, domain } of files) {
    try {
      const ttl = withDocumentBase(readFileSync(filePath, 'utf-8'), filePath)
      await store.loadTurtle(ttl, SCHEMA_GRAPH)
      domains.add(domain)
      fileCount++
      log.debug('Loaded schema file', { domain, file: basename(filePath) })
    } catch (err) {
      log.error('Failed to load schema file — schema graph is incomplete', err, {
        file: basename(filePath),
        domain,
      })
    }
  }

  if (fileCount === 0) {
    throw new Error(
      'Schema loading failed: no ontology files could be loaded into the schema graph. ' +
        'Check file permissions and ontology source integrity.'
    )
  }

  await materializeValueHierarchy(store)

  log.info('Loaded schema files', {
    fileCount,
    domainCount: domains.size,
    domains: [...domains].sort(),
    graph: SCHEMA_GRAPH,
  })

  return { domains: [...domains], fileCount }
}

/**
 * Schema predicates {@link materializeValueHierarchy} mirrors into the default
 * graph — schema triples, not instance data.
 */
export const VALUE_HIERARCHY_PREDICATES: readonly string[] = [
  iri('rdfs', 'subClassOf'),
  iri('skos', 'broaderTransitive'),
]

/**
 * Mirror the schema's value-hierarchy edges into the default graph.
 *
 * Compiled queries run against the default graph only — the SPARQL policy
 * forbids `GRAPH` / `FROM` ([SPARQL11] §13.2 RDF dataset). An IRI filter
 * value is matched with `(skos:broaderTransitive|rdfs:subClassOf)*`, so a
 * broad value (a class or concept) also matches data that stores a narrower
 * one ([RDF-SCHEMA] §3.4 rdfs:subClassOf transitivity; [SKOS] §8.1
 * skos:broaderTransitive). Those edges live in {@link SCHEMA_GRAPH}; without
 * this copy the walk only ever matched the value itself. Only IRI→IRI edges
 * are copied — no shapes, restrictions, or blank nodes leave the schema graph.
 */
export async function materializeValueHierarchy(store: SparqlStore): Promise<void> {
  const predicates = VALUE_HIERARCHY_PREDICATES.map((iri) => `<${iri}>`).join(' ')
  await store.update(`
    INSERT { ?s ?p ?o }
    WHERE {
      VALUES ?p { ${predicates} }
      GRAPH <${SCHEMA_GRAPH}> { ?s ?p ?o }
      FILTER(isIRI(?s) && isIRI(?o) && ?s != ?o)
    }
  `)
}
