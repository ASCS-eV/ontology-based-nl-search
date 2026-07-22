import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { extract } from 'tar'
import { describe, expect, it } from 'vitest'

import { exerciseServer } from './lsp-process.js'

const packageRoot = fileURLToPath(new URL('../..', import.meta.url))
const fixturePath = fileURLToPath(new URL('../__fixtures__/vocabulary.json', import.meta.url))

// pnpm/npm ship as `.cmd`/`.ps1` shims on Windows, which Node refuses to spawn
// by bare name without a shell (the CVE-2024-27980 hardening). Run those through
// a shell on Windows — quoting each argument so temp paths with spaces survive —
// while keeping the plain argv form on POSIX CI.
function runPackageManager(
  command: string,
  args: string[],
  options: { cwd: string }
): SpawnSyncReturns<string> {
  if (process.platform === 'win32') {
    const quoted = [command, ...args]
      .map((part) => (/\s/.test(part) ? `"${part}"` : part))
      .join(' ')
    return spawnSync(quoted, { ...options, encoding: 'utf8', shell: true })
  }
  return spawnSync(command, args, { ...options, encoding: 'utf8' })
}

describe('packed LSP artifact', () => {
  it('installs and runs without workspace dependencies', { timeout: 60_000 }, async () => {
    const temp = await mkdtemp(join(tmpdir(), 'ontology-search-lsp-pack-'))
    try {
      const packed = runPackageManager('pnpm', ['pack', '--pack-destination', temp], {
        cwd: packageRoot,
      })
      expect(packed.status, packed.stderr || packed.stdout).toBe(0)
      const reportedTarball = packed.stdout.trim().split('\n').at(-1)!
      const tarball = isAbsolute(reportedTarball) ? reportedTarball : join(temp, reportedTarball)
      await extract({ file: tarball, cwd: temp })
      const archiveRoot = join(temp, 'package')
      await expect(access(join(archiveRoot, 'dist/cli.js'))).resolves.toBeUndefined()
      await expect(
        access(join(archiveRoot, 'dist/THIRD_PARTY_NOTICES.txt'))
      ).resolves.toBeUndefined()
      await expect(access(join(archiveRoot, 'README.md'))).resolves.toBeUndefined()
      await expect(access(join(archiveRoot, 'LICENSE'))).resolves.toBeUndefined()

      const metadata = JSON.parse(await readFile(join(archiveRoot, 'package.json'), 'utf8')) as {
        dependencies?: Record<string, string>
      }
      expect(metadata.dependencies).toBeUndefined()
      expect(JSON.stringify(metadata)).not.toContain('workspace:')

      const notices = await readFile(join(archiveRoot, 'dist/THIRD_PARTY_NOTICES.txt'), 'utf8')
      expect(notices).toContain('graphql')
      expect(notices).toContain('vscode-languageserver')

      await writeFile(
        join(temp, 'package.json'),
        JSON.stringify({ name: 'pack-test-root', version: '1.0.0', private: true }),
        'utf8'
      )
      const install = runPackageManager(
        'npm',
        ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', tarball],
        { cwd: temp }
      )
      expect(install.status, install.stderr || install.stdout).toBe(0)

      const help = spawnSync(
        process.execPath,
        [join(temp, 'node_modules/@ontology-search/lsp-server/dist/cli.js'), '--help'],
        { encoding: 'utf8' }
      )
      expect(help.status, help.stderr).toBe(0)
      expect(help.stdout).toContain('Usage: ontology-search-lsp')

      const installedCli = join(temp, 'node_modules/@ontology-search/lsp-server/dist/cli.js')
      await exerciseServer(installedCli, fixturePath)

      // Prove npm did not materialize a hidden package-local runtime dependency tree.
      await expect(
        access(join(temp, 'node_modules/@ontology-search/lsp-server/node_modules'))
      ).rejects.toThrow()
    } finally {
      await rm(temp, { recursive: true, force: true })
    }
  })
})
