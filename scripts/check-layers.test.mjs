/**
 * Regression tests for the layer-boundary gate (`check-layers.mjs`).
 *
 * Proves the gate CATCHES violations, not merely that it runs: the real
 * workspace graph must pass, while a declared upward edge, a cycle, and an
 * unranked package must each fail. Zero-dependency (node:test) — like the other
 * `scripts/*.test.mjs`, run via `node --test`.
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { analyzeLayers, readWorkspaceGraph, RANKS } from './check-layers.mjs'

test('the real workspace graph is acyclic and strictly downward', () => {
  const graph = readWorkspaceGraph()
  // Guard against a vacuous pass: if ROOT resolution ever broke, the graph would
  // be empty and `analyzeLayers([])` would also be `[]`. Assert it actually read
  // the workspace before trusting the "no violations" result.
  assert.ok(graph.length >= 14, `expected to read >=14 workspace packages, got ${graph.length}`)
  assert.ok(
    graph.some((p) => p.name === '@ontology-search/core') &&
      graph.some((p) => p.name === '@ontology-search/search'),
    'expected core + search in the discovered graph'
  )
  assert.deepEqual(analyzeLayers(graph), [])
})

test('flags a declared upward dependency (core -> app)', () => {
  const ranks = { '@x/core': 1, '@x/app': 5 }
  const violations = analyzeLayers(
    [
      { name: '@x/core', deps: ['@x/app'] },
      { name: '@x/app', deps: [] },
    ],
    ranks
  )
  assert.match(violations.join('\n'), /not strictly downward/)
})

test('flags a dependency cycle', () => {
  const ranks = { '@x/a': 1, '@x/b': 1 }
  const violations = analyzeLayers(
    [
      { name: '@x/a', deps: ['@x/b'] },
      { name: '@x/b', deps: ['@x/a'] },
    ],
    ranks
  )
  assert.match(violations.join('\n'), /cycle|not strictly downward/)
})

test('flags an unranked package', () => {
  const violations = analyzeLayers([{ name: '@x/new', deps: [] }], {})
  assert.match(violations.join('\n'), /unranked/)
})

test('accepts a legal downward edge (app -> core, leaf depended on by anyone)', () => {
  assert.deepEqual(
    analyzeLayers(
      [
        { name: '@x/app', deps: ['@x/core', '@x/leaf'] },
        { name: '@x/core', deps: ['@x/leaf'] },
        { name: '@x/leaf', deps: [] },
      ],
      { '@x/leaf': 0, '@x/core': 1, '@x/app': 5 }
    ),
    []
  )
})

/**
 * Rule 3 — re-export laundering. The gate reads the DECLARED package.json
 * graph, so an entry point that re-exports a lower package's API hides a real
 * edge from it: `search`'s barrel carried `export { ShaclValidator } from
 * '@ontology-search/ontology/...'`, and `llm` used the validator while
 * declaring only `search`. Rule 2 saw `llm -> search` and passed.
 */
test('flags an entry point that re-exports another workspace package', () => {
  const violations = analyzeLayers(
    [
      {
        name: '@x/mid',
        deps: ['@x/leaf'],
        reexports: [{ subpath: '.', target: '@x/leaf' }],
      },
      { name: '@x/leaf', deps: [] },
    ],
    { '@x/leaf': 0, '@x/mid': 3 }
  )
  assert.match(violations.join('\n'), /re-export laundering/)
  assert.match(violations.join('\n'), /@x\/mid.*@x\/leaf/)
})

test('does not flag a re-export of a package outside the workspace', () => {
  assert.deepEqual(
    analyzeLayers(
      [{ name: '@x/mid', deps: [], reexports: [{ subpath: '.', target: '@x/not-in-graph' }] }],
      { '@x/mid': 3 }
    ),
    []
  )
})

/**
 * The scanner itself, against a fixture on disk. Without this the "workspace
 * has no re-exports" assertion below is vacuous: a scanner that silently read
 * nothing — wrong path, changed `exports` shape — would also report zero.
 */
test('readWorkspaceGraph detects a re-export in an entry point on disk', () => {
  const root = mkdtempSync(join(tmpdir(), 'check-layers-'))
  try {
    const dir = join(root, 'packages', 'mid')
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: '@ontology-search/mid',
        dependencies: { '@ontology-search/leaf': 'workspace:*' },
        exports: { '.': { types: './src/index.ts' } },
      })
    )
    writeFileSync(
      join(dir, 'src', 'index.ts'),
      [
        "export { own } from './own.js'", // same-package: not a violation
        "export type { Leaf } from '@ontology-search/leaf'", // re-export: IS a violation
        "import { helper } from '@ontology-search/leaf'", // a plain import is not
      ].join('\n')
    )
    const graph = readWorkspaceGraph(root)
    assert.deepEqual(graph, [
      {
        name: '@ontology-search/mid',
        deps: ['@ontology-search/leaf'],
        reexports: [{ subpath: '.', target: '@ontology-search/leaf' }],
      },
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('the real workspace has no re-export laundering left', () => {
  const graph = readWorkspaceGraph()
  assert.ok(graph.length >= 14, `expected to read >=14 workspace packages, got ${graph.length}`)
  assert.deepEqual(
    graph.flatMap((p) => (p.reexports ?? []).map((r) => `${p.name} ${r.subpath} -> ${r.target}`)),
    []
  )
})

/**
 * The INDIRECT form: import a workspace symbol, then export the local binding.
 * Semantically identical to `export … from`, equally invisible to the declared
 * graph, and the shape `ontology/sources.ts` and `authoring/backend.ts` were
 * both using — neither of which the `export … from` pattern alone would catch.
 */
test('readWorkspaceGraph detects import-then-export laundering', () => {
  const root = mkdtempSync(join(tmpdir(), 'check-layers-'))
  try {
    const dir = join(root, 'packages', 'mid')
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: '@ontology-search/mid',
        exports: { '.': { types: './src/index.ts' } },
      })
    )
    writeFileSync(
      join(dir, 'src', 'index.ts'),
      [
        "import { Err } from '@ontology-search/leaf'", // bound locally...
        "import { kept } from '@ontology-search/leaf'", // ...used, never exported
        "import { local } from './local.js'",
        'export { Err }', // ...then re-exported: IS a violation
        'export { local }', // same-package binding: not a violation
        'export function ownThing() { return kept(local) }',
      ].join('\n')
    )
    assert.deepEqual(readWorkspaceGraph(root)[0].reexports, [
      { subpath: '.', target: '@ontology-search/leaf' },
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('does not treat `export { X } from` as an indirect re-export twice', () => {
  const root = mkdtempSync(join(tmpdir(), 'check-layers-'))
  try {
    const dir = join(root, 'packages', 'mid')
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: '@ontology-search/mid',
        exports: { '.': { types: './src/index.ts' } },
      })
    )
    writeFileSync(
      join(dir, 'src', 'index.ts'),
      [
        "import { X } from '@ontology-search/leaf'",
        "export { X } from '@ontology-search/leaf'",
      ].join('\n')
    )
    // Reported once by the direct rule, not a second time by the indirect one.
    assert.deepEqual(readWorkspaceGraph(root)[0].reexports, [
      { subpath: '.', target: '@ontology-search/leaf' },
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
