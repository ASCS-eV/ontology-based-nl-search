/**
 * Regression tests for the dev launcher's ontology preflight (`dev.mjs`).
 *
 * Without a materialized ontology the API boots DEGRADED and every search
 * silently returns nothing. The preflight turns that mystery into a fetched
 * ontology or an unmissable, actionable banner. These assert the three
 * outcomes — already present, auto-fetched, and unrecoverable — through the
 * dependency seams, with no network and no real cache touched.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { preflightOntology } from './dev.mjs'

const PIN = { package: 'demo-ontology', version: '1.2.3' }

/** A writable sink that records everything written to it. */
function sink() {
  const chunks = []
  return {
    write: (s) => chunks.push(s),
    get text() {
      return chunks.join('')
    },
  }
}

test('preflight is silent and does not fetch when the cache already matches', () => {
  const out = sink()
  const err = sink()
  let fetched = false
  preflightOntology({
    readPin: () => PIN,
    cacheMatchesPin: () => true,
    runFetch: () => {
      fetched = true
    },
    stdout: out,
    stderr: err,
  })
  assert.equal(fetched, false)
  assert.equal(out.text, '')
  assert.equal(err.text, '')
})

test('preflight auto-fetches and confirms readiness when the fetch succeeds', () => {
  const out = sink()
  const err = sink()
  const seen = []
  // Missing before the fetch, present after it.
  const cacheStates = [false, true]
  preflightOntology({
    readPin: () => PIN,
    cacheMatchesPin: () => cacheStates.shift(),
    runFetch: () => seen.push('fetched'),
    stdout: out,
    stderr: err,
  })
  assert.deepEqual(seen, ['fetched'])
  assert.match(out.text, /fetching the pinned distribution \(demo-ontology 1\.2\.3\)/)
  assert.match(out.text, /Ontology ready/)
  assert.equal(err.text, '')
})

test('preflight prints an actionable banner when the fetch cannot recover', () => {
  const out = sink()
  const err = sink()
  preflightOntology({
    readPin: () => PIN,
    cacheMatchesPin: () => false, // never becomes available
    runFetch: () => {},
    stdout: out,
    stderr: err,
  })
  assert.match(err.text, /ONTOLOGY NOT AVAILABLE/)
  assert.match(err.text, /DEGRADED/)
  assert.match(err.text, /pnpm run fetch:ontology/)
  assert.match(err.text, /HTTP_PROXY \/ HTTPS_PROXY/)
})

test('preflight skips (does not throw) when the pin cannot be read', () => {
  const out = sink()
  const err = sink()
  let fetched = false
  preflightOntology({
    readPin: () => {
      throw new Error('pin not found')
    },
    cacheMatchesPin: () => false,
    runFetch: () => {
      fetched = true
    },
    stdout: out,
    stderr: err,
  })
  assert.equal(fetched, false)
  assert.match(err.text, /Skipping ontology preflight: pin not found/)
})
