import { getDomainOnlyConcepts, lookupGlossary, lookupGlossaryBatch } from '../glossary'

describe('Glossary', () => {
  it('looks up a filterable concept with definition', async () => {
    const entry = await lookupGlossary('motorway')
    expect(entry).not.toBeNull()
    expect(entry!.term).toBe('motorway')
    expect(entry!.filterable).toBe(true)
    expect(entry!.property).toBe('roadTypes')
    expect(entry!.value).toBe('motorway')
    expect(entry!.definition).toContain('high-speed')
  })

  it('looks up by synonym (altLabel)', async () => {
    const entry = await lookupGlossary('autobahn')
    expect(entry).not.toBeNull()
    expect(entry!.term).toBe('motorway')
    expect(entry!.filterable).toBe(true)
  })

  it('looks up a domain-only concept', async () => {
    const entry = await lookupGlossary('intersection')
    expect(entry).not.toBeNull()
    expect(entry!.term).toBe('intersection')
    expect(entry!.filterable).toBe(false)
    expect(entry!.definition).toContain('two or more roads')
    expect(entry!.scopeNote).toBeTruthy()
    expect(entry!.relatedTerms.length).toBeGreaterThan(0)
  })

  it('looks up domain-only by synonym', async () => {
    const entry = await lookupGlossary('junction')
    expect(entry).not.toBeNull()
    expect(entry!.term).toBe('intersection')
    expect(entry!.filterable).toBe(false)
  })

  it('returns null for unknown terms', async () => {
    const entry = await lookupGlossary('xyznonexistent')
    expect(entry).toBeNull()
  })

  it('batch looks up multiple terms', async () => {
    const results = await lookupGlossaryBatch(['tunnel', 'motorway', 'unknown_term'])
    expect(results.size).toBe(2)
    expect(results.get('tunnel')?.filterable).toBe(false)
    expect(results.get('motorway')?.filterable).toBe(true)
    expect(results.has('unknown_term')).toBe(false)
  })

  it('gets all domain-only concepts', async () => {
    const domainOnly = await getDomainOnlyConcepts()
    expect(domainOnly.length).toBeGreaterThan(10)
    for (const entry of domainOnly) {
      expect(entry.filterable).toBe(false)
      expect(entry.definition).toBeTruthy()
    }
  })

  it('domain concepts have scope notes with guidance', async () => {
    const entry = await lookupGlossary('traffic light')
    expect(entry).not.toBeNull()
    expect(entry!.scopeNote).toContain('minTrafficLights')
  })
})
