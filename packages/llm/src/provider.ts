import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { getConfig } from '@ontology-search/core/config'
import { AgentError } from '@ontology-search/core/errors'
import type { LanguageModel } from 'ai'

/**
 * Read the OAuth access token from the Claude CLI credentials file.
 * Located at ~/.claude/.credentials.json, written by `claude` CLI login.
 */
function getClaudeCliToken(): string {
  const credPath = join(homedir(), '.claude', '.credentials.json')

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
