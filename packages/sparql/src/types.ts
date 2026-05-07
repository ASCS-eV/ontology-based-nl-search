/** SPARQL query result binding */
export interface SparqlBinding {
  [variable: string]: {
    type: 'uri' | 'literal' | 'bnode'
    value: string
    datatype?: string
    'xml:lang'?: string
  }
}

/** Standard SPARQL JSON results format */
export interface SparqlResults {
  head: { vars: string[] }
  results: { bindings: SparqlBinding[] }
}

/** Abstract interface for SPARQL store implementations */
export interface SparqlStore {
  /** Execute a SPARQL SELECT/ASK query */
  query(sparql: string): Promise<SparqlResults>

  /** Execute a SPARQL UPDATE (INSERT/DELETE) */
  update(sparql: string): Promise<void>

  /** Load RDF data in Turtle format */
  loadTurtle(data: string, graphUri?: string): Promise<void>

  /** Load RDF data in JSON-LD format */
  loadJsonLd(data: string, graphUri?: string): Promise<void>

  /** Check if the store is ready */
  isReady(): Promise<boolean>
}
