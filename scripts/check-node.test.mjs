/**
 * Regression tests for the Node-runtime preflight (`check-node.mjs`).
 *
 * A too-old Node used to install "successfully" (pnpm only warned) and then
 * fail later somewhere that named neither Node nor a version. These assert
 * that the preflight compares the versions correctly and that the failure
 * message carries the fix, not just the verdict.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  checkNodeVersion,
  compareVersions,
  parseMinimumVersion,
  parseVersion,
  readEngineRange,
} from './check-node.mjs'

test('parses the >= range form the manifest uses', () => {
  assert.deepEqual(parseMinimumVersion('>=22.19.0'), { major: 22, minor: 19, patch: 0 })
  assert.deepEqual(parseMinimumVersion('>= v22.19.0'), { major: 22, minor: 19, patch: 0 })
})

test('refuses to guess at range forms it does not understand', () => {
  for (const range of ['^22.19.0', '22.x', '>=22', undefined, '']) {
    assert.equal(parseMinimumVersion(range), null)
  }
})

test('compares versions part by part, not lexically', () => {
  const v = parseVersion
  // 22.9 < 22.19 lexically compares the other way — the classic off-by-a-digit.
  assert.equal(compareVersions(v('v22.9.0'), v('22.19.0')), -1)
  assert.equal(compareVersions(v('v22.19.0'), v('22.19.0')), 0)
  assert.equal(compareVersions(v('v23.0.0'), v('22.19.0')), 1)
})

test('accepts a Node that satisfies the range', () => {
  const result = checkNodeVersion({ version: 'v22.20.0', range: '>=22.19.0' })
  assert.equal(result.ok, true)
  assert.equal(result.skipped, false)
  assert.match(result.message, /satisfies engines\.node/)
})

test('rejects a too-old Node with both versions and the fix', () => {
  const result = checkNodeVersion({ version: 'v20.11.0', range: '>=22.19.0' })
  assert.equal(result.ok, false)
  assert.match(result.message, /v20\.11\.0/)
  assert.match(result.message, />=22\.19\.0/)
  assert.match(result.message, /\.nvmrc/)
  assert.match(result.message, /nvm use/)
})

test('skips (never fails) when the range cannot be compared', () => {
  const result = checkNodeVersion({ version: 'v22.20.0', range: '^22.19.0' })
  assert.equal(result.ok, true)
  assert.equal(result.skipped, true)
  assert.match(result.message, /Skipping Node version check/)
})

test('the repo manifest declares a range this check understands', () => {
  // Guards the check itself against silently degrading to "skipped" if the
  // manifest range is ever rewritten in a form the parser does not support.
  assert.notEqual(parseMinimumVersion(readEngineRange()), null)
})
