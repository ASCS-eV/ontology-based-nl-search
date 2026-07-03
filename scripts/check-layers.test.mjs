/**
 * Regression tests for the layer-boundary gate (`check-layers.mjs`).
 *
 * Proves the gate CATCHES violations, not merely that it runs: the real
 * workspace graph must pass, while a declared upward edge, a cycle, and an
 * unranked package must each fail. Zero-dependency (node:test) — like the other
 * `scripts/*.test.mjs`, run via `node --test`.
 */
import assert from 'node:assert/strict'
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
