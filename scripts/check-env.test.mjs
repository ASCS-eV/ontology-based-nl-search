/**
 * Regression tests for the environment-file preflight (`check-env.mjs`).
 *
 * Covers the two first-run failures it exists to prevent: a missing
 * `.env.local` (which used to surface as `node: ../../.env.local: not found`)
 * and a misspelled key (which used to surface as nothing at all).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mkdtempSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { checkEnv, copyExampleToLocal, parseEnvKeys, suggestKey } from './check-env.mjs'

const EXAMPLE = [
  '# --- LLM Provider ---',
  'AI_PROVIDER=ollama',
  'AI_MODEL=qwen3:8b',
  '# OPENAI_API_KEY=sk-...',
  '# API_PORT=3003',
  '# WEB_PORT=5174',
].join('\n')

test('reads live keys only from a .env.local, both forms from the example', () => {
  assert.deepEqual(parseEnvKeys('A=1\n# B=2\nC=3\n'), ['A', 'C'])
  assert.deepEqual(parseEnvKeys('A=1\n# B=2\nC=3\n', { commented: true }), ['A', 'B', 'C'])
})

test('a missing .env.local reports the exact command that fixes it', () => {
  const result = checkEnv({ localContent: null, exampleContent: EXAMPLE })
  assert.equal(result.ok, false)
  assert.match(result.problems.join('\n'), /\.env\.local is missing/)
  assert.match(result.problems.join('\n'), /built-in defaults/)
  assert.match(result.problems.join('\n'), /cp \.env\.example \.env\.local/)
})

test('a missing .env.local is flagged as missing, not as a silently-ignored setting', () => {
  // The two are reported differently because only one is broken: without the
  // file the app runs on documented defaults, and CI or a container image
  // legitimately configures everything through the real environment. The CLI
  // fails its strict gate on `typos` alone.
  const result = checkEnv({ localContent: null, exampleContent: EXAMPLE })
  assert.equal(result.missing, true)
  assert.deepEqual(result.typos, [])
})

test('a fully documented .env.local passes clean', () => {
  const result = checkEnv({
    localContent: 'AI_PROVIDER=claude-cli\nAI_MODEL=claude-haiku-4-5\nWEB_PORT=5174\n',
    exampleContent: EXAMPLE,
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.problems, [])
  assert.deepEqual(result.notes, [])
})

test('a misspelled key fails the gate and names the key it meant', () => {
  const result = checkEnv({ localContent: 'AI_PROVDER=ollama\n', exampleContent: EXAMPLE })
  assert.equal(result.ok, false)
  assert.equal(result.missing, false)
  assert.deepEqual(result.typos, [{ key: 'AI_PROVDER', suggestion: 'AI_PROVIDER' }])
  assert.match(result.problems.join('\n'), /did you mean AI_PROVIDER/)
})

test('an unrelated key is reported but does not fail the gate', () => {
  // Another tool may read the same file; only near-misses are treated as typos.
  const result = checkEnv({ localContent: 'MY_OWN_TOOL_FLAG=1\n', exampleContent: EXAMPLE })
  assert.equal(result.ok, true)
  assert.match(result.notes.join('\n'), /MY_OWN_TOOL_FLAG is not documented/)
})

test('runtime-provided and lowercase-proxy keys are accepted undocumented', () => {
  const result = checkEnv({
    localContent: 'NODE_ENV=development\nhttps_proxy=http://proxy:8080\n',
    exampleContent: EXAMPLE,
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.notes, [])
})

test('suggests only near-misses, so the gate cannot fail on a different key', () => {
  // One edit, any length: the common typo.
  assert.equal(suggestKey('AI_PROVDER', ['AI_PROVIDER']), 'AI_PROVIDER')
  assert.equal(suggestKey('OLLAMA_BASE_UR', ['OLLAMA_BASE_URL']), 'OLLAMA_BASE_URL')
  // Case slips are the same key.
  assert.equal(suggestKey('ai_provider', ['AI_PROVIDER']), 'AI_PROVIDER')
  // Two edits on a SHORT name is a different setting, not a slip —
  // API_HOST must never be "corrected" to API_PORT and fail the gate.
  assert.equal(suggestKey('API_HOST', ['API_PORT', 'AI_MODEL']), null)
  assert.equal(suggestKey('FOO', ['AI_MODEL', 'API_PORT']), null)
  // Two edits on a long name is still a slip.
  assert.equal(suggestKey('ANTHROPIC_APIKEYY', ['ANTHROPIC_API_KEY']), 'ANTHROPIC_API_KEY')
})

test('values are never echoed — only key names appear in the output', () => {
  const secret = 'sk-ant-super-secret-value'
  const result = checkEnv({
    localContent: `ANTHROPIC_API_KEEY=${secret}\n`,
    exampleContent: `${EXAMPLE}\n# ANTHROPIC_API_KEY=sk-ant-...`,
  })
  const printed = [...result.problems, ...result.notes].join('\n')
  assert.equal(printed.includes(secret), false)
  assert.match(printed, /did you mean ANTHROPIC_API_KEY/)
})

test(
  'the created .env.local is owner-only — it is where API keys get pasted',
  { skip: process.platform === 'win32' },
  () => {
    const root = mkdtempSync(join(tmpdir(), 'env-preflight-'))
    writeFileSync(join(root, '.env.example'), EXAMPLE)

    assert.equal(copyExampleToLocal(root), true)
    const mode = statSync(join(root, '.env.local')).mode & 0o777
    assert.equal(mode.toString(8), '600')
  }
)
