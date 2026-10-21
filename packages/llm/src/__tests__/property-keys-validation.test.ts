/**
 * Slot validation of property keys (ADR 0009): a qualified key names one
 * chain, a bare name every chain of that name. The validator accepts the bare
 * name with the values of all its chains, and the SHACL gate validates a key
 * against the property shapes of its chains in the domains being searched.
 * Synthetic vocabulary; the SHACL engine is a recording stub.
 */
import type {
  PropertyShapeTarget,
  ShaclValidationResult,
  ShaclValidator,
} from '@ontology-search/ontology/shacl-validator'
import type { SchemaVocabulary } from '@ontology-search/search'
import { describe, expect, it } from 'vitest'

import { validateRangesAgainstShacl, validateSlotsAgainstShacl } from '../slot-validator.js'
import { buildAllowedValuesIndex, buildNumericPropertySet } from '../slot-validator-fuzzy.js'

const EX = 'http://example.org/garage/v1/'

/** Two domains: `garage` reaches `value` through colour and size; `shop` once. */
const vocabulary: SchemaVocabulary = {
  enumProperties: [
    {
      iri: `${EX}value`,
      localName: 'colour__value',
      leafName: 'value',
      label: 'colour value',
      description: '',
      allowedValues: ['blue', 'red'],
      domain: 'garage',
    },
    {
      iri: `${EX}value`,
      localName: 'size__value',
      leafName: 'value',
      label: 'size value',
      description: '',
      allowedValues: ['L', 'S'],
      domain: 'garage',
    },
  ],
  numericProperties: [
    {
      iri: `${EX}amount`,
      localName: 'price__amount',
      leafName: 'amount',
      label: 'price amount',
      description: '',
      datatype: 'float',
      domain: 'garage',
    },
  ],
  domains: ['garage', 'shop'],
  propertyDomains: new Map([
    ['colour__value', ['garage']],
    ['size__value', ['garage']],
    ['value', ['garage', 'shop']],
    ['price__amount', ['garage']],
    ['amount', ['garage']],
  ]),
  propertyShapeTargets: new Map([
    ['colour__value', [{ domain: 'garage', iri: `${EX}value`, targetClass: `${EX}ColourValue` }]],
    [
      'value',
      [
        { domain: 'garage', iri: `${EX}value`, targetClass: `${EX}ColourValue` },
        { domain: 'garage', iri: `${EX}value`, targetClass: `${EX}SizeValue` },
        { domain: 'shop', iri: `${EX}value`, targetClass: `${EX}Label` },
      ],
    ],
    ['price__amount', [{ domain: 'garage', iri: `${EX}amount`, targetClass: `${EX}Money` }]],
  ]),
  conceptSchemes: new Map(),
  classHierarchy: [],
}

/** A SHACL engine stub: knows no key by local name, records target calls. */
function recordingValidator(
  conformsUnder: (target: PropertyShapeTarget & { domain?: string }) => boolean
) {
  const calls: PropertyShapeTarget[][] = []
  const validate = (targets: readonly PropertyShapeTarget[]) => {
    calls.push([...targets])
    const conforms = targets.some(conformsUnder)
    return { conforms, violations: [], resolvedIris: [...new Set(targets.map((t) => t.iri))] }
  }
  const validator = {
    isKnownSlotKey: () => false,
    validateBySlotName: async (): Promise<ShaclValidationResult & { resolvedIris: string[] }> => {
      throw new Error('a key with shape targets must not be resolved by local name')
    },
    validateAgainstTargets: async (targets: readonly PropertyShapeTarget[]) => validate(targets),
    validateAgainstTargetsBatch: async (
      targets: readonly PropertyShapeTarget[],
      values: readonly string[]
    ) => new Map(values.map((v) => [String(v), validate(targets)])),
  }
  return { validator: validator as unknown as ShaclValidator, calls }
}

describe('allowed values of property keys', () => {
  it('gives a qualified key its chain’s values and the bare name all of them', () => {
    const index = buildAllowedValuesIndex(vocabulary)
    expect(index.get('colour__value')?.allowedValues).toEqual(['blue', 'red'])
    expect(index.get('value')?.allowedValues.sort()).toEqual(['L', 'S', 'blue', 'red'])
  })

  it('counts a qualified numeric key and its leaf name as numeric', () => {
    expect([...buildNumericPropertySet(vocabulary)].sort()).toEqual(['amount', 'price__amount'])
  })
})

describe('SHACL gate for property keys', () => {
  it('knows a qualified key the engine cannot resolve by local name', async () => {
    const { validator } = recordingValidator(() => true)
    const ranges = validateRangesAgainstShacl({ price__amount: { min: 1 } }, validator, vocabulary)
    expect(ranges.gaps).toEqual([])
    expect(ranges.ranges).toEqual({ price__amount: { min: 1 } })
  })

  it('validates a qualified key against its own chain only', async () => {
    const { validator, calls } = recordingValidator(() => true)
    // Not in colour's sh:in, so the gate asks the engine.
    await validateSlotsAgainstShacl({ colour__value: 'green' }, validator, vocabulary, undefined, [
      'garage',
    ])
    expect(calls).toEqual([
      [{ domain: 'garage', iri: `${EX}value`, targetClass: `${EX}ColourValue` }],
    ])
  })

  it('validates a bare name against the chains of the searched domains only', async () => {
    // Only the shop's chain would accept it; the garage is searched.
    const { validator, calls } = recordingValidator((t) => t.domain === 'shop')
    const result = await validateSlotsAgainstShacl(
      { value: 'green' },
      validator,
      vocabulary,
      undefined,
      ['garage']
    )
    expect(calls[0]?.map((t) => t.targetClass)).toEqual([`${EX}ColourValue`, `${EX}SizeValue`])
    expect(result.filters).toEqual({})
    expect(result.gaps.map((g) => g.term)).toEqual(['green'])
  })

  it('keeps a bare-name value that one chain of the searched domain accepts', async () => {
    const { validator } = recordingValidator((t) => t.targetClass === `${EX}SizeValue`)
    const result = await validateSlotsAgainstShacl(
      { value: 'XL' },
      validator,
      vocabulary,
      undefined,
      ['garage']
    )
    expect(result.filters).toEqual({ value: 'XL' })
  })

  it('falls back to every chain when no searched domain owns the key', async () => {
    const { validator, calls } = recordingValidator(() => true)
    await validateSlotsAgainstShacl({ value: 'green' }, validator, vocabulary, undefined, [
      'elsewhere',
    ])
    expect(calls[0]).toHaveLength(3)
  })
})
