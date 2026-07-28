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
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const strict = process.argv.includes('--strict')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Resolve the artifact roots the server would search, in the same order:
 * `ontology-sources.json` → `ONTOLOGY_ARTIFACTS_PATH` → none.
 *
 * Deliberately ontology-agnostic: it reads the committed manifest rather than
 * hard-coding the demo's submodule chain, so it carries no ontology-specific
 * identifiers (the server owns the last-resort default in sources.ts). The
 * submodule remediation below is still reached because the committed manifest
 * path lives under a `submodules/` segment.
 */
/**
 * Default cache path segments — mirrors DEFAULT_ONTOLOGY_CACHE_PATH in
 * packages/ontology/src/sources.ts so the preflight check matches runtime.
 */
const DEFAULT_CACHE_SEGMENTS = ['.ontology', 'artifacts']

function resolveArtifactRoots() {
  const manifestPath = join(root, 'ontology-sources.json')
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
      const sources = Array.isArray(manifest?.sources) ? manifest.sources : []
      const paths = sources
        .map((s) => (typeof s?.path === 'string' ? join(root, s.path) : null))
        .filter(Boolean)
      if (paths.length > 0) return paths
    } catch {
      // A malformed manifest is reported loudly by the server at startup
      // (OntologySourcesError); the preflight just falls through.
    }
  }
  const envOverride = process.env.ONTOLOGY_ARTIFACTS_PATH
  if (envOverride) return [envOverride]
  // Last resort: the default cache path (matches runtime fallback)
  return [join(root, ...DEFAULT_CACHE_SEGMENTS)]
}

/** Count `*.shacl.ttl` files in the domain subdirectories of a root. */
function countShapeFiles(rootDir) {
  if (!existsSync(rootDir)) return 0
  let count = 0
  for (const entry of readdirSync(rootDir)) {
    const domainDir = join(rootDir, entry)
    if (!statSync(domainDir).isDirectory()) continue
    for (const file of readdirSync(domainDir)) {
      if (file.endsWith('.shacl.ttl')) count++
    }
  }
  return count
}

const roots = resolveArtifactRoots().map((path) => ({
  path,
  exists: existsSync(path),
  shapeFileCount: countShapeFiles(path),
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
  '     • Or declare sources in ontology-sources.json ({ sources: [{ path }] }).',
  ''
)
process.stderr.write(lines.join('\n'))

// postinstall stays advisory so a missing ontology never bricks `pnpm install`
// (CI and prod images may legitimately provide artifacts another way). The
// strict mode used by `pnpm run check:setup` fails so it can gate CI.
process.exit(strict ? 1 : 0)
