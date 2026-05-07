/**
 * Unified Search Service — single orchestration layer for all search operations.
 *
 * Responsibilities:
 * 1. Full NL search: init → LLM interpret → compile → policy → execute → count
 * 2. Refine search: init → compile pre-filled slots → policy → execute
 *
 * Routes become thin HTTP adapters that call this service.
 * This eliminates duplicated SPARQL execution logic across API routes.
 */
import { generateStructuredSearch } from '@/lib/llm'
import type { LlmStructuredResponse } from '@/lib/llm/types'
import { generateRequestId, RequestLogger } from '@/lib/logging'
import { enforceSparqlPolicy } from '@/lib/sparql/policy'
import type { SparqlBinding } from '@/lib/sparql/types'

import { compileAllCountQueries, compileSlots } from './compiler'
import { getInitializedStore } from './init'
import type { SearchSlots } from './slots'

/** Flattened SPARQL binding row for API consumers */
export type ResultRow = Record<string, string>

/** Result of executing a compiled SPARQL query */
export interface ExecutionResult {
  results: ResultRow[]
  sparql: string
  error?: string
}

/** Full search result including LLM interpretation */
export interface SearchResult {
  interpretation: LlmStructuredResponse['interpretation']
  gaps: LlmStructuredResponse['gaps']
  sparql: string
  execution: ExecutionResult
  meta: SearchMeta
}

/** Refine-only search result (no LLM phase) */
export interface RefineResult {
  sparql: string
  execution: ExecutionResult
  meta: SearchMeta
}

/** Metadata about a search execution */
export interface SearchMeta {
  requestId: string
  totalDatasets: number
  matchCount: number
  executionTimeMs: number
  timings: { stage: string; durationMs: number }[]
}

/** Options for a full NL search */
export interface NlSearchOptions {
  query: string
  domain?: string
  signal?: AbortSignal
}

/** Options for a refine (slot-based) search */
export interface RefineOptions {
  slots: SearchSlots
  signal?: AbortSignal
}

/**
 * Flatten SPARQL bindings into plain string records.
 * Extracts only the `.value` field from each RDF term.
 */
function flattenBindings(bindings: SparqlBinding[]): ResultRow[] {
  return bindings.map((binding) => {
    const row: ResultRow = {}
    for (const [key, term] of Object.entries(binding)) {
      row[key] = term.value
    }
    return row
  })
}

/**
 * Execute a SPARQL query through the policy layer and store.
 * Returns results or a policy/execution error.
 */
async function executeSparql(sparql: string, logger: RequestLogger): Promise<ExecutionResult> {
  const policy = enforceSparqlPolicy(sparql)

  if (!policy.allowed) {
    logger.warn('SPARQL policy violation', { violations: policy.violations })
    return {
      results: [],
      sparql,
      error: `Query policy violation: ${policy.violations.join('; ')}`,
    }
  }

  try {
    const endQuery = logger.time('sparql-execution')
    const store = await getInitializedStore()
    const sparqlResults = await store.query(policy.query)
    endQuery()

    return {
      results: flattenBindings(sparqlResults.results.bindings),
      sparql: policy.query,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'SPARQL execution failed'
    logger.error('SPARQL execution failed', err)
    return { results: [], sparql: policy.query, error: message }
  }
}

/**
 * Count total datasets across all registered asset domains.
 * Non-critical: returns 0 on failure.
 */
async function countTotalDatasets(logger: RequestLogger): Promise<number> {
  try {
    const store = await getInitializedStore()
    const countQueries = await compileAllCountQueries()
    let total = 0

    for (const { query: countSparql } of countQueries) {
      const countResult = await store.query(countSparql)
      const countBinding = countResult.results.bindings[0]
      if (countBinding?.count) {
        total += parseInt(countBinding.count.value, 10)
      }
    }

    return total
  } catch (err) {
    logger.warn('Failed to count total datasets', { error: String(err) })
    return 0
  }
}

/**
 * Build meta information from logger state.
 */
function buildMeta(
  requestId: string,
  matchCount: number,
  totalDatasets: number,
  logger: RequestLogger
): SearchMeta {
  return {
    requestId,
    totalDatasets,
    matchCount,
    executionTimeMs: logger.getTotalMs(),
    timings: logger.getTimings(),
  }
}

/**
 * Full natural-language search pipeline:
 * init → LLM interpretation → compile → policy-check → execute → count
 */
export async function searchNl(options: NlSearchOptions): Promise<SearchResult> {
  const { query, domain, signal } = options
  const requestId = generateRequestId()
  const logger = new RequestLogger({ requestId, query })

  // Ensure store is ready
  const endStoreInit = logger.time('store-init')
  await getInitializedStore()
  endStoreInit()

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  // LLM interpretation (generates slots → compiles → returns SPARQL)
  const endLlm = logger.time('llm-interpretation')
  const structured = await generateStructuredSearch(query, { domain })
  endLlm()

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  // Execute the generated SPARQL
  const execution = await executeSparql(structured.sparql, logger)

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  // Count total datasets (non-critical)
  const totalDatasets = await countTotalDatasets(logger)

  const meta = buildMeta(requestId, execution.results.length, totalDatasets, logger)
  logger.info('Search completed', { matchCount: meta.matchCount, totalDatasets })

  return {
    interpretation: structured.interpretation,
    gaps: structured.gaps,
    sparql: structured.sparql,
    execution,
    meta,
  }
}

/**
 * Refine search pipeline (no LLM):
 * compile pre-filled slots → policy-check → execute
 */
export async function searchRefine(options: RefineOptions): Promise<RefineResult> {
  const { slots, signal } = options
  const requestId = generateRequestId()
  const logger = new RequestLogger({ requestId })

  // Compile slots to SPARQL
  const endCompile = logger.time('compile-slots')
  const sparql = await compileSlots(slots)
  endCompile()

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  // Execute
  const execution = await executeSparql(sparql, logger)

  const meta = buildMeta(requestId, execution.results.length, 0, logger)
  logger.info('Refine completed', { matchCount: meta.matchCount })

  return { sparql, execution, meta }
}
