import { readFileSync, statSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'

import { createAnthropic } from '@ai-sdk/anthropic'
import { createMistral } from '@ai-sdk/mistral'
import { createOpenAI } from '@ai-sdk/openai'
import { getConfig } from '@ontology-search/core/config'
import { AgentError, CredentialsPermissionError } from '@ontology-search/core/errors'
import type { LanguageModel } from 'ai'

/**
 * POSIX mode bits that must be zero on a credentials file — i.e. nothing
 * but the owner may read, write, or execute it. Matches the OpenSSH
 * `StrictModes` rule for private keys.
 */
const CREDENTIALS_GROUP_OTHER_BITS = 0o077

/**
 * Refuse to read a credentials file whose POSIX mode lets group/other read
 * it. On Windows the mode bits are emulated and not meaningful, so the
 * check is skipped there — the OS-level ACLs are the actual gate.
 *
 * @throws CredentialsPermissionError when the file is group/world accessible
 */
export function assertCredentialsPermissions(path: string): void {
  // Windows doesn't surface meaningful POSIX permission bits, so the check
  // would always pass or always fail by accident. The platform's ACLs
  // already restrict access — skip rather than emit a false positive.
  if (platform() === 'win32') return

  const stats = statSync(path)
  const accessBits = stats.mode & CREDENTIALS_GROUP_OTHER_BITS
  if (accessBits !== 0) {
    const octal = (stats.mode & 0o777).toString(8).padStart(3, '0')
    throw new CredentialsPermissionError(
      `Credentials file ${path} has permissions 0${octal} (group/other can access). ` +
        `Run \`chmod 600 ${path}\` and retry.`
    )
  }
}

/**
 * Read the OAuth access token from the Claude CLI credentials file.
 * Located at ~/.claude/.credentials.json, written by `claude` CLI login.
 *
 * The file mode is checked before read: a credentials file readable by
 * group or other would silently leak the embedded OAuth token to any
 * process on the host, so we refuse to read until the operator has
 * tightened the perms.
 */
function getClaudeCliToken(): string {
  const credPath = join(homedir(), '.claude', '.credentials.json')

  // Stat first so a permission-leaky file is refused before the read syscall
  // would copy its contents into memory.
  try {
    assertCredentialsPermissions(credPath)
  } catch (err) {
    if (err instanceof CredentialsPermissionError) throw err
    // statSync may throw ENOENT — fall through to the same error path as
    // readFileSync below, so the user sees a single coherent "credentials
    // not found" message rather than a duplicate stat error.
  }

  let raw: string
  try {
    raw = readFileSync(credPath, 'utf-8')
  } catch (cause) {
    throw new AgentError(
      `Claude CLI credentials not found at ${credPath}. Run "claude" to authenticate first.`,
      { cause }
    )
  }

  return parseClaudeOAuthToken(raw, credPath)
}

/**
 * Parse the Claude CLI OAuth access token out of a raw credentials-file
 * string. Pure (no filesystem) so the parse/validation contract is unit-
 * testable. Every failure path throws the typed {@link AgentError} — including
 * malformed JSON, which previously surfaced as a raw `SyntaxError` outside the
 * error hierarchy the API layer maps by `instanceof`.
 */
export function parseClaudeOAuthToken(raw: string, credPath: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (cause) {
    throw new AgentError(
      `Claude CLI credentials at ${credPath} are not valid JSON. Run "claude" to re-authenticate.`,
      { cause }
    )
  }

  // Cast at the JSON boundary: the file is external input, so we read only the
  // two fields we need and validate them explicitly. Non-object / null parses
  // yield `undefined` here and fall into the "no access token" branch below.
  const oauth = (parsed as { claudeAiOauth?: { accessToken?: string; expiresAt?: number } } | null)
    ?.claudeAiOauth
  if (!oauth?.accessToken) {
    throw new AgentError(`No access token in ${credPath}. Run "claude" to re-authenticate.`)
  }

  if (oauth.expiresAt && Date.now() > oauth.expiresAt) {
    throw new AgentError(
      `Claude CLI token expired. Run "claude" to refresh your session, then restart the API.`
    )
  }

  return oauth.accessToken
}

/**
 * Read the Mistral API key the `vibe` CLI stored at `~/.vibe/.env`.
 *
 * `vibe` (Mistral's coding-agent CLI, analogous to the Claude CLI)
 * writes `MISTRAL_API_KEY='…'` to that file on `vibe --setup`. We
 * reuse it so a developer who's already authenticated `vibe` doesn't
 * re-enter a key. The same permission gate as the Claude credentials
 * applies — a group/other-readable secrets file is refused.
 *
 * @throws CredentialsPermissionError when the file is group/world accessible
 * @throws AgentError when the file or key is missing
 */
function getVibeMistralKey(): string {
  const envPath = join(homedir(), '.vibe', '.env')

  try {
    assertCredentialsPermissions(envPath)
  } catch (err) {
    if (err instanceof CredentialsPermissionError) throw err
    // statSync ENOENT — fall through to the readFileSync error path so
    // the user sees one coherent "run vibe --setup" message.
  }

  let raw: string
  try {
    raw = readFileSync(envPath, 'utf-8')
  } catch (cause) {
    throw new AgentError(
      `Vibe credentials not found at ${envPath}. Run "vibe --setup" to authenticate first.`,
      { cause }
    )
  }

  const key = parseMistralKeyFromEnv(raw)
  if (!key) {
    throw new AgentError(`No MISTRAL_API_KEY in ${envPath}. Run "vibe --setup" to authenticate.`)
  }
  return key
}

/**
 * Extract `MISTRAL_API_KEY` from the contents of a dotenv-style file.
 * Tolerates single/double quotes and surrounding whitespace — the form
 * `vibe --setup` writes (`MISTRAL_API_KEY='…'`). Returns null when the
 * key is absent or empty. Pure + exported for unit testing.
 */
export function parseMistralKeyFromEnv(content: string): string | null {
  const match = content.match(/^\s*MISTRAL_API_KEY\s*=\s*['"]?([^'"\r\n]+)['"]?\s*$/m)
  return match?.[1]?.trim() ?? null
}

/**
 * Get the configured AI model based on validated application config.
 * Supports: openai, ollama, anthropic, claude-cli, vibe-cli (copilot
 * handled via @github/copilot-sdk separately).
 */
export function getModel(): LanguageModel {
  const config = getConfig()
  const { AI_PROVIDER: provider, AI_MODEL: modelId } = config

  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({
        apiKey: config.OPENAI_API_KEY,
      })
      return openai(modelId)
    }

    case 'ollama': {
      const ollama = createOpenAI({
        baseURL: config.OLLAMA_BASE_URL,
        apiKey: 'ollama',
      })
      return ollama.chat(modelId)
    }

    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: config.ANTHROPIC_API_KEY,
      })
      return anthropic(modelId)
    }

    case 'claude-cli': {
      // The Claude CLI OAuth token must be sent as a Bearer token
      // (NOT as `x-api-key`) plus the `anthropic-beta: oauth-2025-04-20`
      // header — that's the dedicated OAuth flow for Claude Code
      // sessions. `@ai-sdk/anthropic` sends `x-api-key: <apiKey>` by
      // default, which the API rejects with "invalid x-api-key" for
      // OAuth-issued tokens. We override the transport via a custom
      // fetch that strips the wrong header and inserts the right ones.
      const token = getClaudeCliToken()
      const anthropic = createAnthropic({
        // apiKey must be non-empty to satisfy the SDK's runtime check;
        // the value is stripped from the wire by the fetch override
        // below, so its content is irrelevant.
        apiKey: 'oauth-bearer-replaced-by-custom-fetch',
        fetch: async (input, init) => {
          const headers = new Headers(init?.headers)
          headers.delete('x-api-key')
          headers.set('Authorization', `Bearer ${token}`)
          headers.set('anthropic-beta', 'oauth-2025-04-20')
          return fetch(input, { ...init, headers })
        },
      })
      return anthropic(modelId)
    }

    case 'vibe-cli': {
      // Use the dedicated Mistral provider rather than the OpenAI one:
      // although Mistral advertises an OpenAI-compatible API, the
      // @ai-sdk/openai provider emits OpenAI-specific shapes Mistral
      // rejects — the Responses API (`/v1/responses` → 404) on the
      // default callable, and `role: "developer"` system messages
      // (→ 422 union_tag_invalid) on `.chat()`. `@ai-sdk/mistral`
      // speaks Mistral's chat API natively (system role + tool calling).
      // The key is the one `vibe --setup` stored in ~/.vibe/.env.
      const mistral = createMistral({
        baseURL: config.MISTRAL_BASE_URL,
        apiKey: getVibeMistralKey(),
      })
      return mistral(modelId)
    }

    default:
      throw new AgentError(
        `Unsupported AI_PROVIDER: "${provider}". Supported: openai, anthropic, claude-cli, vibe-cli, copilot, ollama.`
      )
  }
}
