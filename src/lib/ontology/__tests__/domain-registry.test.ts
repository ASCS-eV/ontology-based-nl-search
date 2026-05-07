import {
  buildDomainRegistry,
  getDomain,
  listDomains,
  resetDomainRegistry,
} from '../domain-registry'

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
})
