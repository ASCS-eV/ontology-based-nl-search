import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resetConfig } from '@ontology-search/core/config'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_OMB_SUBMODULE_PATH,
  discoverShapeFiles,
  getArtifactRoots,
  getWorkspaceRoot,
  loadOntologySourcesManifest,
  OntologySourcesError,
} from '../sources.js'

/**
 * Each test gets its own temp workspace with its own `ontology-sources.json`,
 * so we don't poison the real workspace and we don't fight test-order coupling.
 * `ONTOLOGY_ROOT` is the environment knob `paths.ts:getProjectRoot` honours.
 */
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
      // The five previous duplicates each hard-coded this list; pinning it
      // here catches accidental drift from one canonical source.
      expect(DEFAULT_OMB_SUBMODULE_PATH).toEqual([
        'submodules',
        'hd-map-asset-example',
        'submodules',
        'sl-5-8-asset-tools',
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
        join(workspaceRoot, 'custom-roots/a'),
        join(workspaceRoot, 'custom-roots/b'),
      ])
    })

    it('falls back to ONTOLOGY_ARTIFACTS_PATH when no manifest is present', () => {
      process.env['ONTOLOGY_ARTIFACTS_PATH'] = '/srv/artifacts'
      resetConfig()
      expect(getArtifactRoots()).toEqual(['/srv/artifacts'])
    })

    it('falls back to the DEFAULT_OMB_SUBMODULE_PATH chain as last resort', () => {
      expect(getArtifactRoots()).toEqual([join(workspaceRoot, ...DEFAULT_OMB_SUBMODULE_PATH)])
    })

    it('manifest takes priority over ONTOLOGY_ARTIFACTS_PATH', () => {
      writeFileSync(
        join(workspaceRoot, 'ontology-sources.json'),
        JSON.stringify({ sources: [{ path: 'manifest-root' }] })
      )
      process.env['ONTOLOGY_ARTIFACTS_PATH'] = '/srv/should-be-ignored'
      resetConfig()
      expect(getArtifactRoots()).toEqual([join(workspaceRoot, 'manifest-root')])
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
})
