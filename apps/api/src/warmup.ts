import { createComponentLogger } from '@ontology-search/core/logging'
import { getInitializedStore } from '@ontology-search/search'

const logger = createComponentLogger('warmup')

export async function warmup(): Promise<void> {
  logger.info('Warming up SPARQL store and ontology indexes...')
  const start = Date.now()

  try {
    await getInitializedStore()
    logger.info(`Warmup complete in ${Date.now() - start}ms`)
  } catch (error) {
    logger.error('Warmup failed — service may respond slowly to first request', error)
  }
}
