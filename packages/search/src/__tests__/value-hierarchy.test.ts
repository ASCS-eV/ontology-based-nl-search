/**
 * A broad IRI filter value is expanded into itself and the values below it in
 * the schema's hierarchy (`value-hierarchy.ts`), at every reference depth,
 * before the compiler emits its filter. Pure: no store.
 */
import { normalizeReferences } from '@ontology-search/slots/slots'
import { describe, expect, it } from 'vitest'

import { expandNarrowerValues, withNarrowerValues } from '../value-hierarchy.js'

const EX = 'http://example.org/'
const NARROWER = new Map([
  [`${EX}Road`, [`${EX}Motorway`, `${EX}Rural`]],
  [`${EX}Motorway`, [`${EX}MotorwayManaged`]],
  // A cycle in the declared hierarchy is walked once.
  [`${EX}MotorwayManaged`, [`${EX}Motorway`]],
])

describe('withNarrowerValues', () => {
  it('lists the value and everything below it, transitively and sorted', () => {
    expect(withNarrowerValues(`${EX}Road`, NARROWER)).toEqual([
      `${EX}Motorway`,
      `${EX}MotorwayManaged`,
      `${EX}Road`,
      `${EX}Rural`,
    ])
  })

  it('lists only the value when nothing is below it', () => {
    expect(withNarrowerValues(`${EX}Rural`, NARROWER)).toEqual([`${EX}Rural`])
  })
})

describe('expandNarrowerValues', () => {
  it('expands IRI values, leaves literals and ranges alone, and merges the alternatives', () => {
    const slots = expandNarrowerValues(
      {
        domains: ['d'],
        filters: { roadType: [`${EX}Motorway`, `${EX}Rural`], country: 'DE' },
        ranges: { lanes: { min: 2 } },
      },
      NARROWER
    )
    expect(slots.filters).toEqual({
      roadType: [`${EX}Motorway`, `${EX}MotorwayManaged`, `${EX}Rural`],
      country: 'DE',
    })
    expect(slots.ranges).toEqual({ lanes: { min: 2 } })
  })

  it('expands the filters of references at every depth', () => {
    const slots = expandNarrowerValues(
      {
        domains: ['d'],
        filters: {},
        ranges: {},
        references: [
          {
            domain: 'map',
            filters: { roadType: `${EX}Motorway` },
            references: [{ domain: 'tile', filters: { roadType: `${EX}Rural` } }],
          },
        ],
      },
      NARROWER
    )
    const [map] = normalizeReferences(slots.references)
    expect(map?.filters).toEqual({ roadType: [`${EX}Motorway`, `${EX}MotorwayManaged`] })
    expect(map?.references?.[0]?.filters).toEqual({ roadType: `${EX}Rural` })
  })
})
