import { SSE_EVENT } from '@ontology-search/core/sse/events'
import type { SearchSlots } from '@ontology-search/slots/slots'
import { useCallback, useRef, useState } from 'react'

import type {
  OntologyGap,
  QueryInterpretation,
  RefineResponse,
  RowTraceability,
  SearchMeta,
} from '../api-types'
import { apiPost, apiPostStream, isAbortError } from '../lib/api-client'
import { parseSSEBuffer } from '../lib/sse-parser'

export type SearchPhase = 'idle' | 'interpreting' | 'executing' | 'done'

export interface SearchState {
  interpretation: QueryInterpretation | null
  gaps: OntologyGap[] | null
  sparql: string | null
  graphql: string | null
  /**
   * The validated slot IR the server compiled, streamed over SSE. This is the
   * editable representation the refine round-trip posts back — the search
   * analog of the authoring scene IR.
   */
  slots: SearchSlots | null
  results: Record<string, string>[] | null
  /**
   * Per-row traceability, aligned by index with `results`. Present when the
   * query contained a cross-reference JOIN; each entry maps a referenced-asset
   * variable (`refAsset`, `refAsset1`, …) to that reference's breadcrumb. UI
   * components render each under the matching reference pill.
   */
  traceability: RowTraceability[] | null
  meta: SearchMeta | null
  phase: SearchPhase
  loading: boolean
  error: string | null
}

/**
 * Hook encapsulating the entire search execution lifecycle:
 * - SSE streaming for the initial natural-language search
 * - Direct POST for the refine (slot-based re-query) path
 * - Abort handling for concurrent requests
 */
export function useSearchExecution(_availableDomains?: string[]) {
  const [state, setState] = useState<SearchState>({
    interpretation: null,
    gaps: null,
    sparql: null,
    graphql: null,
    slots: null,
    results: null,
    traceability: null,
    meta: null,
    phase: 'idle',
    loading: false,
    error: null,
  })

  const abortControllerRef = useRef<AbortController | null>(null)

  const handleSearch = useCallback(async (naturalLanguageQuery: string) => {
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setState({
      interpretation: null,
      gaps: null,
      sparql: null,
      graphql: null,
      slots: null,
      results: null,
      traceability: null,
      meta: null,
      phase: 'interpreting',
      loading: true,
      error: null,
    })

    try {
      const res = await apiPostStream(
        '/api/search/stream',
        { query: naturalLanguageQuery },
        {
          signal: controller.signal,
        }
      )

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''
      let pendingEvent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const result = parseSSEBuffer(buffer, pendingEvent)
        buffer = result.remainder
        pendingEvent = result.pendingEvent

        for (const { event, data } of result.events) {
          switch (event) {
            case SSE_EVENT.STATUS:
              setState((s) => ({ ...s, phase: (data as { phase: SearchPhase }).phase }))
              break
            case SSE_EVENT.INTERPRETATION:
              setState((s) => ({ ...s, interpretation: data as QueryInterpretation }))
              break
            case SSE_EVENT.GAPS:
              setState((s) => ({ ...s, gaps: data as OntologyGap[] }))
              break
            case SSE_EVENT.SPARQL:
              setState((s) => ({ ...s, sparql: data as string }))
              break
            case SSE_EVENT.GRAPHQL:
              setState((s) => ({ ...s, graphql: data as string }))
              break
            case SSE_EVENT.SLOTS:
              setState((s) => ({ ...s, slots: data as SearchSlots }))
              break
            case SSE_EVENT.RESULTS: {
              const resultData = data as {
                results: Record<string, string>[]
                traceability?: RowTraceability[]
                error?: string
              }
              setState((s) => ({
                ...s,
                results: resultData.results,
                traceability: resultData.traceability ?? null,
                error: resultData.error ?? s.error,
              }))
              break
            }
            case SSE_EVENT.META:
              setState((s) => ({ ...s, meta: data as SearchMeta }))
              break
            case SSE_EVENT.DONE:
              setState((s) => ({ ...s, phase: 'done' }))
              break
            case SSE_EVENT.ERROR:
              setState((s) => ({ ...s, error: (data as { message: string }).message }))
              break
          }
        }
      }
    } catch (err) {
      if (isAbortError(err) || abortControllerRef.current !== controller) return
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'An unexpected error occurred',
      }))
    } finally {
      // Only the still-current request may finalize the shared state. A superseded
      // request (aborted because a newer search started) must not flip loading/phase.
      if (abortControllerRef.current === controller) {
        setState((s) => ({ ...s, loading: false, phase: 'done' }))
      }
    }
  }, [])

  /**
   * Re-run against edited slots.
   *
   * `slots` is the server's own validated IR with the user's edits applied —
   * never a reconstruction. The previous implementation rebuilt it by
   * regex-scraping `interpretation.mappedTerms[].mapped`, a human-readable
   * display string: multi-valued filters collapsed to a single string,
   * references were dropped entirely, and a reworded interpretation silently
   * changed the query.
   */
  const handleRefine = useCallback(async (edited: SearchSlots) => {
    setState((s) => ({
      ...s,
      loading: true,
      error: null,
      results: null,
      traceability: null,
      meta: null,
      phase: 'executing',
      slots: edited,
    }))

    try {
      const slots = edited

      const data = await apiPost<RefineResponse>('/api/search/refine', { slots })

      setState((s) => ({
        ...s,
        sparql: data.sparql,
        graphql: data.graphql ?? null,
        slots: data.slots,
        results: data.results,
        traceability: data.traceability ?? null,
        meta: data.meta,
        phase: 'done',
      }))
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'Refine failed',
      }))
    } finally {
      setState((s) => ({ ...s, loading: false, phase: 'done' }))
    }
  }, [])

  const handleGraphQLRun = useCallback(async (graphqlQuery: string) => {
    setState((s) => ({
      ...s,
      loading: true,
      error: null,
      results: null,
      traceability: null,
      meta: null,
      phase: 'executing',
    }))

    try {
      // Parse GraphQL back to slots via the API
      const data = await apiPost<RefineResponse>('/api/search/refine-graphql', {
        graphql: graphqlQuery,
      })

      setState((s) => ({
        ...s,
        sparql: data.sparql,
        graphql: data.graphql ?? graphqlQuery,
        // The slots the GraphQL document parsed to. Without adopting them the
        // refinement panel would still show the PREVIOUS query's IR, and a
        // re-run would silently execute that instead of what the user wrote.
        slots: data.slots,
        results: data.results,
        traceability: data.traceability ?? null,
        meta: data.meta,
        phase: 'done',
      }))
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'GraphQL execution failed',
      }))
    } finally {
      setState((s) => ({ ...s, loading: false, phase: 'done' }))
    }
  }, [])

  return { ...state, handleSearch, handleRefine, handleGraphQLRun }
}
