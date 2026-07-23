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

import type { AuthoringIR } from '@ontology-search/authoring-ir'
import { authoringIrWireSchema } from '@ontology-search/authoring-ir/scene-wire-schema'
import { getConfig } from '@ontology-search/core/config'
import { badRequest, internalError, unprocessable } from '@ontology-search/core/errors'
import { REQUEST_ID_HEADER, RequestLogger } from '@ontology-search/core/logging'
import { SSE_EVENT } from '@ontology-search/core/sse/events'
import { runSceneAgent, runScenePipeline } from '@ontology-search/llm/authoring'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

import type { AppEnv } from '../types.js'

export const authoringRoutes = new Hono<AppEnv>()

/**
 * Streaming NL authoring: SSE endpoint that progressively emits the model's
 * interpretation, the authored IR, the emitted `.xosc`, and the per-gate
 * validation across repair attempts.
 */
authoringRoutes.post('/stream', (c) => {
  const requestId = c.get('requestId')
  const streamLogger = new RequestLogger({ requestId })

  // Compose the HTTP request signal and the SSE write-side abort into one
  // signal so a disconnected client cancels the LLM turns and the gates.
  const controller = new AbortController()
  const requestSignal = c.req.raw.signal
  if (requestSignal.aborted) controller.abort()
  else requestSignal.addEventListener('abort', () => controller.abort(), { once: true })

  return streamSSE(
    c,
    async (stream) => {
      stream.onAbort(() => controller.abort())

      let body: { query?: unknown; archetype?: unknown }
      try {
        body = await c.req.json()
      } catch {
        await stream.writeSSE({
          event: SSE_EVENT.ERROR,
          data: JSON.stringify(badRequest('Invalid JSON body').body),
        })
        return
      }

      const { query, archetype } = body
      if (!query || typeof query !== 'string') {
        await stream.writeSSE({
          event: SSE_EVENT.ERROR,
          data: JSON.stringify(badRequest('Missing or invalid "query" field').body),
        })
        return
      }
      if (archetype !== undefined && typeof archetype !== 'string') {
        await stream.writeSSE({
          event: SSE_EVENT.ERROR,
          data: JSON.stringify(badRequest('"archetype" must be a string').body),
        })
        return
      }

      const maxQueryChars = getConfig().API_MAX_QUERY_CHARS
      if (query.length > maxQueryChars) {
        await stream.writeSSE({
          event: SSE_EVENT.ERROR,
          data: JSON.stringify(
            badRequest(`Query too long (${query.length} chars; max ${maxQueryChars}).`).body
          ),
        })
        return
      }

      const logger = new RequestLogger({ requestId, query })
      logger.info('Authoring stream started', { archetype })

      try {
        const result = await runSceneAgent(query, {
          ...(archetype ? { archetype } : {}),
          signal: controller.signal,
          onProgress: async (progress) => {
            if (controller.signal.aborted) return
            switch (progress.phase) {
              case 'authoring':
                await stream.writeSSE({
                  event: SSE_EVENT.STATUS,
                  data: JSON.stringify({ phase: 'authoring', message: 'Authoring scene…' }),
                })
                break
              case 'repairing':
                await stream.writeSSE({
                  event: SSE_EVENT.STATUS,
                  data: JSON.stringify({
                    phase: 'repairing',
                    message: `Repairing scene (attempt ${progress.attempt})…`,
                  }),
                })
                break
              case 'authored':
                if (progress.interpretation) {
                  await stream.writeSSE({
                    event: SSE_EVENT.INTERPRETATION,
                    data: JSON.stringify(progress.interpretation),
                  })
                }
                break
              case 'gated':
                await stream.writeSSE({
                  event: SSE_EVENT.VALIDATION,
                  data: JSON.stringify({
                    attempt: progress.attempt,
                    valid: progress.valid,
                    trace: progress.trace,
                    gaps: progress.gaps,
                  }),
                })
                break
            }
          },
        })

        if (controller.signal.aborted) return

        await stream.writeSSE({ event: SSE_EVENT.SCENE, data: JSON.stringify(result.ir) })
        if (result.xosc !== undefined) {
          await stream.writeSSE({
            event: SSE_EVENT.XOSC,
            data: JSON.stringify({ xosc: result.xosc }),
          })
        }
        await stream.writeSSE({ event: SSE_EVENT.GAPS, data: JSON.stringify(result.gaps) })
        await stream.writeSSE({
          event: SSE_EVENT.META,
          data: JSON.stringify({
            valid: result.valid,
            attempts: result.attempts,
            reportedGaps: result.reportedGaps,
            trace: result.trace,
          }),
        })
        await stream.writeSSE({ event: SSE_EVENT.DONE, data: '{}' })

        logger.info('Authoring stream completed', {
          valid: result.valid,
          attempts: result.attempts,
          gapCount: result.gaps.length,
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          logger.info('Authoring stream aborted by client')
          return
        }
        logger.error('Authoring stream failed', error)
        await stream.writeSSE({
          event: SSE_EVENT.ERROR,
          data: JSON.stringify({ message: 'Authoring failed' }),
        })
      }
    },
    async (err, stream) => {
      streamLogger.error('SSE stream error', err)
      await stream.writeSSE({
        event: SSE_EVENT.ERROR,
        data: JSON.stringify({ message: 'Stream error' }),
      })
    }
  )
})

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

    return c.json(
      {
        xosc: result.xosc,
        valid: result.valid,
        gaps: result.gaps,
        diagnostics: result.diagnostics,
        trace: result.trace,
      },
      200,
      { [REQUEST_ID_HEADER]: requestId }
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      logger.info('Authoring refine aborted by client')
      return c.body(null, 408)
    }
    logger.error('Authoring refine failed', error)
    const err = internalError()
    return c.json(err.body, err.status)
  }
})
