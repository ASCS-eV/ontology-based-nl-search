import { createComponentLogger } from '@ontology-search/core/logging'
import { warmupLlmSession } from '@ontology-search/llm'
import { buildSystemPrompt } from '@ontology-search/llm/prompt-builder'
import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'
import { ShaclValidator } from '@ontology-search/ontology/shacl-validator'
import { getInitializedStore } from '@ontology-search/search'
import { getShaclContent } from '@ontology-search/search/shacl-reader'
import { registerPolicyNamespaces } from '@ontology-search/sparql/policy'

const logger = createComponentLogger('warmup')

/** Result of the warmup process — surfaces degraded state for health checks */
export interface WarmupResult {
  ready: boolean
  errors: string[]
  timings: { storeMs: number; vocabMs: number; shaclMs: number; sessionMs: number }
}

export async function warmup(): Promise<WarmupResult> {
  logger.info('Warming up SPARQL store and ontology indexes...')
  const start = Date.now()
  const errors: string[] = []

  try {
    await getInitializedStore()
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Store initialization failed: ${msg}`)
    logger.error('Store warmup failed', error)
  }
  const storeMs = Date.now() - start

  // Register all discovered ontology namespaces with the SPARQL policy
  // so compiled queries pass prefix validation regardless of which
  // ontology is loaded.
  try {
    const registry = await buildDomainRegistry()
    registerPolicyNamespaces(registry.getAllNamespaces())
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Policy namespace registration failed: ${msg}`)
    logger.error('Policy namespace registration failed', error)
  }

  // Pre-build the LLM system prompt from raw SHACL content
  const vocabStart = Date.now()
  try {
    const shaclContent = getShaclContent()
    buildSystemPrompt(shaclContent)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Prompt build failed: ${msg}`)
    logger.error('Vocab warmup failed', error)
  }
  const vocabMs = Date.now() - vocabStart

  // Pre-construct the SHACL validator so the first search doesn't pay
  // the shape-parse cost (~7s on the full ontology).
  const shaclStart = Date.now()
  try {
    await ShaclValidator.fromWorkspace()
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`SHACL validator init failed: ${msg}`)
    logger.error('SHACL warmup failed', error)
  }
  const shaclMs = Date.now() - shaclStart

  // Pre-create the LLM session so first query is instant
  const sessionStart = Date.now()
  try {
    await warmupLlmSession()
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`LLM session warmup failed: ${msg}`)
    logger.error('LLM session warmup failed', error)
  }
  const sessionMs = Date.now() - sessionStart

  const ready = errors.length === 0
  if (ready) {
    logger.info(`Warmup complete in ${Date.now() - start}ms`, {
      storeMs,
      vocabMs,
      shaclMs,
      sessionMs,
    })
  } else {
    logger.warn(`Warmup completed with ${errors.length} error(s) — service degraded`, {
      errors,
      totalMs: Date.now() - start,
    })
  }

  return { ready, errors, timings: { storeMs, vocabMs, shaclMs, sessionMs } }
}
