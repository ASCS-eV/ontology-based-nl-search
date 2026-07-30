#!/usr/bin/env node
/**
 * Dev launcher — sets NODE_OPTIONS for the API server's heap requirement
 * (Oxigraph WASM + SHACL validator + Copilot SDK subprocess ≈ 4–5 GB)
 * then delegates to turbo.
 */
import { execSync, spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { cacheMatchesPin, readPin } from './fetch-ontology.mjs'

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))

/**
 * Ontology preflight for `pnpm dev`.
 *
 * Without a materialized ontology the API starts DEGRADED and every search
 * returns empty results — a silent failure that reads as "my query is wrong"
 * rather than "no data is loaded". So before starting the dev servers we make
 * sure the pinned ontology cache exists, fetch it automatically when it does
 * not, and — if that fetch cannot complete (offline, proxy, changed pin) —
 * print an unmissable, actionable banner instead of booting into a broken app.
 *
 * It never aborts: developers working on non-search parts of the app can still
 * start the servers. The banner is the "better error message" — it turns a
 * mystery into a one-line fix.
 */
/** Spawn the fetcher script, inheriting stdio and the proxy-aware CLI path. */
function runFetchScript() {
  spawnSync(process.execPath, [join(SCRIPTS_DIR, 'fetch-ontology.mjs')], {
    stdio: 'inherit',
    env: process.env,
  })
}

export function preflightOntology({
  readPin: readPinFn = readPin,
  cacheMatchesPin: cacheMatchesPinFn = cacheMatchesPin,
  runFetch = runFetchScript,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  let pin
  try {
    pin = readPinFn()
  } catch (error) {
    // A missing/malformed pin is a repo-integrity problem the ontology package
    // reports at startup; don't let the launcher second-guess it.
    const message = error instanceof Error ? error.message : String(error)
    stderr.write(`⚠  Skipping ontology preflight: ${message}\n`)
    return
  }

  if (cacheMatchesPinFn(pin)) return

  stdout.write(
    `• Ontology cache not found — fetching the pinned distribution ` +
      `(${pin.package} ${pin.version})…\n`
  )
  // Delegate to the fetcher so its proxy handling and checksum/sentinel
  // verification apply; it stays advisory (exit 0) on a network hiccup.
  runFetch()

  if (cacheMatchesPinFn(pin)) {
    stdout.write(`✓ Ontology ready.\n`)
    return
  }

  stderr.write(
    [
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '⚠  ONTOLOGY NOT AVAILABLE — the API will start DEGRADED and every search',
      '   will return empty results.',
      '',
      `   The pinned distribution (${pin.package} ${pin.version}) could not be`,
      '   materialized. This is usually a network problem.',
      '',
      '   To fix, run this and read its output:',
      '       pnpm run fetch:ontology',
      '',
      '   • Behind a proxy? The fetcher honours HTTP_PROXY / HTTPS_PROXY and',
      '     NO_PROXY (same as git/pnpm) — export those in THIS shell, since',
      '     Node does not read them on its own.',
      '   • Offline? Point ONTOLOGY_ARTIFACTS_PATH at a local artifacts dir,',
      '     or declare sources in ontology-sources.json.',
      '',
      '   Starting the dev servers anyway (Ctrl+C to stop)…',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
    ].join('\n')
  )
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  preflightOntology()

  process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS ?? '', '--max-old-space-size=8192']
    .filter(Boolean)
    .join(' ')

  // `turbo run dev` starts one PERSISTENT task per package that has a `dev`
  // script. Turbo refuses to run when its concurrency limit is not strictly
  // greater than the number of persistent tasks (otherwise the graph can never
  // make progress), and the default limit is 10. The workspace now has more
  // than 10 dev servers, so pin a generous limit here. Persistent watchers are
  // mostly idle after their initial compile, so a high cap is harmless — it
  // only needs to exceed the number of packages with a `dev` task.
  const DEV_CONCURRENCY = 20

  try {
    execSync(`turbo run dev --concurrency=${DEV_CONCURRENCY}`, {
      stdio: 'inherit',
      env: process.env,
    })
  } catch {
    process.exit(1)
  }
}
