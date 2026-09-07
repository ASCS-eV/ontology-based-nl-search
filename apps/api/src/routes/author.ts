/**
 * Authoring routes — NL → validated OpenSCENARIO `.xosc`, the authoring analog
 * of `routes/search.ts`.
 *
 *   POST /author/stream  — SSE. Natural-language authoring: the LLM fills the
 *                          scene IR, the deterministic pipeline gates + lowers
 *                          it, and the bounded repair loop iterates. Streams
 *                          progress, the IR, the emitted `.xosc`, and the
 *                          per-gate validation.
 *   POST /author/refine  — JSON. IR-direct authoring: a pre-filled/edited scene
 *                          IR is gated + lowered with NO LLM. This is the
 *                          security-equivalent of `/search/refine` — the IR is
 *                          editable, the `.xosc` is read-only (derived).
 *
 * STANDARDS — the stream is a `text/event-stream` per
 *   [SSE] Server-Sent Events — docs/specs/references/eventsource.md §9.
 * The refine body is the authoring IR wire format, held to
 *   [JSON-SCHEMA-CORE] JSON Schema 2020-12 (packages/authoring-ir).
 */

import type { AuthoringRefineResponse } from '@ontology-search/api-types'
import type { AuthoringIR } from '@ontology-search/authoring-ir'
import { authoringIrWireSchema } from '@ontology-search/authoring-ir/scene-wire-schema'
import { AppError, badRequest, internalError, unprocessable } from '@ontology-search/core/errors'
import { REQUEST_ID_HEADER, RequestLogger } from '@ontology-search/core/logging'
import { SSE_EVENT } from '@ontology-search/core/sse/events'
import { runSceneAgent, runScenePipeline } from '@ontology-search/llm/authoring'
import { Hono } from 'hono'

import type { AppEnv } from '../types.js'
import { handleStreamRoute } from './stream-handler.js'

export const authoringRoutes = new Hono<AppEnv>()

/**
 * Streaming NL authoring: SSE endpoint that progressively emits the model's
 * interpretation, the authored IR, the emitted `.xosc`, and the per-gate
 * validation across repair attempts.
 */
authoringRoutes.post('/stream', (c) =>
  handleStreamRoute<{ archetype?: string }>(c, {
    label: 'Authoring stream',
    errorMessage: 'Authoring failed',
    parseBody: (raw) => {
      const archetype = raw['archetype']
      if (archetype !== undefined && typeof archetype !== 'string') {
        return badRequest('"archetype" must be a string')
      }
      return archetype === undefined ? {} : { archetype }
    },
    handler: async ({ query, body, signal, logger, emit }) => {
      const { archetype } = body
      logger.info('Authoring stream started', { archetype })

      const result = await runSceneAgent(query, {
        ...(archetype ? { archetype } : {}),
        signal,
        onProgress: async (progress) => {
          if (signal.aborted) return
          switch (progress.phase) {
            case 'authoring':
              await emit(SSE_EVENT.STATUS, { phase: 'authoring', message: 'Authoring scene…' })
              break
            case 'repairing':
              await emit(SSE_EVENT.STATUS, {
                phase: 'repairing',
                message: `Repairing scene (attempt ${progress.attempt})…`,
              })
              break
            case 'authored':
              if (progress.interpretation) {
                await emit(SSE_EVENT.INTERPRETATION, progress.interpretation)
              }
              break
            case 'gated':
              await emit(SSE_EVENT.VALIDATION, {
                attempt: progress.attempt,
                valid: progress.valid,
                trace: progress.trace,
                gaps: progress.gaps,
              })
              break
          }
        },
      })

      if (signal.aborted) return

      await emit(SSE_EVENT.SCENE, result.ir)
      if (result.xosc !== undefined) await emit(SSE_EVENT.XOSC, { xosc: result.xosc })
      await emit(SSE_EVENT.GAPS, result.gaps)
      await emit(SSE_EVENT.META, {
        valid: result.valid,
        attempts: result.attempts,
        reportedGaps: result.reportedGaps,
        trace: result.trace,
      })
      await emit(SSE_EVENT.DONE, {})

      logger.info('Authoring stream completed', {
        valid: result.valid,
        attempts: result.attempts,
        gapCount: result.gaps.length,
      })
    },
  })
)

/**
 * Refine endpoint: gate + lower a pre-filled/edited scene IR with NO LLM.
 * The `scene` field is validated against the IR wire schema so a hallucinated
 * key or smuggled raw `.xosc` is rejected rather than materialized.
 */
authoringRoutes.post('/refine', async (c) => {
  const requestId = c.get('requestId')
  const logger = new RequestLogger({ requestId })

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    const err = badRequest('Invalid JSON body')
    return c.json(err.body, err.status)
  }

  if (!body || typeof body !== 'object' || !('scene' in body)) {
    const err = badRequest('Missing "scene" field in request body')
    return c.json(err.body, err.status)
  }

  const parsed = authoringIrWireSchema.safeParse((body as { scene: unknown }).scene)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    const err = unprocessable('Invalid scene IR', issues)
    return c.json(err.body, err.status)
  }

  const rawXodr = (body as { roadNetworkXodr?: unknown }).roadNetworkXodr
  if (rawXodr !== undefined && typeof rawXodr !== 'string') {
    const err = badRequest('"roadNetworkXodr" must be a string')
    return c.json(err.body, err.status)
  }

  try {
    logger.info('Authoring refine started')
    const result = await runScenePipeline({
      ir: parsed.data as AuthoringIR,
      ...(typeof rawXodr === 'string' ? { roadNetworkXodr: rawXodr } : {}),
      signal: c.req.raw.signal,
    })

    logger.info('Authoring refine completed', {
      valid: result.valid,
      gapCount: result.gaps.length,
    })

    // Typed against the shared wire contract so the response cannot drift from
    // `AuthoringRefineResponse` (an un-annotated literal previously smuggled a
    // `diagnostics` field the type omitted). [RFC8259] JSON body over [RFC9110].
    const response: AuthoringRefineResponse = {
      ...(result.xosc !== undefined ? { xosc: result.xosc } : {}),
      valid: result.valid,
      gaps: [...result.gaps],
      diagnostics: [...result.diagnostics],
      trace: [...result.trace],
    }
    return c.json(response, 200, { [REQUEST_ID_HEADER]: requestId })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      logger.info('Authoring refine aborted by client')
      return c.body(null, 408)
    }
    // Typed errors carry their own status and an operator-facing message —
    // let the app's onError handler map them instead of flattening every
    // cause into one opaque 500.
    if (error instanceof AppError) throw error
    logger.error('Authoring refine failed', error)
    const err = internalError()
    return c.json(err.body, err.status)
  }
})
