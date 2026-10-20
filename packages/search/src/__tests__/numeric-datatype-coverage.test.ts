/**
 * Every [RDF11] §5.1 numeric XSD datatype makes a property range-filterable.
 * Only `xsd:integer` and `xsd:float` used to count, so an `xsd:decimal` leaf
 * was typed as a string: the editor's GraphQL schema then rejected the
 * `min:`/`max:` arguments the serializer had emitted for the very same slot.
 * Neutral namespace — no real ontology name enters the test.
 */
import { describe, expect, it } from 'vitest'

import { OxigraphStore } from '../../../sparql/src/oxigraph-store.js'
import { extractNumericProperties } from '../numeric-properties.js'
import { toVocabularyResponse } from '../schema-index/to-vocabulary-response.js'
import { SCHEMA_GRAPH } from '../schema-loader.js'

const NS = 'http://example.org/weather/v1/'

const SCHEMA_TTL = `
@prefix w: <${NS}> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

w:ObsShape a sh:NodeShape ;
  sh:targetClass w:Obs ;
  sh:property [ sh:path w:windSpeed ; sh:datatype xsd:decimal ] ;
  sh:property [ sh:path w:pressure ; sh:datatype xsd:double ] ;
  sh:property [ sh:path w:count ; sh:datatype xsd:nonNegativeInteger ] ;
  sh:property [ sh:path w:gust ; sh:or ( [ sh:datatype xsd:decimal ] [ sh:datatype xsd:integer ] ) ] ;
  sh:property [ sh:path w:note ; sh:datatype xsd:string ] .
`

async function numericProps() {
  const store = new OxigraphStore()
  await store.loadTurtle(SCHEMA_TTL, SCHEMA_GRAPH)
  const names = ['windSpeed', 'pressure', 'count', 'gust', 'note']
  const domains = new Map(names.map((n) => [`${NS}${n}`, new Set(['weather'])]))
  return extractNumericProperties(store, domains)
}

describe('numeric datatype coverage', () => {
  it('discovers decimal, double and integer-subtype leaves as numeric', async () => {
    const byName = Object.fromEntries((await numericProps()).map((p) => [p.localName, p.datatype]))
    expect(byName).toEqual({
      windSpeed: 'float',
      pressure: 'float',
      count: 'integer',
      gust: 'float',
    })
  })

  it('projects a decimal leaf as numeric so the GraphQL schema offers min/max', () => {
    const response = toVocabularyResponse({
      cards: [
        {
          kind: 'property',
          iri: `${NS}windSpeed`,
          localName: 'windSpeed',
          domain: 'weather',
          labels: ['windSpeed'],
          leafKind: 'literal',
          datatype: 'http://www.w3.org/2001/XMLSchema#decimal',
        },
      ],
      byDomain: new Map(),
      domainCatalog: [{ domain: 'weather', classLabels: ['weather'], sampleTerms: [] }],
    })
    expect(response.properties[0]).toMatchObject({ type: 'numeric', datatype: 'float' })
  })
})
