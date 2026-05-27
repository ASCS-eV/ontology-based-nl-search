import { getConfig } from '@ontology-search/core/config'
import { StoreUnavailableError } from '@ontology-search/core/errors'
import { MIME } from '@ontology-search/core/http/mime'

import type { SparqlQueryOptions, SparqlResults, SparqlStore } from './types.js'

/**
 * Remote SPARQL store that sends queries to an external endpoint.
 * Used for production with Apache Jena Fuseki or any SPARQL 1.1 endpoint.
 */
export class RemoteSparqlStore implements SparqlStore {
  private endpoint: string
  private updateEndpoint: string
  private timeoutMs: number

  /**
   * @param timeoutMs Per-call HTTP timeout. Defaults to `SPARQL_REMOTE_TIMEOUT_MS`
   *                  from the Zod-validated config so deployments can tune it
   *                  via env without touching code. Pass an explicit value to
   *                  override (e.g. tests with `timeoutMs: 1`).
   */
  constructor(endpoint: string, updateEndpoint?: string, timeoutMs?: number) {
    this.endpoint = endpoint
    // Fuseki convention: /sparql for query, /update for updates
    this.updateEndpoint = updateEndpoint || endpoint.replace('/sparql', '/update')
    this.timeoutMs = timeoutMs ?? getConfig().SPARQL_REMOTE_TIMEOUT_MS
  }

  /**
   * Compose the per-store timeout with an optional caller-supplied signal.
   * The fetch is aborted by whichever fires first — request timeout or
   * client disconnect.
   */
  private buildSignal(external?: AbortSignal): AbortSignal {
    const timeout = AbortSignal.timeout(this.timeoutMs)
    if (!external) return timeout
    return AbortSignal.any([timeout, external])
  }

  /** Backwards-compatible getter used by non-query fetches. */
  private get signal(): AbortSignal {
    return this.buildSignal()
  }

  /**
   * Lifecycle hook — no-op. This store holds no persistent connection:
   * each call is a one-shot `fetch` with a per-call `AbortSignal.timeout`,
   * so there is nothing to release at shutdown. Implemented for interface
   * symmetry with the worker-backed store.
   */
  async close(): Promise<void> {
    // intentional: stateless HTTP client, nothing to release.
  }

  async isReady(): Promise<boolean> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': MIME.SPARQL_QUERY,
          Accept: MIME.SPARQL_RESULTS_JSON,
        },
        body: 'ASK { ?s ?p ?o }',
        signal: this.signal,
      })
      return response.ok
    } catch {
      // intentional: connectivity probe — false means the endpoint is unreachable
      return false
    }
  }

  async query(sparql: string, options?: SparqlQueryOptions): Promise<SparqlResults> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': MIME.SPARQL_QUERY,
        Accept: MIME.SPARQL_RESULTS_JSON,
      },
      body: sparql,
      signal: this.buildSignal(options?.signal),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new StoreUnavailableError(`SPARQL query failed (${response.status}): ${errorText}`)
    }

    return response.json() as Promise<SparqlResults>
  }

  async update(sparql: string): Promise<void> {
    const response = await fetch(this.updateEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': MIME.SPARQL_UPDATE,
      },
      body: sparql,
      signal: this.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new StoreUnavailableError(`SPARQL update failed (${response.status}): ${errorText}`)
    }
  }

  async loadTurtle(data: string, graphUri?: string): Promise<void> {
    await this.loadData(data, MIME.TURTLE, graphUri)
  }

  async loadJsonLd(data: string, graphUri?: string): Promise<void> {
    await this.loadData(data, MIME.JSONLD, graphUri)
  }

  /**
   * Generic data-load helper: POST serialized RDF to the Graph Store endpoint.
   * Both loadTurtle and loadJsonLd delegate here — the only difference is the
   * Content-Type header, which the SPARQL Graph Store HTTP Protocol spec
   * uses to select the parser.
   *
   * @see https://www.w3.org/TR/sparql11-http-rdf-update/
   */
  private async loadData(data: string, contentType: string, graphUri?: string): Promise<void> {
    const url = graphUri
      ? `${this.endpoint.replace('/sparql', '/data')}?graph=${encodeURIComponent(graphUri)}`
      : `${this.endpoint.replace('/sparql', '/data')}?default`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: data,
      signal: this.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new StoreUnavailableError(`Failed to load RDF data (${response.status}): ${errorText}`)
    }
  }
}
