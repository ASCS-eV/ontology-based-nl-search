/**
 * Single source of truth for ontology source-tree discovery.
 *
 * Before this module the workspace-root walk, the `ontology-sources.json`
 * manifest read, and the SHACL/OWL file discovery were copy-pasted across
 * five files (`schema-loader.ts`, `shacl-validator.ts`,
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

/**
 * Path segments of the local ontology cache that holds the upstream artifacts.
 * Used as the last-resort fallback when `ontology-sources.json` and
 * `ONTOLOGY_ARTIFACTS_PATH` are absent.
 *
 * The cache is materialized by `scripts/fetch-ontology.mjs` from the
 * distribution pinned in `ontology-package.json` (version + sha256), and mirrors
 * the upstream layout, so this path is version-independent: bumping the
 * ontology never moves it. Not checked in — a fresh clone gets it from
 * `pnpm install` (postinstall) or `pnpm run fetch:ontology`.
 */
export const DEFAULT_ONTOLOGY_CACHE_PATH = ['.ontology', 'artifacts'] as const

/**
 * Path segments of the local ontology cache's `imports/` tree — the
 * upstream standards (ASAM OpenDRIVE, ASAM OpenSCENARIO, …) an asset domain
 * references, as opposed to the ASCS-eV `artifacts/` domains above. Same
 * materialization and versioning story as {@link DEFAULT_ONTOLOGY_CACHE_PATH};
 * kept as a sibling constant so a consumer resolving into `imports/` (e.g. the
 * authoring gate grounding its cross-file OpenDRIVE check in the real ASAM
 * ontology) shares one source of truth for the cache layout.
 */
export const DEFAULT_ONTOLOGY_IMPORTS_PATH = ['.ontology', 'imports'] as const

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
  /**
   * Optional denylist of domain subdirectory names to skip in this root.
   * Applied after {@link domains}: a domain is loaded only when it passes the
   * allowlist (if any) and is not named here. A name may not appear in both
   * lists.
   *
   * Use this to drop a few domains from a large root without enumerating
   * every other one.
   */
  excludeDomains?: string[]
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
    validateDomainSelection(configPath, source as OntologySource)
  }
  return { sources: sources as readonly OntologySource[] }
}

/**
 * Fail fast on a mal-formed domain selection: both lists must be arrays of
 * strings ([JSON-SCHEMA-CORE] §10.3.1.2 `items`, [JSON-SCHEMA-VAL] §6.1.1 `type`, as declared in
 * `ontology-sources.schema.json`), and a domain named in both is a
 * contradiction the loader refuses to resolve silently.
 */
function validateDomainSelection(configPath: string, source: OntologySource): void {
  for (const key of ['domains', 'excludeDomains'] as const) {
    const list: unknown = source[key]
    if (list === undefined) continue
    if (!Array.isArray(list) || !list.every((d) => typeof d === 'string')) {
      throw new OntologySourcesError(
        `${configPath}: sources[].${key} of "${source.path}" must be an array of domain names; received ${JSON.stringify(list)}`
      )
    }
  }
  const excluded = new Set(source.excludeDomains ?? [])
  const both = (source.domains ?? []).filter((d) => excluded.has(d))
  if (both.length > 0) {
    throw new OntologySourcesError(
      `${configPath}: source "${source.path}" both includes and excludes ${both.join(', ')}; name each domain in at most one of domains / excludeDomains`
    )
  }
}

/** A resolved artifact root with optional domain allow- and denylist. */
export interface ArtifactRoot {
  /** Absolute path to the artifacts directory. */
  path: string
  /**
   * When set, only load domain subdirectories whose names appear in this set.
   * When absent, load all domain subdirectories.
   */
  domainAllowlist?: ReadonlySet<string>
  /** When set, never load domain subdirectories whose names appear in this set. */
  domainDenylist?: ReadonlySet<string>
}

/**
 * Whether a domain subdirectory of `root` is selected by the root's
 * allowlist and denylist. Every walk over an artifact root goes through this
 * one predicate, so the schema graph, the domain registry, the SHACL
 * validator and the JSON-LD contexts always see the same set of ontologies.
 */
export function isDomainSelected(root: ArtifactRoot, domain: string): boolean {
  if (root.domainAllowlist && !root.domainAllowlist.has(domain)) return false
  return !root.domainDenylist?.has(domain)
}

/**
 * Resolve the absolute directory paths to search for ontology artifacts.
 *
 * Resolution order:
 * 1. `sources[].path` entries from `ontology-sources.json` (relative to workspace root)
 * 2. `ONTOLOGY_ARTIFACTS_PATH` from the Zod-validated config (single path)
 * 3. The default {@link DEFAULT_ONTOLOGY_CACHE_PATH} inside the workspace
 */
