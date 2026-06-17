import { describe, expect, it } from 'vitest'

import { enumEncodableValues, enumPropertyMembers, isGraphQLEnumName } from '../graphql/enum.js'

describe('isGraphQLEnumName', () => {
  it('accepts valid GraphQL names', () => {
    expect(isGraphQLEnumName('DE')).toBe(true)
    expect(isGraphQLEnumName('motorway')).toBe(true)
    expect(isGraphQLEnumName('_private')).toBe(true)
    expect(isGraphQLEnumName('lane2')).toBe(true)
  })

  it('rejects names that are not valid enum values', () => {
    expect(isGraphQLEnumName('2lanes')).toBe(false) // leading digit
    expect(isGraphQLEnumName('A/B')).toBe(false) // slash
    expect(isGraphQLEnumName('with space')).toBe(false)
    expect(isGraphQLEnumName('https://example.org/x')).toBe(false)
    expect(isGraphQLEnumName('')).toBe(false)
    expect(isGraphQLEnumName('true')).toBe(false) // reserved
    expect(isGraphQLEnumName('null')).toBe(false)
  })
})

describe('enumEncodableValues', () => {
  it('returns sorted unique values when all are valid enum names', () => {
    expect(enumEncodableValues(['urban', 'motorway', 'urban'])).toEqual(['motorway', 'urban'])
  })

  it('returns null when any value is not a valid enum name (string fallback)', () => {
    expect(enumEncodableValues(['DE', 'A/B'])).toBeNull()
  })

  it('returns null for an empty list', () => {
    expect(enumEncodableValues([])).toBeNull()
  })
})

describe('enumPropertyMembers', () => {
  it('returns name -> sorted members for fully enum-encodable names', () => {
    const members = enumPropertyMembers([
      { name: 'roadType', allowedValues: ['urban', 'motorway'] },
      { name: 'numberOfLanes', allowedValues: undefined },
    ])
    expect(members.get('roadType')).toEqual(['motorway', 'urban'])
    expect(members.has('numberOfLanes')).toBe(false)
  })

  it('unions values across occurrences of the same name (cross-domain)', () => {
    const members = enumPropertyMembers([
      { name: 'country', allowedValues: ['DE'] },
      { name: 'country', allowedValues: ['AT', 'DE'] },
    ])
    expect(members.get('country')).toEqual(['AT', 'DE'])
  })

  it('excludes a name when any occurrence has a non-encodable value', () => {
    const members = enumPropertyMembers([
      { name: 'region', allowedValues: ['North'] },
      { name: 'region', allowedValues: ['A/B'] },
    ])
    expect(members.has('region')).toBe(false)
  })
})
