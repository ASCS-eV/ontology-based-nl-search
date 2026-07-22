import type { VocabProperty, VocabularyResponse } from '@ontology-search/api-types'
import { describe, expect, it } from 'vitest'

import {
  buildGraphQLNameMap,
  GraphQLVocabularyError,
  sanitizeGraphQLName,
} from '../graphql-name.js'

const property = (
  name: string,
  domain = 'asset',
  type: 'enum' | 'string' = 'string'
): VocabProperty => ({
  name,
  label: name,
  description: '',
  domain,
  type,
  ...(type === 'enum' ? { allowedValues: ['one'] } : {}),
})

describe('sanitizeGraphQLName', () => {
  it.each([
    ['valid_name', 'valid_name'],
    ['lane-count', 'lane_count'],
    ['1st', '_1st'],
    ['', '_field'],
  ])('maps %j to %j', (raw, expected) => {
    expect(sanitizeGraphQLName(raw)).toBe(expected)
  })
})

describe('buildGraphQLNameMap', () => {
  it('builds scoped reverse mappings', () => {
    const map = buildGraphQLNameMap({
      domains: ['asset-domain'],
      properties: [property('lane-count', 'asset-domain')],
    })
    expect(map.domains.get('asset_domain')).toBe('asset-domain')
    expect(map.domainFields.get('asset-domain')).toBe('asset_domain')
    expect(map.propertiesByDomain.get('asset-domain')?.get('lane_count')).toBe('lane-count')
    expect(map.propertyFieldsByDomain.get('asset-domain')?.get('lane-count')).toBe('lane_count')
  })

  it.each([
    {
      label: 'domain collision',
      vocabulary: { domains: ['asset-domain', 'asset_domain'], properties: [] },
    },
    {
      label: 'property collision',
      vocabulary: {
        domains: ['asset'],
        properties: [property('lane-count'), property('lane_count')],
      },
    },
    {
      label: 'unknown property domain',
      vocabulary: { domains: ['asset'], properties: [property('name', 'missing')] },
    },
    {
      label: 'reserved field',
      vocabulary: { domains: ['asset'], properties: [property('references')] },
    },
    {
      label: 'introspection prefix',
      vocabulary: { domains: ['__asset'], properties: [] },
    },
    {
      label: 'enum type collision across domains',
      vocabulary: {
        domains: ['first', 'second'],
        properties: [
          property('road-type', 'first', 'enum'),
          property('road_type', 'second', 'enum'),
        ],
      },
    },
  ] satisfies { label: string; vocabulary: VocabularyResponse }[])(
    'rejects $label',
    ({ vocabulary }) => {
      expect(() => buildGraphQLNameMap(vocabulary)).toThrow(GraphQLVocabularyError)
    }
  )
})
