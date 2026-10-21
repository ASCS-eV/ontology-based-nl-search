#!/usr/bin/env node
/**
 * Ontology-sources preflight.
 *
 * Runs on `postinstall` (advisory, never blocks install) and via
 * `pnpm run check:setup` (strict, exits non-zero on failure). It answers the
 * single most common first-run question — "why does search return nothing?" —
 * by checking, at setup time, that an ontology actually exists on disk.
 *
 * The check mirrors the runtime resolution order in
 * `packages/ontology/src/sources.ts` (manifest → ONTOLOGY_ARTIFACTS_PATH →
 * default cache path) so the advice here matches what the server would do.
 * It is ontology-agnostic: it reports on whatever paths are configured and
 * keys its remediation on generic path segments, never on a specific ontology
 * name.
 *
 * Self-contained on purpose: `postinstall` runs before any package is built,
 * so it cannot import the (TypeScript) ontology package.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadEnvFileIntoProcess } from './check-env.mjs'

const strict = process.argv.includes('--strict')
const checkout = join(dirname(fileURLToPath(import.meta.url)), '..')
// The server reads ONTOLOGY_ROOT / ONTOLOGY_SOURCES_FILE / ONTOLOGY_ARTIFACTS_PATH
// from .env.local too.
loadEnvFileIntoProcess(checkout)
// Workspace root the server resolves against — `getProjectRoot` in
// packages/ontology/src/paths.ts: a relative ONTOLOGY_ROOT is relative to the
// checkout, whatever directory this runs in.
const root = process.env.ONTOLOGY_ROOT ? resolve(checkout, process.env.ONTOLOGY_ROOT) : checkout

/**
 * Default cache path segments — mirrors DEFAULT_ONTOLOGY_CACHE_PATH in
 * packages/ontology/src/sources.ts so the preflight check matches runtime.
 */
const DEFAULT_CACHE_SEGMENTS = ['.ontology', 'artifacts']

const configuredManifest = process.env.ONTOLOGY_SOURCES_FILE
const manifestPath = configuredManifest
  ? resolve(root, configuredManifest)
  : join(root, 'ontology-sources.json')

/**
 * Read the manifest and reject what `loadOntologySourcesManifest` in
 * packages/ontology/src/sources.ts rejects: unreadable or malformed JSON, no
 * `sources` array, an entry without a string `path`, and a `domains` /
 * `excludeDomains` list that is not an array of distinct names or that
 * overlaps the other list.
 */
function readManifest() {
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  } catch (err) {
    throw new Error(`Cannot read ${manifestPath} as JSON: ${err.message}`)
  }
  if (manifest === null || typeof manifest !== 'object' || !Array.isArray(manifest.sources)) {
    throw new Error(`${manifestPath} must declare { sources: [...] }`)
  }
  for (const source of manifest.sources) {
    if (source === null || typeof source !== 'object' || typeof source.path !== 'string') {
      throw new Error(
        `${manifestPath}: every sources[] entry must be { path: string }; received ${JSON.stringify(source)}`
      )
    }
    for (const key of ['domains', 'excludeDomains']) {
      const list = source[key]
      if (list === undefined) continue
      const names = Array.isArray(list) && list.every((d) => typeof d === 'string')
      if (!names || new Set(list).size !== list.length) {
        throw new Error(
          `${manifestPath}: sources[].${key} of "${source.path}" must be an array of distinct domain names`
        )
      }
    }
    const excluded = new Set(source.excludeDomains ?? [])
    const both = (source.domains ?? []).filter((d) => excluded.has(d))
    if (both.length > 0) {
      throw new Error(
        `${manifestPath}: source "${source.path}" both includes and excludes ${both.join(', ')}`
      )
    }
  }
  return manifest.sources
}

/**
 * The server rejects a configured manifest that is missing, and any manifest
 * it cannot read, with an OntologySourcesError — it never falls back to
 * another ontology. Report exactly that, rather than counting the shape files
 * of a fallback the server would not load.
 */
function failOnManifest(message) {
  process.stderr.write(
    [
      '',
      `⚠  ${message}`,
      '   The API starts DEGRADED and loads no ontology until the manifest is fixed',
      configuredManifest ? '   or ONTOLOGY_SOURCES_FILE is unset.' : '   or removed.',
      '',
    ].join('\n')
  )
  process.exit(strict ? 1 : 0)
}

let manifestSources = null
if (existsSync(manifestPath)) {
  try {
    manifestSources = readManifest()
  } catch (err) {
    failOnManifest(err.message)
  }
} else if (configuredManifest) {
  failOnManifest(`ONTOLOGY_SOURCES_FILE points at a missing file: ${manifestPath}`)
}

