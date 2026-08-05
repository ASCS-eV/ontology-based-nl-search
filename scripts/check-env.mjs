#!/usr/bin/env node
/**
 * Environment-file preflight.
 *
 * Two first-run failures used to surface as something unrelated to the
 * environment file that caused them:
 *
 *   1. **No `.env.local`.** The API dev server loads it with Node's
 *      `--env-file`, so a fresh clone died with `node: ../../.env.local: not
 *      found` — a message that names neither the repo's setup step nor the
 *      file's purpose — while the web and docs servers kept running, making it
 *      read as "the API won't connect".
 *   2. **A misspelled key.** `process.env` has no schema, so `AI_PROVDER=ollama`
 *      is not an error anywhere: the value is silently ignored, the default
 *      provider takes over, and the operator debugs the provider they never
 *      configured.
 *
 * `.env.example` is the reference for what may appear in `.env.local` — it
 * documents every key, including the ones consumed outside the Zod config
 * (the dev-server ports, the design-system selection). A drift test in
 * packages/core keeps it in sync with the schema.
 *
 * Values are NEVER read, printed, or logged — only key names. This file
 * routinely holds API keys.
 *
 * Usage:
 *   node scripts/check-env.mjs            # advisory: reports, exit 0
 *   node scripts/check-env.mjs --strict   # gate: exits 1 on a real problem
 */
import { chmodSync, copyFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export const ENV_LOCAL = '.env.local'
export const ENV_EXAMPLE = '.env.example'

/**
 * Keys that are legitimately absent from `.env.example` but valid in a
 * `.env.local`: the lowercase proxy spellings undici honours, and the
 * runtime-selected mode. Everything else must be documented.
 */
const UNDOCUMENTED_BUT_VALID = new Set(['http_proxy', 'https_proxy', 'no_proxy', 'NODE_ENV'])

/**
 * Assignment keys in a dotenv-style file.
 *
 * `commented` also collects `# KEY=…` lines, which is how `.env.example`
 * documents every optional knob — so the documented-key set is the union of
 * both forms, while a `.env.local` only ever contributes its live lines.
 */
export function parseEnvKeys(content, { commented = false } = {}) {
  const pattern = commented
    ? /^\s*#?\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/
    : /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/
  const keys = []
  for (const line of content.split(/\r?\n/)) {
    const match = pattern.exec(line)
    if (match?.[1]) keys.push(match[1])
  }
  return [...new Set(keys)]
}

/** Levenshtein distance — small inputs (env key names), so the plain DP is fine. */
export function editDistance(a, b) {
  const rows = a.length + 1
  const cols = b.length + 1
  let previous = Array.from({ length: cols }, (_, j) => j)
  for (let i = 1; i < rows; i++) {
    const current = [i]
    for (let j = 1; j < cols; j++) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution)
    }
    previous = current
  }
  return previous[cols - 1]
}

/**
 * Length at which a two-character difference is more likely a slip than a
 * different name. Below it the budget is one character.
 */
const TWO_EDIT_MIN_LENGTH = 14

/**
 * The documented key an unknown key most likely meant, or null.
 *
 * The budget is deliberately tight, because this decides whether
 * `check:setup` FAILS. Real typos are overwhelmingly one edit —
 * `AI_PROVDER`, `OLAMA_BASE_URL`, a case slip (the comparison is
 * case-insensitive). Allowing two edits on short names turns genuinely
 * different keys into false accusations: `API_HOST` is two edits from
 * `API_PORT` and means something else entirely. A key with no near match is
 * NOT treated as a typo — it may belong to another tool that reads the same
 * file — so it is reported without failing the gate.
 */
export function suggestKey(unknown, documented) {
  const budget = unknown.length >= TWO_EDIT_MIN_LENGTH ? 2 : 1
  let best = null
  for (const candidate of documented) {
    const distance = editDistance(unknown.toUpperCase(), candidate.toUpperCase())
    if (distance <= budget && (best === null || distance < best.distance)) {
      best = { key: candidate, distance }
    }
  }
  return best?.key ?? null
}

