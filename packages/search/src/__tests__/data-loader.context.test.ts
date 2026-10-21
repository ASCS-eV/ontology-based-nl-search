import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { resetConfig } from '@ontology-search/core/config'
import { describe, expect, it, vi } from 'vitest'

import { OxigraphStore } from '../../../sparql/src/oxigraph-store.js'
import { contextUrlCandidates, loadSampleData } from '../data-loader.js'

describe('contextUrlCandidates', () => {
  it('keeps exact and trailing-slash variants of a plain context URL', () => {
    expect(contextUrlCandidates('https://example.org/onto/v1/')).toEqual([
      'https://example.org/onto/v1/',
      'https://example.org/onto/v1//',
      'https://example.org/onto/v1',
    ])
  })

  it.each(['https://example.org/onto/v1/context', 'https://example.org/onto/v1#context'])(
    'maps the catalog form %s to the ontology base IRI a local context is indexed by',
    (url) => {
      const candidates = contextUrlCandidates(url)
      expect(candidates).toContain('https://example.org/onto/v1/')
      expect(candidates).toContain('https://example.org/onto/v1')
    }
  )

  it('maps the #context form to the hash namespace a local context is indexed by', () => {
    expect(contextUrlCandidates('https://example.org/onto/v1#context')).toContain(
      'https://example.org/onto/v1#'
    )
  })

  it('does not strip "context" when it is only part of a path segment', () => {
    expect(contextUrlCandidates('https://example.org/mycontext')).not.toContain(
      'https://example.org/my'
    )
  })
})

/**
 * The data loader end to end, from a manifest's `data` directory: a catalog
 * `@context` IRI resolves to a local context — a selected domain's where two
 * claim the same IRI, an unselected domain's where only it does — and Turtle
 * data resolves its relative IRIs against its own location.
 */
describe('loadSampleData — manifest data sources', () => {
  const VOCAB = 'http://example.org/demo#'
  const context = (size: string) => JSON.stringify({ '@context': { '@vocab': VOCAB, size } })

  it('resolves contexts selected-domain first and bases Turtle data on its location', async () => {
    const root = mkdtempSync(join(tmpdir(), 'data-sources-'))
    const dataDir = join(root, 'data')
    for (const domain of ['demo', 'umbrella']) {
      mkdirSync(join(root, 'artifacts', domain), { recursive: true })
    }
    mkdirSync(dataDir)
    writeFileSync(join(root, 'artifacts', 'demo', 'demo.context.jsonld'), context(`${VOCAB}size`))
    // Same @vocab as demo's context, from a domain the selection leaves out.
    writeFileSync(
      join(root, 'artifacts', 'umbrella', 'umbrella.context.jsonld'),
      context('http://example.org/not-selected#size')
    )
    // Only the unselected domain declares this one; data may still use it.
    writeFileSync(
      join(root, 'artifacts', 'umbrella', 'whole.context.jsonld'),
      JSON.stringify({ '@context': { '@vocab': 'http://example.org/whole/' } })
    )
    writeFileSync(
      join(dataDir, 'whole.jsonld'),
      JSON.stringify({
        '@context': 'http://example.org/whole/context',
        '@id': 'urn:item:3',
        '@type': 'Item',
      })
    )
    writeFileSync(
      join(dataDir, 'item.jsonld'),
      JSON.stringify({
        '@context': 'http://example.org/demo#context',
        '@id': 'urn:item:1',
        '@type': 'Item',
        size: 'L',
      })
    )
    writeFileSync(join(dataDir, 'more.ttl'), `<item2> a <${VOCAB}Item> .\n`)
    writeFileSync(
      join(root, 'ontology-sources.json'),
      JSON.stringify({ sources: [{ path: 'artifacts', data: 'data', domains: ['demo'] }] })
    )
    vi.stubEnv('ONTOLOGY_ROOT', root)
    resetConfig()
    try {
      const store = new OxigraphStore()
      await loadSampleData(store)
      const items = await store.query(`SELECT ?s WHERE { ?s a <${VOCAB}Item> } ORDER BY ?s`)
      expect(items.results.bindings.map((b) => b['s']?.value)).toEqual([
        new URL('item2', pathToFileURL(join(dataDir, 'more.ttl'))).href,
        'urn:item:1',
      ])
      const size = await store.query('SELECT ?p WHERE { <urn:item:1> ?p "L" }')
      expect(size.results.bindings.map((b) => b['p']?.value)).toEqual([`${VOCAB}size`])
      const whole = await store.query('SELECT ?t WHERE { <urn:item:3> a ?t }')
      expect(whole.results.bindings.map((b) => b['t']?.value)).toEqual([
        'http://example.org/whole/Item',
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
      vi.unstubAllEnvs()
      resetConfig()
    }
  }, 120_000)
})
