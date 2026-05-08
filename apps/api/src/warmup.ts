import { createComponentLogger } from '@ontology-search/core/logging'
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

    logger.info(`Warmup complete in ${Date.now() - start}ms`, { storeMs, vocabMs })
  } catch (error) {
    logger.error('Warmup failed — service may respond slowly to first request', error)
  }
}