export function getArtifactRoots(): ArtifactRoot[] {
  const root = getWorkspaceRoot()
  const manifest = loadOntologySourcesManifest()
  if (manifest && manifest.sources.length > 0) {
    return manifest.sources.map((s) => ({
      path: join(root, s.path),
      domainAllowlist: s.domains ? new Set(s.domains) : undefined,
      domainDenylist: s.excludeDomains ? new Set(s.excludeDomains) : undefined,
    }))
  }

  const override = getConfig().ONTOLOGY_ARTIFACTS_PATH
  if (override) return [{ path: override }]

  return [{ path: join(root, ...DEFAULT_ONTOLOGY_CACHE_PATH) }]
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
  /**
   * Domain names the root's `domains` / `excludeDomains` lists name but that
   * have no subdirectory in the root — almost always a typo. Only present
   * when non-empty.
   */
  unknownDomains?: string[]
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
    const entries = readdirSync(root.path)
    for (const entry of entries) {
      if (!isDomainSelected(root, entry)) continue
      const domainDir = join(root.path, entry)
      if (!statSync(domainDir).isDirectory()) continue
      for (const file of readdirSync(domainDir)) {
        if (file.endsWith('.shacl.ttl')) shapeFileCount++
      }
    }
    const present = new Set(entries)
    const named = [...(root.domainAllowlist ?? []), ...(root.domainDenylist ?? [])]
    const unknownDomains = named.filter((d) => !present.has(d))
    return {
      path: root.path,
      exists: true,
      shapeFileCount,
      ...(unknownDomains.length > 0 ? { unknownDomains } : {}),
    }
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

  // Remediation is keyed on the shape of the missing path, not on any ontology
  // name: the default root is the pinned-package cache, but a deployment may
  // legitimately declare a submodule (or any directory) of its own.
  const segments = (r: OntologyRootDiagnostic) => r.path.split(/[/\\]/)
  const missingCacheRoot = diag.roots.some(
    (r) => !r.exists && segments(r).includes(DEFAULT_ONTOLOGY_CACHE_PATH[0])
  )
  if (missingCacheRoot) {
    lines.push(
      '  • The ontology cache has not been materialized yet. Run:',
      '        pnpm run fetch:ontology',
      '    which downloads the distribution pinned in ontology-package.json',
      '    (version + sha256) and extracts it. `pnpm install` does this too.'
    )
  }
  const missingSubmoduleRoot = diag.roots.some(
    (r) => !r.exists && segments(r).includes('submodules')
  )
  if (missingSubmoduleRoot) {
    lines.push(
      '  • A declared source lives under submodules/ and is not initialized. Run:',
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
 * When a root declares a `domainAllowlist` and/or `domainDenylist`, only the
 * selected domain subdirectories are loaded (see {@link isDomainSelected}).
 */
export function discoverShapeFiles(options: DiscoverShapeFilesOptions = {}): ShapeFile[] {
  const includeOwl = options.includeOwl ?? false
  const exclude = options.exclude ?? new Set<string>()
  const results: ShapeFile[] = []

  for (const root of getArtifactRoots()) {
    if (!existsSync(root.path)) continue
    for (const entry of readdirSync(root.path)) {
      if (exclude.has(entry)) continue
      if (!isDomainSelected(root, entry)) continue
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

/** A discovered JSON-LD context file with its domain (directory name above it). */
export interface ContextFile {
  path: string
  /** Directory name immediately above the file — domain by convention. */
  domain: string
}

/**
 * Walk every artifact root, every domain subdirectory, and return every
 * `*.context.jsonld` file inside — the per-ontology JSON-LD contexts that
 * map human-facing term names to IRIs ([JSON-LD11] §3.1 The Context).
 *
 * Sibling of {@link discoverShapeFiles}: same root resolution
 * (`getArtifactRoots`), same allow-/denylist handling, same silent skip of
 * missing roots. Discovery only — parsing lives with the consumer
 * (`@ontology-search/search` schema-index), keeping this module I/O-shape
 * agnostic.
 */
export function discoverContextFiles(): ContextFile[] {
  const results: ContextFile[] = []

  for (const root of getArtifactRoots()) {
    if (!existsSync(root.path)) continue
    for (const entry of readdirSync(root.path)) {
      if (!isDomainSelected(root, entry)) continue
      const domainDir = join(root.path, entry)
      if (!statSync(domainDir).isDirectory()) continue
      for (const file of readdirSync(domainDir)) {
        if (file.endsWith('.context.jsonld')) {
          results.push({ path: join(domainDir, file), domain: entry })
        }
      }
    }
  }
  return results
}
