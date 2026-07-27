/**
 * Regression gate for the authoring feature's standards registration
 * (CONTRIBUTING criterion #31): every interface must cite a *registered*
 * normative standard.
 *
 * The authoring source cites ASAM tags (`[OSC-XSD]`, `[OSC-RCR]`, `[QC-XOSC]`,
 * `[QC-XODR]`, `[XML10]`) that were previously absent from both the standards
 * inventory (`apps/docs/standards-audit.md`) and the reference index
 * (`docs/specs/references/README.md`). This test asserts they are registered,
 * and that the two citation fixes (`[SPARQL]` → `[SPARQL11]`; the Turtle/RDF
 * emitter cites `[TURTLE]`/`[RDF11]`) are in place — so an unregistered
 * authoring tag or a citation regression fails CI. Zero-dependency
 * (node:test), like the other `scripts/*.test.mjs`, run via `node --test`.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/** ASAM tags cited in authoring source that must be registered. */
const ASAM_TAGS = ['[OSC-XSD]', '[OSC-RCR]', '[QC-FW]', '[QC-XOSC]', '[QC-XODR]', '[XML10]']

test('standards-audit.md registers the authoring interfaces', () => {
  const audit = read('apps/docs/standards-audit.md')
  assert.match(audit, /Authoring interfaces/i, 'expected an Authoring interfaces section')
  assert.match(audit, /Scene IR/i, 'expected the Scene IR interface listed')
  assert.match(audit, /OpenSCENARIO/, 'expected OpenSCENARIO named')
  for (const tag of ASAM_TAGS) {
    assert.ok(audit.includes(tag), `standards-audit.md must document the ${tag} tag`)
  }
})

test('references/README.md registers the ASAM tags with their in-repo source', () => {
  const readme = read('docs/specs/references/README.md')
  assert.match(readme, /ASAM standards/i, 'expected an ASAM standards section')
  assert.match(readme, /RangeCheckerRulesV1_3/, 'expected the RangeCheckerRules source cited')
  assert.match(readme, /OpenSCENARIO\.xsd/, 'expected the OpenSCENARIO XSD source cited')
  for (const tag of ASAM_TAGS) {
    assert.ok(readme.includes(tag), `references/README.md must register the ${tag} tag`)
  }
})

test('the semantic gate cites the registered [SPARQL11] tag, not bare [SPARQL]', () => {
  const src = read('packages/authoring-gate/src/semantic-gate.ts')
  assert.ok(src.includes('[SPARQL11]'), 'semantic-gate must cite [SPARQL11]')
  // The registered tag is [SPARQL11]; a bare [SPARQL] is unregistered. Strip the
  // valid occurrences first, then assert none remain.
  assert.ok(
    !src.replaceAll('[SPARQL11]', '').includes('[SPARQL]'),
    'semantic-gate must not use the unregistered bare [SPARQL] tag'
  )
})

test('the RDF/Turtle emitter cites [TURTLE] and [RDF11]', () => {
  const src = read('packages/authoring-gate/src/ir-to-rdf.ts')
  assert.ok(src.includes('[TURTLE]'), 'ir-to-rdf emits Turtle and must cite [TURTLE]')
  assert.ok(src.includes('[RDF11]'), 'ir-to-rdf must cite [RDF11] for the data model')
})
