/**
 * Copilot SDK Adapter — stateless slot-filling with pre-warmed session pool.
 *
 * Each request gets a FRESH session (no context pollution), but sessions are
 * pre-created in a pool so the ~5.8s creation cost is paid in the background,
 * not on the request path. After use, a session is discarded and a replacement
 * is queued for background creation.
 *
 * This gives the best of both worlds:
 * - Same result quality as the stateless Vercel/claude-cli path
 * - No warmup latency on the request path (amortized via pool)
 *
 * @see ./agent-policy.ts — Single source of truth for agent behaviour
 * @see ./agent-context.ts — Shared prompt/vocabulary/store caching
 * @see ./submission-router.ts — Token-keyed callback routing for concurrent requests
 */

import { randomUUID } from 'node:crypto'

import { approveAll, CopilotClient, type CopilotSession, defineTool } from '@github/copilot-sdk'
import { getConfig } from '@ontology-search/core/config'
import { Stopwatch } from '@ontology-search/core/logging'
import { getPrimaryDomain } from '@ontology-search/search'

import type { LlmStructuredResponse } from '../types.js'
import { getAgentContext } from './agent-context.js'
import { getAgentPolicy } from './agent-policy.js'
import { buildEmptyFallbackResponse } from './empty-fallback.js'
import type { AgentOptions } from './index.js'
import { runSlotPipeline } from './run-slot-pipeline.js'
import { renderTokenDirective, type Submission, SubmissionRouter } from './submission-router.js'

// ─── Client Singleton ────────────────────────────────────────────────────────

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
 * Per-request submission router. Each concurrent request gets a unique token;
 * the single `submit_slots` handler routes tool-call replies by token so
 * concurrent searches can't interfere.
 */
const submissionRouter = new SubmissionRouter()

// ─── Tool Definition ─────────────────────────────────────────────────────────

/**
 * Build the submit_slots tool for a session.
 * The handler routes to whichever request is currently active via callback.
 */
function buildSubmitSlotsTool() {
  return defineTool('submit_slots', {
    description:
      'Submit the structured search result with filled slots, interpretation, and gaps. ' +
      'Call exactly once. You MUST echo the request_token from the user message verbatim ' +
      'as the requestToken property — it is required for routing your reply to the caller.',
    skipPermission: true,
    parameters: {
      type: 'object',
      properties: {
        requestToken: {
          type: 'string',
          description:
            'Echo the [request_token: …] value from the user message verbatim. Required.',
        },
        slots: {
          type: 'object',
          properties: {
            domains: { type: 'array', items: { type: 'string' } },
            filters: {
              type: 'object',
              additionalProperties: {
                oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
              },
            },
            ranges: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  min: { type: 'number' },
                  max: { type: 'number' },
                },
              },
            },
          },
        },
        interpretation: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            mappedTerms: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  input: { type: 'string' },
                  mapped: { type: 'string' },
                  confidence: {
                    type: 'string',
                    enum: ['high', 'medium', 'low'],
                  },
                  property: { type: 'string' },
                },
                required: ['input', 'mapped', 'confidence'],
              },
            },
          },
          required: ['summary', 'mappedTerms'],
        },
        gaps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              term: { type: 'string' },
              reason: { type: 'string' },
              suggestions: { type: 'array', items: { type: 'string' } },
            },
            required: ['term', 'reason'],
          },
        },
      },
      required: ['requestToken', 'slots', 'interpretation', 'gaps'],
    },
    handler: async (params: unknown) => {
      const result = submissionRouter.route(params)
      if (result.ok) return { accepted: true }
      return { accepted: false, error: result.reason }
    },
  })
}

// ─── Single-Use Session Pool ─────────────────────────────────────────────────

/** Pre-warmed sessions ready for use. Each session is consumed once and discarded. */
const readyPool: CopilotSession[] = []
/** Target pool size — sessions are replenished in the background after consumption. */
const POOL_SIZE = 3
/** Prevents concurrent replenishment storms. */
let replenishing = false

/**
 * Create a fresh session. No `infiniteSessions` — each session is used
 * exactly once so no history accumulates.
 */
