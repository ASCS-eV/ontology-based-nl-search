import type { VocabularyResponse } from '@ontology-search/api-types'
import { graphql, GraphQLEnumType, GraphQLObjectType, parse, validate } from 'graphql'
import { describe, expect, it } from 'vitest'

import { buildGraphQLSchema } from '../graphql-schema.js'

const vocabulary: VocabularyResponse = {
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
    {
      name: 'title',
      label: 'Title',
      description: 'Human-readable asset title.',
      domain: 'hdmap',
      type: 'string',
    },
  ],
}

const schema = buildGraphQLSchema(vocabulary)
const errorsFor = (query: string) => validate(schema, parse(query))
const resultType = () => schema.getType('hdmap_Result') as GraphQLObjectType

describe('buildGraphQLSchema', () => {
  it('exposes every discovered domain', () => {
    expect(errorsFor('query { hdmap { _all } ositrace { _all } }')).toHaveLength(0)
  })

  it('types closed values as an enum', () => {
    const field = resultType().getFields()['roadTypes']
    expect(String(field?.type)).toBe('Filter')
    expect(String(field?.args.find((argument) => argument.name === 'values')?.type)).toBe(
      '[roadTypes_Enum]'
    )
    const enumType = schema.getType('roadTypes_Enum') as GraphQLEnumType
    expect(enumType.getValues().map((value) => value.name)).toEqual(['motorway', 'urban'])
    expect(errorsFor('query { hdmap { roadTypes(values: [motorway]) } }')).toHaveLength(0)
    expect(errorsFor('query { hdmap { roadTypes(values: [bogus]) } }')).not.toHaveLength(0)
  })

  it('types numeric bounds by datatype', () => {
    const field = resultType().getFields()['numberIntersections']
    expect(String(field?.args.find((argument) => argument.name === 'min')?.type)).toBe('Int')
    expect(errorsFor('query { hdmap { numberIntersections(min: 1) } }')).toHaveLength(0)
  })

  it('types free-form literals as string-valued filters', () => {
    const field = resultType().getFields()['title']
    expect(String(field?.args.find((argument) => argument.name === 'values')?.type)).toBe(
      '[String]'
    )
    expect(field?.description).toContain('Human-readable asset title')
    expect(errorsFor('query { hdmap { title(values: ["Example"]) } }')).toHaveLength(0)
  })

  it('supports recursively typed references', () => {
    const references = schema.getType('References') as GraphQLObjectType
    expect(Object.keys(references.getFields()).sort()).toEqual(['hdmap', 'ositrace'])
    expect(
      errorsFor('query { ositrace { references { hdmap { references { ositrace { _all } } } } } }')
    ).toHaveLength(0)
  })

  it('rejects unknown domains and fields', () => {
    expect(errorsFor('query { missing { _all } }')).not.toHaveLength(0)
    expect(errorsFor('query { hdmap { missing } }')).not.toHaveLength(0)
  })

  it('uses the shared name projection', () => {
    const projected = buildGraphQLSchema({
      domains: ['asset-domain'],
      properties: [
        {
          name: 'lane-count',
          label: 'Lane count',
          description: '',
          domain: 'asset-domain',
          type: 'numeric',
          datatype: 'integer',
        },
      ],
    })
    expect(
      validate(projected, parse('query { asset_domain { lane_count(min: 1) } }'))
    ).toHaveLength(0)
  })

  it('provides a valid empty-schema placeholder', () => {
    const empty = buildGraphQLSchema({ domains: [], properties: [] })
    expect(validate(empty, parse('query { _empty }'))).toHaveLength(0)
  })

  it('serializes Filter and Range leaf values unchanged when executed', async () => {
    const result = await graphql({
      schema,
      source: 'query { hdmap { roadTypes numberIntersections } }',
      rootValue: { hdmap: { roadTypes: 'motorway', numberIntersections: 3 } },
    })
    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({ hdmap: { roadTypes: 'motorway', numberIntersections: 3 } })
  })
})
