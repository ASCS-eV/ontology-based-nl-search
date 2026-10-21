/**
 * `POST /search/stream` takes the scope the user selected as `domains`.
 *
 * Every name must be a domain of the loaded ontology: an unknown one is
 * rejected with 400, never dropped, since searching less than the user chose
 * without saying so is what an explicit scope rules out. The names reach the
 * search canonical; an empty list selects nothing and searches everything.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '../app.js'

vi.mock('../search-factory.js', () => ({
  searchNl: vi.fn(),
  searchRefine: vi.fn(),
}))

vi.mock('@ontology-search/search/compiler', () => ({
  canonicalDomains: vi.fn(async (domains: readonly string[]) => ({
    known: domains
      .filter((d) => ['hdmap', 'openlabel'].includes(d.toLowerCase()))
      .map((d) => d.toLowerCase()),
    unknown: domains.filter((d) => !['hdmap', 'openlabel'].includes(d.toLowerCase())),
  })),
}))

vi.mock('@ontology-search/ontology/domain-registry', () => ({
  buildDomainRegistry: vi.fn(async () => ({ domainNames: ['hdmap', 'openlabel'] })),
}))

const RESULT = {
  interpretation: { query: 'q', intent: 'search', domains: ['hdmap'] },
  gaps: [],
  sparql: 'SELECT * WHERE { ?s ?p ?o }',
  execution: { results: [], error: undefined },
  meta: { matchCount: 0, executionTimeMs: 1 },
}

async function stream(body: unknown): Promise<string> {
  const res = await app.request('/search/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.text()
}

beforeEach(async () => {
  vi.clearAllMocks()
  const { searchNl } = await import('../search-factory.js')
  vi.mocked(searchNl).mockResolvedValue(RESULT as never)
})

describe('POST /search/stream with a domain scope', () => {
  it('passes the canonical scope to the search', async () => {
    await stream({ query: 'motorways', domains: ['HDMap', 'openlabel'] })
    const { searchNl } = await import('../search-factory.js')
    expect(vi.mocked(searchNl).mock.lastCall?.[0].domains).toEqual(['hdmap', 'openlabel'])
  })

  it('rejects an unknown domain with 400 and lists the known ones', async () => {
    const text = await stream({ query: 'motorways', domains: ['hdmap', 'atlantis'] })
    expect(text).toContain('event: error')
    expect(text).toContain('Unknown domains: atlantis')
    expect(text).toContain('Known domains: hdmap, openlabel')
    const { searchNl } = await import('../search-factory.js')
    expect(searchNl).not.toHaveBeenCalled()
  })

  it('rejects a scope that is not a list of names', async () => {
    const text = await stream({ query: 'motorways', domains: 'hdmap' })
    expect(text).toContain('event: error')
    // The SSE data line is JSON, so the quotes in the message are escaped.
    expect(text).toContain('Invalid \\"domains\\" field')
  })

  it('searches every domain when the scope is empty or absent', async () => {
    const { searchNl } = await import('../search-factory.js')
    await stream({ query: 'motorways', domains: [] })
    expect(vi.mocked(searchNl).mock.lastCall?.[0]).not.toHaveProperty('domains')
    await stream({ query: 'motorways' })
    expect(vi.mocked(searchNl).mock.lastCall?.[0]).not.toHaveProperty('domains')
  })
})
