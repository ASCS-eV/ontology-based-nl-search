/**
 * Regression tests for the ontology-sources preflight (`check-ontology-sources.mjs`).
 *
 * The preflight must resolve a manifest exactly like the server does: from
 * ONTOLOGY_SOURCES_FILE when set, with relative source paths anchored at the
 * manifest's own directory rather than the repo root.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPTS = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(SCRIPTS, 'check-ontology-sources.mjs')

// Empty, not absent: an already-set variable is never overridden from the
// checkout's own .env.local, so the developer's settings cannot leak in.
const ISOLATED = { ONTOLOGY_ROOT: '', ONTOLOGY_ARTIFACTS_PATH: '', ONTOLOGY_SOURCES_FILE: '' }

function runStrict(env, cwd = undefined) {
  return spawnSync(process.execPath, [SCRIPT, '--strict'], {
    env: { ...process.env, ...ISOLATED, ...env },
    encoding: 'utf8',
    cwd,
  })
}

/** A temp dir with one domain holding one shape file under `artifacts/`. */
function workspaceWithArtifacts() {
  const dir = mkdtempSync(join(tmpdir(), 'check-sources-'))
  mkdirSync(join(dir, 'artifacts', 'demo'), { recursive: true })
  writeFileSync(join(dir, 'artifacts', 'demo', 'demo.shacl.ttl'), '')
  return dir
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
  assert.match(result.stderr, /ONTOLOGY_SOURCES_FILE points at a missing file: .*sources\.json/)
  // Not reported as an empty artifact root: the manifest is not one.
  assert.doesNotMatch(result.stderr, /No ontology shape files/)
})

test('a manifest the server rejects fails strict mode instead of counting a fallback', () => {
  const dir = workspaceWithArtifacts()
  try {
    const cases = [
      ['{"sources": [', /Cannot read .*sources\.json as JSON/],
      ['{"sources": [{"name": "no-path"}]}', /every sources\[\] entry must be \{ path: string \}/],
      [
        JSON.stringify({
          sources: [{ path: 'artifacts', domains: ['demo'], excludeDomains: ['demo'] }],
        }),
        /both includes and excludes demo/,
      ],
      [
        JSON.stringify({ sources: [{ path: 'artifacts', domains: ['demo', 'demo'] }] }),
        /must be an array of distinct domain names/,
      ],
    ]
    for (const [manifest, message] of cases) {
      writeFileSync(join(dir, 'sources.json'), manifest)
      const result = runStrict({ ONTOLOGY_SOURCES_FILE: join(dir, 'sources.json') })
      assert.equal(result.status, 1, manifest)
      assert.match(result.stderr, message)
      assert.doesNotMatch(result.stdout, /Ontology sources found/)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a relative ONTOLOGY_SOURCES_FILE resolves against ONTOLOGY_ROOT, as on the server', () => {
  const dir = workspaceWithArtifacts()
  try {
    writeFileSync(join(dir, 'sources.json'), JSON.stringify({ sources: [{ path: 'artifacts' }] }))
    const result = runStrict({ ONTOLOGY_ROOT: dir, ONTOLOGY_SOURCES_FILE: 'sources.json' })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /1 in .*artifacts/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("settings in the checkout's .env.local are honoured", () => {
  // A copy of the script in a scratch checkout, so the .env.local it reads is
  // the test's and not the developer's.
  const checkout = workspaceWithArtifacts()
  try {
    mkdirSync(join(checkout, 'scripts'))
    for (const file of ['check-ontology-sources.mjs', 'check-env.mjs']) {
      copyFileSync(join(SCRIPTS, file), join(checkout, 'scripts', file))
    }
    writeFileSync(
      join(checkout, 'sources.json'),
      JSON.stringify({ sources: [{ path: 'artifacts' }] })
    )
    writeFileSync(join(checkout, '.env.local'), 'ONTOLOGY_SOURCES_FILE=sources.json\n')
    const env = { ...process.env }
    for (const key of Object.keys(ISOLATED)) delete env[key]
    const result = spawnSync(
      process.execPath,
      [join(checkout, 'scripts', 'check-ontology-sources.mjs'), '--strict'],
      { env, encoding: 'utf8' }
    )
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /1 in .*artifacts/)
  } finally {
    rmSync(checkout, { recursive: true, force: true })
  }
})

test('relative ONTOLOGY_ROOT and ONTOLOGY_ARTIFACTS_PATH resolve as on the server, from any cwd', () => {
  const dir = workspaceWithArtifacts()
  // Deeper than the checkout, so the relative path's `..` segments cannot all
  // collapse at `/` and land on the right directory by accident.
  const cwd = join(dir, ...Array.from({ length: 16 }, () => 'cwd'))
  mkdirSync(cwd, { recursive: true })
  try {
    const result = runStrict(
      { ONTOLOGY_ROOT: relative(join(SCRIPTS, '..'), dir), ONTOLOGY_ARTIFACTS_PATH: 'artifacts' },
      cwd
    )
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /1 in .*artifacts/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
