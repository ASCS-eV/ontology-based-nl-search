/**
 * Copilot SDK filler for the scene-authoring agent.
 *
 * Mirrors `packages/llm/src/agent/copilot-agent.ts`, with one deliberate
 * simplification: authoring is lower-volume and not latency-critical like
 * search, so it creates a FRESH single-use session per fill instead of a
 * pre-warmed pool. Because the session is created at request time, its
 * `submit_scene` handler closes over a request-local resolver — so concurrent
 * fills are isolated WITHOUT the token-routing the pooled search path needs.
 *
 * Each session bakes the byte-stable static core as its system message; the
 * per-request tail (archetype + repair feedback + user request) rides in the
 * request message, exactly as the search adapter does.
 *
 * @see ./scene-agent.ts — the repair-loop orchestrator that drives this
 */

import { approveAll, CopilotClient, type CopilotSession, defineTool } from '@github/copilot-sdk'
import { getConfig } from '@ontology-search/core/config'
import { z } from 'zod'

import { getAgentPolicy } from '../agent/agent-policy.js'
import { getSceneStaticCore } from './scene-prompt.js'
import { type SceneSubmissionParams, sceneSubmissionSchema } from './scene-tool.js'

// ─── Client singleton (shared with the search adapter's pattern) ─────────────

let client: CopilotClient | null = null

async function getClient(): Promise<CopilotClient> {
  if (client) return client
  const { GITHUB_TOKEN } = getConfig()
  client = new CopilotClient({
    ...(GITHUB_TOKEN ? { gitHubToken: GITHUB_TOKEN } : {}),
  })
  await client.start()
  return client
}

/**
 * Warm the Copilot client so the first authoring request doesn't pay client
 * startup on the request path. Best-effort: swallows failures (e.g. proxy down)
 * so warmup can never affect readiness.
 */
export async function warmupSceneCopilot(): Promise<void> {
  try {
    await getClient()
  } catch {
    // intentional: warmup is best-effort
  }
}

/**
 * The `submit_scene` parameters as JSON Schema 2020-12 — generated from the Zod
 * source so it can never drift from the Vercel tool.
 * [JSON-SCHEMA-CORE] JSON Schema 2020-12 (criterion #31).
 */
const sceneParameters = z.toJSONSchema(sceneSubmissionSchema, { target: 'draft-2020-12' })

const LLM_TURN_TIMEOUT_MS = 120_000

/**
 * Resolve when `promise` settles or reject with `AbortError` when `signal`
 * fires — whichever happens first.
 */
function raceWithSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (v) => {
        signal.removeEventListener('abort', onAbort)
        resolve(v)
      },
      (e) => {
        signal.removeEventListener('abort', onAbort)
        reject(e)
      }
    )
  })
}

/**
 * Run one scene-fill turn via the Copilot SDK. Returns the submitted scene, or
 * `null` when the model settled without calling `submit_scene` (the
 * orchestrator surfaces that as a gap).
 */
export async function fillSceneCopilot(
  requestMessage: string,
  signal?: AbortSignal
): Promise<SceneSubmissionParams | null> {
  const c = await getClient()
  const policy = getAgentPolicy()

  // Request-local capture — no cross-request router needed for per-request
  // sessions: this session's handler is the only writer of `captured`.
  let captured: SceneSubmissionParams | null = null
  let deliver!: () => void
  const arrived = new Promise<void>((resolve) => {
    deliver = resolve
  })

  const session: CopilotSession = await c.createSession({
    model: policy.model,
    ...(policy.reasoningEffort
      ? { reasoningEffort: policy.reasoningEffort as unknown as 'low' | 'medium' | 'high' }
      : {}),
    onPermissionRequest: approveAll,
    systemMessage: { mode: 'replace', content: getSceneStaticCore() },
    tools: [
      defineTool('submit_scene', {
        description:
          'Submit the authored OpenSCENARIO scene as a structured IR plus an ' +
          'interpretation and any gaps. Call exactly once. Never emit raw .xosc XML.',
        skipPermission: true,
        parameters: sceneParameters,
        handler: async (params: unknown) => {
          const parsed = sceneSubmissionSchema.safeParse(params)
          if (!parsed.success) return { accepted: false, error: parsed.error.message }
          captured = parsed.data
          deliver()
          return { accepted: true }
        },
      }),
    ],
    availableTools: ['submit_scene'],
  })

  try {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    // Resolve as soon as EITHER the submission arrives OR the session settles.
    // We do not block on the model's post-tool-call chatter (same rationale as
    // the search adapter).
    const idleOutcome = session.sendAndWait({ prompt: requestMessage }, LLM_TURN_TIMEOUT_MS).then(
      () => 'idle' as const,
      () => 'idle' as const
    )
    const raced = Promise.race([arrived.then(() => 'submitted' as const), idleOutcome])
    if (signal) await raceWithSignal(raced, signal)
    else await raced

    return captured
  } finally {
    session.disconnect().catch(() => {
      // intentional: best-effort cleanup
    })
  }
}
