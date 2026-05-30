/**
 * Provider — credentials-file permission gate.
 *
 * `assertCredentialsPermissions` refuses to read a token file whose POSIX
 * mode lets group/other access it. Regression coverage for criterion 27
 * (credentials must be mode-checked) — before the fix the provider would
 * silently `readFileSync` a 0644 credentials file and ship the embedded
 * OAuth token wherever the model client sent its request.
 */
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { CredentialsPermissionError } from '@ontology-search/core/errors'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { assertCredentialsPermissions, parseMistralKeyFromEnv } from '../provider.js'

const isWindows = process.platform === 'win32'

describe('assertCredentialsPermissions', () => {
  let workdir: string
  let credPath: string

  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), 'cred-perm-'))
    credPath = join(workdir, 'creds.json')
    writeFileSync(credPath, '{"token":"x"}', { mode: 0o600 })
  })

  afterEach(() => {
    rmSync(workdir, { recursive: true, force: true })
  })

  it.skipIf(isWindows)('accepts 0600 credentials', () => {
    chmodSync(credPath, 0o600)
    expect(() => assertCredentialsPermissions(credPath)).not.toThrow()
  })

  it.skipIf(isWindows)(
    'rejects 0644 (group + other readable) credentials with CredentialsPermissionError',
    () => {
      chmodSync(credPath, 0o644)
      expect(() => assertCredentialsPermissions(credPath)).toThrow(CredentialsPermissionError)
    }
  )

  it.skipIf(isWindows)('rejects 0660 (group readable) credentials', () => {
    chmodSync(credPath, 0o660)
    expect(() => assertCredentialsPermissions(credPath)).toThrow(CredentialsPermissionError)
  })

  it.skipIf(isWindows)('rejects 0606 (other readable) credentials', () => {
    chmodSync(credPath, 0o606)
    expect(() => assertCredentialsPermissions(credPath)).toThrow(CredentialsPermissionError)
  })

  it.skipIf(isWindows)('error message includes the path and a chmod hint', () => {
    chmodSync(credPath, 0o644)
    try {
      assertCredentialsPermissions(credPath)
      expect.fail('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(CredentialsPermissionError)
      expect((err as Error).message).toContain(credPath)
      expect((err as Error).message).toMatch(/chmod 600/)
    }
  })

  it.runIf(isWindows)('is a no-op on Windows where POSIX bits are not meaningful', () => {
    expect(() => assertCredentialsPermissions(credPath)).not.toThrow()
  })
})

describe('parseMistralKeyFromEnv', () => {
  it('parses the single-quoted form `vibe --setup` writes', () => {
    expect(parseMistralKeyFromEnv("MISTRAL_API_KEY='abc123'\n")).toBe('abc123')
  })

  it('parses double-quoted and bare forms', () => {
    expect(parseMistralKeyFromEnv('MISTRAL_API_KEY="abc123"')).toBe('abc123')
    expect(parseMistralKeyFromEnv('MISTRAL_API_KEY=abc123')).toBe('abc123')
  })

  it('tolerates surrounding whitespace and ignores other keys', () => {
    const env = 'FOO=bar\n  MISTRAL_API_KEY =  xyz789 \nBAZ=qux\n'
    expect(parseMistralKeyFromEnv(env)).toBe('xyz789')
  })

  it('returns null when the key is absent or empty', () => {
    expect(parseMistralKeyFromEnv('FOO=bar\n')).toBeNull()
    expect(parseMistralKeyFromEnv("MISTRAL_API_KEY=''")).toBeNull()
    expect(parseMistralKeyFromEnv('')).toBeNull()
  })
})
