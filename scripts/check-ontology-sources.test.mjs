/**
 * Regression tests for the ontology-sources preflight (`check-ontology-sources.mjs`).
 *
 * The preflight must resolve a manifest exactly like the server does: from
 * ONTOLOGY_SOURCES_FILE when set, with relative source paths anchored at the
 * manifest's own directory rather than the repo root.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'check-ontology-sources.mjs')

function runStrict(env) {
  return spawnSync(process.execPath, [SCRIPT, '--strict'], {
    env: { ...process.env, ONTOLOGY_ARTIFACTS_PATH: '', ...env },
    encoding: 'utf8',
  })
}

test('ONTOLOGY_SOURCES_FILE is honoured and its paths resolve against the manifest', () => {
  const dir = mkdtempSync(join(tmpdir(), 'check-sources-'))
  try {
    mkdirSync(join(dir, 'artifacts', 'demo'), { recursive: true })
    writeFileSync(join(dir, 'artifacts', 'demo', 'demo.shacl.ttl'), '')
    writeFileSync(join(dir, 'sources.json'), JSON.stringify({ sources: [{ path: 'artifacts' }] }))

    const result = runStrict({ ONTOLOGY_SOURCES_FILE: join(dir, 'sources.json') })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, new RegExp(`1 in ${join(dir, 'artifacts').replace(/\\/g, '\\\\')}`))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a missing ONTOLOGY_SOURCES_FILE fails strict mode and names the file', () => {
  const missing = join(tmpdir(), 'no-such-dir', 'sources.json')
  const result = runStrict({ ONTOLOGY_SOURCES_FILE: missing })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /sources\.json \(missing\)/)
})
