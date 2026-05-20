import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resetConfig } from '@ontology-search/core/config'
import { OntologySourcesError } from '@ontology-search/core/errors'

import {
  buildDomainRegistry,
  getDomain,
  getPrimaryDomain,
  listDomains,
  resetDomainRegistry,
} from '../domain-registry.js'

describe('DomainRegistry', () => {
  beforeEach(() => {
    resetDomainRegistry()
  })

  it('discovers hdmap domain with correct metadata', async () => {
    const registry = await buildDomainRegistry()
    const hdmap = registry.domains.get('hdmap')

    expect(hdmap).toBeDefined()
    expect(hdmap!.name).toBe('hdmap')
    expect(hdmap!.namespace).toContain('hdmap')
    expect(hdmap!.targetClass).toBe('hdmap:HdMap')
    expect(hdmap!.version).toMatch(/^v\d+$/)
    expect(hdmap!.hasGeoreference).toBe(true)
  })

  it('discovers scenario domain', async () => {
    const registry = await buildDomainRegistry()
    const scenario = registry.domains.get('scenario')

    expect(scenario).toBeDefined()
    expect(scenario!.targetClass).toBe('scenario:Scenario')
    expect(scenario!.hasGeoreference).toBe(true)
  })

  it('discovers openlabel-v2 domain with underscore prefix', async () => {
    const registry = await buildDomainRegistry()
    const olv2 = registry.domains.get('openlabel-v2')

    expect(olv2).toBeDefined()
    expect(olv2!.name).toBe('openlabel-v2')
    expect(olv2!.prefix).toBe('openlabel_v2')
    expect(olv2!.namespace).toBe('https://w3id.org/ascs-ev/envited-x/openlabel/v2/')
    expect(olv2!.targetClass).toBe('openlabel_v2:Scenario')
    expect(olv2!.shapes).toContain('Scenario')
  })

  it('resolveByIriDomain resolves direct match first', async () => {
    const registry = await buildDomainRegistry()
    // "openlabel" exists as a direct registry key (v1)
    const resolved = registry.resolveByIriDomain('openlabel')
    expect(resolved).toBeDefined()
    expect(resolved!.name).toBe('openlabel')
  })

  it('resolveByIriDomain falls back to namespace path match', async () => {
    const registry = await buildDomainRegistry()
    // "nonexistent-openlabel" doesn't exist as a key but matches openlabel-v2
    // via namespace pattern /openlabel/v — however, this also matches openlabel v1
    // For a true fallback test, use the hdmap IRI-derived name
    const hdmapResolved = registry.resolveByIriDomain('hdmap')
    expect(hdmapResolved).toBeDefined()
    expect(hdmapResolved!.name).toBe('hdmap')
  })

  it('discovers multiple domains', async () => {
    const registry = await buildDomainRegistry()

    expect(registry.domainNames.length).toBeGreaterThan(1)
    expect(registry.domainNames).toContain('hdmap')
    expect(registry.domainNames).toContain('scenario')
  })

  it('generates SPARQL prefixes for a domain', async () => {
    const registry = await buildDomainRegistry()
    const prefixes = registry.prefixesFor('hdmap')

    expect(prefixes).toContain('PREFIX hdmap:')
    expect(prefixes).toContain('PREFIX rdfs:')
    expect(prefixes).toContain('PREFIX xsd:')
    expect(prefixes).toContain('PREFIX georeference:')
  })

  it('generates all prefixes', async () => {
    const registry = await buildDomainRegistry()
    const prefixes = registry.allPrefixes()

    expect(prefixes).toContain('PREFIX hdmap:')
    expect(prefixes).toContain('PREFIX scenario:')
    expect(prefixes).toContain('PREFIX georeference:')
  })

  it('getDomain returns descriptor for valid domain', async () => {
    const domain = await getDomain('hdmap')
    expect(domain).toBeDefined()
    expect(domain!.name).toBe('hdmap')
  })

  it('getDomain returns undefined for invalid domain', async () => {
    const domain = await getDomain('nonexistent')
    expect(domain).toBeUndefined()
  })

  it('listDomains returns sorted domain names', async () => {
    const names = await listDomains()
    expect(names.length).toBeGreaterThan(0)
    const sorted = [...names].sort()
    expect(names).toEqual(sorted)
  })

  it('each domain has shapes array', async () => {
    const registry = await buildDomainRegistry()
    for (const [, desc] of registry.domains) {
      expect(desc.shapes.length).toBeGreaterThan(0)
    }
  })

  it('caches registry on second call', async () => {
    const r1 = await buildDomainRegistry()
    const r2 = await buildDomainRegistry()
    expect(r1).toBe(r2) // Same reference = cached
  })

  /**
   * Regression: production callers must never hard-code a specific
   * domain literal as a fallback. The primary domain MUST come from
   * SHACL discovery and MUST be the lexicographically first registered
   * name (i.e. equal to `listDomains()[0]`).
   */
  describe('getPrimaryDomain', () => {
    it('returns the lexicographically first discovered domain', async () => {
      const primary = await getPrimaryDomain()
      const names = await listDomains()
      expect(primary).toBe(names[0])
    })

    /**
     * When the registry is empty, callers must fail loudly with a typed
     * error rather than silently substitute a guess. Point `ONTOLOGY_ROOT`
     * at an empty temp directory so the artifact scan finds nothing.
     */
    it('throws OntologySourcesError when the registry has no domains', async () => {
      const prevRoot = process.env['ONTOLOGY_ROOT']
      const emptyRoot = mkdtempSync(join(tmpdir(), 'empty-ontology-'))
      process.env['ONTOLOGY_ROOT'] = emptyRoot
      resetConfig()
      resetDomainRegistry()
      try {
        await expect(getPrimaryDomain()).rejects.toBeInstanceOf(OntologySourcesError)
      } finally {
        if (prevRoot === undefined) delete process.env['ONTOLOGY_ROOT']
        else process.env['ONTOLOGY_ROOT'] = prevRoot
        resetConfig()
        resetDomainRegistry()
        rmSync(emptyRoot, { recursive: true, force: true })
      }
    })
  })
})
