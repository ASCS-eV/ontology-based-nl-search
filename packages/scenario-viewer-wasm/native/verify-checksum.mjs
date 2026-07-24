#!/usr/bin/env node
/**
 * Verify the committed `wasm/esmini.js` matches its integrity manifest
 * `wasm/esmini.js.sha256` (written by native/build.mjs). This artifact is a
 * SINGLE_FILE Emscripten build — the `.wasm` is inlined as base64 — so the whole
 * multi-megabyte glue file is the one thing in this package a reviewer cannot
 * read in a diff. This gate catches a corrupted or tampered blob; run it in CI
 * on every PR.
 *
 * Exit 0 when the digest matches; exit 1 (with a clear message) otherwise.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG = dirname(dirname(fileURLToPath(import.meta.url)))
const ARTIFACT = join(PKG, 'wasm', 'esmini.js')
const MANIFEST = join(PKG, 'wasm', 'esmini.js.sha256')

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

if (!existsSync(ARTIFACT)) fail(`missing artifact: ${ARTIFACT}`)
if (!existsSync(MANIFEST)) fail(`missing manifest: ${MANIFEST} (run build:wasm)`)

const [expected] = readFileSync(MANIFEST, 'utf8').trim().split(/\s+/)
const actual = createHash('sha256').update(readFileSync(ARTIFACT)).digest('hex')

if (actual !== expected) {
  fail(
    `esmini.js checksum mismatch\n  expected ${expected}\n  actual   ${actual}\n` +
      `The committed WASM does not match its manifest — rebuild with ` +
      `\`pnpm --filter @ontology-search/scenario-viewer-wasm build:wasm\` (which regenerates both).`
  )
}

console.log(`✓ esmini.js integrity verified (sha256 ${actual.slice(0, 12)}…)`)
