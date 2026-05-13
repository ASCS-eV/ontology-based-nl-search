/**
 * Oxigraph Store — In-memory SPARQL store using Oxigraph WASM.
 *
 * **Purpose:**
 * - Development/testing with small datasets (<1000 entries)
 * - Eliminates need for external triple store during local development
 * - Fast initialization (~100ms) vs. external SPARQL endpoints
 *
 * **Architecture:**
 * - Wraps Oxigraph WASM (Rust-based RDF database compiled to WebAssembly)
 * - Implements SparqlStore interface for drop-in compatibility with Blazegraph/Fuseki
 * - Dynamic import prevents WASM bundling in client builds
 * - In-memory only — data cleared on restart (suitable for dev/CI)
 *
 * **Limitations:**
 * - Not suitable for production (no persistence, limited scalability)
 * - Memory-bound (entire dataset loaded in RAM)
 * - No federation or advanced SPARQL 1.1 features
 *
 * **When to Use:**
 * - Local development with SPARQL_MODE=memory
 * - Unit/integration tests
 * - CI pipelines (no external services required)
 *
 * @see packages/sparql/src/types.ts — SparqlStore interface definition
 * @see https://github.com/oxigraph/oxigraph — Oxigraph project
 */

import type { SparqlBinding, SparqlResults, SparqlStore } from './types.js'

/** RDF/JS-compatible term from Oxigraph */
interface OxigraphTerm {
  termType: 'NamedNode' | 'Literal' | 'BlankNode' | 'DefaultGraph'
  value: string
  datatype?: { value: string }
  language?: string
}

/** Oxigraph Store instance (dynamically imported WASM module) */
interface OxigraphStoreInstance {
  query(sparql: string): Map<string, OxigraphTerm>[] | boolean
  update(sparql: string): void
  load(data: string, options: { format: string; to_graph_name?: OxigraphTerm }): void
}

/** Oxigraph WASM module */
interface OxigraphModule {
  Store: new () => OxigraphStoreInstance
  namedNode(iri: string): OxigraphTerm
}

/**
 * In-memory SPARQL store using Oxigraph WASM.
 * Used for development/testing with small datasets (<1000 entries).
 */
export class OxigraphStore implements SparqlStore {
  private store: OxigraphStoreInstance | null = null
  private oxigraph: OxigraphModule | null = null

  async initialize(): Promise<void> {
    if (this.store) return

    // Dynamic import to avoid bundling WASM in client
    this.oxigraph = (await import('oxigraph')) as unknown as OxigraphModule
    this.store = new this.oxigraph.Store()
  }

  async isReady(): Promise<boolean> {
    return this.store !== null
  }

  async query(sparql: string): Promise<SparqlResults> {
    await this.initialize()

    const rawResults = this.store!.query(sparql)

    // SELECT query - results are an array of Maps
    if (Array.isArray(rawResults)) {
      const firstRow = rawResults[0]
      const vars = firstRow ? [...firstRow.keys()] : []

      const bindings: SparqlBinding[] = rawResults.map((row) => {
        const binding: SparqlBinding = {}
        for (const [key, term] of row.entries()) {
          if (term) {
            binding[key] = termToBinding(term)
          }
        }
        return binding
      })

      return { head: { vars }, results: { bindings } }
    }

    // ASK query - boolean result
    return {
      head: { vars: [] },
      results: { bindings: [{ result: { type: 'literal', value: String(rawResults) } }] },
    }
  }

  async update(sparql: string): Promise<void> {
    await this.initialize()
    this.store!.update(sparql)
  }

  async loadTurtle(data: string, graphUri?: string): Promise<void> {
    await this.initialize()

    if (graphUri) {
      const graph = this.oxigraph!.namedNode(graphUri)
      this.store!.load(data, { format: 'text/turtle', to_graph_name: graph })
    } else {
      this.store!.load(data, { format: 'text/turtle' })
    }
  }

  async loadJsonLd(data: string, graphUri?: string): Promise<void> {
    await this.initialize()

    if (graphUri) {
      const graph = this.oxigraph!.namedNode(graphUri)
      this.store!.load(data, { format: 'application/ld+json', to_graph_name: graph })
    } else {
      this.store!.load(data, { format: 'application/ld+json' })
    }
  }
}

/** Convert an Oxigraph term to SPARQL JSON binding format */
function termToBinding(term: OxigraphTerm): SparqlBinding[string] {
  if (term.termType === 'NamedNode') {
    return { type: 'uri', value: term.value }
  }
  if (term.termType === 'Literal') {
    const result: SparqlBinding[string] = { type: 'literal', value: term.value }
    if (term.datatype && term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') {
      result.datatype = term.datatype.value
    }
    if (term.language) {
      result['xml:lang'] = term.language
    }
    return result
  }
  if (term.termType === 'BlankNode') {
    return { type: 'bnode', value: term.value }
  }
  return { type: 'literal', value: String(term) }
}
