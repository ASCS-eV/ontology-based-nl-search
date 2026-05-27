import { createComponentLogger } from '@ontology-search/core/logging'
import { warmupLlmSession } from '@ontology-search/llm'
import { buildSystemPrompt } from '@ontology-search/llm/prompt-builder'
import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'
import { ShaclValidator } from '@ontology-search/ontology/shacl-validator'
import { getInitializedStore, warmupCompiler } from '@ontology-search/search'
import { getShaclContent } from '@ontology-search/search/shacl-reader'
import { probePropertyPathSupport } from '@ontology-search/sparql'
import { registerPolicyNamespaces } from '@ontology-search/sparql/policy'

const logger = createComponentLogger('warmup')

/** Result of the warmup process — surfaces degraded state for health checks */
export interface WarmupResult {
  ready: boolean
  errors: string[]
  timings: {
    storeMs: number
    vocabMs: number
    compilerMs: number
    shaclMs: number
    sessionMs: number
  }
}

export async function warmup(): Promise<WarmupResult> {
  logger.info('Warming up SPARQL store and ontology indexes...')
  const start = Date.now()
  const errors: string[] = []

  try {
    const store = await getInitializedStore()
    // Probe property-path support BEFORE any other warmup step runs
    // queries against the store. A store that silently drops
    // `rdfs:subClassOf*` would let warmup succeed and then return
    // zero results for every hierarchical query — debugging that in
    // production is painful, so we fail loudly at startup instead.
    await probePropertyPathSupport(store)
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

  // Pre-build the compiler vocabulary (property-path BFS + leaf-kind
  // enrichment + cross-reference chain discovery). This is the single
  // most expensive cold-start step — ~39s on the 22-domain workspace
  // ontology — and previously landed on the first user query's
  // `sparql-compile` stage. Warming it here moves it off the hot path.
  const compilerStart = Date.now()
  try {
    await warmupCompiler()
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Compiler vocab warmup failed: ${msg}`)
    logger.error('Compiler warmup failed', error)
  }
  const compilerMs = Date.now() - compilerStart

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
      compilerMs,
      shaclMs,
      sessionMs,
    })
  } else {
    logger.warn(`Warmup completed with ${errors.length} error(s) — service degraded`, {
      errors,
      totalMs: Date.now() - start,
    })
  }

  return { ready, errors, timings: { storeMs, vocabMs, compilerMs, shaclMs, sessionMs } }
}
