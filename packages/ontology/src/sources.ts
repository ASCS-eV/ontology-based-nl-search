/**
 * Single source of truth for ontology source-tree discovery.
 *
 * Before this module the workspace-root walk, the `ontology-sources.json`
 * manifest read, and the SHACL/OWL file discovery were copy-pasted across
 * five files (`schema-loader.ts`, `shacl-reader.ts`, `shacl-validator.ts`,
 * `domain-registry.ts`, `vocabulary-index.ts`). Each copy silently swallowed
 * JSON-parse errors via `catch {}`, hiding manifest mis-configuration.
 *
 * Callers now go through this module. Mal-formed manifests throw
 * {@link OntologySourcesError} so misconfiguration fails fast instead of
 * silently falling back to the default submodule path.
 */

import { getConfig } from '@ontology-search/core/config'
import { OntologySourcesError } from '@ontology-search/core/errors'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

import { getProjectRoot } from './paths.js'

/**
 * Re-exported from `@ontology-search/core/errors` so legacy callers that
 * imported it from this module continue to compile. The canonical
 * declaration lives in core so the API tier can map it to HTTP status by
 * `instanceof` without depending on the ontology package.
 */
export { OntologySourcesError }

/**
 * Path segments of the nested git-submodule chain that holds the
 * upstream ontology artifacts (the `artifacts/` directory inside
 * `ontology-management-base`). Used as the last-resort fallback when
 * `ontology-sources.json` and `ONTOLOGY_ARTIFACTS_PATH` are absent.
 *
 * The five duplicate implementations each hard-coded this chain; a
 * future rename of any submodule had to be made in five places.
 */
export const DEFAULT_OMB_SUBMODULE_PATH = [
  'submodules',
  'hd-map-asset-example',
  'submodules',
  'sl-5-8-asset-tools',
  'submodules',
  'ontology-management-base',
  'artifacts',
] as const

/** A single declared source in `ontology-sources.json`. */
export interface OntologySource {
  /** Workspace-relative path to a directory containing domain subdirectories. */
  path: string
}

/** Parsed contents of the manifest. */
export interface OntologySourcesManifest {
  sources: readonly OntologySource[]
}

/** Workspace root — re-exported under a clearer name. */
export function getWorkspaceRoot(): string {
  return getProjectRoot()
}

/**
 * Read and validate `ontology-sources.json` from the workspace root.
 * Returns `null` when the file is absent; throws {@link OntologySourcesError}
 * when it is present but unreadable, mal-formed JSON, or violates the
 * expected `{ sources: [{ path: string }, ...] }` shape.
 */
export function loadOntologySourcesManifest(): OntologySourcesManifest | null {
  const root = getWorkspaceRoot()
  const configPath = join(root, 'ontology-sources.json')
  if (!existsSync(configPath)) return null

  let raw: string
  try {
    raw = readFileSync(configPath, 'utf-8')
  } catch (err) {
    throw new OntologySourcesError(
      `Cannot read ${configPath}: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new OntologySourcesError(
      `Malformed JSON in ${configPath}: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as { sources?: unknown }).sources)
  ) {
    throw new OntologySourcesError(
      `${configPath} must declare { sources: [...] }; received ${typeof parsed}`
    )
  }
  const sources = (parsed as { sources: unknown[] }).sources
  for (const source of sources) {
    if (
      source === null ||
      typeof source !== 'object' ||
      typeof (source as { path?: unknown }).path !== 'string'
    ) {
      throw new OntologySourcesError(
        `${configPath}: every sources[] entry must be { path: string }; received ${JSON.stringify(source)}`
      )
    }
  }
  return { sources: sources as readonly OntologySource[] }
}

/**
 * Resolve the absolute directory paths to search for ontology artifacts.
 *
 * Resolution order:
 * 1. `sources[].path` entries from `ontology-sources.json` (relative to workspace root)
 * 2. `ONTOLOGY_ARTIFACTS_PATH` from the Zod-validated config (single path)
 * 3. The default {@link DEFAULT_OMB_SUBMODULE_PATH} chain inside the workspace
 */
export function getArtifactRoots(): string[] {
  const root = getWorkspaceRoot()
  const manifest = loadOntologySourcesManifest()
  if (manifest && manifest.sources.length > 0) {
    return manifest.sources.map((s) => join(root, s.path))
  }

  const override = getConfig().ONTOLOGY_ARTIFACTS_PATH
  if (override) return [override]

  return [join(root, ...DEFAULT_OMB_SUBMODULE_PATH)]
}

/** A discovered shape file with its domain (the directory name above it). */
export interface ShapeFile {
  path: string
  /** Directory name immediately above the file — domain by convention. */
  domain: string
}

export interface DiscoverShapeFilesOptions {
  /** Also return `.owl.ttl` files alongside `.shacl.ttl`. Default: false. */
  includeOwl?: boolean
  /** Skip these domain directory names (e.g. exclude the large `gx` domain). */
  exclude?: ReadonlySet<string>
}

/**
 * Walk every artifact root, every domain subdirectory, and return every
 * `.shacl.ttl` (and optionally `.owl.ttl`) file inside. Roots that do not
 * exist are silently skipped — that matches the prior callers' behaviour
 * and lets the dev workspace coexist with selectively-cloned submodules.
 */
export function discoverShapeFiles(options: DiscoverShapeFilesOptions = {}): ShapeFile[] {
  const includeOwl = options.includeOwl ?? false
  const exclude = options.exclude ?? new Set<string>()
  const results: ShapeFile[] = []

  for (const root of getArtifactRoots()) {
    if (!existsSync(root)) continue
    for (const entry of readdirSync(root)) {
      if (exclude.has(entry)) continue
      const domainDir = join(root, entry)
      if (!statSync(domainDir).isDirectory()) continue
      for (const file of readdirSync(domainDir)) {
        if (file.endsWith('.shacl.ttl') || (includeOwl && file.endsWith('.owl.ttl'))) {
          results.push({ path: join(domainDir, file), domain: entry })
        }
      }
    }
  }
  return results
}
