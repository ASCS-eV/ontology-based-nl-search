/**
 * Oxigraph Worker — runs Oxigraph WASM in a dedicated worker thread.
 *
 * Receives messages from the main thread (query, update, load) and executes
 * them synchronously inside the worker. This prevents Oxigraph's synchronous
 * WASM calls from blocking the main event loop during query execution.
 *
 * Protocol:
 * - Main thread sends `WorkerRequest` messages
 * - Worker replies with `WorkerResponse` messages matched by `id`
 * - Worker sends `{ type: 'ready' }` after initialization
 *
 * @see packages/sparql/src/worker-oxigraph-store.ts — main-thread proxy
 */

import { parentPort } from 'node:worker_threads'

import { MIME } from '@ontology-search/core/http/mime'
import { iri } from '@ontology-search/core/rdf/prefixes'

// ─── Types shared with main thread ───────────────────────────────────────────

export type WorkerRequest =
  | { type: 'init'; id: string }
  | { type: 'query'; id: string; sparql: string }
  | { type: 'update'; id: string; sparql: string }
  | { type: 'loadTurtle'; id: string; data: string; graphUri?: string }
  | { type: 'loadJsonLd'; id: string; data: string; graphUri?: string }
  | { type: 'terminate'; id: string }

export type WorkerResponse =
  | { type: 'ready'; id: string }
  | { type: 'result'; id: string; data: unknown }
  | { type: 'error'; id: string; message: string }

// ─── RDF/JS-compatible term from Oxigraph ────────────────────────────────────

interface OxigraphTerm {
  termType: 'NamedNode' | 'Literal' | 'BlankNode' | 'DefaultGraph'
  value: string
  datatype?: { value: string }
  language?: string
}

interface OxigraphStoreInstance {
  query(sparql: string): Map<string, OxigraphTerm>[] | boolean
  update(sparql: string): void
  load(data: string, options: { format: string; to_graph_name?: OxigraphTerm }): void
}

interface OxigraphModule {
  Store: new () => OxigraphStoreInstance
  namedNode(iri: string): OxigraphTerm
}

// ─── Binding conversion (duplicated from oxigraph-store.ts to avoid import) ──

const XSD_STRING_IRI = iri('xsd', 'string')

interface BindingValue {
  type: 'uri' | 'literal' | 'bnode'
  value: string
  datatype?: string
  'xml:lang'?: string
}

function termToBinding(term: OxigraphTerm): BindingValue {
  if (term.termType === 'NamedNode') {
    return { type: 'uri', value: term.value }
  }
  if (term.termType === 'Literal') {
    const result: BindingValue = { type: 'literal', value: term.value }
    if (term.datatype && term.datatype.value !== XSD_STRING_IRI) {
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

// ─── Worker state ────────────────────────────────────────────────────────────

let store: OxigraphStoreInstance | null = null
let oxigraph: OxigraphModule | null = null

async function initialize(): Promise<void> {
  if (store) return
  oxigraph = (await import('oxigraph')) as unknown as OxigraphModule
  store = new oxigraph.Store()
}

function executeQuery(sparql: string): unknown {
  const rawResults = store!.query(sparql)

  if (Array.isArray(rawResults)) {
    const firstRow = rawResults[0]
    const vars = firstRow ? [...firstRow.keys()] : []

    const bindings = rawResults.map((row) => {
      const binding: Record<string, BindingValue> = {}
      for (const [key, term] of row.entries()) {
        if (term) {
          binding[key] = termToBinding(term)
        }
      }
      return binding
    })

    return { head: { vars }, results: { bindings } }
  }

  // ASK query
  return {
    head: { vars: [] },
    results: { bindings: [{ result: { type: 'literal', value: String(rawResults) } }] },
  }
}

function loadIntoStore(data: string, format: string, graphUri?: string): void {
  if (graphUri) {
    const graph = oxigraph!.namedNode(graphUri)
    store!.load(data, { format, to_graph_name: graph })
  } else {
    store!.load(data, { format })
  }
}

// ─── Message handler ─────────────────────────────────────────────────────────

if (parentPort) {
  const port = parentPort

  port.on('message', async (msg: WorkerRequest) => {
    try {
      switch (msg.type) {
        case 'init':
          await initialize()
          port.postMessage({ type: 'ready', id: msg.id } satisfies WorkerResponse)
          break

        case 'query':
          await initialize()
          port.postMessage({
            type: 'result',
            id: msg.id,
            data: executeQuery(msg.sparql),
          } satisfies WorkerResponse)
          break

        case 'update':
          await initialize()
          store!.update(msg.sparql)
          port.postMessage({ type: 'result', id: msg.id, data: null } satisfies WorkerResponse)
          break

        case 'loadTurtle':
          await initialize()
          loadIntoStore(msg.data, MIME.TURTLE, msg.graphUri)
          port.postMessage({ type: 'result', id: msg.id, data: null } satisfies WorkerResponse)
          break

        case 'loadJsonLd':
          await initialize()
          loadIntoStore(msg.data, MIME.JSONLD, msg.graphUri)
          port.postMessage({ type: 'result', id: msg.id, data: null } satisfies WorkerResponse)
          break

        case 'terminate':
          port.postMessage({ type: 'result', id: msg.id, data: null } satisfies WorkerResponse)
          // Don't call process.exit() — let the main thread's worker.terminate()
          // handle shutdown. Exiting here can race with message delivery,
          // causing the 'exit' event to fire before the response is received.
          break
      }
    } catch (err) {
      port.postMessage({
        type: 'error',
        id: msg.id,
        message: err instanceof Error ? err.message : String(err),
      } satisfies WorkerResponse)
    }
  })
}
