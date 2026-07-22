import { chmod, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.url))
const DIST = join(PACKAGE_ROOT, 'dist')

await rm(DIST, { recursive: true, force: true })
await mkdir(DIST, { recursive: true })

const result = await build({
  entryPoints: [join(PACKAGE_ROOT, 'src/cli.ts')],
  outfile: join(DIST, 'cli.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  packages: 'bundle',
  banner: {
    js: `#!/usr/bin/env node
import { createRequire as __createRequire } from 'node:module';
const require = __createRequire(import.meta.url);`,
  },
  metafile: true,
  sourcemap: true,
  minify: false,
  legalComments: 'none',
})

await chmod(join(DIST, 'cli.js'), 0o755)
await writeThirdPartyNotices(result.metafile.inputs)

async function writeThirdPartyNotices(inputs) {
  const packages = new Map()

  for (const input of Object.keys(inputs)) {
    const absoluteInput = resolve(PACKAGE_ROOT, input)
    if (!absoluteInput.includes(`${join('node_modules', '')}`)) continue

    const packageInfo = await findPackageInfo(absoluteInput)
    if (!packageInfo || packageInfo.name.startsWith('@ontology-search/')) continue
    packages.set(`${packageInfo.name}@${packageInfo.version}`, packageInfo)
  }

  const sections = [
    'THIRD-PARTY SOFTWARE NOTICES',
    '',
    'This bundled executable includes the following third-party software:',
  ]
  for (const key of [...packages.keys()].sort()) {
    const packageInfo = packages.get(key)
    const licenseText = await readLicenseText(packageInfo.root)
    sections.push(
      '',
      '='.repeat(80),
      `${packageInfo.name} ${packageInfo.version}`,
      `Declared license: ${packageInfo.license}`,
      `Source: ${packageInfo.homepage ?? packageInfo.repository ?? 'package metadata'}`,
      '-'.repeat(80),
      licenseText.trim(),
      ''
    )
  }

  if (packages.size === 0) throw new Error('No bundled third-party packages were detected.')
  await writeFile(join(DIST, 'THIRD_PARTY_NOTICES.txt'), sections.join('\n'), 'utf8')
}

async function findPackageInfo(sourceFile) {
  let current = dirname(sourceFile)
  while (current !== dirname(current)) {
    try {
      const raw = await readFile(join(current, 'package.json'), 'utf8')
      const metadata = JSON.parse(raw)
      if (metadata.name && metadata.version) {
        if (!metadata.license) {
          throw new Error(`${metadata.name}@${metadata.version} has no declared license.`)
        }
        return {
          root: current,
          name: metadata.name,
          version: metadata.version,
          license: normalizeMetadata(metadata.license),
          homepage: metadata.homepage,
          repository: normalizeMetadata(metadata.repository),
        }
      }
    } catch (error) {
      if (error instanceof SyntaxError) throw error
      if (error instanceof Error && error.message.includes('has no declared license')) throw error
    }
    current = dirname(current)
  }
  return null
}

async function readLicenseText(packageRoot) {
  const entries = await readdir(packageRoot)
  const licensePatterns = [/^licen[cs]e(\..*)?$/i, /^copying(\..*)?$/i, /^notice(\..*)?$/i]
  const filename = licensePatterns
    .map((pattern) => entries.find((entry) => pattern.test(entry)))
    .find((entry) => entry !== undefined)
  if (!filename) throw new Error(`No license text found for package at ${packageRoot}.`)
  return readFile(join(packageRoot, filename), 'utf8')
}

function normalizeMetadata(value) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && typeof value.url === 'string') return value.url
  return JSON.stringify(value)
}
