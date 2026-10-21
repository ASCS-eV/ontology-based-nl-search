import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { resetConfig } from '@ontology-search/core/config'
import { describe, expect, it, vi } from 'vitest'

import { OxigraphStore } from '../../../sparql/src/oxigraph-store.js'
import { loadSchemaGraph, SCHEMA_GRAPH, withDocumentBase } from '../schema-loader.js'

/** Generated ontologies can carry relative IRIs and no `@base` (seen in LinkML OWL output). */
const RELATIVE_IRI_TTL = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
<http://example.org/onto/Shape> owl:allValuesFrom <avoided> .
`

describe('withDocumentBase', () => {
  const file = join('/tmp', 'onto', 'demo.owl.ttl')

  it('lets a document with relative IRIs load, resolving them against its location', async () => {
    const store = new OxigraphStore()
    await expect(store.loadTurtle(RELATIVE_IRI_TTL)).rejects.toThrow()

    await store.loadTurtle(withDocumentBase(RELATIVE_IRI_TTL, file))
    const result = await store.query(
      'SELECT ?o WHERE { <http://example.org/onto/Shape> <http://www.w3.org/2002/07/owl#allValuesFrom> ?o }'
    )
    expect(result.results.bindings[0]?.['o']?.value).toBe(
      new URL('avoided', pathToFileURL(file)).href
    )
  })

  it('keeps the document on its original line numbers', () => {
    expect(withDocumentBase('a\nb', file).split('\n')).toHaveLength(2)
  })

  it('lets an @base inside the document take precedence', async () => {
    const store = new OxigraphStore()
    const ttl = '@base <http://example.org/base/> .\n<s> <http://example.org/p> <o> .'
    await store.loadTurtle(withDocumentBase(ttl, file))
    const result = await store.query('SELECT ?s WHERE { ?s <http://example.org/p> ?o }')
    expect(result.results.bindings[0]?.['s']?.value).toBe('http://example.org/base/s')
  })
})

describe('loadSchemaGraph', () => {
  it('loads a schema file with relative IRIs, resolved against its location', async () => {
    const root = mkdtempSync(join(tmpdir(), 'schema-base-iri-'))
    const file = join(root, 'artifacts', 'demo', 'demo.shacl.ttl')
    mkdirSync(join(root, 'artifacts', 'demo'), { recursive: true })
    writeFileSync(file, RELATIVE_IRI_TTL)
    vi.stubEnv('ONTOLOGY_ROOT', root)
    vi.stubEnv('ONTOLOGY_ARTIFACTS_PATH', join(root, 'artifacts'))
    resetConfig()
    try {
      const store = new OxigraphStore()
      expect((await loadSchemaGraph(store)).fileCount).toBe(1)
      const result = await store.query(
        `SELECT ?o WHERE { GRAPH <${SCHEMA_GRAPH}> { <http://example.org/onto/Shape> <http://www.w3.org/2002/07/owl#allValuesFrom> ?o } }`
      )
      expect(result.results.bindings[0]?.['o']?.value).toBe(
        new URL('avoided', pathToFileURL(file)).href
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
      vi.unstubAllEnvs()
      resetConfig()
    }
  }, 120_000)
})
