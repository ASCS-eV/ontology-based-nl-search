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

import { preflightEnvFile, preflightOntology } from './dev.mjs'

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

test('env preflight creates .env.local from the example on a first run', () => {
  const out = sink()
  const err = sink()
  let copied = false
  preflightEnvFile({
    readLocal: () => (copied ? 'AI_PROVIDER=ollama\n' : null),
    readExample: () => 'AI_PROVIDER=ollama\n',
    copyExample: () => {
      copied = true
      return true
    },
    stdout: out,
    stderr: err,
  })
  assert.equal(copied, true)
  assert.match(out.text, /Created \.env\.local from \.env\.example/)
  assert.match(out.text, /Review AI_PROVIDER/)
  assert.equal(err.text, '')
})

test('env preflight banners a misspelled key instead of letting it be ignored', () => {
  const out = sink()
  const err = sink()
  preflightEnvFile({
    readLocal: () => 'AI_PROVDER=ollama\n',
    readExample: () => 'AI_PROVIDER=ollama\n',
    copyExample: () => assert.fail('must not overwrite an existing .env.local'),
    stdout: out,
    stderr: err,
  })
  assert.match(err.text, /unrecognized setting/)
  assert.match(err.text, /did you mean AI_PROVIDER/)
  assert.match(err.text, /IGNORED at runtime/)
})

test('env preflight is silent when .env.local is present and clean', () => {
  const out = sink()
  const err = sink()
  preflightEnvFile({
    readLocal: () => 'AI_PROVIDER=ollama\n',
    readExample: () => 'AI_PROVIDER=ollama\n# API_PORT=3003\n',
    copyExample: () => assert.fail('must not overwrite an existing .env.local'),
    stdout: out,
    stderr: err,
  })
  assert.equal(out.text, '')
  assert.equal(err.text, '')
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
