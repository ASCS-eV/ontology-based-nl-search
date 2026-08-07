/**
 * Drift guard for the one function this package deliberately keeps in two
 * copies: the Oxigraph term → SPARQL JSON binding conversion, implemented in
 * both `oxigraph-store.ts` and `oxigraph-worker.ts`.
 *
 * The duplication is forced (see the comment in `oxigraph-worker.ts`): the
 * conversion must run inside the worker, because an Oxigraph term is a
 * WASM-backed handle whose only own property is a pointer into that thread's
 * heap — `structuredClone` copies it happily and the result is meaningless —
 * and the worker cannot import a sibling module because its dev-mode `tsx`
 * loader will not resolve a relative `./x.js` specifier to `.ts`.
 *
 * What is NOT forced is the two copies disagreeing. Both drivers implement the
 * same `SparqlStore` contract and are chosen by `SPARQL_MODE`, so a term the
 * two shape differently is a bug that only shows up under one deployment. This
 * runs both real stores over one table of terms and requires identical output.
 *
 * @see https://www.w3.org/TR/sparql11-results-json/ — [SPARQL11-JSON] §3 bindings
 */
import { afterAll, describe, expect, it } from 'vitest'

import { OxigraphStore } from '../oxigraph-store.js'
import type { SparqlBinding } from '../types.js'
import { WorkerOxigraphStore } from '../worker-oxigraph-store.js'

/**
 * One Turtle document covering every term shape the conversion branches on:
 * an IRI object, a plain literal (implicit `xsd:string`, whose datatype must be
 * OMITTED per [SPARQL11-JSON] §3.2.2), a language-tagged literal, and a
 * typed literal whose datatype must be REPORTED.
 */
const FIXTURE = `
<urn:s:1> <urn:p:iri>   <urn:o:target> .
<urn:s:1> <urn:p:plain> "plain string" .
<urn:s:1> <urn:p:lang>  "Straße"@de .
<urn:s:1> <urn:p:typed> "42"^^<http://www.w3.org/2001/XMLSchema#integer> .
`

const QUERY = 'SELECT ?p ?o WHERE { <urn:s:1> ?p ?o } ORDER BY ?p'

const direct = new OxigraphStore()
const worker = new WorkerOxigraphStore()

afterAll(async () => {
  await worker.terminate()
})

/** Run the fixture through a store and return its bindings, ordered. */
async function bindingsFrom(store: {
  loadTurtle: (data: string) => Promise<void>
  query: (q: string) => Promise<{ results: { bindings: SparqlBinding[] } }>
}): Promise<SparqlBinding[]> {
  await store.loadTurtle(FIXTURE)
  const res = await store.query(QUERY)
  return res.results.bindings
}

describe('Oxigraph binding conversion — parity across the two drivers', () => {
  it('shapes every term type identically in the direct and worker stores', async () => {
    const [fromDirect, fromWorker] = await Promise.all([bindingsFrom(direct), bindingsFrom(worker)])

    // Guard against a vacuous pass: an empty result set would compare equal.
    expect(fromDirect).toHaveLength(4)
    expect(fromWorker).toEqual(fromDirect)
  }, 60_000)

  it('reports each term shape per SPARQL 1.1 JSON', async () => {
    const byPredicate = new Map((await bindingsFrom(direct)).map((b) => [b['p']?.value, b['o']]))

    expect(byPredicate.get('urn:p:iri')).toEqual({ type: 'uri', value: 'urn:o:target' })
    // Implicit xsd:string carries no `datatype` key at all.
    expect(byPredicate.get('urn:p:plain')).toEqual({ type: 'literal', value: 'plain string' })

    /**
     * Known deviation, pinned rather than asserted-as-correct: both drivers
     * also report `datatype: rdf:langString` on a language-tagged literal.
     * [SPARQL11-JSON] §3.2.2 encodes such a literal as `type`/`value`/`xml:lang`
     * and its example carries no datatype; RDF 1.1 does define rdf:langString as
     * the datatype, so this is redundant rather than wrong. Consumers already
     * work around it — see the `sh:in` handling in
     * `search/schema-index/fragment-extractor.ts`, which drops a bare
     * rdf:langString when serializing Turtle. Normalizing it away is a change to
     * store OUTPUT and belongs with that consumer cleanup, not in a
     * de-duplication commit; this assertion exists so the change is deliberate
     * when someone makes it.
     */
    const lang = byPredicate.get('urn:p:lang')
    expect(lang).toMatchObject({ type: 'literal', value: 'Straße', 'xml:lang': 'de' })
    expect(lang?.datatype).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString')
    expect(byPredicate.get('urn:p:typed')).toEqual({
      type: 'literal',
      value: '42',
      datatype: 'http://www.w3.org/2001/XMLSchema#integer',
    })
  }, 60_000)
})
