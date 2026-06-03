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
import type { TimingEntry } from '@ontology-search/core/logging'
import { generateRequestId, RequestLogger } from '@ontology-search/core/logging'
import type { PolicyResult } from '@ontology-search/sparql/policy'
import type { SparqlBinding, SparqlStore } from '@ontology-search/sparql/types'

import type { CompileResult, SearchSlots, TraceabilityPlan } from './slots.js'
import type {
  LlmStructuredResponse,
  ResultRow,
  ResultTraceStep,
  RowTraceability,
  SearchMeta as WireSearchMeta,
} from './types.js'

// Re-export the wire row/step types so any intra-package reference keeps
// resolving from here, while the single declaration lives in api-types.
export type { ResultRow, ResultTraceStep }

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
  /**
   * Compile search slots into a SPARQL query and (when the query
   * contains a cross-reference JOIN) a traceability plan the service
   * uses to attach a per-row breadcrumb. Production wires this to
   * `compileSlotsWithTrace`; tests typically supply a stub returning
   * just `{ sparql }`.
   */
  compileSlots: (slots: SearchSlots) => Promise<CompileResult>
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

/** Result of executing a compiled SPARQL query */
export interface ExecutionResult {
  results: ResultRow[]
  /**
   * Per-row traceability, aligned by index with `results`. Present iff the
   * compiled query carried reference `TraceabilityPlan`s. Each entry maps a
   * referenced-asset variable (`refAsset`, `refAsset1`, …) to the steps the
   * JOIN walked from `?asset` to that reference — UI clients render each as a
   * breadcrumb under the matching reference pill.
   */
  traceability?: RowTraceability[]
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

/**
 * Metadata about a search execution. Single-sourced from the wire
 * {@link WireSearchMeta} (api-types) so the server and web client cannot drift;
 * tightened only in that the server ALWAYS populates `timings` (optional on the
 * wire). Assignable to the wire type, so route responses can `satisfies` it.
 */
export interface SearchMeta extends WireSearchMeta {
  timings: TimingEntry[]
}

/** Progress event emitted during incremental search phases. */
export interface SearchProgress {
  phase: 'store-ready' | 'interpreting' | 'interpreted' | 'executing' | 'done'
  /** Partial result data available at this phase. */
  data?: Partial<Pick<SearchResult, 'interpretation' | 'gaps' | 'sparql'>>
}

/** Options for a full NL search */
export interface NlSearchOptions {
  query: string
  domain?: string
  signal?: AbortSignal
  /**
   * Correlation id from the upstream HTTP middleware. When supplied, the
   * service adopts it so the requestId in response headers, SSE meta
   * events, and server-side logs all match. When omitted (CLI / library
   * use), a fresh id is generated.
   */
  requestId?: string
  /**
   * Optional progress callback invoked at each pipeline phase boundary.
   * Enables incremental SSE streaming — the route can emit events as soon
   * as each phase completes rather than waiting for the full pipeline.
   */
  onProgress?: (progress: SearchProgress) => Promise<void> | void
}

/** Options for a refine (slot-based) search */
export interface RefineOptions {
  slots: SearchSlots
  signal?: AbortSignal
  /** See {@link NlSearchOptions.requestId}. */
  requestId?: string
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
   *
   * When `onProgress` is provided, emits incremental phase events so the
   * caller (e.g. SSE route) can push partial results to the client
   * without waiting for the full pipeline to complete.
   */
  async searchNl(options: NlSearchOptions): Promise<SearchResult> {
    const { query, domain, signal, onProgress } = options
    const requestId = options.requestId ?? generateRequestId()
    const logger = new RequestLogger({ requestId, query })

    // Ensure store is ready
    const endStoreInit = logger.time('store-init')
    await this.deps.getStore()
    endStoreInit()

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    await onProgress?.({ phase: 'interpreting' })

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

    // Emit interpretation as soon as it's available (before SPARQL execution)
    await onProgress?.({
      phase: 'interpreted',
      data: {
        interpretation: structured.interpretation,
        gaps: structured.gaps,
        sparql: structured.sparql,
      },
    })

    await onProgress?.({ phase: 'executing' })

    // Execute SPARQL and count total datasets in parallel (count is non-critical).
    // The LLM agent already compiled the SPARQL upstream; if it threaded
    // a traceability plan through `structured.trace`, the executor uses
    // it to attach per-row breadcrumbs.
    const [execution, totalDatasets] = await Promise.all([
      this.executeSparql(structured.sparql, structured.trace, logger, signal),
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
    const requestId = options.requestId ?? generateRequestId()
    const logger = new RequestLogger({ requestId })

    // SHACL validation — defense-in-depth gate for callers that bypass the
    // LLM agent (e.g. the /refine API). Drops any value that violates a
    // declared SHACL constraint so it never reaches SPARQL compilation.
    const endValidate = logger.time('shacl-validation')
    const validatedSlots = this.deps.validateSlots ? await this.deps.validateSlots(slots) : slots
    endValidate()

    // Compile slots to SPARQL — capture trace plan when present so the
    // executor can attach per-row breadcrumbs.
    const endCompile = logger.time('compile-slots')
    const { sparql, trace } = await this.deps.compileSlots(validatedSlots)
    endCompile()

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    // Execute
    const execution = await this.executeSparql(sparql, trace, logger, signal)

    const meta = this.buildMeta(requestId, execution.results.length, 0, logger)
    logger.info('Refine completed', { matchCount: meta.matchCount })

    return { sparql, execution, meta }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  /**
   * Execute a SPARQL query through the policy layer and store.
   * Returns results or a policy/execution error. When `trace` is
   * supplied, also assembles a per-row traceability breadcrumb by
   * reading the plan's step variables from each binding.
   */
  private async executeSparql(
    sparql: string,
    trace: TraceabilityPlan[] | undefined,
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
        traceability:
          trace && trace.length > 0
            ? this.assembleTraceability(sparqlResults.results.bindings, trace)
            : undefined,
        sparql: policy.query,
      }
    } catch (err) {
      // Aborts must propagate so the SSE handler can shut the stream
      // cleanly instead of surfacing a generic execution failure.
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      // The execution failed for non-abort reasons (store unreachable,
      // malformed query). We surface a stable, opaque error string here —
      // the route layer treats this as a boolean signal and never echoes
      // the raw message to the client, so leaking `err.message` would only
      // create a coupling between library wording and the response shape.
      logger.error('SPARQL execution failed', err)
      return { results: [], sparql: policy.query, error: 'SPARQL execution failed' }
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
   * Walk every reference's trace plan against each row's binding to build a
   * per-row, per-reference breadcrumb map keyed by each plan's
   * `targetVariable` (`refAsset`, `refAsset1`, …). Steps whose variable isn't
   * bound in the row are skipped — a normal outcome for `OPTIONAL`-flavoured
   * patterns. A plan that contributes no steps for a row adds no key, so the
   * UI only renders breadcrumbs that actually resolved.
   */
  private assembleTraceability(
    bindings: SparqlBinding[],
    traces: TraceabilityPlan[]
  ): RowTraceability[] {
    return bindings.map((binding) => {
      const row: RowTraceability = {}
      for (const plan of traces) {
        const steps: ResultTraceStep[] = []
        for (const planStep of plan.steps) {
          const term = binding[planStep.variable]
          if (!term) continue
          steps.push({ predicate: planStep.predicate, intermediate: term.value })
        }
        if (steps.length > 0) row[plan.targetVariable] = steps
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
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

      // Run the per-domain COUNT queries concurrently rather than serially.
      // They are independent and the total is order-independent, so a serial
      // `for await` needlessly turned N store round-trips into N sequential
      // ones — on a remote store (Fuseki) that is N RTTs where one overlap
      // would do. Each query still carries the abort signal so a client
      // disconnect cancels every in-flight count.
      const counts = await Promise.all(
        countQueries.map(async ({ query: countSparql }) => {
          const countResult = await store.query(countSparql, { signal })
          const countBinding = countResult.results.bindings[0]
          return countBinding?.count ? parseInt(countBinding.count.value, 10) : 0
        })
      )

      endCount()
      return counts.reduce((sum, n) => sum + n, 0)
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
