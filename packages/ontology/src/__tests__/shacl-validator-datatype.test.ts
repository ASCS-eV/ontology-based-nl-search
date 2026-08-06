/**
 * The candidate node the validator synthesizes for a slot value must carry the
 * datatype the SHAPES declare, not one guessed from the host value's runtime
 * type.
 *
 * `sh:datatype` holds only when the literal's datatype IRI EQUALS the declared
 * one [SHACL] §4.2.3 — SHACL performs no numeric promotion. Typing the literal
 * from the JS type therefore rejected valid values in both directions, and the
 * `sh:minInclusive` comparison then failed in cascade because it cannot order a
 * plain string. Both directions are asserted here against the real pinned
 * shapes, together with the rejections that must survive the fix.
 */
import { RDF_PREFIXES } from '@ontology-search/core/rdf/prefixes'
import type { Quad } from '@rdfjs/types'
import { describe, expect, it } from 'vitest'

import { ShaclValidator } from '../shacl-validator.js'
import { buildCandidateDataset } from '../shacl-validator-candidates.js'

const XSD = RDF_PREFIXES.xsd
const PROP = 'https://example.test/p'
const CLS = 'https://example.test/C'

/** The object of the property triple in a freshly built candidate dataset. */
function objectOf(ds: Iterable<Quad>): Quad['object'] {
  for (const q of ds) if (q.predicate.value === PROP) return q.object
  throw new Error('candidate dataset carries no property triple')
}

describe('candidate synthesis types literals from the declared datatype', () => {
  it('types a lexically valid string with the declared numeric datatype', () => {
    const object = objectOf(
      buildCandidateDataset(PROP, '5', CLS, new Set([`${XSD}integer`])) as Iterable<Quad>
    )
    expect(object.termType).toBe('Literal')
    expect((object as { datatype: { value: string } }).datatype.value).toBe(`${XSD}integer`)
  })

  it('types a whole number as the declared float, not as xsd:integer', () => {
    const object = objectOf(
      buildCandidateDataset(PROP, 5, CLS, new Set([`${XSD}float`])) as Iterable<Quad>
    )
    expect((object as { datatype: { value: string } }).datatype.value).toBe(`${XSD}float`)
  })

  it('leaves a lexically invalid value untyped so the engine reports it honestly', () => {
    const object = objectOf(
      buildCandidateDataset(PROP, 'abc', CLS, new Set([`${XSD}integer`])) as Iterable<Quad>
    )
    expect((object as { datatype: { value: string } }).datatype.value).toBe(`${XSD}string`)
  })

  it('declines to choose when several declared datatypes could accept the value', () => {
    const object = objectOf(
      buildCandidateDataset(
        PROP,
        '5',
        CLS,
        new Set([`${XSD}integer`, `${XSD}float`])
      ) as Iterable<Quad>
    )
    expect((object as { datatype: { value: string } }).datatype.value).toBe(`${XSD}string`)
  })
})

describe('slot validation against the real shapes', () => {
  /**
   * The reproduced defect: search sends filter values as strings, so an
   * integer-valued property received `"5"` as an xsd:string and reported both a
   * DatatypeConstraintComponent and a cascading MinInclusiveConstraintComponent
   * violation for a perfectly valid quantity.
   */
  it('accepts a valid integer quantity supplied as a filter string', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    for (const slot of ['numberIntersections', 'numberTrafficLights']) {
      const result = await validator.validateBySlotName(slot, '5')
      expect(result.resolvedIris.length).toBeGreaterThan(0)
      expect(result.violations.map((v) => v.sourceConstraintComponent)).toEqual([])
      expect(result.conforms).toBe(true)
    }
  }, 300000)

  it('accepts a whole number for a float-typed property', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    const result = await validator.validateBySlotName('accuracyObjects', 5)
    expect(result.conforms).toBe(true)
  }, 300000)

  /**
   * The fix must not become a rubber stamp: everything the validator was right
   * to reject must still be rejected.
   */
  it.each([
    ['numberIntersections', 'abc', 'not an integer at all'],
    ['numberIntersections', '3.7', 'a decimal for an integer property'],
    ['numberIntersections', '-5', 'below the declared minimum'],
    ['country', 'NOT_A_COUNTRY', 'fails the declared pattern'],
    ['roadTypes', 'motorway_entry', 'retired from the vocabulary in OMB v0.4.0'],
  ])(
    'still rejects %s=%s (%s)',
    async (slot, value) => {
      const validator = await ShaclValidator.fromWorkspace()
      const result = await validator.validateBySlotName(slot, value)
      expect(result.conforms).toBe(false)
      expect(result.violations.length).toBeGreaterThan(0)
    },
    300000
  )

  it('still accepts values the vocabulary declares', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    expect((await validator.validateBySlotName('roadTypes', 'motorway')).conforms).toBe(true)
    expect((await validator.validateBySlotName('country', 'DE')).conforms).toBe(true)
  }, 300000)
})
