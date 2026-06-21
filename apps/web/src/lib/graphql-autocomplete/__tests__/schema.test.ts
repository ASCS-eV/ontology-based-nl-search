/**
 * Requirements-driven tests for the autocomplete SCHEMA CONTRACT (R1–R6).
 *
 * These exercise the static `GraphQLSchema` via `graphql.validate` + schema
 * introspection only — they never touch `graphql-language-service`, so they run
 * in vitest. The live-completion requirements (R7–R10) are guarded by
 * `apps/e2e/tests/graphql-editor-autocomplete.spec.ts`. See `../README.md`.
 */
import { GraphQLEnumType, GraphQLObjectType, parse, validate } from 'graphql'
import { describe, expect, it } from 'vitest'

import { buildGraphQLSchema } from '../schema'
import type { EditorVocabulary } from '../types'

const vocab: EditorVocabulary = {
  domains: ['hdmap', 'ositrace'],
  properties: [
    { name: 'roadTypes', label: 'Road types', description: '', domain: 'hdmap', type: 'enum', allowedValues: ['motorway', 'urban'] }, // prettier-ignore
    { name: 'numberIntersections', label: 'Number of intersections', description: '', domain: 'hdmap', type: 'numeric', datatype: 'integer' }, // prettier-ignore
  ],
}

const schema = buildGraphQLSchema(vocab)
const errorsFor = (query: string) => validate(schema, parse(query))
const hdmapResult = () => schema.getType('hdmap_Result') as GraphQLObjectType

describe('R1: every discovered domain is a top-level Query field', () => {
  it('exposes each domain as a queryable field', () => {
    expect(errorsFor('query { hdmap { _all } }')).toHaveLength(0)
    expect(errorsFor('query { ositrace { _all } }')).toHaveLength(0)
  })
})

describe('R2: a categorical property is a Filter field whose values are a GraphQL enum', () => {
  it('types the field as Filter (not Boolean)', () => {
    expect(String(hdmapResult().getFields()['roadTypes']?.type)).toBe('Filter')
  })

  it('models the sh:in members as a GraphQL enum on the `values` argument', () => {
    const valuesArg = hdmapResult()
      .getFields()
      ['roadTypes']?.args.find((a) => a.name === 'values')
    expect(String(valuesArg?.type)).toBe('[roadTypes_Enum]')
    const enumType = schema.getType('roadTypes_Enum') as GraphQLEnumType
    expect(enumType.getValues().map((v) => v.name)).toEqual(['motorway', 'urban'])
  })

  it('accepts unquoted enum-literal values and rejects unknown ones', () => {
    expect(errorsFor('query { hdmap { roadTypes(values: [motorway]) } }')).toHaveLength(0)
    expect(errorsFor('query { hdmap { roadTypes(values: [bogus]) } }').length).toBeGreaterThan(0)
  })

  it('surfaces the allowed values in the field description', () => {
    const desc = hdmapResult().getFields()['roadTypes']?.description
    expect(desc).toContain('motorway')
    expect(desc).toContain('urban')
  })
})

describe('R3: a numeric property is a Range field with min/max typed by datatype', () => {
  it('types the field as Range (not Boolean)', () => {
    expect(String(hdmapResult().getFields()['numberIntersections']?.type)).toBe('Range')
  })

  it('types an integer bound as Int and documents the datatype', () => {
    const minArg = hdmapResult()
      .getFields()
      ['numberIntersections']?.args.find((a) => a.name === 'min')
    expect(String(minArg?.type)).toBe('Int')
    expect(minArg?.description).toContain('integer')
  })

  it('accepts a numeric range query', () => {
    expect(errorsFor('query { hdmap { numberIntersections(min: 1) } }')).toHaveLength(0)
  })
})

describe('R4: references are recursive typed fields at any depth', () => {
  it('exposes `references` whose targets are the discovered domains, each typed + labelable', () => {
    const refs = schema.getType('References') as GraphQLObjectType
    expect(Object.keys(refs.getFields()).sort()).toEqual(['hdmap', 'ositrace'])
    const hdmapRef = refs.getFields()['hdmap']
    expect(String(hdmapRef?.type)).toBe('hdmap_Result')
    expect(hdmapRef?.args.find((a) => a.name === 'label')).toBeDefined()
  })

  it('accepts a reference query with enum + range (the JSON-scalar dead zone is gone)', () => {
    expect(
      errorsFor(
        'query { ositrace { references { hdmap(label: "x") { roadTypes(values: [motorway]) numberIntersections(min: 1) } } } }'
      )
    ).toHaveLength(0)
  })

  it('accepts a reference nested inside a reference', () => {
    expect(
      errorsFor('query { ositrace { references { hdmap { references { ositrace { _all } } } } } }')
    ).toHaveLength(0)
  })
})

describe('R5: schema-aware validation rejects unknown domains and fields', () => {
  it('rejects an unknown top-level domain', () => {
    expect(errorsFor('query { nosuchDomain { _all } }').length).toBeGreaterThan(0)
  })

  it('rejects an unknown field on a known domain', () => {
    expect(errorsFor('query { hdmap { bogusField } }').length).toBeGreaterThan(0)
  })

  it('rejects an unknown referenced domain and an unknown field inside a reference', () => {
    expect(
      errorsFor('query { ositrace { references { nosuchDomain { _all } } } }').length
    ).toBeGreaterThan(0)
    expect(
      errorsFor('query { ositrace { references { hdmap { bogusField } } } }').length
    ).toBeGreaterThan(0)
  })
})

describe('R6: field names are sanitized to GraphQL Names (mirrors the serializer)', () => {
  it('exposes a non-Name property as a sanitized field that validates', () => {
    // A SHACL local name may contain characters illegal in a GraphQL Name; the
    // schema must sanitize identically to the serializer so prefilled queries
    // validate. `lane-count` -> `lane_count`.
    const s = buildGraphQLSchema({
      domains: ['hdmap'],
      properties: [
        { name: 'lane-count', label: 'Lanes', description: '', domain: 'hdmap', type: 'numeric', datatype: 'integer' }, // prettier-ignore
      ],
    })
    expect((s.getType('hdmap_Result') as GraphQLObjectType).getFields()['lane_count']).toBeDefined()
    expect(validate(s, parse('query { hdmap { lane_count(min: 1) } }'))).toHaveLength(0)
  })
})