/**
 * Compare a `.env.local` against the documented keys.
 *
 * Two different severities, because they are two different situations:
 *
 *   - `missing` — there is no `.env.local`. The app still runs, on the
 *     defaults documented in `.env.example`, and `pnpm dev` creates the file.
 *     It is worth reporting loudly (the provider you get is probably not the
 *     one you want) but it is NOT a broken machine: CI and container images
 *     legitimately configure everything through the real environment.
 *   - `typos` — a key that is one slip from a documented one. That value IS
 *     silently ignored while the operator believes it applied, so it fails
 *     the gate.
 *
 * Unrecognized keys with no near match are surfaced in `notes` only: they may
 * belong to another tool reading the same file.
 */
export function checkEnv({ localContent, exampleContent }) {
  const problems = []
  const notes = []

  if (localContent === null) {
    return {
      ok: false,
      missing: true,
      problems: [
        `${ENV_LOCAL} is missing, so the app runs entirely on built-in defaults —`,
        `  including which LLM provider it talks to. Create it with:`,
        `      cp ${ENV_EXAMPLE} ${ENV_LOCAL}`,
        `  then review AI_PROVIDER in it — the default (ollama) expects a local Ollama.`,
      ],
      notes,
      typos: [],
    }
  }

  const documented = parseEnvKeys(exampleContent, { commented: true })
  const present = parseEnvKeys(localContent)
  const typos = []

  for (const key of present) {
    if (documented.includes(key) || UNDOCUMENTED_BUT_VALID.has(key)) continue
    const suggestion = suggestKey(key, documented)
    if (suggestion) {
      typos.push({ key, suggestion })
      problems.push(`${key} is not a known setting — did you mean ${suggestion}?`)
    } else {
      notes.push(`${key} is not documented in ${ENV_EXAMPLE} (ignored by this app).`)
    }
  }

  return { ok: problems.length === 0, missing: false, problems, notes, typos }
}

/** Read a repo-root file, or null when it does not exist. */
export function readRootFile(name, root = ROOT) {
  const path = join(root, name)
  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

/**
 * Load `.env.local` into the current process so its settings reach code that
 * does NOT read the file itself — `clean-ports.mjs`, and the Vite/VitePress
 * dev servers, which take their ports from `process.env`. Before this,
 * `WEB_PORT` and `DOCS_PORT` in `.env.local` were silently ignored even though
 * `.env.example` documents them.
 *
 * Node's loader leaves already-set variables alone, so an inline
 * `API_PORT=4000 pnpm dev` still wins over the file.
 *
 * Returns whether a file was loaded.
 */
export function loadEnvFileIntoProcess(root = ROOT, env = process) {
  const path = join(root, ENV_LOCAL)
  if (!existsSync(path)) return false
  env.loadEnvFile(path)
  return true
}

/**
 * Create `.env.local` from `.env.example`. Returns false when the example is
 * missing (a broken checkout) so callers can report that instead.
 *
 * Created owner-only: this is the file API keys get pasted into, and the
 * example's world-readable mode would carry straight over. Same rule the
 * runtime already applies to the credential files it reads
 * (`assertCredentialsPermissions`). `chmod` is a no-op on Windows, where the
 * ACLs are the real gate.
 */
export function copyExampleToLocal(root = ROOT) {
  const example = join(root, ENV_EXAMPLE)
  if (!existsSync(example)) return false
  const target = join(root, ENV_LOCAL)
  copyFileSync(example, target)
  chmodSync(target, 0o600)
  return true
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const strict = process.argv.includes('--strict')
  const exampleContent = readRootFile(ENV_EXAMPLE)

  if (exampleContent === null) {
    process.stderr.write(`⚠  ${ENV_EXAMPLE} is missing — cannot check ${ENV_LOCAL}.\n`)
    process.exit(strict ? 1 : 0)
  }

  const result = checkEnv({ localContent: readRootFile(ENV_LOCAL), exampleContent })

  for (const note of result.notes) process.stdout.write(`•  ${note}\n`)

  if (result.ok) {
    if (strict) process.stdout.write(`✓ ${ENV_LOCAL} present; every key is a known setting.\n`)
    process.exit(0)
  }

  process.stderr.write(`\n⚠  ${result.problems[0]}\n`)
  for (const line of result.problems.slice(1)) process.stderr.write(`   ${line}\n`)
  process.stderr.write('\n')

  // Only a silently-ignored setting fails the gate. A missing file is reported
  // just as loudly, but it leaves the app on documented defaults rather than
  // on a value the operator thinks took effect — and an environment that
  // configures everything through the real environment (CI, a container) has
  // no reason to carry the file at all.
  process.exit(strict && result.typos.length > 0 ? 1 : 0)
}
