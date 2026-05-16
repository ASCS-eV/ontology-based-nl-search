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

/**
 * Per-call options for store methods.
 *
 * `signal` lets callers cancel an in-flight query when the client disconnects
 * (SSE close, request abort, etc.). Implementations decide how forcefully
 * they honour it — remote stores compose it with their network timeout via
 * `AbortSignal.any`, in-memory stores check it at entry/exit since WASM
 * cannot be interrupted mid-call.
 */
export interface SparqlQueryOptions {
  signal?: AbortSignal
}

/** Abstract interface for SPARQL store implementations */
export interface SparqlStore {
  /** Execute a SPARQL SELECT/ASK query */
  query(sparql: string, options?: SparqlQueryOptions): Promise<SparqlResults>

  /** Execute a SPARQL UPDATE (INSERT/DELETE) */
  update(sparql: string): Promise<void>

  /** Load RDF data in Turtle format */
  loadTurtle(data: string, graphUri?: string): Promise<void>

  /** Load RDF data in JSON-LD format */
  loadJsonLd(data: string, graphUri?: string): Promise<void>

  /** Check if the store is ready */
  isReady(): Promise<boolean>
}
