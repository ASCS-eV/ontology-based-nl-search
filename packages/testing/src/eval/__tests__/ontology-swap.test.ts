/**
 * Ontology-swap gate — the genericity proof.
 *
 * Points the WHOLE pipeline at the synthetic toyverse ontology (three tiny
 * domains: base ← book, press, with an sh:in enum, a numeric property, a
 * cross-domain sh:class reference, and JSON-LD contexts) and asserts that
 * schema loading, the term index, retrieval, fragment extraction, the
 * autocomplete projection, and the SPARQL compiler all work with ZERO code
 * change. Any hardcoded real-ontology identifier in a production code path
 * fails here, because none of the real ontology is loaded.
 *
 * The suite runs in its own vitest process (fileParallelism: false,
 * isolate) so the process-wide singletons (config, store, registry,
 * indices) are built once, against the fixture only.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

function findRepoRoot(start: string): string {
  let cur = start
  while (cur !== '/') {
    if (existsSync(join(cur, 'pnpm-workspace.yaml'))) return cur
    cur = dirname(cur)
  }
  throw new Error(`Could not find pnpm-workspace.yaml above ${start}`)
}

const REPO_ROOT = findRepoRoot(dirname(fileURLToPath(import.meta.url)))
const FIXTURE_DIR = join(REPO_ROOT, 'packages/testing/fixtures/toyverse')

type SearchModule = typeof import('@ontology-search/search')

let workspaceRoot: string
let search: SearchModule
let store: Awaited<ReturnType<SearchModule['getInitializedStore']>>

beforeAll(async () => {
  workspaceRoot = mkdtempSync(join(tmpdir(), 'ontology-swap-'))
  writeFileSync(
    join(workspaceRoot, 'ontology-sources.json'),
    JSON.stringify({ sources: [{ path: relative(workspaceRoot, FIXTURE_DIR) }] })
  )
  process.env['ONTOLOGY_ROOT'] = workspaceRoot
  const { resetConfig } = await import('@ontology-search/core/config')
  resetConfig()

  search = await import('@ontology-search/search')
  store = await search.getInitializedStore()
  await search.warmupRetrievalIndex(store)
}, 180_000)

afterAll(() => {
  rmSync(workspaceRoot, { recursive: true, force: true })
})

describe('ontology swap — schema loading and term index', () => {
  it('indexes the fixture domains with enum, numeric, and label data', async () => {
    const index = await search.buildTermIndex(store)

    const genre = index.cards.find((c) => c.localName === 'genre' && c.kind === 'property')
    expect(genre).toMatchObject({
      domain: 'book',
      allowedValues: ['fantasy', 'poetry', 'scifi'],
    })
    expect(genre?.labels).toContain('genre')

    const pageCount = index.cards.find((c) => c.localName === 'pageCount')
    expect(pageCount?.datatype).toContain('integer')
    // Label enrichment from the fixture's JSON-LD context alias.
    expect(pageCount?.labels).toContain('pages')
  })

  it('derives the cross-domain dependency edge from sh:class', async () => {
    const index = await search.buildTermIndex(store)
    const publisher = index.cards.find((c) => c.localName === 'hasPublisher')
    expect(publisher?.referencesDomain).toBe('press')
  })

  it('builds a catalog entry per fixture domain', async () => {
    const index = await search.buildTermIndex(store)
    const catalogDomains = index.domainCatalog.map((d) => d.domain)
    expect(catalogDomains).toContain('book')
    expect(catalogDomains).toContain('press')
  })
})

describe('ontology swap — retrieval', () => {
  it('routes a toy query and selects its cards with parseable fragments', async () => {
    const retrieved = await search.retrieveRelevantSchema(store, 'genre fantasy')

    expect(retrieved.domains[0]).toBe('book')
    expect(retrieved.confidence).toBeGreaterThanOrEqual(0.5)
    expect(retrieved.cards.some((c) => c.localName === 'genre')).toBe(true)

    expect(retrieved.fragments.length).toBeGreaterThan(0)
    for (const [i, fragment] of retrieved.fragments.entries()) {
      await store.loadTurtle(fragment.turtle, `urn:test:swap-fragment-${i}`)
    }
  })

  it('pulls the referenced domain transitively for object-property queries', async () => {
    const retrieved = await search.retrieveRelevantSchema(store, 'publisher')
    const reachable = new Set([...retrieved.domains, ...retrieved.cards.map((c) => c.domain)])
    expect(reachable.has('press')).toBe(true)
  })

  it('preserves gap detection: absent terms yield low confidence but the full catalog', async () => {
    const retrieved = await search.retrieveRelevantSchema(store, 'zzqx flibber blorp')
    expect(retrieved.confidence).toBeLessThan(0.2)
    expect(retrieved.catalog.length).toBeGreaterThanOrEqual(2)
  })
})

describe('ontology swap — downstream consumers', () => {
  it('projects the autocomplete vocabulary from the fixture index', async () => {
    const response = search.toVocabularyResponse(await search.buildTermIndex(store))

    expect(response.properties.find((p) => p.name === 'genre')).toMatchObject({
      type: 'enum',
      domain: 'book',
      allowedValues: ['fantasy', 'poetry', 'scifi'],
    })
    expect(response.properties.find((p) => p.name === 'foundedYear')).toMatchObject({
      type: 'numeric',
      datatype: 'integer',
    })
  })

  it('discovers the fixture asset domains from the cross-domain hierarchy', async () => {
    const assetDomains = await search.getAssetDomains()
    expect(assetDomains.has('book')).toBe(true)
    expect(assetDomains.has('press')).toBe(true)
  })

  it('compiles deterministic SPARQL for a toy slot set', async () => {
    const sparql = await search.compileSlots({
      domains: ['book'],
      filters: { genre: 'fantasy' },
      ranges: {},
    })

    expect(sparql).toContain('https://example.org/toyverse/book/v1/')
    expect(sparql).toContain('fantasy')
  })
})
