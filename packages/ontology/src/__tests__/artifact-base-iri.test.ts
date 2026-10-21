/**
 * Every reader of an artifact file resolves the file's relative IRIs against
 * one base, the file's own location ([TURTLE] §6.3: absent `@base`, the base
 * is the Retrieval URI). Generated ontologies (LinkML OWL, for one) carry
 * relative IRIs and no `@base`; the domain registry and the SHACL validator
 * must see the same IRIs as the schema graph, which loads the file with
 * `artifactBaseIri` as its base.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { resetConfig } from '@ontology-search/core/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildDomainRegistry, resetDomainRegistry } from '../domain-registry.js'
import { parseTtl } from '../domain-registry-parse.js'
import { loadShapesFromDisk } from '../shacl-validator-loader.js'
import { artifactBaseIri } from '../sources.js'

// Pass-through spy, so the registry's wiring can be asserted without changing
// what it parses.
vi.mock('../domain-registry-parse.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../domain-registry-parse.js')>()
  return { ...actual, parseTtl: vi.fn(actual.parseTtl) }
})

const SHAPES = `@prefix sh: <http://www.w3.org/ns/shacl#> .
<DemoShape> a sh:NodeShape ;
  sh:targetClass <Demo> .
`

describe('artifact base IRI — one base for every reader of a file', () => {
  let root: string
  let file: string
  const resolved = (relative: string) => new URL(relative, artifactBaseIri(file)).href

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'artifact-base-iri-'))
    mkdirSync(join(root, 'artifacts', 'demo'), { recursive: true })
    file = join(root, 'artifacts', 'demo', 'demo.shacl.ttl')
    writeFileSync(file, SHAPES)
    vi.stubEnv('ONTOLOGY_ROOT', root)
    vi.stubEnv('ONTOLOGY_ARTIFACTS_PATH', join(root, 'artifacts'))
    resetConfig()
    resetDomainRegistry()
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
    vi.unstubAllEnvs()
    resetConfig()
    resetDomainRegistry()
    vi.mocked(parseTtl).mockClear()
  })

  it('is the file location as a file: URL', () => {
    expect(artifactBaseIri(file)).toBe(pathToFileURL(file).href)
  })

  it('resolves relative IRIs when the registry parses a file', () => {
    const { quads } = parseTtl(SHAPES, artifactBaseIri(file))
    expect(quads.map((q) => q.subject.value)).toContain(resolved('DemoShape'))
    expect(quads.map((q) => q.object.value)).toContain(resolved('Demo'))
  })

  it('the registry parses each artifact against that file’s base', async () => {
    await buildDomainRegistry()
    expect(vi.mocked(parseTtl)).toHaveBeenCalledWith(SHAPES, artifactBaseIri(file))
  })

  it('resolves relative IRIs in the SHACL validator’s shapes graph', async () => {
    const shapes = await loadShapesFromDisk()
    const subjects = [...shapes].map((q) => q.subject.value)
    expect(subjects).toContain(resolved('DemoShape'))
    expect(subjects).not.toContain('DemoShape')
  })
})
