import { createOpenAI } from '@ai-sdk/openai'

/**
 * Get the configured AI model based on environment variables.
 * Supports: openai, ollama (copilot is handled via @github/copilot-sdk separately)
 */
export function getModel() {
  const provider = process.env.AI_PROVIDER || 'openai'
  const modelId = process.env.AI_MODEL || 'gpt-4o'

  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      })
      return openai(modelId)
    }

    case 'ollama': {
      // Ollama is compatible with OpenAI API format
      const ollama = createOpenAI({
        baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
        apiKey: 'ollama',
      })
      return ollama(modelId)
    }

    default:
      throw new Error(
        `Unsupported AI_PROVIDER: "${provider}". Supported: openai, copilot, ollama.`,
      )
  }
}
