import { fileURLToPath } from 'node:url'

import { describe, it } from 'vitest'

import { exerciseServer } from './lsp-process.js'

const cliPath = fileURLToPath(new URL('../../dist/cli.js', import.meta.url))
const fixturePath = fileURLToPath(new URL('../__fixtures__/vocabulary.json', import.meta.url))

describe('stdio LSP process', () => {
  it('serves the advertised lifecycle and language features', { timeout: 30_000 }, async () => {
    await exerciseServer(cliPath, fixturePath)
  })
})
