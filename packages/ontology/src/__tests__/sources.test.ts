import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { resetConfig } from '@ontology-search/core/config'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  assertOntologySourcesAvailable,
  DEFAULT_OMB_SUBMODULE_PATH,
  diagnoseOntologySources,
  discoverContextFiles,
  discoverShapeFiles,
  formatMissingSourcesError,
  getArtifactRoots,
  getWorkspaceRoot,
  loadOntologySourcesManifest,
  type OntologySourcesDiagnostics,
  OntologySourcesError,
} from '../sources.js'

/**
 * Each test gets its own temp workspace with its own `ontology-sources.json`,
 * so we don't poison the real workspace and we don't fight test-order coupling.
 * `ONTOLOGY_ROOT` is the environment knob `paths.ts:getProjectRoot` honours.
 */
function repoRoot(): string {
  let cur = dirname(new URL(import.meta.url).pathname)
  while (cur !== '/') {
    if (existsSync(join(cur, 'pnpm-workspace.yaml'))) return cur
    cur = dirname(cur)
  }
  throw new Error('repo root not found')
}

function setWorkspaceRoot(root: string): void {
  process.env['ONTOLOGY_ROOT'] = root
  // resetConfig() forces getConfig() to re-read process.env on next call,
  // so ONTOLOGY_ARTIFACTS_PATH overrides in individual tests take effect.
  resetConfig()
}

