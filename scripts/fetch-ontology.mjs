#!/usr/bin/env node
/**
 * Materialize the pinned ontology source tree.
 *
 * The ontology this repo searches over is published as a Python distribution
 * (`ontology-management-base` on PyPI), whose sdist carries the `artifacts/`
 * and `imports/` trees at the same layout a source checkout has. This script
 * downloads that one distribution, verifies its checksum, and extracts only
 * those trees into a local cache — so a fresh clone needs one 1.5 MB download
 * instead of a git submodule that drags ~900 MB of upstream history and nested
 * submodules along for 11 MB of data.
 *
 * Nothing here needs Python: an sdist is a gzipped tarball. The pin lives in
 * `ontology-package.json`, and **its sha256 is the authority** — the registry
 * is asked where the file lives, never what it should contain.
 *
 * Usage:
 *   node scripts/fetch-ontology.mjs            # fetch if the cache does not match the pin
 *   node scripts/fetch-ontology.mjs --check    # verify only; non-zero exit if stale (no network)
 *   node scripts/fetch-ontology.mjs --force    # re-fetch even if the cache matches
 *
 * Runs on `postinstall` (advisory — a fetch failure must never brick an
 * install) and under `pnpm run check:setup` (strict).
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Name of the marker that records which pin the cache was built from. */
const PIN_MARKER = '.pin'

/**
 * Read and validate `ontology-package.json`. Throws on anything malformed:
 * a half-understood pin would silently fetch the wrong ontology.
 */
export function readPin(root = ROOT) {
  const path = join(root, 'ontology-package.json')
  if (!existsSync(path)) throw new Error(`ontology pin not found: ${path}`)
  const pin = JSON.parse(readFileSync(path, 'utf8'))
  const missing = ['package', 'version', 'registry', 'sdist', 'paths', 'cacheDir'].filter(
    (k) => pin[k] === undefined
  )
  if (missing.length > 0) {
    throw new Error(`${path}: missing required field(s) ${missing.join(', ')}`)
  }
  if (typeof pin.sdist.filename !== 'string' || !/^[0-9a-f]{64}$/.test(pin.sdist.sha256 ?? '')) {
    throw new Error(`${path}: sdist must be { filename: string, sha256: 64 hex chars }`)
  }
  if (!Array.isArray(pin.paths) || pin.paths.length === 0) {
    throw new Error(`${path}: paths must be a non-empty array of subtrees to extract`)
  }
  return pin
}

/** The identity a materialized cache must carry to count as matching the pin. */
function pinIdentity(pin) {
  return { package: pin.package, version: pin.version, sha256: pin.sdist.sha256 }
}

/**
 * Whether the cache already holds exactly this pin: the marker matches AND
 * every sentinel file is present. The marker alone is not enough — a partially
 * deleted cache would still carry it.
 */
export function cacheMatchesPin(pin, root = ROOT) {
  const cacheDir = join(root, pin.cacheDir)
  const markerPath = join(cacheDir, PIN_MARKER)
  if (!existsSync(markerPath)) return false
  let marker
  try {
    marker = JSON.parse(readFileSync(markerPath, 'utf8'))
  } catch {
    return false
  }
  const want = pinIdentity(pin)
  if (marker.package !== want.package || marker.version !== want.version) return false
  if (marker.sha256 !== want.sha256) return false
  return (pin.sentinels ?? []).every((rel) => existsSync(join(cacheDir, rel)))
}

/** sha256 of a buffer, as lowercase hex. */
export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Ask the registry where the pinned sdist lives. Only the URL comes from here;
 * the bytes are checked against the pin's own sha256, so a registry that served
 * something else cannot get it past {@link materialize}.
 */
