import { SSE_EVENT } from '@ontology-search/core/sse/events'
import { useCallback, useRef, useState } from 'react'

import type {
  MappedTerm,
  OntologyGap,
  QueryInterpretation,
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

function isNumericRange(mapped: string): boolean {
  return /[><=]\s*\d/.test(mapped) || /\d+\s*[-–]\s*\d+/.test(mapped)
}

function parseRange(mapped: string): { min?: number; max?: number } {
  const geMatch = mapped.match(/>=?\s*(\d+(?:\.\d+)?)/)
  const leMatch = mapped.match(/<=?\s*(\d+(?:\.\d+)?)/)
  const rangeMatch = mapped.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/)

  if (rangeMatch) {
    return { min: Number(rangeMatch[1]), max: Number(rangeMatch[2]) }
  }
  const result: { min?: number; max?: number } = {}
  if (geMatch) result.min = Number(geMatch[1])
  if (leMatch) result.max = Number(leMatch[1])
  return result
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
      if (isAbortError(err)) return
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'An unexpected error occurred',
      }))
    } finally {
      setState((s) => ({ ...s, loading: false, phase: 'done' }))
    }
  }, [])

  const handleRefine = useCallback(async (updatedTerms: MappedTerm[], updatedDomains: string[]) => {
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
      const filters: Record<string, string> = {}
      const ranges: Record<string, { min?: number; max?: number }> = {}

      // Task 21d-flat: every mapped term — geography, license, plain
      // enums — flows through the same `filters` map keyed by SHACL
      // leaf local name. The compiler walks the discovered property
      // path for each key; no client-side knowledge of which fields
      // are "location" is needed.
      for (const term of updatedTerms) {
        if (term.property && term.mapped) {
          if (isNumericRange(term.mapped)) {
            ranges[term.property] = parseRange(term.mapped)
          } else {
            filters[term.property] = term.mapped
          }
        }
      }

      // Empty domains = search all domains (cross-domain query)
      const domains = updatedDomains

      const slots = {
        domains,
        filters,
        ranges,
      }

      const data = await apiPost<{
        sparql: string
        graphql?: string
        results: Record<string, string>[]
        traceability?: RowTraceability[]
        meta: SearchMeta
      }>('/api/search/refine', { slots })

      setState((s) => ({
        ...s,
        sparql: data.sparql,
        graphql: data.graphql ?? null,
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
      const data = await apiPost<{
        sparql: string
        graphql?: string
        results: Record<string, string>[]
        traceability?: RowTraceability[]
        meta: SearchMeta
      }>('/api/search/refine-graphql', { graphql: graphqlQuery })

      setState((s) => ({
        ...s,
        sparql: data.sparql,
        graphql: data.graphql ?? graphqlQuery,
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