describe('ontology source-tree discovery (sources.ts)', () => {
  let workspaceRoot: string

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'ontology-sources-test-'))
    setWorkspaceRoot(workspaceRoot)
    delete process.env['ONTOLOGY_ARTIFACTS_PATH']
    resetConfig()
  })

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true })
    delete process.env['ONTOLOGY_ROOT']
    delete process.env['ONTOLOGY_ARTIFACTS_PATH']
    resetConfig()
  })

  describe('DEFAULT_OMB_SUBMODULE_PATH', () => {
    it('is the canonical chain shared by all callers', () => {
      // The previous duplicates each hard-coded this list; pinning it
      // here catches accidental drift from one canonical source.
      expect(DEFAULT_OMB_SUBMODULE_PATH).toEqual([
        'submodules',
        'ontology-management-base',
        'artifacts',
      ])
    })
  })

  describe('getWorkspaceRoot', () => {
    it('returns the directory ONTOLOGY_ROOT points at', () => {
      expect(getWorkspaceRoot()).toBe(workspaceRoot)
    })
  })

  describe('loadOntologySourcesManifest', () => {
    it('returns null when ontology-sources.json is absent', () => {
      expect(loadOntologySourcesManifest()).toBeNull()
    })

    it('parses a valid manifest', () => {
      writeFileSync(
        join(workspaceRoot, 'ontology-sources.json'),
        JSON.stringify({ sources: [{ path: 'artifacts-a' }, { path: 'artifacts-b' }] })
      )
      const manifest = loadOntologySourcesManifest()
      expect(manifest).toEqual({
        sources: [{ path: 'artifacts-a' }, { path: 'artifacts-b' }],
      })
    })

    /**
     * Regression for task 05: previously every duplicate did
     * `try { JSON.parse(...) } catch {}` and silently fell back to the
     * default submodule path, hiding misconfiguration. The unified
     * module fails fast with a typed error so deployments learn
     * immediately that the manifest is broken.
     */
    it('throws OntologySourcesError on malformed JSON instead of silently swallowing', () => {
      writeFileSync(join(workspaceRoot, 'ontology-sources.json'), '{ not valid json')

      expect(() => loadOntologySourcesManifest()).toThrow(OntologySourcesError)
      expect(() => loadOntologySourcesManifest()).toThrow(/Malformed JSON/)
    })

    it('throws when JSON is valid but the shape is wrong (no sources array)', () => {
      writeFileSync(
        join(workspaceRoot, 'ontology-sources.json'),
        JSON.stringify({ srcs: [] }) // wrong key
      )
      expect(() => loadOntologySourcesManifest()).toThrow(OntologySourcesError)
      expect(() => loadOntologySourcesManifest()).toThrow(/must declare \{ sources/)
    })

    it('throws when a source entry lacks a path string', () => {
      writeFileSync(
        join(workspaceRoot, 'ontology-sources.json'),
        JSON.stringify({ sources: [{ name: 'no-path' }] })
      )
      expect(() => loadOntologySourcesManifest()).toThrow(OntologySourcesError)
      expect(() => loadOntologySourcesManifest()).toThrow(/sources\[\]/)
    })
  })

  describe('getArtifactRoots', () => {
    it('uses manifest paths when ontology-sources.json declares them', () => {
      writeFileSync(
        join(workspaceRoot, 'ontology-sources.json'),
        JSON.stringify({ sources: [{ path: 'custom-roots/a' }, { path: 'custom-roots/b' }] })
      )
      expect(getArtifactRoots()).toEqual([
        { path: join(workspaceRoot, 'custom-roots/a'), domainAllowlist: undefined },
        { path: join(workspaceRoot, 'custom-roots/b'), domainAllowlist: undefined },
      ])
    })

    it('falls back to ONTOLOGY_ARTIFACTS_PATH when no manifest is present', () => {
      process.env['ONTOLOGY_ARTIFACTS_PATH'] = '/srv/artifacts'
      resetConfig()
      expect(getArtifactRoots()).toEqual([{ path: '/srv/artifacts' }])
    })

    it('falls back to the DEFAULT_OMB_SUBMODULE_PATH chain as last resort', () => {
      expect(getArtifactRoots()).toEqual([
        { path: join(workspaceRoot, ...DEFAULT_OMB_SUBMODULE_PATH) },
      ])
    })

    it('manifest takes priority over ONTOLOGY_ARTIFACTS_PATH', () => {
      writeFileSync(
        join(workspaceRoot, 'ontology-sources.json'),
        JSON.stringify({ sources: [{ path: 'manifest-root' }] })
      )
      process.env['ONTOLOGY_ARTIFACTS_PATH'] = '/srv/should-be-ignored'
      resetConfig()
      expect(getArtifactRoots()).toEqual([
        { path: join(workspaceRoot, 'manifest-root'), domainAllowlist: undefined },
      ])
    })

    it('passes domains allowlist from manifest', () => {
      writeFileSync(
        join(workspaceRoot, 'ontology-sources.json'),
        JSON.stringify({
          sources: [{ path: 'omb-root', domains: ['hdmap', 'scenario'] }],
        })
      )
      const roots = getArtifactRoots()
      expect(roots).toHaveLength(1)
      expect(roots[0].path).toBe(join(workspaceRoot, 'omb-root'))
      expect(roots[0].domainAllowlist).toEqual(new Set(['hdmap', 'scenario']))
    })
  })

  describe('discoverShapeFiles', () => {
    /**
     * Create a fake artifact tree:
     *   <root>/<domain>/<file>.shacl.ttl  (always)
     *   <root>/<domain>/<file>.owl.ttl    (when includeOwl=true)
     * The test asserts directory-name preservation and file-suffix filtering.
     */
    function setupArtifacts(): string {
      const artifactsRoot = join(workspaceRoot, 'artifacts')
      mkdirSync(join(artifactsRoot, 'hdmap'), { recursive: true })
      mkdirSync(join(artifactsRoot, 'scenario'), { recursive: true })
      mkdirSync(join(artifactsRoot, 'gx'), { recursive: true })
      writeFileSync(join(artifactsRoot, 'hdmap', 'hdmap.shacl.ttl'), '@prefix : <#> .')
      writeFileSync(join(artifactsRoot, 'hdmap', 'hdmap.owl.ttl'), '@prefix : <#> .')
      writeFileSync(join(artifactsRoot, 'hdmap', 'readme.md'), 'ignored')
      writeFileSync(join(artifactsRoot, 'scenario', 'scenario.shacl.ttl'), '@prefix : <#> .')
      writeFileSync(join(artifactsRoot, 'gx', 'gx.shacl.ttl'), '@prefix : <#> .')
      writeFileSync(
        join(workspaceRoot, 'ontology-sources.json'),
        JSON.stringify({ sources: [{ path: 'artifacts' }] })
      )
      return artifactsRoot
    }

    it('returns every .shacl.ttl with its domain (the directory above)', () => {
      const artifactsRoot = setupArtifacts()
      const files = discoverShapeFiles()

      // Default: SHACL only, no excludes.
      const paths = files.map((f) => f.path).sort()
      expect(paths).toEqual([
        join(artifactsRoot, 'gx', 'gx.shacl.ttl'),
        join(artifactsRoot, 'hdmap', 'hdmap.shacl.ttl'),
        join(artifactsRoot, 'scenario', 'scenario.shacl.ttl'),
      ])

      // Domain is the directory name immediately above the file.
      const byDomain = new Map(files.map((f) => [f.path, f.domain]))
      expect(byDomain.get(join(artifactsRoot, 'hdmap', 'hdmap.shacl.ttl'))).toBe('hdmap')
      expect(byDomain.get(join(artifactsRoot, 'scenario', 'scenario.shacl.ttl'))).toBe('scenario')
    })

    it('includeOwl=true picks up .owl.ttl alongside .shacl.ttl', () => {
      const artifactsRoot = setupArtifacts()
      const files = discoverShapeFiles({ includeOwl: true })
      const paths = files.map((f) => f.path)

      expect(paths).toContain(join(artifactsRoot, 'hdmap', 'hdmap.owl.ttl'))
      expect(paths).toContain(join(artifactsRoot, 'hdmap', 'hdmap.shacl.ttl'))
    })

    it('exclude omits the named domain entirely', () => {
      setupArtifacts()
      const files = discoverShapeFiles({ exclude: new Set(['gx']) })
      const domains = new Set(files.map((f) => f.domain))

      expect(domains.has('gx')).toBe(false)
      expect(domains.has('hdmap')).toBe(true)
      expect(domains.has('scenario')).toBe(true)
    })

    it('skips non-existent artifact roots silently (selective-clone-friendly)', () => {
      writeFileSync(
        join(workspaceRoot, 'ontology-sources.json'),
        JSON.stringify({ sources: [{ path: 'does-not-exist' }] })
      )
      expect(discoverShapeFiles()).toEqual([])
    })
  })

  describe('ontology-sources.example.json', () => {
    /**
     * The shipped example is the template operators copy — the loader (the
     * runtime contract behind ontology-sources.schema.json) must accept it
     * verbatim, including the imports opt-in documented in the docs.
     */
    it('is accepted by the loader, with and without the imports opt-in source', () => {
      const example = JSON.parse(
        readFileSync(join(repoRoot(), 'ontology-sources.example.json'), 'utf-8')
      ) as { sources: unknown[] }

      writeFileSync(join(workspaceRoot, 'ontology-sources.json'), JSON.stringify(example))
      expect(loadOntologySourcesManifest()?.sources).toHaveLength(1)

      example.sources.push({
        name: 'omb-imports',
        path: 'submodules/ontology-management-base/imports',
      })
      writeFileSync(join(workspaceRoot, 'ontology-sources.json'), JSON.stringify(example))
      expect(loadOntologySourcesManifest()?.sources).toHaveLength(2)
      expect(getArtifactRoots()).toHaveLength(2)
    })
  })

  describe('discoverContextFiles', () => {
    /**
     * `*.context.jsonld` files were once never discovered by the
     * schema/vocabulary path (only the data loader read them ad hoc). The
     * discovery seam mirrors discoverShapeFiles — same roots, same
     * allowlist, same silent skip of missing roots.
     */
    function setupContexts(): string {
      const artifactsRoot = join(workspaceRoot, 'artifacts')
      mkdirSync(join(artifactsRoot, 'hdmap'), { recursive: true })
      mkdirSync(join(artifactsRoot, 'scenario'), { recursive: true })
      writeFileSync(join(artifactsRoot, 'hdmap', 'hdmap.context.jsonld'), '{}')
      writeFileSync(join(artifactsRoot, 'hdmap', 'hdmap.shacl.ttl'), '@prefix : <#> .')
      writeFileSync(join(artifactsRoot, 'hdmap', 'readme.md'), 'ignored')
      writeFileSync(join(artifactsRoot, 'scenario', 'scenario.context.jsonld'), '{}')
      writeFileSync(
        join(workspaceRoot, 'ontology-sources.json'),
        JSON.stringify({ sources: [{ path: 'artifacts' }] })
      )
      return artifactsRoot
    }

    it('returns every *.context.jsonld with its domain (the directory above)', () => {
      const artifactsRoot = setupContexts()
      const files = discoverContextFiles()

      expect(files.map((f) => f.path).sort()).toEqual([
        join(artifactsRoot, 'hdmap', 'hdmap.context.jsonld'),
        join(artifactsRoot, 'scenario', 'scenario.context.jsonld'),
      ])
      const byDomain = new Map(files.map((f) => [f.domain, f.path]))
      expect(byDomain.get('hdmap')).toBe(join(artifactsRoot, 'hdmap', 'hdmap.context.jsonld'))
      expect(byDomain.get('scenario')).toBe(
        join(artifactsRoot, 'scenario', 'scenario.context.jsonld')
      )
    })

    it('honours the per-root domains allowlist', () => {
      setupContexts()
      writeFileSync(
        join(workspaceRoot, 'ontology-sources.json'),
        JSON.stringify({ sources: [{ path: 'artifacts', domains: ['scenario'] }] })
      )
      const files = discoverContextFiles()
      expect(files.map((f) => f.domain)).toEqual(['scenario'])
    })

    it('skips non-existent artifact roots silently', () => {
      writeFileSync(
        join(workspaceRoot, 'ontology-sources.json'),
        JSON.stringify({ sources: [{ path: 'does-not-exist' }] })
      )
      expect(discoverContextFiles()).toEqual([])
    })
  })

  describe('diagnoseOntologySources', () => {
    it('reports zero shape files when the only root is missing', () => {
      writeFileSync(
        join(workspaceRoot, 'ontology-sources.json'),
        JSON.stringify({ sources: [{ path: 'does-not-exist' }] })
      )
      const diag = diagnoseOntologySources()
      expect(diag.totalShapeFiles).toBe(0)
      expect(diag.roots).toEqual([
        { path: join(workspaceRoot, 'does-not-exist'), exists: false, shapeFileCount: 0 },
      ])
    })

    it('counts .shacl.ttl files per root', () => {
      const artifactsRoot = join(workspaceRoot, 'artifacts')
      mkdirSync(join(artifactsRoot, 'hdmap'), { recursive: true })
      writeFileSync(join(artifactsRoot, 'hdmap', 'a.shacl.ttl'), '@prefix : <#> .')
      writeFileSync(join(artifactsRoot, 'hdmap', 'a.owl.ttl'), '@prefix : <#> .') // not counted
      writeFileSync(
        join(workspaceRoot, 'ontology-sources.json'),
        JSON.stringify({ sources: [{ path: 'artifacts' }] })
      )
      const diag = diagnoseOntologySources()
      expect(diag.totalShapeFiles).toBe(1)
      expect(diag.roots[0]).toEqual({ path: artifactsRoot, exists: true, shapeFileCount: 1 })
    })
  })

  describe('assertOntologySourcesAvailable', () => {
    /**
     * Regression for the first-run gap: with submodules un-initialized the
     * loader found 0 files, logged it, and the service started "ready" while
     * every search came back empty. The guard now fails fast with an
     * actionable message. The default submodule chain does not exist inside
     * the temp workspace, so a live scan yields zero files here.
     */
    it('throws OntologySourcesError with the submodule remediation when nothing is found', () => {
      expect(() => assertOntologySourcesAvailable()).toThrow(OntologySourcesError)
      expect(() => assertOntologySourcesAvailable()).toThrow(/git submodule update --init/)
    })

    it('does not throw when at least one shape file exists', () => {
      const artifactsRoot = join(workspaceRoot, 'artifacts')
      mkdirSync(join(artifactsRoot, 'hdmap'), { recursive: true })
      writeFileSync(join(artifactsRoot, 'hdmap', 'a.shacl.ttl'), '@prefix : <#> .')
      writeFileSync(
        join(workspaceRoot, 'ontology-sources.json'),
        JSON.stringify({ sources: [{ path: 'artifacts' }] })
      )
      expect(() => assertOntologySourcesAvailable()).not.toThrow()
    })

    it('accepts injected diagnostics (no filesystem) for a non-empty tree', () => {
      const diag: OntologySourcesDiagnostics = {
        roots: [{ path: '/x', exists: true, shapeFileCount: 3 }],
        totalShapeFiles: 3,
      }
      expect(() => assertOntologySourcesAvailable(diag)).not.toThrow()
    })
  })

  describe('formatMissingSourcesError', () => {
    it('recommends recursive submodule init when a missing root is under submodules/', () => {
      const diag: OntologySourcesDiagnostics = {
        roots: [
          {
            path: join('repo', 'submodules', 'foo', 'artifacts'),
            exists: false,
            shapeFileCount: 0,
          },
        ],
        totalShapeFiles: 0,
      }
      const msg = formatMissingSourcesError(diag)
      expect(msg).toMatch(/git submodule update --init/)
      expect(msg).toMatch(/ontology-sources\.json/)
      expect(msg).toMatch(/ONTOLOGY_ARTIFACTS_PATH/)
    })

    it('omits the submodule hint when the missing root is not under submodules/', () => {
      const diag: OntologySourcesDiagnostics = {
        roots: [{ path: '/srv/custom-artifacts', exists: false, shapeFileCount: 0 }],
        totalShapeFiles: 0,
      }
      const msg = formatMissingSourcesError(diag)
      expect(msg).not.toMatch(/git submodule/)
      expect(msg).toMatch(/ONTOLOGY_ARTIFACTS_PATH/)
    })
  })
})
