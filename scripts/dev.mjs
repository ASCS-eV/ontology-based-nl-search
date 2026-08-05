#!/usr/bin/env node
/**
 * Dev launcher — sets NODE_OPTIONS for the API server's heap requirement
 * (Oxigraph WASM + SHACL validator + Copilot SDK subprocess ≈ 4–5 GB)
 * then delegates to turbo.
 */
import { execSync, spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  checkEnv,
  copyExampleToLocal,
  ENV_EXAMPLE,
  ENV_LOCAL,
  loadEnvFileIntoProcess,
  readRootFile,
} from './check-env.mjs'
import { cacheMatchesPin, readPin } from './fetch-ontology.mjs'

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))

/**
 * Environment-file preflight for `pnpm dev`.
 *
 * The API dev server loads `.env.local` with Node's `--env-file-if-exists`, so
 * a missing file no longer kills it — but it does leave every setting at its
 * built-in default, which is not what a developer who never created the file
 * expects. Rather than let that surface later as a provider that was never
 * configured, create the file from the example (the documented setup step) and
 * say so, mirroring how the ontology preflight below materializes the cache.
 *
 * Misspelled keys get the same treatment as a failed ontology fetch: an
 * unmissable banner, never an abort — the servers still start.
 */
export function preflightEnvFile({
  readLocal = () => readRootFile(ENV_LOCAL),
  readExample = () => readRootFile(ENV_EXAMPLE),
  copyExample = copyExampleToLocal,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  const exampleContent = readExample()
  if (exampleContent === null) {
    stderr.write(`⚠  ${ENV_EXAMPLE} is missing — skipping the environment preflight.\n`)
    return
  }

  if (readLocal() === null) {
    if (!copyExample()) {
      stderr.write(`⚠  Could not create ${ENV_LOCAL} from ${ENV_EXAMPLE}.\n`)
      return
    }
    stdout.write(
      `• Created ${ENV_LOCAL} from ${ENV_EXAMPLE} (first run).\n` +
        `  Review AI_PROVIDER in it — the default (ollama) expects a local Ollama\n` +
        `  at OLLAMA_BASE_URL with the model in AI_MODEL already pulled.\n`
    )
    return
  }

  const result = checkEnv({ localContent: readLocal(), exampleContent })
  if (result.ok) return

  stderr.write(
    [
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `⚠  ${ENV_LOCAL} has ${result.problems.length} unrecognized setting(s). They are`,
      '   IGNORED at runtime, so the app silently uses the defaults instead:',
      '',
      ...result.problems.map((p) => `     • ${p}`),
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
    ].join('\n')
  )
}

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
  // Environment first: the ontology preflight and the dev servers both read
  // settings that may only exist in `.env.local`.
  preflightEnvFile()
  loadEnvFileIntoProcess()
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
