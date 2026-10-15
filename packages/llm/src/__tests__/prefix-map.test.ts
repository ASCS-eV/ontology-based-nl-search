import type { DomainDescriptor, DomainRegistry } from '@ontology-search/ontology/domain-registry'
import { describe, expect, it } from 'vitest'

import { buildPrefixMap } from '../prefix-map.js'

function descriptor(
  name: string,
  prefix: string,
  namespace: string,
  declaredPrefixes: Record<string, string> = {}
): DomainDescriptor {
  return {
    name,
    namespace,
    prefix,
    targetClass: '',
    targetClassIri: '',
    version: 'v1',
    shapes: [],
    declaredPrefixes,
  }
}

describe('buildPrefixMap', () => {
  it('binds a prefix shared by two versions to both namespaces', () => {
    const registry = {
      domains: new Map([
        ['olv1', descriptor('olv1', 'ol', 'https://example.org/ol/v1/')],
        ['olv2', descriptor('olv2', 'ol', 'https://example.org/ol/v2/')],
      ]),
    } as unknown as DomainRegistry
    expect(buildPrefixMap(registry).get('ol')).toEqual([
      'https://example.org/ol/v1/',
      'https://example.org/ol/v2/',
    ])
  })

  it('includes prefixes a domain declares for other vocabularies, without duplicates', () => {
    const registry = {
      domains: new Map([
        [
          'a',
          descriptor('a', 'a', 'https://example.org/a/v1/', {
            a: 'https://example.org/a/v1/',
            sh: 'http://www.w3.org/ns/shacl#',
          }),
        ],
      ]),
    } as unknown as DomainRegistry
    const map = buildPrefixMap(registry)
    expect(map.get('a')).toEqual(['https://example.org/a/v1/'])
    expect(map.get('sh')).toEqual(['http://www.w3.org/ns/shacl#'])
  })
})
