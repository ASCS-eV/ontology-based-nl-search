import { SSE_EVENT } from '@ontology-search/core/sse/events'
import { useCallback, useRef, useState } from 'react'

import type {
  MappedTerm,
  OntologyGap,
  QueryInterpretation,
  ResultTraceStep,
  SearchMeta,
} from '../api-types'
import { parseSSEBuffer } from '../lib/sse-parser'

export type SearchPhase = 'idle' | 'interpreting' | 'executing' | 'done'

export interface SearchState {
  interpretation: QueryInterpretation | null
  gaps: OntologyGap[] | null
  sparql: string | null
  results: Record<string, string>[] | null
  /**
   * Per-row traceability breadcrumb. Aligned by index with `results`.
   * Present when the query contained a cross-reference JOIN (the
   * compiler emits a `TraceabilityPlan` which the service expands per
   * row). UI components render this as a breadcrumb under the row.
   */
  traceability: ResultTraceStep[][] | null
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
      results: null,
      traceability: null,
      meta: null,
      phase: 'interpreting',
      loading: true,
      error: null,
    })

    try {
      const res = await fetch('/api/search/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: naturalLanguageQuery }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Search failed')
      }

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
            case SSE_EVENT.RESULTS: {
              const resultData = data as {
                results: Record<string, string>[]
                traceability?: ResultTraceStep[][]
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
      if (err instanceof Error && err.name === 'AbortError') return
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

      const res = await fetch('/api/search/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Refine failed')
      }

      const data = await res.json()
      setState((s) => ({
        ...s,
        sparql: data.sparql,
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

  return { ...state, handleSearch, handleRefine }
}
