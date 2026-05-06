import { createOpenAI } from '@ai-sdk/openai'

/**
 * Get the configured AI model based on environment variables.
 * Supports: openai, copilot (GitHub Models), ollama
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

    case 'copilot': {
      // GitHub Copilot / GitHub Models — OpenAI-compatible endpoint
      const copilot = createOpenAI({
        baseURL: 'https://api.githubcopilot.com',
        apiKey: process.env.GITHUB_TOKEN,
      })
      return copilot(modelId)
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
        `Unsupported AI_PROVIDER: "${provider}". Supported: openai, copilot, ollama. ` +
          `Install additional @ai-sdk/* packages for more providers.`,
      )
  }
}
