import type { SparqlStore, SparqlResults } from './types'

/**
 * In-memory SPARQL store using Oxigraph WASM.
 * Used for development/testing with small datasets (<1000 entries).
 */
export class OxigraphStore implements SparqlStore {
  private store: any = null
  private oxigraph: any = null

  async initialize(): Promise<void> {
    if (this.store) return

    // Dynamic import to avoid bundling WASM in client
    this.oxigraph = await import('oxigraph')
    this.store = new this.oxigraph.Store()
  }

  async isReady(): Promise<boolean> {
    return this.store !== null
  }

  async query(sparql: string): Promise<SparqlResults> {
    await this.initialize()

    const rawResults = this.store.query(sparql)

    // Convert Oxigraph results to standard SPARQL JSON format
    if (Array.isArray(rawResults)) {
      // SELECT query - results are an array of Maps
      const vars = rawResults.length > 0
        ? [...rawResults[0].keys()]
        : []

      const bindings = rawResults.map((row: Map<string, any>) => {
        const binding: Record<string, any> = {}
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
    this.store.update(sparql)
  }

  async loadTurtle(data: string, graphUri?: string): Promise<void> {
    await this.initialize()

    if (graphUri) {
      const graph = this.oxigraph.namedNode(graphUri)
      this.store.load(data, { format: 'text/turtle', to_graph_name: graph })
    } else {
      this.store.load(data, { format: 'text/turtle' })
    }
  }

  async loadJsonLd(data: string, graphUri?: string): Promise<void> {
    await this.initialize()

    // Oxigraph WASM doesn't natively support JSON-LD parsing,
    // so we convert to N-Quads format first using a simple approach.
    // For production, consider using jsonld.js for proper expansion.
    if (graphUri) {
      const graph = this.oxigraph.namedNode(graphUri)
      this.store.load(data, { format: 'application/ld+json', to_graph_name: graph })
    } else {
      this.store.load(data, { format: 'application/ld+json' })
    }
  }
}

/** Convert an Oxigraph term to SPARQL JSON binding format */
function termToBinding(term: any): { type: string; value: string; datatype?: string; 'xml:lang'?: string } {
  if (term.termType === 'NamedNode') {
    return { type: 'uri', value: term.value }
  }
  if (term.termType === 'Literal') {
    const result: any = { type: 'literal', value: term.value }
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
