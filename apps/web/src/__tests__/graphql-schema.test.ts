import { GraphQLEnumType, GraphQLObjectType, parse, validate } from 'graphql'
import { describe, expect, it } from 'vitest'

import type { Vocabulary } from '../hooks/useVocabulary'
import { buildGraphQLSchema } from '../lib/graphql-schema'

const vocab: Vocabulary = {
  domains: ['hdmap', 'ositrace'],
  properties: [
    {
      name: 'roadTypes',
      label: 'Road types',
      description: '',
      domain: 'hdmap',
      type: 'enum',
      allowedValues: ['motorway', 'urban'],
    },
    {
      name: 'numberIntersections',
      label: 'Number of intersections',
      description: '',
      domain: 'hdmap',
      type: 'numeric',
      datatype: 'integer',
    },
  ],
}

describe('buildGraphQLSchema (editor query contract from discovery)', () => {
  const schema = buildGraphQLSchema(vocab)
  const errorsFor = (query: string) => validate(schema, parse(query))

  it('accepts a valid query: domain + enum filter + numeric range + _all', () => {
    expect(
      errorsFor(
        'query { hdmap { roadTypes(values: [motorway]) numberIntersections(min: 1) _all } }'
      )
    ).toHaveLength(0)
  })

  it('accepts a field-based reference query with enum + range (the dead zone is gone)', () => {
    expect(
      errorsFor(
        'query { ositrace { references { hdmap(label: "x") { roadTypes(values: [motorway]) numberIntersections(min: 1) } } } }'
      )
    ).toHaveLength(0)
  })

  it('accepts a nested reference (reference of a reference)', () => {
    expect(
      errorsFor('query { ositrace { references { hdmap { references { ositrace { _all } } } } } }')
    ).toHaveLength(0)
  })

  it('rejects an unknown referenced domain', () => {
    expect(
      errorsFor('query { ositrace { references { nosuchDomain { _all } } } }').length
    ).toBeGreaterThan(0)
  })

  it('rejects an unknown field on a referenced domain (references are now typed)', () => {
    expect(
      errorsFor('query { ositrace { references { hdmap { bogusField } } } }').length
    ).toBeGreaterThan(0)
  })

  it('exposes `references` as a field whose targets are the discovered domains', () => {
    const refs = schema.getType('References') as GraphQLObjectType
    expect(Object.keys(refs.getFields()).sort()).toEqual(['hdmap', 'ositrace'])
    // each target returns that domain's result type and accepts an optional label
    const hdmapRef = refs.getFields()['hdmap']
    expect(String(hdmapRef?.type)).toBe('hdmap_Result')
    expect(hdmapRef?.args.find((a) => a.name === 'label')).toBeDefined()
  })

  it('rejects an unknown domain (schema-aware validation, not just syntax)', () => {
    expect(errorsFor('query { nosuchDomain { _all } }').length).toBeGreaterThan(0)
  })

  it('rejects an unknown field on a known domain', () => {
    expect(errorsFor('query { hdmap { bogusField } }').length).toBeGreaterThan(0)
  })

  it('always exposes every discovered domain as a query field', () => {
    expect(errorsFor('query { ositrace { _all } }')).toHaveLength(0)
  })

  it('types numeric fields as Range and categorical fields as Filter (not Boolean)', () => {
    // Regression: every property field was typed Boolean, so the editor's
    // autocomplete showed ": Boolean" everywhere and conveyed no structure.
    const hdmap = schema.getType('hdmap_Result') as GraphQLObjectType
    const fields = hdmap.getFields()
    expect(String(fields['numberIntersections']?.type)).toBe('Range')
    expect(String(fields['roadTypes']?.type)).toBe('Filter')
  })

  it('types numeric bound arguments by datatype (integer -> Int) and documents it', () => {
    const hdmap = schema.getType('hdmap_Result') as GraphQLObjectType
    const minArg = hdmap.getFields()['numberIntersections']?.args.find((a) => a.name === 'min')
    expect(String(minArg?.type)).toBe('Int')
    expect(minArg?.description).toContain('integer')
  })

  it('surfaces enum allowed values in the field description for autocomplete', () => {
    const hdmap = schema.getType('hdmap_Result') as GraphQLObjectType
    const roadTypes = hdmap.getFields()['roadTypes']
    expect(roadTypes?.description).toContain('motorway')
    expect(roadTypes?.description).toContain('urban')
  })

  it('models enum-encodable filter values as a GraphQL enum (for value autocomplete)', () => {
    const hdmap = schema.getType('hdmap_Result') as GraphQLObjectType
    const valuesArg = hdmap.getFields()['roadTypes']?.args.find((a) => a.name === 'values')
    expect(String(valuesArg?.type)).toBe('[roadTypes_Enum]')
    const enumType = schema.getType('roadTypes_Enum') as GraphQLEnumType
    expect(enumType.getValues().map((v) => v.name)).toEqual(['motorway', 'urban'])
  })

  it('accepts enum-literal filter values (the serializer form) and rejects unknown ones', () => {
    expect(errorsFor('query { hdmap { roadTypes(values: [motorway]) } }')).toHaveLength(0)
    expect(errorsFor('query { hdmap { roadTypes(values: [bogus]) } }').length).toBeGreaterThan(0)
  })
})
