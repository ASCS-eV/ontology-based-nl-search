import { describe, expect, it } from 'vitest'

import { NUMERIC_DATATYPE_IRIS, numericKind } from '../numeric-datatypes.js'

const XSD = 'http://www.w3.org/2001/XMLSchema#'

describe('numericKind — [RDF11] §5.1 numeric XSD datatypes', () => {
  it.each(['decimal', 'double', 'float'])('classifies xsd:%s as a non-integer number', (t) => {
    expect(numericKind(`${XSD}${t}`)).toBe('float')
  })

  it.each(['integer', 'int', 'long', 'nonNegativeInteger', 'unsignedByte'])(
    'classifies xsd:%s as an integer',
    (t) => {
      expect(numericKind(`${XSD}${t}`)).toBe('integer')
    }
  )

  it.each(['string', 'boolean', 'dateTime', 'anyURI'])('does not treat xsd:%s as numeric', (t) => {
    expect(numericKind(`${XSD}${t}`)).toBeNull()
  })

  it('returns null for an absent datatype', () => {
    expect(numericKind(undefined)).toBeNull()
  })

  it('lists every numeric datatype exactly once, sorted', () => {
    expect(NUMERIC_DATATYPE_IRIS).toHaveLength(16)
    expect([...NUMERIC_DATATYPE_IRIS]).toEqual([...new Set(NUMERIC_DATATYPE_IRIS)].sort())
  })
})
