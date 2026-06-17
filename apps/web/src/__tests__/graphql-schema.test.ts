import { GraphQLObjectType, parse, validate } from 'graphql'
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
        'query { hdmap { roadTypes(values: ["motorway"]) numberIntersections(min: 1) _all } }'
      )
    ).toHaveLength(0)
  })

  it('accepts a reference query with reference-scoped ranges', () => {
    expect(
      errorsFor(
        'query { ositrace(references: [{ domain: "hdmap", ranges: { numberIntersections: { min: 1 } } }]) { _all } }'
      )
    ).toHaveLength(0)
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

  it('surfaces enum allowed values in the field description for autocomplete', () => {
    const hdmap = schema.getType('hdmap_Result') as GraphQLObjectType
    const roadTypes = hdmap.getFields()['roadTypes']
    expect(roadTypes?.description).toContain('motorway')
    expect(roadTypes?.description).toContain('urban')
  })
})
