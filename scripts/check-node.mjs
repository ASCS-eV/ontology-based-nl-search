#!/usr/bin/env node
/**
 * Node-runtime preflight.
 *
 * `engines.node` in the root manifest is the contract every script, dev server
 * and test in this repo is written against. pnpm enforces it at install time
 * (`engineStrict` in pnpm-workspace.yaml), but that only covers the shell that
 * ran the install: a developer who later switches Node versions (nvm, fnm,
 * asdf, a different terminal) gets no signal at all until something fails
 * deep inside a dev server for a reason that names neither Node nor a version.
 *
 * So `pnpm run check:setup` asks the question directly and answers it with the
 * version numbers and the command that fixes it.
 *
 * Usage:
 *   node scripts/check-node.mjs            # advisory: warns, exit 0
 *   node scripts/check-node.mjs --strict   # gate: exits 1 on mismatch
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** The `engines.node` range the root manifest declares, or undefined. */
export function readEngineRange(root = ROOT) {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  return manifest.engines?.node
}

/**
 * Parse the minimum version out of a range.
 *
 * Deliberately understands only the single form this repo uses (`>=x.y.z`).
 * Anything else returns null and the check reports "skipped" rather than
 * guessing: a preflight that silently mis-parses a range it doesn't understand
 * is worse than no preflight, because it fails builds on correct machines.
 */
export function parseMinimumVersion(range) {
  const match = /^\s*>=\s*v?(\d+)\.(\d+)\.(\d+)\s*$/.exec(range ?? '')
  if (!match) return null
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
}

/** Parse `v22.19.0` / `22.19.0` into comparable parts, or null. */
export function parseVersion(version) {
  const match = /^\s*v?(\d+)\.(\d+)\.(\d+)/.exec(version ?? '')
  if (!match) return null
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
}

/** -1 / 0 / 1, comparing major, then minor, then patch. */
export function compareVersions(a, b) {
  for (const part of ['major', 'minor', 'patch']) {
    if (a[part] !== b[part]) return a[part] < b[part] ? -1 : 1
  }
  return 0
}

/**
 * Decide whether `version` satisfies `range`, and produce the message the CLI
 * prints. Pure so the wording is testable without spawning another Node.
 */
export function checkNodeVersion({ version, range }) {
  const minimum = parseMinimumVersion(range)
  const running = parseVersion(version)
  if (!minimum || !running) {
    return {
      ok: true,
      skipped: true,
      message:
        `• Skipping Node version check: cannot compare running ${version} ` +
        `against engines.node "${range}".`,
    }
  }
  if (compareVersions(running, minimum) >= 0) {
    return {
      ok: true,
      skipped: false,
      message: `✓ Node ${version} satisfies engines.node ${range}`,
    }
  }
  return {
    ok: false,
    skipped: false,
    message:
      `✗ Node ${version} is too old — this repo requires engines.node ${range}.\n` +
      `  The repo pins the supported major in .nvmrc, so:\n` +
      `      nvm use        (or: fnm use / asdf install)\n` +
      `  installs and selects it. Then re-run the command.\n` +
      `  pnpm enforces the same range at install time, so an install that\n` +
      `  succeeded on a different Node does not mean this one will work.`,
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const strict = process.argv.includes('--strict')
  const result = checkNodeVersion({ version: process.version, range: readEngineRange() })

  if (result.ok) {
    if (strict || result.skipped) process.stdout.write(`${result.message}\n`)
    process.exit(0)
  }

  process.stderr.write(`${result.message}\n`)
  process.exit(strict ? 1 : 0)
}
