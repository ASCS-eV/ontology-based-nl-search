import { createComponentLogger } from '@ontology-search/core/logging'
import { warmupLlmSession } from '@ontology-search/llm'
import { buildSystemPrompt } from '@ontology-search/llm/prompt-builder'
import { extractVocabulary, getInitializedStore } from '@ontology-search/search'

const logger = createComponentLogger('warmup')

export async function warmup(): Promise<void> {
  logger.info('Warming up SPARQL store and ontology indexes...')
  const start = Date.now()

  try {
    const store = await getInitializedStore()
    const storeMs = Date.now() - start

    // Pre-build the LLM system prompt so first search doesn't pay the cost
    const vocabStart = Date.now()
    const vocabulary = await extractVocabulary(store)
    buildSystemPrompt(vocabulary)
    const vocabMs = Date.now() - vocabStart

    // Pre-create the Copilot SDK session (~6s) so first query is instant
    const sessionStart = Date.now()
    await warmupLlmSession()
    const sessionMs = Date.now() - sessionStart

    logger.info(`Warmup complete in ${Date.now() - start}ms`, { storeMs, vocabMs, sessionMs })
  } catch (error) {
    logger.error('Warmup failed — service may respond slowly to first request', error)
  }
}
