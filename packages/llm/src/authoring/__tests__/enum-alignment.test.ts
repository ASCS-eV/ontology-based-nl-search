/**
 * The alignment of IR enumeration values to the `sh:in` lists of a SHACL
 * document (`enum-alignment.ts`), on a synthetic vocabulary.
 */
import { describe, expect, it } from 'vitest'

import { alignEnumValues, enumVocabularyFromShacl } from '../enum-alignment.js'

const SHACL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/scene/> .

ex:DynamicsShape a sh:NodeShape ;
  sh:targetClass ex:Dynamics ;
  sh:property [ sh:path ex:shape ; sh:in ( "cubic" "linear" "step" ) ] .
ex:OtherDynamicsShape a sh:NodeShape ;
  sh:targetClass ex:OtherDynamics ;
  sh:property [ sh:path ex:shape ; sh:in ( "sinusoidal" ) ] ;
  sh:property [ sh:path ex:name ] .
`

const scene = (properties: Record<string, string | string[]>) => ({
  entities: [{ ref: 'Ego', type: 'Vehicle', properties: { name: 'Ego' } }],
  actions: [{ actor: 'Ego', kind: 'LaneChangeAction', properties }],
})

describe('enumVocabularyFromShacl', () => {
  it('lists each property once, with the union of its lists, sorted', async () => {
    const vocabulary = await enumVocabularyFromShacl(SHACL)
    expect([...vocabulary]).toEqual([['shape', ['cubic', 'linear', 'sinusoidal', 'step']]])
  })

  it('is empty without a document', async () => {
    expect((await enumVocabularyFromShacl('')).size).toBe(0)
  })
})

describe('alignEnumValues', () => {
  it('replaces a value by the member it is closest to and records it', async () => {
    const vocabulary = await enumVocabularyFromShacl(SHACL)
    const { ir, corrections } = alignEnumValues(
      scene({ shape: 'Linear', name: 'Linear' }),
      vocabulary
    )
    expect(ir.actions[0]?.properties).toEqual({ shape: 'linear', name: 'Linear' })
    expect(corrections).toEqual([
      { where: 'action Ego LaneChangeAction', property: 'shape', from: 'Linear', to: 'linear' },
    ])
  })

  it('aligns each value of a list and leaves exact members alone', async () => {
    const vocabulary = await enumVocabularyFromShacl(SHACL)
    const { ir, corrections } = alignEnumValues(scene({ shape: ['cubic', 'Steps'] }), vocabulary)
    expect(ir.actions[0]?.properties['shape']).toEqual(['cubic', 'step'])
    expect(corrections.map((c) => c.from)).toEqual(['Steps'])
  })

  it('leaves a far-off value and a parameter reference to the gates', async () => {
    const vocabulary = await enumVocabularyFromShacl(SHACL)
    const input = scene({ shape: 'bogus' })
    expect(alignEnumValues(input, vocabulary)).toEqual({ ir: input, corrections: [] })
    const parameter = scene({ shape: '$shape' })
    expect(alignEnumValues(parameter, vocabulary).ir).toBe(parameter)
  })

  it('returns the same object when nothing changes', async () => {
    const vocabulary = await enumVocabularyFromShacl(SHACL)
    const input = scene({ shape: 'linear' })
    expect(alignEnumValues(input, vocabulary).ir).toBe(input)
    expect(alignEnumValues(input, new Map()).ir).toBe(input)
  })
})