async function createSession(prompt: string): Promise<CopilotSession> {
  const c = await getClient()
  const policy = getAgentPolicy()

  return c.createSession({
    model: policy.model,
    ...(policy.reasoningEffort ? { reasoningEffort: policy.reasoningEffort } : {}),
    onPermissionRequest: approveAll,
    systemMessage: { mode: 'replace', content: prompt },
    tools: [buildSubmitSlotsTool()],
    availableTools: [policy.forcedTool],
  })
}

/**
 * Fill the pool up to POOL_SIZE. Called at startup (warmup) and after
 * each session is consumed. Runs in the background — never blocks requests.
 * Creates sessions in parallel for faster filling.
 */
async function replenishPool(): Promise<void> {
  if (replenishing) return
  replenishing = true
  try {
    const { prompt } = await getAgentContext()
    const needed = POOL_SIZE - readyPool.length
    if (needed <= 0) return
    const sessions = await Promise.all(Array.from({ length: needed }, () => createSession(prompt)))
    readyPool.push(...sessions)
  } catch {
    // intentional: pool creation may fail (network issues, proxy down).
    // Requests will create sessions inline as fallback.
  } finally {
    replenishing = false
  }
}

/**
 * Take a pre-warmed session from the pool. If the pool is empty (burst
 * traffic), create one on-the-fly (pays the ~5.8s cost inline).
 * After taking, trigger background replenishment.
 */
async function acquireSession(): Promise<CopilotSession> {
  const session = readyPool.shift()
  // Fire-and-forget replenishment — don't block the request
  void replenishPool()
  if (session) return session
  // Pool exhausted — create inline (rare, only under burst)
  const { prompt } = await getAgentContext()
  return createSession(prompt)
}

/**
 * Exported for warmup — kicks off pool replenishment in the background.
 * Does NOT await completion — the server starts immediately. The pool
 * fills asynchronously; first requests that arrive before it's ready
 * create sessions inline.
 */
export async function getPersistentSession(): Promise<CopilotSession> {
  // Only ensure the client is started (fast) — pool fills in background
  await getClient()
  void replenishPool()
  // Return a placeholder — warmup doesn't actually need a session reference,
  // it just triggers background creation.
  if (readyPool.length > 0) return readyPool[0]!
  const { prompt } = await getAgentContext()
  return createSession(prompt)
}

// ─── Abort Helper ────────────────────────────────────────────────────────────

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

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Run the slot-filling agent via the Copilot SDK — single-use sessions.
 *
 * Each request takes a pre-warmed session from the pool (no warmup cost),
 * uses it once (no context pollution), and discards it. A replacement is
 * created in the background immediately.
 */
export async function runCopilotAgent(
  naturalLanguageQuery: string,
  options?: AgentOptions
): Promise<LlmStructuredResponse> {
  const sw = new Stopwatch()
  const targetDomain = options?.domain ?? (await getPrimaryDomain())

  const endSetup = sw.time('setup')
  const { vocabulary } = await getAgentContext()
  endSetup()

  // Acquire a fresh, pre-warmed session (pool replenishes in background)
  const endSession = sw.time('session-acquire')
  const session = await acquireSession()
  endSession()

  // Register callback for this request's token
  const requestToken = randomUUID()
  const submissionRef: { value: Submission | null } = { value: null }
  const unregister = submissionRouter.register(requestToken, (submission) => {
    submissionRef.value = submission
  })

  const promptWithToken = `${naturalLanguageQuery}\n\n${renderTokenDirective(requestToken)}`
  const signal = options?.signal

  try {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const endLlmCall = sw.time('llm-round-trip')
    if (signal) {
      await raceWithSignal(session.sendAndWait({ prompt: promptWithToken }), signal)
    } else {
      await session.sendAndWait({ prompt: promptWithToken })
    }
    endLlmCall()
  } finally {
    unregister()
    // Discard the used session — don't reuse (prevents context accumulation)
    session.disconnect().catch(() => {
      // intentional: best-effort cleanup
    })
  }

  if (submissionRef.value) {
    const response = await runSlotPipeline({
      submission: submissionRef.value,
      vocabulary,
      targetDomain,
      sw,
    })
    return { ...response, timings: sw.getTimings() }
  }

  // Fallback: LLM didn't call submit_slots
  const fallback = await buildEmptyFallbackResponse(naturalLanguageQuery, vocabulary)
  return { ...fallback, timings: sw.getTimings() }
}
