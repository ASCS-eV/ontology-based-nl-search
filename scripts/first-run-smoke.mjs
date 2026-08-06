#!/usr/bin/env node
/**
 * First-run smoke: what a clean machine actually gets.
 *
 * The setup preflights are unit-tested individually, but the property that
 * matters is end-to-end and was never asserted anywhere: a developer who has
 * just cloned the repo, installed, and started the API — with no `.env.local`
 * and no LLM provider running — must get a server that starts, says what is
 * unavailable, and answers a search with the reason rather than a shrug.
 *
 * Every check below corresponds to a failure that reached a real developer:
 *
 *   1. The server starts at all. It used to refuse, because the built-in
 *      provider default demanded an API key that no document mentioned.
 *   2. `/health` reports ready, and names the unavailable provider. A provider
 *      failure must not read as unready — anything waiting for readiness (an
 *      orchestrator, Playwright) would wait forever.
 *   3. Routes that do not need a provider still answer.
 *   4. A search fails with the setting to change and the command to run, not
 *      with "Search failed".
 *
 * Run against the BUILT server (`dist`), the same artifact `pnpm start` runs.
 *
 * Usage:
 *   node scripts/first-run-smoke.mjs                  # skips if this checkout
 *                                                     # has a .env.local
 *   node scripts/first-run-smoke.mjs --require-clean  # CI: fail instead of skip
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/** A port unlikely to collide with anything else on the runner. */
const PORT = 3199
const BASE = `http://localhost:${PORT}`
/** Cold start builds the vocabulary and parses every shape; be generous. */
const READY_TIMEOUT_MS = 180_000

const failures = []

function check(description, condition, detail) {
  if (condition) {
    process.stdout.write(`  ✓ ${description}\n`)
    return
  }
  failures.push(`${description}${detail ? `\n      got: ${detail}` : ''}`)
  process.stdout.write(`  ✗ ${description}\n`)
}

/**
 * The contract these checks assert: whatever is wrong with the provider, the
 * message names it and carries a command. Not one specific wording — a runner
 * with no Ollama gets "not reachable", one with Ollama but no model pulled
 * gets "ollama pull", and both are correct first-run answers.
 */
const ACTIONABLE_PROVIDER_ADVICE = /ollama serve|ollama pull|OLLAMA_BASE_URL/

/** Poll `/health` until the server answers anything at all. */
async function waitForServer(deadline) {
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/health`)
      const body = await res.json()
      if (body.status !== 'starting') return { status: res.status, body }
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
  return null
}

/** Read an SSE stream to its end, returning the parsed `error` event if any. */
async function readSearchError(response) {
  const text = await response.text()
  const frames = text.split('\n\n')
  for (const frame of frames) {
    if (!frame.startsWith('event: error')) continue
    const dataLine = frame.split('\n').find((line) => line.startsWith('data: '))
    if (dataLine) return JSON.parse(dataLine.slice('data: '.length))
  }
  return null
}

const entry = join(ROOT, 'apps', 'api', 'dist', 'index.js')
if (!existsSync(entry)) {
  process.stderr.write(`✗ ${entry} is missing — run \`pnpm run build\` first.\n`)
  process.exit(1)
}

process.stdout.write('First-run smoke: clean machine, no .env.local, no provider\n')

// The whole point is the zero-configuration path, so a checkout that HAS been
// configured cannot answer the question. Skip there rather than assert
// something weaker; CI passes --require-clean so a runner that somehow carries
// the file fails loudly instead of silently skipping.
if (existsSync(join(ROOT, '.env.local'))) {
  const requireClean = process.argv.includes('--require-clean')
  process.stdout.write(
    `  • this checkout has a .env.local, so the zero-config path cannot be observed here` +
      `${requireClean ? ' (and --require-clean was passed)' : ' — skipping'}\n`
  )
  process.exit(requireClean ? 1 : 0)
}

const server = spawn(process.execPath, ['--max-old-space-size=8192', entry], {
  cwd: ROOT,
  // Deliberately no provider configuration: this is the zero-config path.
  env: { ...process.env, API_PORT: String(PORT), NODE_ENV: 'development' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverOutput = ''
server.stdout.on('data', (chunk) => (serverOutput += chunk))
server.stderr.on('data', (chunk) => (serverOutput += chunk))
server.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    failures.push(`the server exited during startup with code ${code}`)
  }
})

try {
  const health = await waitForServer(Date.now() + READY_TIMEOUT_MS)
  check('the server starts with no configuration at all', health !== null)

  if (health) {
    check('/health reports ready', health.status === 200, JSON.stringify(health.body))
    const warnings = health.body.warnings ?? []
    check(
      '/health names the unavailable provider instead of hiding it',
      warnings.some((w) => ACTIONABLE_PROVIDER_ADVICE.test(w)),
      JSON.stringify(warnings)
    )

    const stats = await fetch(`${BASE}/stats`).then((r) => r.json())
    check(
      'routes that need no provider still answer',
      typeof stats.totalAssets === 'number' && stats.totalAssets > 0,
      JSON.stringify(stats).slice(0, 120)
    )

    const search = await fetch(`${BASE}/search/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'German highways' }),
    })
    const error = await readSearchError(search)
    check('a search reports an error rather than empty results', error !== null)
    check(
      'the search error names the command that fixes it',
      ACTIONABLE_PROVIDER_ADVICE.test(error?.message ?? ''),
      error?.message
    )
    check(
      'the search error carries a machine-readable code',
      error?.code === 'SERVICE_UNAVAILABLE',
      error?.code
    )
  }
} finally {
  server.kill('SIGTERM')
}

if (failures.length > 0) {
  process.stderr.write(`\n✗ First-run smoke failed:\n`)
  for (const failure of failures) process.stderr.write(`  - ${failure}\n`)
  process.stderr.write(`\n--- server output ---\n${serverOutput.slice(-4000)}\n`)
  process.exit(1)
}

process.stdout.write('\n✓ A clean machine starts, explains itself, and stays usable.\n')
process.exit(0)
