import { readFileSync, statSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'

import { createAnthropic } from '@ai-sdk/anthropic'
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

  const creds = JSON.parse(raw)
  const oauth = creds.claudeAiOauth
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
 * Get the configured AI model based on validated application config.
 * Supports: openai, ollama, anthropic, claude-cli (copilot handled via @github/copilot-sdk separately)
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
      return ollama(modelId)
    }

    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: config.ANTHROPIC_API_KEY,
      })
      return anthropic(modelId)
    }

    case 'claude-cli': {
      const anthropic = createAnthropic({
        apiKey: getClaudeCliToken(),
      })
      return anthropic(modelId)
    }

    default:
      throw new AgentError(
        `Unsupported AI_PROVIDER: "${provider}". Supported: openai, anthropic, claude-cli, copilot, ollama.`
      )
  }
}
