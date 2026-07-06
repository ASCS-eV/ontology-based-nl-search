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
 * Re-exported from `@ontology-search/core/errors` so callers can import it
 * from this module. The canonical declaration lives in core so the API tier
 * can map it to HTTP status by `instanceof` without depending on the
 * ontology package.
 */
export { OntologySourcesError }

/**
 * Path segments of the git-submodule directory that holds the upstream
 * ontology artifacts (the `artifacts/` directory inside
 * `ontology-management-base`). Used as the last-resort fallback when
 * `ontology-sources.json` and `ONTOLOGY_ARTIFACTS_PATH` are absent.
 *
 * OMB is a direct submodule of this repo, so the chain is shallow. The
 * duplicate implementations each hard-coded this path; a future rename of
 * the submodule had to be made in several places.
 */
export const DEFAULT_OMB_SUBMODULE_PATH = [
  'submodules',
  'ontology-management-base',
  'artifacts',
] as const

/** A single declared source in `ontology-sources.json`. */
export interface OntologySource {
  /** Human-readable name (typically the domain name). */
  name?: string
  /** Workspace-relative path to a directory containing domain subdirectories. */
  path: string
  /**
   * Optional workspace-relative path to a directory containing instance data
   * files (JSON-LD or Turtle). When present, the data-loader uses ONLY these
   * directories instead of built-in sample data.
   */
  data?: string
  /**
   * Optional allowlist of domain subdirectory names to load from this root.
   * When set, only these domains are loaded; all other subdirectories are
   * ignored. When absent, all domain subdirectories are loaded (default).
   *
   * Use this when a source root (e.g. OMB `artifacts/`) contains many
   * domains but only a subset is needed.
   */
  domains?: string[]
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

/** A resolved artifact root with optional domain allowlist. */
export interface ArtifactRoot {
  /** Absolute path to the artifacts directory. */
  path: string
  /**
   * When set, only load domain subdirectories whose names appear in this set.
   * When absent, load all domain subdirectories.
   */
  domainAllowlist?: ReadonlySet<string>
}

/**
 * Resolve the absolute directory paths to search for ontology artifacts.
 *
 * Resolution order:
 * 1. `sources[].path` entries from `ontology-sources.json` (relative to workspace root)
 * 2. `ONTOLOGY_ARTIFACTS_PATH` from the Zod-validated config (single path)
 * 3. The default {@link DEFAULT_OMB_SUBMODULE_PATH} chain inside the workspace
 */
export function getArtifactRoots(): ArtifactRoot[] {
  const root = getWorkspaceRoot()
  const manifest = loadOntologySourcesManifest()
  if (manifest && manifest.sources.length > 0) {
    return manifest.sources.map((s) => ({
      path: join(root, s.path),
      domainAllowlist: s.domains ? new Set(s.domains) : undefined,
    }))
  }

  const override = getConfig().ONTOLOGY_ARTIFACTS_PATH
  if (override) return [{ path: override }]

  return [{ path: join(root, ...DEFAULT_OMB_SUBMODULE_PATH) }]
}

/**
 * Resolve data sources from `ontology-sources.json`, pairing each `data`
 * directory with its corresponding `path` (artifacts) directory so the
 * loader can resolve remote @context URLs to local context files.
 */
export function getDataSources(): { dataDir: string; artifactsDir: string }[] {
  const root = getWorkspaceRoot()
  const manifest = loadOntologySourcesManifest()
  if (!manifest) return []
  return manifest.sources
    .filter((s): s is OntologySource & { data: string } => typeof s.data === 'string')
    .map((s) => ({
      dataDir: join(root, s.data),
      artifactsDir: join(root, s.path),
    }))
}

/**
 * Return the names of sources that declare instance data. These domains
 * are implicitly "asset domains" — the user explicitly provided data for
 * them and expects them to be searchable, regardless of whether they
 * participate in cross-domain rdfs:subClassOf hierarchies.
 */
export function getDataDomainNames(): string[] {
  const manifest = loadOntologySourcesManifest()
  if (!manifest) return []
  return manifest.sources
    .filter((s) => typeof s.data === 'string' && typeof s.name === 'string')
    .map((s) => s.name!)
}

/** Per-root view of what the source resolver found on disk. */
export interface OntologyRootDiagnostic {
  /** Absolute path the resolver searched. */
  path: string
  /** Whether the directory exists. */
  exists: boolean
  /** Number of `*.shacl.ttl` files found in its domain subdirectories. */
  shapeFileCount: number
}

/** Aggregate diagnostics across every resolved artifact root. */
export interface OntologySourcesDiagnostics {
  roots: OntologyRootDiagnostic[]
  /** Sum of `shapeFileCount` across all roots. Zero means nothing to load. */
  totalShapeFiles: number
}

/**
 * Inspect every resolved artifact root and report whether it exists and how
 * many shape files it contains. Drives both the install-time preflight and
 * the startup fail-fast — neither has to re-implement the resolution order.
 */
export function diagnoseOntologySources(): OntologySourcesDiagnostics {
  const roots = getArtifactRoots().map((root): OntologyRootDiagnostic => {
    if (!existsSync(root.path)) return { path: root.path, exists: false, shapeFileCount: 0 }
    let shapeFileCount = 0
    for (const entry of readdirSync(root.path)) {
      if (root.domainAllowlist && !root.domainAllowlist.has(entry)) continue
      const domainDir = join(root.path, entry)
      if (!statSync(domainDir).isDirectory()) continue
      for (const file of readdirSync(domainDir)) {
        if (file.endsWith('.shacl.ttl')) shapeFileCount++
      }
    }
    return { path: root.path, exists: true, shapeFileCount }
  })
  const totalShapeFiles = roots.reduce((sum, r) => sum + r.shapeFileCount, 0)
  return { roots, totalShapeFiles }
}

/**
 * Build the actionable error shown when no ontology shape files are found.
 * Pure (takes diagnostics, no I/O) so the message contract is unit-testable.
 *
 * The remediation is data-driven, not ontology-specific: when a missing root
 * lives under a `submodules/` segment the most likely cause is an
 * un-initialized git submodule, so we surface the init command; otherwise we
 * point at the two configuration knobs (`ontology-sources.json`
 * and `ONTOLOGY_ARTIFACTS_PATH`).
 */
export function formatMissingSourcesError(diag: OntologySourcesDiagnostics): string {
  const lines = [
    'No ontology shape files (*.shacl.ttl) were found. Natural-language search ' +
      'cannot work without an ontology — the LLM prompt, slot validation, and ' +
      'query compiler are all driven by the SHACL shapes.',
    '',
    'Searched these source roots:',
    ...diag.roots.map(
      (r) => `  - ${r.path} ${r.exists ? `(exists, 0 shape files)` : '(missing)'}` // exists+0 means an empty/wrong dir
    ),
    '',
    'To fix:',
  ]

  const missingSubmoduleRoot = diag.roots.some(
    (r) => !r.exists && r.path.split(/[/\\]/).includes('submodules')
  )
  if (missingSubmoduleRoot) {
    lines.push(
      '  • The ontology ships as a git submodule that is not initialized. Run:',
      '        git submodule update --init',
      '    then restart. (Fresh clones: `git clone --recurse-submodules <url>`.)'
    )
  }
  lines.push(
    '  • Or point ONTOLOGY_ARTIFACTS_PATH at a directory of ontology artifacts,',
    '  • Or declare your source directories in ontology-sources.json ({ sources: [{ path }] }).'
  )
  return lines.join('\n')
}

/**
 * Throw {@link OntologySourcesError} when no shape files can be found, so the
 * service fails fast with an actionable message instead of silently starting
 * with an empty schema graph and returning empty/garbage search results.
 *
 * Accepts the diagnostics as a parameter (defaulting to a live scan) so the
 * guard can be unit-tested without touching the filesystem.
 */
export function assertOntologySourcesAvailable(
  diag: OntologySourcesDiagnostics = diagnoseOntologySources()
): void {
  if (diag.totalShapeFiles === 0) {
    throw new OntologySourcesError(formatMissingSourcesError(diag))
  }
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
 *
 * When a root declares a `domainAllowlist`, only those domain subdirectories
 * are loaded — all others are skipped.
 */
export function discoverShapeFiles(options: DiscoverShapeFilesOptions = {}): ShapeFile[] {
  const includeOwl = options.includeOwl ?? false
  const exclude = options.exclude ?? new Set<string>()
  const results: ShapeFile[] = []

  for (const root of getArtifactRoots()) {
    if (!existsSync(root.path)) continue
    for (const entry of readdirSync(root.path)) {
      if (exclude.has(entry)) continue
      if (root.domainAllowlist && !root.domainAllowlist.has(entry)) continue
      const domainDir = join(root.path, entry)
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
