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
 * default submodule path) so the advice here matches what the server would do.
 * It is ontology-agnostic: it reports on whatever paths are configured and
 * keys its remediation on the generic `submodules/` path segment, never on a
 * specific ontology name.
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
 * Default submodule path segments — mirrors DEFAULT_OMB_SUBMODULE_PATH in
 * packages/ontology/src/sources.ts so the preflight check matches runtime.
 */
const DEFAULT_SUBMODULE_SEGMENTS = [
  'submodules',
  'hd-map-asset-example',
  'submodules',
  'sl-5-8-asset-tools',
  'submodules',
  'ontology-management-base',
  'artifacts',
]

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
  // Last resort: the default submodule chain (matches runtime fallback)
  return [join(root, ...DEFAULT_SUBMODULE_SEGMENTS)]
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
const missingSubmoduleRoot = roots.some(
  (r) => !r.exists && r.path.split(/[/\\]/).includes('submodules')
)

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
if (missingSubmoduleRoot) {
  lines.push(
    '     • Initialize the ontology git submodules (most likely cause):',
    '           git submodule update --init --recursive',
    '       Fresh clones: git clone --recurse-submodules <url>'
  )
}
lines.push(
  '     • Or set ONTOLOGY_ARTIFACTS_PATH to a directory of ontology artifacts,',
  '     • Or declare sources in ontology-sources.json ({ sources: [{ path }] }).',
  ''
)
process.stderr.write(lines.join('\n'))

// postinstall stays advisory so a missing submodule never bricks `pnpm install`
// (CI and prod images may legitimately provide artifacts another way). The
// strict mode used by `pnpm run check:setup` fails so it can gate CI.
process.exit(strict ? 1 : 0)