export async function resolveSdistUrl(pin, fetchImpl = fetch) {
  const url = `${pin.registry}/pypi/${pin.package}/${pin.version}/json`
  const res = await fetchImpl(url)
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`)
  const meta = await res.json()
  const entry = (meta.urls ?? []).find(
    (u) => u.packagetype === 'sdist' && u.filename === pin.sdist.filename
  )
  if (!entry) {
    throw new Error(
      `${pin.package} ${pin.version} does not publish an sdist named ${pin.sdist.filename}`
    )
  }
  return entry.url
}

/**
 * Extract the pinned subtrees from a downloaded tarball into the cache.
 *
 * An sdist's entries are prefixed with `<name>-<version>/`, which `strip: 1`
 * removes so the cache mirrors the upstream layout (`artifacts/`, `imports/`)
 * — the same paths a source checkout has, which is what keeps every path
 * reference in this repo structurally unchanged.
 *
 * Verification order matters: checksum first, then extract, then assert the
 * sentinels. A distribution that stopped shipping the data would pass the
 * checksum (it is a legitimately published file) and must still fail loudly
 * rather than leave an empty cache behind.
 */
export async function materialize(tarballPath, pin, { root = ROOT, tarImpl } = {}) {
  const bytes = readFileSync(tarballPath)
  const digest = sha256(bytes)
  if (digest !== pin.sdist.sha256) {
    throw new Error(
      `checksum mismatch for ${pin.sdist.filename}\n  expected ${pin.sdist.sha256}\n  received ${digest}`
    )
  }

  const tar = tarImpl ?? (await import('tar'))
  const cacheDir = join(root, pin.cacheDir)
  rmSync(cacheDir, { recursive: true, force: true })
  mkdirSync(cacheDir, { recursive: true })

  const wanted = pin.paths.map((p) => `${p}/`)
  await tar.x({
    file: tarballPath,
    cwd: cacheDir,
    strip: 1,
    // `path` is the full entry name including the `<name>-<version>/` prefix
    // that `strip` will remove, so match on the segment after it.
    filter: (path) => {
      const rel = path.split('/').slice(1).join('/')
      return wanted.some((w) => rel.startsWith(w))
    },
  })

  const missing = (pin.sentinels ?? []).filter((rel) => !existsSync(join(cacheDir, rel)))
  if (missing.length > 0) {
    rmSync(cacheDir, { recursive: true, force: true })
    throw new Error(
      `${pin.package} ${pin.version} did not contain: ${missing.join(', ')}\n` +
        `The distribution's layout changed — update ontology-package.json (paths/sentinels) ` +
        `rather than working around it.`
    )
  }

  writeFileSync(
    join(cacheDir, PIN_MARKER),
    JSON.stringify({ ...pinIdentity(pin), fetchedFrom: pin.sdist.filename }, null, 2) + '\n'
  )
  return cacheDir
}

/** Download, verify and extract the pinned distribution. */
export async function fetchOntology({ root = ROOT, fetchImpl = fetch, tarImpl, force } = {}) {
  const pin = readPin(root)
  if (!force && cacheMatchesPin(pin, root)) {
    return { pin, cacheDir: join(root, pin.cacheDir), skipped: true }
  }

  const url = await resolveSdistUrl(pin, fetchImpl)
  const res = await fetchImpl(url)
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`)
  const bytes = Buffer.from(await res.arrayBuffer())

  const temp = await mkdtemp(join(tmpdir(), 'ontology-pin-'))
  try {
    const tarballPath = join(temp, pin.sdist.filename)
    await writeFile(tarballPath, bytes)
    const cacheDir = await materialize(tarballPath, pin, { root, tarImpl })
    return { pin, cacheDir, skipped: false }
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const check = process.argv.includes('--check')
  const force = process.argv.includes('--force')

  try {
    const pin = readPin()
    if (check) {
      if (cacheMatchesPin(pin)) {
        process.stdout.write(
          `✓ ontology cache matches the pin (${pin.package} ${pin.version}) in ${pin.cacheDir}/\n`
        )
        process.exit(0)
      }
      process.stderr.write(
        `✗ ontology cache does not match the pin (${pin.package} ${pin.version}).\n` +
          `  Run: pnpm run fetch:ontology\n`
      )
      process.exit(1)
    }

    const { cacheDir, skipped } = await fetchOntology({ force })
    process.stdout.write(
      skipped
        ? `• ontology cache already at ${pin.package} ${pin.version}\n`
        : `✓ ontology ${pin.package} ${pin.version} extracted to ${cacheDir}\n`
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Advisory on postinstall: a network hiccup must not brick `pnpm install`.
    // The ontology preflight that runs next reports the consequence, and
    // `pnpm run check:setup` fails for real.
    process.stderr.write(`⚠  ontology fetch failed: ${message}\n`)
    process.exit(process.argv.includes('--strict') ? 1 : 0)
  }
}
