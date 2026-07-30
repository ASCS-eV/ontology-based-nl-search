/**
 * Regression tests for the ontology fetcher (`fetch-ontology.mjs`).
 *
 * The fetcher replaced a git submodule, so its failure modes are the repo's
 * supply chain: a distribution whose bytes changed, one that stopped shipping
 * the data, and a cache that only looks complete. Each is asserted to fail
 * loudly rather than leave a half-populated tree that the loader would read as
 * "ontology present, 0 shapes".
 *
 * No network: the tests build a real sdist-shaped tarball and inject it through
 * the `fetchImpl` seam. Zero-dependency apart from `tar` (already required by
 * the fetcher itself), like the other `scripts/*.test.mjs`, run via `node --test`.
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import * as tar from 'tar'

import {
  cacheMatchesPin,
  ensureEnvProxy,
  fetchOntology,
  materialize,
  readPin,
  resolveSdistUrl,
  sha256,
} from './fetch-ontology.mjs'

const PKG = 'demo-ontology'
const VERSION = '9.9.9'
const FILENAME = `${PKG}-${VERSION}.tar.gz`

let work
let tarballPath
let tarballSha

/** Build an sdist-shaped tarball: everything under a `<name>-<version>/` prefix. */
function buildTarball(dir, { withSentinels = true } = {}) {
  const stage = join(dir, 'stage', `${PKG}-${VERSION}`)
  mkdirSync(join(stage, 'artifacts', 'envited-x'), { recursive: true })
  mkdirSync(join(stage, 'imports', 'OpenScenario'), { recursive: true })
  mkdirSync(join(stage, 'tests'), { recursive: true })
  if (withSentinels) {
    writeFileSync(join(stage, 'artifacts', 'envited-x', 'envited-x.shacl.ttl'), '@prefix : <#> .\n')
    writeFileSync(join(stage, 'imports', 'OpenScenario', 'OpenSCENARIO.xsd'), '<xsd:schema/>\n')
  }
  // Not in `paths`: must not be extracted.
  writeFileSync(join(stage, 'tests', 'do-not-extract.txt'), 'x\n')

  const out = join(dir, FILENAME)
  tar.c({ sync: true, gzip: true, file: out, cwd: join(dir, 'stage') }, [`${PKG}-${VERSION}`])
  return out
}

/** A pin pointing at the fixture tarball, rooted in a temp workspace. */
function makePin(root, overrides = {}) {
  const pin = {
    package: PKG,
    version: VERSION,
    registry: 'https://registry.invalid',
    sdist: { filename: FILENAME, sha256: tarballSha },
    paths: ['artifacts', 'imports'],
    sentinels: ['artifacts/envited-x/envited-x.shacl.ttl', 'imports/OpenScenario/OpenSCENARIO.xsd'],
    cacheDir: '.ontology',
    ...overrides,
  }
  writeFileSync(join(root, 'ontology-package.json'), JSON.stringify(pin, null, 2))
  return pin
}

/** A fetch that answers the registry metadata call and the download. */
function fakeFetch(tarball, { metaOk = true } = {}) {
  return async (url) => {
    if (url.includes('/pypi/')) {
      return {
        ok: metaOk,
        status: metaOk ? 200 : 404,
        json: async () => ({
          urls: [
            { packagetype: 'bdist_wheel', filename: 'wheel.whl', url: 'https://x/wheel.whl' },
            { packagetype: 'sdist', filename: FILENAME, url: 'https://x/' + FILENAME },
          ],
        }),
      }
    }
    const bytes = readFileSync(tarball)
    return { ok: true, status: 200, arrayBuffer: async () => bytes }
  }
}

before(() => {
  work = mkdtempSync(join(tmpdir(), 'fetch-ontology-test-'))
  tarballPath = buildTarball(work)
  tarballSha = sha256(readFileSync(tarballPath))
})

after(() => {
  rmSync(work, { recursive: true, force: true })
})

test('the real pin in this repo is well-formed', () => {
  const pin = readPin()
  assert.equal(pin.package, 'ontology-management-base')
  assert.match(pin.sdist.sha256, /^[0-9a-f]{64}$/)
  assert.ok(pin.paths.includes('artifacts'), 'artifacts must be extracted')
  assert.ok(
    pin.sentinels.some((s) => s.endsWith('.shacl.ttl')),
    'at least one sentinel must be a shape file — the thing the loader needs'
  )
})

test('readPin rejects a pin without a usable checksum', () => {
  const root = mkdtempSync(join(work, 'badpin-'))
  writeFileSync(
    join(root, 'ontology-package.json'),
    JSON.stringify({
      package: PKG,
      version: VERSION,
      registry: 'x',
      sdist: { filename: FILENAME, sha256: 'not-a-digest' },
      paths: ['artifacts'],
      cacheDir: '.ontology',
    })
  )
  assert.throws(() => readPin(root), /64 hex/)
})

test('materialize extracts only the pinned subtrees, stripping the sdist prefix', async () => {
  const root = mkdtempSync(join(work, 'ok-'))
  const pin = makePin(root)
  const cacheDir = await materialize(tarballPath, pin, { root, tarImpl: tar })

  assert.ok(existsSync(join(cacheDir, 'artifacts', 'envited-x', 'envited-x.shacl.ttl')))
  assert.ok(existsSync(join(cacheDir, 'imports', 'OpenScenario', 'OpenSCENARIO.xsd')))
  // The prefix is gone, so the cache mirrors the upstream layout.
  assert.ok(!existsSync(join(cacheDir, `${PKG}-${VERSION}`)))
  // A subtree outside `paths` is not extracted.
  assert.ok(!existsSync(join(cacheDir, 'tests')))
  assert.ok(cacheMatchesPin(pin, root))
})

