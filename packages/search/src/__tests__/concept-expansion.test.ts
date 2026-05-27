/**
 * Concept-hierarchy expansion — generic SKOS-driven value broadening.
 *
 * Drives a synthetic, NON-ENVITED-X SKOS scheme (a geography tree:
 * Europe → Scandinavia → {SE,NO,DK} and Europe → {DE,FR}) through the
 * expansion index. No region table is hardcoded anywhere in source —
 * the index reads whatever `skos:broader`/`skos:narrower` the graph
 * declares, and emits each member's `skos:notation` as the value.
 *
 * If a future change reintroduces a hardcoded continent→country map or
 * breaks the transitive closure, these assertions fail.
 */
import { describe, expect, it } from 'vitest'

import { OxigraphStore } from '../../../sparql/src/oxigraph-store.js'
import {
  buildConceptExpansionIndex,
  expandConceptValue,
  expandFilterConcepts,
} from '../concept-expansion.js'

const SKOS_FIXTURE = `
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix geo: <http://example.org/geo/> .

geo:Europe a skos:Concept ;
    skos:prefLabel "Europe" ;
    skos:altLabel "Europa" ;
    skos:narrower geo:Scandinavia, geo:DE, geo:FR .

geo:Scandinavia a skos:Concept ;
    skos:prefLabel "Scandinavia" ;
    skos:narrower geo:SE, geo:NO, geo:DK .

geo:DE a skos:Concept ; skos:prefLabel "Germany" ; skos:notation "DE" .
geo:FR a skos:Concept ; skos:prefLabel "France" ; skos:notation "FR" .
geo:SE a skos:Concept ; skos:prefLabel "Sweden" ; skos:notation "SE" .
geo:NO a skos:Concept ; skos:prefLabel "Norway" ; skos:notation "NO" .
geo:DK a skos:Concept ; skos:prefLabel "Denmark" ; skos:notation "DK" .
`

async function loadIndex() {
  const store = new OxigraphStore()
  // Concept-expansion queries the default graph + named graphs; load
  // into the default graph here.
  await store.loadTurtle(SKOS_FIXTURE)
  return buildConceptExpansionIndex(store)
}

describe('concept-expansion (generic SKOS)', () => {
  it('expands a top concept transitively to all leaf notations', async () => {
    const index = await loadIndex()
    // Europe → {DE, FR} ∪ Scandinavia{SE, NO, DK}
    expect(expandConceptValue('Europe', index)).toEqual(['DE', 'DK', 'FR', 'NO', 'SE'])
  })

  it('matches case-insensitively and via altLabel', async () => {
    const index = await loadIndex()
    expect(expandConceptValue('europe', index)).toEqual(['DE', 'DK', 'FR', 'NO', 'SE'])
    // altLabel "Europa" (German) resolves to the same concept.
    expect(expandConceptValue('Europa', index)).toEqual(['DE', 'DK', 'FR', 'NO', 'SE'])
  })

  it('expands an intermediate concept to only its own subtree', async () => {
    const index = await loadIndex()
    expect(expandConceptValue('Scandinavia', index)).toEqual(['DK', 'NO', 'SE'])
  })

  it('returns null for a leaf concept (already a concrete member)', async () => {
    const index = await loadIndex()
    expect(expandConceptValue('Germany', index)).toBeNull()
    expect(expandConceptValue('DE', index)).toBeNull()
  })

  it('returns null for an unrelated value', async () => {
    const index = await loadIndex()
    expect(expandConceptValue('not-a-concept', index)).toBeNull()
  })

  it('expandFilterConcepts replaces a broad value, leaves others untouched', async () => {
    const index = await loadIndex()
    const result = expandFilterConcepts({ country: 'Europe', roadTypes: 'motorway' }, index)
    expect(result.country).toEqual(['DE', 'DK', 'FR', 'NO', 'SE'])
    // A non-concept filter is passed through verbatim.
    expect(result.roadTypes).toBe('motorway')
  })

  it('expandFilterConcepts flattens + dedups mixed arrays', async () => {
    const index = await loadIndex()
    // ["Scandinavia", "DE"] → {SE,NO,DK} ∪ {DE}
    const result = expandFilterConcepts({ country: ['Scandinavia', 'DE'] }, index)
    expect(new Set(result.country)).toEqual(new Set(['SE', 'NO', 'DK', 'DE']))
  })

  it('is a no-op for a graph with no SKOS hierarchy', async () => {
    const store = new OxigraphStore()
    await store.loadTurtle(`
      @prefix ex: <http://example.org/> .
      ex:a ex:b ex:c .
    `)
    const index = await buildConceptExpansionIndex(store)
    expect(index.size).toBe(0)
    expect(expandFilterConcepts({ country: 'Europe' }, index)).toEqual({ country: 'Europe' })
  })
})
