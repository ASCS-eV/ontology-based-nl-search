#!/usr/bin/env node
/**
 * Verify the committed `wasm/osc-engine.wasm` matches its integrity manifest
 * `wasm/osc-engine.wasm.sha256` (written by native/build.mjs). The binary is
 * the one file in this package a reviewer cannot inspect in a diff, so this
 * gate catches a corrupted or tampered blob — run it in CI on every PR.
 *
 * Exit 0 when the digest matches; exit 1 (with a clear message) otherwise.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG = dirname(dirname(fileURLToPath(import.meta.url)))
const WASM = join(PKG, 'wasm', 'osc-engine.wasm')
const MANIFEST = join(PKG, 'wasm', 'osc-engine.wasm.sha256')

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

if (!existsSync(WASM)) fail(`missing artifact: ${WASM}`)
if (!existsSync(MANIFEST)) fail(`missing manifest: ${MANIFEST} (run build:wasm)`)

const [expected] = readFileSync(MANIFEST, 'utf8').trim().split(/\s+/)
const actual = createHash('sha256').update(readFileSync(WASM)).digest('hex')

if (actual !== expected) {
  fail(
    `osc-engine.wasm checksum mismatch\n  expected ${expected}\n  actual   ${actual}\n` +
      `The committed WASM does not match its manifest — rebuild with ` +
      `\`pnpm --filter @ontology-search/authoring-wasm build:wasm\` (which regenerates both).`
  )
}

console.log(`✓ osc-engine.wasm integrity verified (sha256 ${actual.slice(0, 12)}…)`)
