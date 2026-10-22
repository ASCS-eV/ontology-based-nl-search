/**
 * The value hierarchy is read from the schema graph alone: subclass edges and
 * SKOS hierarchies written in either direction, between IRIs only
 * (`value-hierarchy.ts`). Executed against a synthetic, ontology-neutral
 * schema in Oxigraph.
 */
import { describe, expect, it } from 'vitest'

import { OxigraphStore } from '../../../sparql/src/oxigraph-store.js'
import { SCHEMA_GRAPH } from '../schema-loader.js'
import { queryNarrowerValues } from '../value-hierarchy.js'

const EX = 'http://example.org/'

const SCHEMA = `
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix ex: <${EX}> .

ex:Motorway rdfs:subClassOf ex:Road .
ex:Managed rdfs:subClassOf ex:Motorway .
# A self-loop, a blank node and a literal are no edges.
ex:Road rdfs:subClassOf ex:Road .
ex:Road rdfs:subClassOf [ a ex:Restriction ] .
ex:Road rdfs:subClassOf "Road" .
# A concept scheme may write its hierarchy upward or downward.
ex:Wet skos:broader ex:Surface .
ex:Surface skos:narrower ex:Icy .
ex:Puddles skos:broaderTransitive ex:Surface .
ex:Surface skos:narrowerTransitive ex:Slush .
`

/** Hierarchy the instance data asserts is not the schema's. */
const DATA = `
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix ex: <${EX}> .

ex:Gravel rdfs:subClassOf ex:Road .
`

describe('queryNarrowerValues', () => {
  it('maps each broader IRI to the IRIs directly below it in the schema graph', async () => {
    const store = new OxigraphStore()
    await store.loadTurtle(SCHEMA, SCHEMA_GRAPH)
    await store.loadTurtle(DATA)

    const narrower = await queryNarrowerValues(store)
    expect([...narrower].sort()).toEqual([
      [`${EX}Motorway`, [`${EX}Managed`]],
      [`${EX}Road`, [`${EX}Motorway`]],
      [`${EX}Surface`, [`${EX}Icy`, `${EX}Puddles`, `${EX}Slush`, `${EX}Wet`]],
    ])
  }, 30_000)
})
