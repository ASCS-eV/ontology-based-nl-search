import { describe, expect, it } from 'vitest'

import { parseCodexCliCredentials, parseCodexCliVersion } from '../codex-auth.js'

function token(exp: number): string {
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url')
  return `header.${payload}.signature`
}

describe('Codex CLI authentication', () => {
  it('parses only the OAuth fields needed by the smoke runner', () => {
    const expiresAt = 2_000_000_000
    expect(
      parseCodexCliCredentials(
        JSON.stringify({
          auth_mode: 'chatgpt',
          OPENAI_API_KEY: null,
          tokens: {
            access_token: token(expiresAt),
            account_id: 'account-123',
            refresh_token: 'must-not-be-returned',
          },
        }),
        'test-auth.json',
        1_900_000_000_000
      )
    ).toEqual({
      accessToken: token(expiresAt),
      accountId: 'account-123',
      expiresAt: expiresAt * 1000,
    })
  })

  it('rejects malformed, missing, and expired OAuth credentials', () => {
    expect(() => parseCodexCliCredentials('{', 'test-auth.json')).toThrow(/not valid JSON/)
    expect(() =>
      parseCodexCliCredentials(JSON.stringify({ auth_mode: 'apikey' }), 'test-auth.json')
    ).toThrow(/No ChatGPT access token/)
    expect(() =>
      parseCodexCliCredentials(
        JSON.stringify({
          auth_mode: 'chatgpt',
          tokens: { access_token: token(100), account_id: 'account-123' },
        }),
        'test-auth.json',
        101_000
      )
    ).toThrow(/expired/)
  })

  it('parses the installed CLI version banner', () => {
    expect(parseCodexCliVersion('codex-cli 0.146.0\n')).toBe('0.146.0')
    expect(parseCodexCliVersion('codex-cli 0.147.0-alpha.3')).toBe('0.147.0-alpha.3')
    expect(() => parseCodexCliVersion('codex unknown')).toThrow(/Could not parse/)
  })
})
