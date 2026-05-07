import type { SparqlStore, SparqlResults } from './types'

/**
 * Remote SPARQL store that sends queries to an external endpoint.
 * Used for production with Apache Jena Fuseki or any SPARQL 1.1 endpoint.
 */
export class RemoteSparqlStore implements SparqlStore {
  private endpoint: string
  private updateEndpoint: string

  constructor(endpoint: string, updateEndpoint?: string) {
    this.endpoint = endpoint
    // Fuseki convention: /sparql for query, /update for updates
    this.updateEndpoint = updateEndpoint || endpoint.replace('/sparql', '/update')
  }

  async isReady(): Promise<boolean> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sparql-query',
          Accept: 'application/sparql-results+json',
        },
        body: 'ASK { ?s ?p ?o }',
      })
      return response.ok
    } catch {
      return false
    }
  }

  async query(sparql: string): Promise<SparqlResults> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        Accept: 'application/sparql-results+json',
      },
      body: sparql,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`SPARQL query failed (${response.status}): ${errorText}`)
    }

    return response.json()
  }

  async update(sparql: string): Promise<void> {
    const response = await fetch(this.updateEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-update',
      },
      body: sparql,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`SPARQL update failed (${response.status}): ${errorText}`)
    }
  }

  async loadTurtle(data: string, graphUri?: string): Promise<void> {
    const url = graphUri
      ? `${this.endpoint.replace('/sparql', '/data')}?graph=${encodeURIComponent(graphUri)}`
      : `${this.endpoint.replace('/sparql', '/data')}?default`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/turtle' },
      body: data,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to load Turtle data (${response.status}): ${errorText}`)
    }
  }

  async loadJsonLd(data: string, graphUri?: string): Promise<void> {
    const url = graphUri
      ? `${this.endpoint.replace('/sparql', '/data')}?graph=${encodeURIComponent(graphUri)}`
      : `${this.endpoint.replace('/sparql', '/data')}?default`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/ld+json' },
      body: data,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to load JSON-LD data (${response.status}): ${errorText}`)
    }
  }
}