test('a changed distribution fails the checksum instead of being installed', async () => {
  const root = mkdtempSync(join(work, 'tampered-'))
  const pin = makePin(root, { sdist: { filename: FILENAME, sha256: 'a'.repeat(64) } })
  await assert.rejects(
    () => materialize(tarballPath, pin, { root, tarImpl: tar }),
    /checksum mismatch/
  )
  assert.ok(!existsSync(join(root, '.ontology', 'artifacts')), 'nothing may be extracted')
})

test('a distribution that stopped shipping the data fails loudly and leaves no cache', async () => {
  const root = mkdtempSync(join(work, 'empty-'))
  const emptyDir = mkdtempSync(join(work, 'emptysrc-'))
  const emptyTarball = buildTarball(emptyDir, { withSentinels: false })
  const pin = makePin(root, {
    sdist: { filename: FILENAME, sha256: sha256(readFileSync(emptyTarball)) },
  })
  await assert.rejects(
    () => materialize(emptyTarball, pin, { root, tarImpl: tar }),
    /did not contain/
  )
  assert.ok(!existsSync(join(root, '.ontology')), 'a partial cache must be removed')
})

test('cacheMatchesPin rejects a cache that is stale, tampered or incomplete', async () => {
  const root = mkdtempSync(join(work, 'stale-'))
  const pin = makePin(root)
  await materialize(tarballPath, pin, { root, tarImpl: tar })
  assert.ok(cacheMatchesPin(pin, root))

  // A bumped version must not be served from the old cache.
  assert.ok(!cacheMatchesPin({ ...pin, version: '9.9.10' }, root))
  // Same version, different bytes: the pin's checksum is part of the identity.
  assert.ok(!cacheMatchesPin({ ...pin, sdist: { ...pin.sdist, sha256: 'b'.repeat(64) } }, root))
  // The marker alone is not enough — a deleted sentinel means "not materialized".
  rmSync(join(root, '.ontology', 'imports', 'OpenScenario', 'OpenSCENARIO.xsd'))
  assert.ok(!cacheMatchesPin(pin, root))
})

test('fetchOntology downloads once and then skips', async () => {
  const root = mkdtempSync(join(work, 'fetch-'))
  makePin(root)
  let calls = 0
  const counting = (url) => {
    calls++
    return fakeFetch(tarballPath)(url)
  }

  const first = await fetchOntology({ root, fetchImpl: counting, tarImpl: tar })
  assert.equal(first.skipped, false)
  assert.equal(calls, 2, 'one metadata call + one download')

  const second = await fetchOntology({ root, fetchImpl: counting, tarImpl: tar })
  assert.equal(second.skipped, true)
  assert.equal(calls, 2, 'a matching cache must not touch the network')

  const forced = await fetchOntology({ root, fetchImpl: counting, tarImpl: tar, force: true })
  assert.equal(forced.skipped, false)
  assert.equal(calls, 4)
})

test('resolveSdistUrl picks the pinned sdist, never the wheel', async () => {
  const root = mkdtempSync(join(work, 'url-'))
  const pin = makePin(root)
  assert.equal(await resolveSdistUrl(pin, fakeFetch(tarballPath)), 'https://x/' + FILENAME)
})

test('resolveSdistUrl fails when the version does not publish the pinned filename', async () => {
  const root = mkdtempSync(join(work, 'url404-'))
  const pin = makePin(root, { sdist: { filename: 'other.tar.gz', sha256: tarballSha } })
  await assert.rejects(() => resolveSdistUrl(pin, fakeFetch(tarballPath)), /does not publish/)
})

// Node's global `fetch` ignores HTTP(S)_PROXY on its own, so behind a proxy the
// fetch fails while curl/git/pnpm succeed. ensureEnvProxy installs an undici
// dispatcher that reads those vars (plus NO_PROXY).
test('ensureEnvProxy is a no-op when no proxy variable is set', async () => {
  assert.equal(await ensureEnvProxy({}), false)
})

test('ensureEnvProxy ignores a proxy variable that is empty or whitespace', async () => {
  assert.equal(await ensureEnvProxy({ HTTPS_PROXY: '' }), false)
  assert.equal(await ensureEnvProxy({ HTTPS_PROXY: '   ' }), false)
})

test('ensureEnvProxy installs a dispatcher when a proxy variable is set', async () => {
  // Regression: this returned false whenever NODE_USE_ENV_PROXY was already
  // set, and otherwise re-exec'd with a flag that is a NO-OP on Node 22 — so
  // the proxy was never actually applied on a supported runtime.
  assert.equal(await ensureEnvProxy({ HTTPS_PROXY: 'http://127.0.0.1:8080' }), true)
})

test('ensureEnvProxy applies even when NODE_USE_ENV_PROXY is already set', async () => {
  assert.equal(
    await ensureEnvProxy({ HTTPS_PROXY: 'http://127.0.0.1:8080', NODE_USE_ENV_PROXY: '1' }),
    true
  )
})
