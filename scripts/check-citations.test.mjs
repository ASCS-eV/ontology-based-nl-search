/**
 * Regression tests for the citation gate (`check-citations.mjs`).
 *
 * Proves the gate CATCHES each kind of wrong citation, not merely that it
 * runs: the real repository must pass, while an unregistered tag, a section
 * the text does not have, a term cited at the wrong section and a link whose
 * anchor sits in another section must each fail. The last group replays
 * citations this repository actually carried against the real vendored texts.
 * Zero-dependency (node:test), like the other `scripts/*.test.mjs`, run via
 * `node --test`.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { analyzeCitations, checkRepository, readRegistry, readSpec } from './check-citations.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REFERENCES = join(ROOT, 'docs/specs/references')

const SPEC = `<!--
  Source:    https://example.org/TR/shapes/
-->

## Table of Contents

1.  [1\\. Introduction](#intro)
2.  [4\\. Core](#core)
    1.  [4.1.2 ex:datatype](#DatatypeComponent)
    2.  [4.8.3 ex:in](#InComponent)

## 1\\. Introduction

## 4\\. Core

#### 4.1.2 ex:datatype

#### 4.8.3 ex:in
`

const REGISTRY = `
| Tag | File | Specification |
| --- | --- | --- |
| \`[SHAPES]\` | \`shapes.md\` | Shapes |
| \`[PROSE]\` | \`prose.md\` | A text without section numbers |

| Tag | Standard | Normative source in-repo |
| --- | --- | --- |
| \`[PINNED]\` | An artifact | not vendored |
`

const registry = readRegistry(REGISTRY)
const specs = new Map([
  ['shapes.md', readSpec(SPEC)],
  ['prose.md', readSpec('## Introduction\n\n## Keywords\n')],
])
const check = (line) => analyzeCitations([{ path: 'a.ts', text: line }], registry, specs)

test('the registry lists every tagged row, with its text where one is stored', () => {
  assert.deepEqual(
    [...registry],
    [
      ['SHAPES', 'shapes.md'],
      ['PROSE', 'prose.md'],
      ['PINNED', null],
    ]
  )
})

test('a vendored text yields its sections, the terms its headings define, and its anchors', () => {
  const spec = specs.get('shapes.md')
  assert.equal(spec.source, 'https://example.org/TR/shapes/')
  assert.deepEqual([...spec.sections].sort(), ['1', '4', '4.1.2', '4.8.3'])
  assert.equal(spec.definedIn.get('ex:in'), '4.8.3')
  assert.equal(spec.anchors.get('InComponent'), '4.8.3')
})

test('correct citations pass, in either citation style and with enclosing sections', () => {
  assert.deepEqual(check('the `ex:in` list ([SHAPES] §4.8.3)'), [])
  assert.deepEqual(check('a list [SHAPES §4.8.3] ex:in'), [])
  assert.deepEqual(check('the list `ex:in` ([SHAPES] §4)'), [])
  assert.deepEqual(check('https://example.org/TR/shapes/#InComponent — [SHAPES] §4.8.3'), [])
})

test('an unregistered tag fails', () => {
  assert.match(check('as [OTHER] §2 says')[0] ?? '', /\[OTHER\] is not registered/)
})

test('a section the text does not have fails, including one listed after the first', () => {
  assert.match(check('[SHAPES] §4.2.3')[0] ?? '', /§4\.2\.3 does not exist/)
  assert.match(check('[SHAPES] §4.8.3, §9')[0] ?? '', /§9 does not exist/)
})

test('a term cited at a section that does not define it fails, before or after the citation', () => {
  assert.match(
    check('numeric `ex:datatype` ([SHAPES] §4.8.3)')[0] ?? '',
    /ex:datatype is defined in \[SHAPES\] §4\.1\.2, cited as §4\.8\.3/
  )
  assert.match(check('[SHAPES] §4.1.2 ex:in')[0] ?? '', /ex:in is defined in \[SHAPES\] §4\.8\.3/)
})

test('a link into the text whose anchor sits in another section fails; other documents are not read', () => {
  assert.match(
    check('https://example.org/TR/shapes/#DatatypeComponent — [SHAPES] §4.8.3')[0] ?? '',
    /#DatatypeComponent is \[SHAPES\] §4\.1\.2, cited as §4\.8\.3/
  )
  assert.deepEqual(check('https://example.org/TR/other/#DatatypeComponent — [SHAPES] §4.8.3'), [])
})

test('a text without section numbers, or a tag with no text, cannot be checked and passes', () => {
  assert.deepEqual(check('[PROSE] §6.5 object keywords'), [])
  assert.deepEqual(check('[PINNED] §4'), [])
})

/**
 * Citations this repository carried before the gate existed, replayed against
 * the real vendored texts. Each was wrong in a way a reader following it
 * would have noticed only by opening the spec.
 */
test('the formerly wrong citations are each caught against the real texts', () => {
  const realRegistry = readRegistry(readFileSync(join(REFERENCES, 'README.md'), 'utf8'))
  const realSpecs = new Map()
  for (const file of new Set(realRegistry.values())) {
    if (file) realSpecs.set(file, readSpec(readFileSync(join(REFERENCES, file), 'utf8')))
  }
  const formerly = [
    ['the declared one [SHACL] §4.2.3', /does not exist/],
    ['numeric `sh:datatype` ([SHACL] §4.1.1)', /sh:datatype is defined in \[SHACL\] §4\.1\.2/],
    ['`sh:targetClass` [SHACL §2.1.3.3]', /sh:targetClass is defined in \[SHACL\] §2\.1\.3\.2/],
    [
      'https://www.w3.org/TR/shacl/#InConstraintComponent — [SHACL] §4.6.1 sh:in',
      /sh:in is defined in \[SHACL\] §4\.8\.3/,
    ],
    ['Compact IRI ([JSON-LD11] §3.7)', /does not exist/],
    ['https://www.w3.org/TR/rdf-schema/ — [RDF-SCHEMA] §5.4.1 rdfs:label', /not registered/],
    [
      'https://www.w3.org/TR/rdf-schema/ — [RDFS] §5.4.1 rdfs:label',
      /rdfs:label is defined in \[RDFS\] §3\.6/,
    ],
    [
      'https://spec.graphql.org/draft/#sec-Language.Fragments — [GraphQL] §2.8',
      /#sec-Language\.Fragments is \[GraphQL\] §2\.9/,
    ],
  ]
  for (const [line, expected] of formerly) {
    const violations = analyzeCitations([{ path: 'a.ts', text: line }], realRegistry, realSpecs)
    assert.match(violations.join('\n'), expected, line)
  }
})

test('every numbered citation in the repository resolves', () => {
  const { registry: real, specs: parsed, violations } = checkRepository()
  // Guard against a vacuous pass: a registry or spec parse that silently read
  // nothing would leave nothing to violate.
  assert.ok(real.size >= 20, `expected >=20 registered tags, got ${real.size}`)
  assert.ok(
    (parsed.get('shacl.md')?.sections.size ?? 0) > 100,
    'expected the SHACL text to number its sections'
  )
  assert.deepEqual(violations, [])
})
