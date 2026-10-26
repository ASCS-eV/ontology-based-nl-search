/**
 * Regression gate for `optimisticRepeatInstall: false` in pnpm-workspace.yaml:
 * a plain `pnpm install` must recreate a workspace link that has gone missing.
 *
 * With pnpm's default fast check, `pnpm install` compares only the manifests,
 * the lockfile and the patch files, prints "Already up to date" over a missing
 * `node_modules/@ontology-search/<pkg>` link, and the build then fails with
 * TS2307 "Cannot find module". The test installs a two-package workspace under
 * this repository's own pnpm-workspace.yaml, deletes the link, and installs
 * again. pnpm starts in the repository root, so it is the pinned version, and
 * works on the temporary workspace through `--dir`. It needs `pnpm` on PATH
 * and no network: the workspace has no registry dependencies. Zero-dependency
 * (node:test), like the other `scripts/*.test.mjs`, run via `node --test`.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(value))
}

function pnpmInstall(dir) {
  const options = { cwd: ROOT, encoding: 'utf8' }
  // `pnpm` is a `.cmd` shim on Windows, which only a shell can start; the
  // quotes keep a temporary directory with spaces one argument.
  const result =
    process.platform === 'win32'
      ? spawnSync(`pnpm --dir "${dir}" install --offline`, { ...options, shell: true })
      : spawnSync('pnpm', ['--dir', dir, 'install', '--offline'], options)
  assert.equal(
    result.status,
    0,
    `pnpm install failed: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`
  )
}

test('pnpm install recreates a workspace link that has gone missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pnpm-workspace-'))
  try {
    // The copied yaml's `packages/*` glob picks up the two packages below.
    copyFileSync(join(ROOT, 'pnpm-workspace.yaml'), join(dir, 'pnpm-workspace.yaml'))
    writeJson(join(dir, 'package.json'), { name: 'root', private: true })
    writeJson(join(dir, 'packages', 'leaf', 'package.json'), { name: 'leaf', version: '0.0.0' })
    writeJson(join(dir, 'packages', 'consumer', 'package.json'), {
      name: 'consumer',
      version: '0.0.0',
      dependencies: { leaf: 'workspace:*' },
    })
    const link = join(dir, 'packages', 'consumer', 'node_modules', 'leaf')

    pnpmInstall(dir)
    assert.ok(existsSync(link), 'the first install links the workspace dependency')

    rmSync(link)
    pnpmInstall(dir)
    assert.ok(existsSync(link), 'a repeat install recreates the missing link')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
