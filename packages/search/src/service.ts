/**
 * Unified Search Service — single orchestration layer for all search operations.
 *
 * Architecture:
 * - SearchService class with constructor-injected dependencies (Dependency Inversion)
 * - No global state — all external I/O accessed through typed interfaces
 * - Module-level factory provides production wiring; tests inject mocks directly
 *
 * Responsibilities:
 * 1. Full NL search: init → LLM interpret → compile → policy → execute → count
 * 2. Refine search: init → compile pre-filled slots → policy → execute
 */
import { generateRequestId, RequestLogger } from '@ontology-search/core/logging'
import type { PolicyResult } from '@ontology-search/sparql/policy'
import type { SparqlBinding, SparqlStore } from '@ontology-search/sparql/types'

import type { SearchSlots } from './slots.js'
import type { LlmStructuredResponse } from './types.js'

// ─── Dependency Interfaces ───────────────────────────────────────────────────

/** External dependencies required by SearchService */
export interface SearchDependencies {
  /** Resolve the initialized SPARQL store (handles lazy init + data loading) */
  getStore: () => Promise<SparqlStore>
  /** Translate natural language → structured interpretation + SPARQL */
  interpretQuery: (
    query: string,
    options: { domain?: string; signal?: AbortSignal }
  ) => Promise<LlmStructuredResponse>
  /** Compile search slots into a SPARQL query string */
  compileSlots: (slots: SearchSlots) => Promise<string>
  /** Compile count queries for all registered asset domains */
  compileCountQueries: () => Promise<{ domain: string; query: string }[]>
  /** Validate a SPARQL query against security policy */
  enforcePolicy: (sparql: string) => PolicyResult & { query: string }
  /**
   * Apply ontology-level SHACL validation to refine-path slots, dropping
   * any value that violates a declared constraint. The LLM agent path runs
   * SHACL validation itself; this dependency closes the same gap for any
   * caller that supplies pre-filled slots directly. Optional — when omitted,
   * slots flow through unchanged (matches the pre-Phase-1 behaviour).
   */
  validateSlots?: (slots: SearchSlots) => Promise<SearchSlots>
}

// ─── Result Types ────────────────────────────────────────────────────────────

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

// ─── Service Implementation ──────────────────────────────────────────────────

/**
 * SearchService encapsulates the search orchestration logic.
 * All external dependencies are injected via the constructor — no global state.
 *
 * Usage:
 *   const service = new SearchService(deps)
 *   const result = await service.searchNl({ query: '...' })
 *
 * Testing:
 *   const service = new SearchService({ getStore: async () => mockStore, ... })
 */
export class SearchService {
  private readonly deps: SearchDependencies

  constructor(deps: SearchDependencies) {
    this.deps = deps
  }

  /**
   * Full natural-language search pipeline:
   * init → LLM interpretation → policy-check → execute → count
   */
  async searchNl(options: NlSearchOptions): Promise<SearchResult> {
    const { query, domain, signal } = options
    const requestId = generateRequestId()
    const logger = new RequestLogger({ requestId, query })

    // Ensure store is ready
    const endStoreInit = logger.time('store-init')
    await this.deps.getStore()
    endStoreInit()

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    // LLM interpretation (generates slots → compiles → returns SPARQL)
    const endLlm = logger.time('llm-total')
    const structured = await this.deps.interpretQuery(query, { domain, signal })
    endLlm()

    // Merge LLM sub-timings into the logger's timing list
    if (structured.timings) {
      logger.addTimings(
        structured.timings.map((t) => ({ stage: `llm/${t.stage}`, durationMs: t.durationMs }))
      )
    }

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    // Execute SPARQL and count total datasets in parallel (count is non-critical)
    const [execution, totalDatasets] = await Promise.all([
      this.executeSparql(structured.sparql, logger, signal),
      this.countTotalDatasets(logger, signal),
    ])

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const meta = this.buildMeta(requestId, execution.results.length, totalDatasets, logger)
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
  async searchRefine(options: RefineOptions): Promise<RefineResult> {
    const { slots, signal } = options
    const requestId = generateRequestId()
    const logger = new RequestLogger({ requestId })

    // SHACL validation — defense-in-depth gate for callers that bypass the
    // LLM agent (e.g. the /refine API). Drops any value that violates a
    // declared SHACL constraint so it never reaches SPARQL compilation.
    const endValidate = logger.time('shacl-validation')
    const validatedSlots = this.deps.validateSlots ? await this.deps.validateSlots(slots) : slots
    endValidate()

    // Compile slots to SPARQL
    const endCompile = logger.time('compile-slots')
    const sparql = await this.deps.compileSlots(validatedSlots)
    endCompile()

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    // Execute
    const execution = await this.executeSparql(sparql, logger, signal)

    const meta = this.buildMeta(requestId, execution.results.length, 0, logger)
    logger.info('Refine completed', { matchCount: meta.matchCount })

    return { sparql, execution, meta }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  /**
   * Execute a SPARQL query through the policy layer and store.
   * Returns results or a policy/execution error.
   */
  private async executeSparql(
    sparql: string,
    logger: RequestLogger,
    signal?: AbortSignal
  ): Promise<ExecutionResult> {
    const policy = this.deps.enforcePolicy(sparql)

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
      const store = await this.deps.getStore()
      const sparqlResults = await store.query(policy.query, { signal })
      endQuery()

      return {
        results: this.flattenBindings(sparqlResults.results.bindings),
        sparql: policy.query,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'SPARQL execution failed'
      logger.error('SPARQL execution failed', err)
      return { results: [], sparql: policy.query, error: message }
    }
  }

  /**
   * Flatten SPARQL bindings into plain string records.
   * Extracts only the `.value` field from each RDF term.
   */
  private flattenBindings(bindings: SparqlBinding[]): ResultRow[] {
    return bindings.map((binding) => {
      const row: ResultRow = {}
      for (const [key, term] of Object.entries(binding)) {
        row[key] = term.value
      }
      return row
    })
  }

  /**
   * Count total datasets across all registered asset domains.
   * Non-critical: returns 0 on failure.
   */
  private async countTotalDatasets(logger: RequestLogger, signal?: AbortSignal): Promise<number> {
    const endCount = logger.time('dataset-count')
    try {
      const store = await this.deps.getStore()
      const countQueries = await this.deps.compileCountQueries()
      let total = 0

      for (const { query: countSparql } of countQueries) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
        const countResult = await store.query(countSparql, { signal })
        const countBinding = countResult.results.bindings[0]
        if (countBinding?.count) {
          total += parseInt(countBinding.count.value, 10)
        }
      }

      endCount()
      return total
    } catch (err) {
      endCount()
      // Propagate aborts so the caller stops the pipeline; swallow other
      // errors (count is best-effort metadata, not on the critical path).
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      logger.warn('Failed to count total datasets', { error: String(err) })
      return 0
    }
  }

  private buildMeta(
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
}

// Factory functions (getSearchService, searchNl, searchRefine) are in factory.ts
// to avoid import dependency on @ontology-search/llm in test contexts.