/**
 * Resolve the artifact roots the server would search, in the same order:
 * the manifest (`ONTOLOGY_SOURCES_FILE`, else `ontology-sources.json`) →
 * `ONTOLOGY_ARTIFACTS_PATH` → the default cache path. Relative source paths
 * resolve against the manifest's own directory, as in sources.ts.
 *
 * Deliberately ontology-agnostic: it reads whatever the manifest declares and
 * carries no ontology-specific identifiers.
 */
function resolveArtifactRoots() {
  if (manifestSources && manifestSources.length > 0) {
    const baseDir = dirname(manifestPath)
    const asSet = (list) => (list ? new Set(list) : undefined)
    return manifestSources.map((s) => ({
      path: isAbsolute(s.path) ? s.path : resolve(baseDir, s.path),
      allow: asSet(s.domains),
      deny: asSet(s.excludeDomains),
    }))
  }
  const envOverride = process.env.ONTOLOGY_ARTIFACTS_PATH
  if (envOverride) return [{ path: resolve(root, envOverride) }]
  // Last resort: the default cache path (matches runtime fallback)
  return [{ path: join(root, ...DEFAULT_CACHE_SEGMENTS) }]
}

/**
 * Count `*.shacl.ttl` files in the selected domain subdirectories of a root —
 * mirrors `isDomainSelected` in packages/ontology/src/sources.ts.
 */
function countShapeFiles({ path: rootDir, allow, deny }) {
  if (!existsSync(rootDir)) return 0
  let count = 0
  for (const entry of readdirSync(rootDir)) {
    if (allow && !allow.has(entry)) continue
    if (deny?.has(entry)) continue
    const domainDir = join(rootDir, entry)
    if (!statSync(domainDir).isDirectory()) continue
    for (const file of readdirSync(domainDir)) {
      if (file.endsWith('.shacl.ttl')) count++
    }
  }
  return count
}

const roots = resolveArtifactRoots().map((r) => ({
  path: r.path,
  exists: existsSync(r.path),
  shapeFileCount: countShapeFiles(r),
}))
const total = roots.reduce((sum, r) => sum + r.shapeFileCount, 0)

if (total > 0) {
  if (strict) {
    const summary = roots.map((r) => `${r.shapeFileCount} in ${r.path}`).join(', ')
    process.stdout.write(`✓ Ontology sources found (${total} shape files: ${summary}).\n`)
  }
  process.exit(0)
}

// No shape files — build the same actionable guidance the server emits.
const segments = (r) => r.path.split(/[/\\]/)
const missingCacheRoot = roots.some(
  (r) => !r.exists && segments(r).includes(DEFAULT_CACHE_SEGMENTS[0])
)
const missingSubmoduleRoot = roots.some((r) => !r.exists && segments(r).includes('submodules'))

const lines = [
  '',
  '⚠  No ontology shape files (*.shacl.ttl) were found.',
  '   Natural-language search needs an ontology — without it the API starts',
  '   DEGRADED and every search returns empty results.',
  '',
  '   Searched:',
  ...(roots.length > 0
    ? roots.map((r) => `     - ${r.path} ${r.exists ? '(exists, 0 shape files)' : '(missing)'}`)
    : ['     (no ontology-sources.json and no ONTOLOGY_ARTIFACTS_PATH configured)']),
  '',
  '   To fix:',
]
if (missingCacheRoot) {
  lines.push(
    '     • Materialize the pinned ontology (most likely cause):',
    '           pnpm run fetch:ontology',
    '       It downloads the distribution pinned in ontology-package.json',
    '       (version + sha256) and extracts it. `pnpm install` runs it too.'
  )
}
if (missingSubmoduleRoot) {
  lines.push(
    '     • A declared source lives under submodules/ — initialize it:',
    '           git submodule update --init'
  )
}
lines.push(
  '     • Or set ONTOLOGY_ARTIFACTS_PATH to a directory of ontology artifacts,',
  '     • Or declare sources in ontology-sources.json ({ sources: [{ path }] })',
  '       or in the manifest ONTOLOGY_SOURCES_FILE points at.',
  ''
)
process.stderr.write(lines.join('\n'))

// postinstall stays advisory so a missing ontology never bricks `pnpm install`
// (CI and prod images may legitimately provide artifacts another way). The
// strict mode used by `pnpm run check:setup` fails so it can gate CI.
process.exit(strict ? 1 : 0)
