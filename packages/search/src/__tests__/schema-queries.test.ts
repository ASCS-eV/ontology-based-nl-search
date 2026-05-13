import { describe, expect, it } from 'vitest'

import { getInitializedStore } from '../init.js'
import {
  queryAssetDomains,
  queryDomainReferences,
  queryPropertyDomains,
  queryPropertyShapeGroups,
  queryRange2DProperties,
} from '../schema-queries.js'

describe('schema-queries', () => {
  describe('queryPropertyDomains', () => {
    it('returns property-domain mappings from SHACL shapes', async () => {
      const store = await getInitializedStore()
      const properties = await queryPropertyDomains(store)

      expect(properties.length).toBeGreaterThan(0)

      // Verify structure
      const prop = properties[0]
      expect(prop).toHaveProperty('localName')
      expect(prop).toHaveProperty('iri')
      expect(prop).toHaveProperty('domain')
      expect(prop).toHaveProperty('targetClass')
      expect(typeof prop.localName).toBe('string')
      expect(typeof prop.iri).toBe('string')
      expect(typeof prop.domain).toBe('string')
    })

    it('handles multi-domain properties (roadTypes in hdmap and ositrace)', async () => {
      const store = await getInitializedStore()
      const properties = await queryPropertyDomains(store)

      const roadTypesProps = properties.filter((p) => p.localName === 'roadTypes')

      // roadTypes should exist in at least hdmap and ositrace
      expect(roadTypesProps.length).toBeGreaterThanOrEqual(2)

      const domains = roadTypesProps.map((p) => p.domain)
      expect(domains).toContain('hdmap')
      expect(domains).toContain('ositrace')

      // Each should have a different IRI
      const iris = roadTypesProps.map((p) => p.iri)
      expect(new Set(iris).size).toBe(roadTypesProps.length)
    })

    it('extracts domain names correctly', async () => {
      const store = await getInitializedStore()
      const properties = await queryPropertyDomains(store)

      const domains = new Set(properties.map((p) => p.domain))

      // Should include key asset domains
      expect(domains.has('hdmap')).toBe(true)
      expect(domains.has('scenario')).toBe(true)
      expect(domains.has('ositrace')).toBe(true)
    })

    it('returns distinct property-domain pairs', async () => {
      const store = await getInitializedStore()
      const properties = await queryPropertyDomains(store)

      const keys = properties.map((p) => `${p.localName}:${p.domain}`)
      const uniqueKeys = new Set(keys)

      // Deduplication is handled internally — every entry should be unique
      expect(keys.length).toBe(uniqueKeys.size)
    })
  })

  describe('queryAssetDomains', () => {
    it('discovers asset domains from rdfs:subClassOf hierarchy', async () => {
      const store = await getInitializedStore()
      const domains = await queryAssetDomains(store)

      // Should find asset domains (SimulationAsset, SoftwareAsset, CodeAsset subclasses)
      expect(domains.length).toBeGreaterThan(0)

      // Verify structure
      const domain = domains[0]
      expect(domain).toHaveProperty('domainName')
      expect(domain).toHaveProperty('assetClass')
      expect(typeof domain.domainName).toBe('string')
      expect(typeof domain.assetClass).toBe('string')
    })

    it('includes key simulation asset domains', async () => {
      const store = await getInitializedStore()
      const domains = await queryAssetDomains(store)

      const domainNames = new Set(domains.map((d) => d.domainName))

      // These are rdfs:subClassOf envited-x:SimulationAsset
      expect(domainNames.has('hdmap')).toBe(true)
      expect(domainNames.has('scenario')).toBe(true)
      expect(domainNames.has('ositrace')).toBe(true)
    })

    it('excludes supporting ontologies (not asset subclasses)', async () => {
      const store = await getInitializedStore()
      const domains = await queryAssetDomains(store)

      const domainNames = new Set(domains.map((d) => d.domainName))

      // georeference and manifest are NOT asset domains
      expect(domainNames.has('georeference')).toBe(false)
      expect(domainNames.has('manifest')).toBe(false)
    })

    it('returns unique domains', async () => {
      const store = await getInitializedStore()
      const domains = await queryAssetDomains(store)

      const domainNames = domains.map((d) => d.domainName)
      const uniqueNames = new Set(domainNames)

      expect(domainNames.length).toBe(uniqueNames.size)
    })
  })

  describe('queryDomainReferences', () => {
    it('discovers domain reference relationships from SHACL shapes', async () => {
      const store = await getInitializedStore()
      const refs = await queryDomainReferences(store)

      expect(refs.length).toBeGreaterThan(0)

      const ref = refs[0]
      expect(ref).toHaveProperty('parentDomain')
      expect(ref).toHaveProperty('childDomain')
      expect(typeof ref.parentDomain).toBe('string')
      expect(typeof ref.childDomain).toBe('string')
    })

    it('discovers scenario → hdmap reference', async () => {
      const store = await getInitializedStore()
      const refs = await queryDomainReferences(store)

      const hdmapRef = refs.find((r) => r.parentDomain === 'scenario' && r.childDomain === 'hdmap')
      expect(hdmapRef).toBeDefined()
    })

    it('discovers scenario → environment-model reference', async () => {
      const store = await getInitializedStore()
      const refs = await queryDomainReferences(store)

      const envRef = refs.find(
        (r) => r.parentDomain === 'scenario' && r.childDomain === 'environment-model'
      )
      expect(envRef).toBeDefined()
    })

    it('returns distinct parent-child pairs', async () => {
      const store = await getInitializedStore()
      const refs = await queryDomainReferences(store)

      const keys = refs.map((r) => `${r.parentDomain}→${r.childDomain}`)
      const uniqueKeys = new Set(keys)

      expect(keys.length).toBe(uniqueKeys.size)
    })
  })

  describe('queryPropertyShapeGroups', () => {
    it('classifies properties into shape groups from SHACL nesting', async () => {
      const store = await getInitializedStore()
      const groups = await queryPropertyShapeGroups(store)

      expect(groups.length).toBeGreaterThan(0)

      // Verify structure
      const group = groups[0]
      expect(group).toHaveProperty('localName')
      expect(group).toHaveProperty('domain')
      expect(group).toHaveProperty('shapeGroup')
    })

    it('correctly classifies known hdmap properties', async () => {
      const store = await getInitializedStore()
      const groups = await queryPropertyShapeGroups(store)

      const lookup = new Map(groups.map((g) => [`${g.localName}:${g.domain}`, g.shapeGroup]))

      // roadTypes is in the Content shape
      expect(lookup.get('roadTypes:hdmap')).toBe('Content')
      // formatType is in the Format shape
      expect(lookup.get('formatType:hdmap')).toBe('Format')
      // length is in the Quantity shape
      expect(lookup.get('length:hdmap')).toBe('Quantity')
      // usedDataSources is in the DataSource shape
      expect(lookup.get('usedDataSources:hdmap')).toBe('DataSource')
    })
  })

  describe('queryRange2DProperties', () => {
    it('detects Range2D properties from SHACL shapes', async () => {
      const store = await getInitializedStore()
      const range2D = await queryRange2DProperties(store)

      // speedLimit uses Range2D in hdmap
      const names = range2D.map((p) => p.localName)
      expect(names).toContain('speedLimit')
    })

    it('returns correct structure', async () => {
      const store = await getInitializedStore()
      const range2D = await queryRange2DProperties(store)

      if (range2D.length > 0) {
        expect(range2D[0]).toHaveProperty('localName')
        expect(range2D[0]).toHaveProperty('domain')
      }
    })
  })
})
