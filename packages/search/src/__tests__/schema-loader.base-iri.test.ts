import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

import { OxigraphStore } from '../../../sparql/src/oxigraph-store.js'
import { withDocumentBase } from '../schema-loader.js'

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
