import type { AuthoringIR } from '@ontology-search/authoring-ir'
import { SSE_EVENT } from '@ontology-search/core/sse/events'
import { useCallback, useRef, useState } from 'react'

import type {
  AuthoringMeta,
  AuthoringRefineResponse,
  AuthoringValidation,
  GateTrace,
  OntologyGap,
  QueryInterpretation,
  SceneGap,
} from '../api-types'
import { apiPost, apiPostStream, isAbortError } from '../lib/api-client'
import { parseSSEBuffer } from '../lib/sse-parser'

export type AuthoringPhase = 'idle' | 'authoring' | 'repairing' | 'done'

export interface AuthoringState {
  /** The model's interpretation of the natural-language authoring request. */
  interpretation: QueryInterpretation | null
  /** The filled scene IR — the LLM's only output; editable, drives the `.xosc`. */
  scene: AuthoringIR | null
  /** The emitted OpenSCENARIO document — read-only (derived from {@link scene}). */
  xosc: string | null
  /** Outstanding pipeline gaps from the final pass. */
  gaps: SceneGap[] | null
  /** Concepts the model self-reported it could not express in the IR. */
  reportedGaps: OntologyGap[] | null
  /** Per-gate verdicts (semantic → structural → residual) of the final pass. */
  trace: GateTrace[] | null
  /** Whether the final pass passed the semantic + structural gates. */
  valid: boolean | null
  /** Number of LLM authoring turns performed (1 + repairs used). */
  attempts: number | null
  phase: AuthoringPhase
  /** Human-readable status of the current phase (e.g. "Repairing scene…"). */
  statusMessage: string | null
  loading: boolean
  error: string | null
}

const INITIAL_STATE: AuthoringState = {
  interpretation: null,
  scene: null,
  xosc: null,
  gaps: null,
  reportedGaps: null,
  trace: null,
  valid: null,
  attempts: null,
  phase: 'idle',
  statusMessage: null,
  loading: false,
  error: null,
}

/**
 * Hook encapsulating the authoring execution lifecycle — the authoring analog
 * of {@link ../hooks/useSearchExecution useSearchExecution}:
 * - SSE streaming for the natural-language authoring loop (`/author/stream`)
 * - Direct POST for the IR-direct refine path (`/author/refine`, no LLM)
 * - Abort handling so a superseded request never finalizes shared state
 */
export function useAuthoringExecution() {
  const [state, setState] = useState<AuthoringState>(INITIAL_STATE)
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleAuthor = useCallback(async (query: string, archetype?: string) => {
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setState({
      ...INITIAL_STATE,
      phase: 'authoring',
      statusMessage: 'Authoring scene…',
      loading: true,
    })

    try {
      const res = await apiPostStream(
        '/api/author/stream',
        archetype ? { query, archetype } : { query },
        { signal: controller.signal }
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
            case SSE_EVENT.STATUS: {
              const status = data as { phase: 'authoring' | 'repairing'; message: string }
              setState((s) => ({ ...s, phase: status.phase, statusMessage: status.message }))
              break
            }
            case SSE_EVENT.INTERPRETATION:
              setState((s) => ({ ...s, interpretation: data as QueryInterpretation }))
              break
            case SSE_EVENT.VALIDATION: {
              const v = data as AuthoringValidation
              setState((s) => ({ ...s, trace: v.trace, gaps: v.gaps, valid: v.valid }))
              break
            }
            case SSE_EVENT.SCENE:
              setState((s) => ({ ...s, scene: data as AuthoringIR }))
              break
            case SSE_EVENT.XOSC:
              setState((s) => ({ ...s, xosc: (data as { xosc: string }).xosc }))
              break
            case SSE_EVENT.GAPS:
              setState((s) => ({ ...s, gaps: data as SceneGap[] }))
              break
            case SSE_EVENT.META: {
              const meta = data as AuthoringMeta
              setState((s) => ({
                ...s,
                valid: meta.valid,
                attempts: meta.attempts,
                reportedGaps: meta.reportedGaps,
                trace: meta.trace,
              }))
              break
            }
            case SSE_EVENT.DONE:
              setState((s) => ({ ...s, phase: 'done', statusMessage: null }))
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
      // Only the still-current request may finalize the shared state. A
      // superseded request (aborted because a newer author started) must not
      // flip loading/phase out from under the request that replaced it.
      if (abortControllerRef.current === controller) {
        setState((s) => ({ ...s, loading: false, phase: 'done', statusMessage: null }))
      }
    }
  }, [])

  /**
   * Re-gate + re-lower an edited scene IR with NO LLM — the security-equivalent
   * of the search feature's slot refine. The IR is editable; the returned
   * `.xosc` is read-only (derived).
   */
  const handleRefine = useCallback(async (scene: AuthoringIR, roadNetworkXodr?: string) => {
    setState((s) => ({ ...s, loading: true, error: null, phase: 'authoring', scene }))

    try {
      const data = await apiPost<AuthoringRefineResponse>('/api/author/refine', {
        scene,
        ...(roadNetworkXodr ? { roadNetworkXodr } : {}),
      })

      setState((s) => ({
        ...s,
        xosc: data.xosc ?? null,
        gaps: data.gaps,
        trace: data.trace,
        valid: data.valid,
        phase: 'done',
      }))
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'Refine failed',
      }))
    } finally {
      setState((s) => ({ ...s, loading: false, phase: 'done', statusMessage: null }))
    }
  }, [])

  return { ...state, handleAuthor, handleRefine }
}
