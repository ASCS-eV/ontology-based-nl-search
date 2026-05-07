import { createOpenAI } from '@ai-sdk/openai'
import { getConfig } from '@ontology-search/core/config'
import type { LanguageModel } from 'ai'

/**
 * Get the configured AI model based on validated application config.
 * Supports: openai, ollama (copilot is handled via @github/copilot-sdk separately)
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

    default:
      throw new Error(`Unsupported AI_PROVIDER: "${provider}". Supported: openai, copilot, ollama.`)
  }
}
