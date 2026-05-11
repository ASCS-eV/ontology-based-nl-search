import { describe, expect, it, vi } from 'vitest'

import type { ShaclDomainContent } from '../shacl-reader.js'
import { readShaclFiles, resetShaclCache } from '../shacl-reader.js'

describe('readShaclFiles', () => {
  it('reads SHACL files from ontology sources', () => {
    resetShaclCache()
    const files = readShaclFiles()

    expect(files.length).toBeGreaterThan(0)
    expect(files.every((f) => f.domain.length > 0)).toBe(true)
    expect(files.every((f) => f.content.length > 0)).toBe(true)
    expect(files.every((f) => f.fileName.endsWith('.shacl.ttl'))).toBe(true)
    expect(files.every((f) => f.sizeBytes > 0)).toBe(true)
  })

  it('excludes gx domain (too large for LLM context)', () => {
    resetShaclCache()
    const files = readShaclFiles()
    const gxFiles = files.filter((f) => f.domain === 'gx')

    expect(gxFiles).toHaveLength(0)
  })

  it('includes key asset domains', () => {
    resetShaclCache()
    const files = readShaclFiles()
    const domains = new Set(files.map((f) => f.domain))

    expect(domains.has('hdmap')).toBe(true)
    expect(domains.has('scenario')).toBe(true)
    expect(domains.has('georeference')).toBe(true)
    expect(domains.has('envited-x')).toBe(true)
    expect(domains.has('openlabel')).toBe(true)
  })

  it('includes openlabel and openlabel-v2', () => {
    resetShaclCache()
    const files = readShaclFiles()
    const domains = new Set(files.map((f) => f.domain))

    expect(domains.has('openlabel')).toBe(true)
    expect(domains.has('openlabel-v2')).toBe(true)
  })

  it('returns sorted results by domain name', () => {
    resetShaclCache()
    const files = readShaclFiles()
    const domains = files.map((f) => f.domain)
    const sorted = [...domains].sort()

    expect(domains).toEqual(sorted)
  })

  it('SHACL content contains expected Turtle constructs', () => {
    resetShaclCache()
    const files = readShaclFiles()
    const hdmap = files.find((f) => f.domain === 'hdmap')

    expect(hdmap).toBeDefined()
    expect(hdmap!.content).toContain('sh:NodeShape')
    expect(hdmap!.content).toContain('sh:property')
    expect(hdmap!.content).toContain('sh:path')
  })

  it('hdmap SHACL contains sh:in enumerations for roadTypes', () => {
    resetShaclCache()
    const files = readShaclFiles()
    const hdmap = files.find((f) => f.domain === 'hdmap')

    expect(hdmap).toBeDefined()
    expect(hdmap!.content).toContain('sh:in')
    expect(hdmap!.content).toContain('motorway')
  })

  it('georeference SHACL contains sh:pattern for country codes', () => {
    resetShaclCache()
    const files = readShaclFiles()
    const geo = files.find((f) => f.domain === 'georeference')

    expect(geo).toBeDefined()
    expect(geo!.content).toContain('sh:pattern')
  })

  it('total content size is under 500 KB (fits LLM context)', () => {
    resetShaclCache()
    const files = readShaclFiles()
    const totalBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0)

    // Must fit in ~200K token context window (1 token ≈ 4 chars)
    expect(totalBytes).toBeLessThan(500_000)
  })
})
