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
import { z } from 'zod'

import type { LlmStructuredResponse } from '../types.js'
import { buildRequestPrompt, getAgentContext, getStaticCore } from './agent-context.js'
import { getAgentPolicy } from './agent-policy.js'
import { buildEmptyFallbackResponse } from './empty-fallback.js'
import type { AgentOptions } from './index.js'
import { runSlotPipeline } from './run-slot-pipeline.js'
import { SCHEMA_TOOL_DEFINITIONS } from './schema-tools.js'
import { renderTokenDirective, type Submission, SubmissionRouter } from './submission-router.js'
import { slotSubmissionSchema } from './tools.js'

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
 * Copilot routes concurrent replies by an echoed token, so its tool schema is
 * the canonical slot schema PLUS requestToken. Generating it from the Zod
 * source (not hand-writing) means new slots — like `references` — can never
 * drift out of the Copilot provider again.
 * [JSON-SCHEMA-CORE] JSON Schema 2020-12 — same dialect as the published
 * submit-slots.schema.json artifact (criterion #31).
 */
export const copilotSubmitParameters = z.toJSONSchema(
  slotSubmissionSchema.extend({
    requestToken: z
      .string()
      .describe('Echo the [request_token: …] value from the user message verbatim. Required.'),
  }),
  { target: 'draft-2020-12' }
)

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
    parameters: copilotSubmitParameters,
    handler: async (params: unknown) => {
      const result = submissionRouter.route(params)
      if (result.ok) return { accepted: true }
      return { accepted: false, error: result.reason }
    },
  })
}

/**
 * Copilot-SDK wrappers for the schema-lookup tools. Stateless and
 * read-only, so unlike submit_slots they need no request-token routing —
 * concurrent sessions can share the handlers safely.
 */
function buildLookupTools() {
  return SCHEMA_TOOL_DEFINITIONS.map((def) =>
    defineTool(def.name, {
      description: def.description,
      skipPermission: true,
      parameters: z.toJSONSchema(def.argsSchema, { target: 'draft-2020-12' }),
      handler: (params: unknown) => def.handler(params),
    })
  )
}

// ─── Single-Use Session Pool ─────────────────────────────────────────────────

/** Pre-warmed sessions ready for use. Each session is consumed once and discarded. */
const readyPool: CopilotSession[] = []
/** Target pool size — sessions are replenished in the background after consumption. */
const POOL_SIZE = 3
/** Prevents concurrent replenishment storms. */
let replenishing = false

/**
 * Ceiling for a single LLM turn, passed explicitly to `session.sendAndWait`
 * (whose SDK default is 60s). Because success is derived from the routed
 * `submit_slots` submission — not from `session.idle` — this bound only
 * governs the cases where the model never submits (→ fallback) or where the
 * tool-call turn itself is pathologically slow. It is deliberately generous:
 * a heavily loaded backend can push a legitimate tool-call turn well past
 * the 60s default, which surfaces as "Timeout waiting for session.idle".
 */
const LLM_TURN_TIMEOUT_MS = 120_000

/**
 * Create a fresh session. No `infiniteSessions` — each session is used
 * exactly once so no history accumulates.
 */
async function createSession(prompt: string): Promise<CopilotSession> {
  const c = await getClient()
  const policy = getAgentPolicy()

  return c.createSession({
    model: policy.model,
    // [SDK] The Copilot `session.create` wire schema accepts
    // `reasoningEffort: "none"` ("none" disables reasoning), but the SDK's
    // exported `ReasoningEffort` union narrows to low|medium|high|xhigh.
    // Forward the wire-valid policy value with a cast.
    ...(policy.reasoningEffort
      ? { reasoningEffort: policy.reasoningEffort as unknown as 'low' | 'medium' | 'high' }
      : {}),
    onPermissionRequest: approveAll,
    systemMessage: { mode: 'replace', content: prompt },
    tools: [buildSubmitSlotsTool(), ...buildLookupTools()],
    availableTools: [...policy.lookupTools, policy.forcedTool],
  })
}

/**
 * Fill the pool up to POOL_SIZE. Called at startup (warmup) and after
 * each session is consumed. Runs in the background — never blocks requests.
 * Creates sessions in parallel for faster filling.
 *
 * Sessions bake ONLY the static prompt core (the Copilot SDK cannot
 * replace a session's system message per turn): the core is byte-stable
 * and therefore prompt-cacheable, while the per-query retrieved schema
 * tail rides in the request message.
 */
async function replenishPool(): Promise<void> {
  if (replenishing) return
  replenishing = true
  try {
    const needed = POOL_SIZE - readyPool.length
    if (needed <= 0) return
    const sessions = await Promise.all(
      Array.from({ length: needed }, () => createSession(getStaticCore()))
    )
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
  return createSession(getStaticCore())
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
  return createSession(getStaticCore())
}

// ─── Prompt-cache priming ────────────────────────────────────────────────────

/**
 * Throwaway query used only to warm the backend prompt cache. Its content is
 * irrelevant: the point is to make the backend prefill and cache the static
 * prompt core the pooled sessions bake, so the first real query hits a warm
 * cache instead of paying the cold prefill. The query-specific retrieved
 * tail is deliberately never primed.
 */
const CACHE_PRIMING_QUERY = 'warmup'

/**
 * Run one throwaway slot-fill to warm the shared prompt cache. Best-effort:
 * any failure is swallowed so priming can never affect readiness or requests.
 * Exported for tests.
 */
export async function primeCacheOnce(): Promise<void> {
  try {
    await runCopilotAgent(CACHE_PRIMING_QUERY)
  } catch {
    // intentional: priming is best-effort and must never surface an error
  }
}

/**
 * Warm the prompt cache ONCE in the background (non-blocking, so warmup
 * readiness is not delayed). Deliberately does NOT re-prime on a timer: keeping
 * the cache warm would require a periodic LLM round-trip, i.e. continuous token
 * cost on an otherwise-idle deployment. Instead, an idle deployment simply pays
 * the one-time cold-prefill cost on its next real query after the backend cache
 * TTL (~5 min) expires — identical to the pre-priming behaviour, just warm for
 * the common non-idle case.
 */
export function primeCacheInBackground(): void {
  void primeCacheOnce()
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
  const policy = getAgentPolicy()

  const endSetup = sw.time('setup')
  const { vocabulary } = await getAgentContext()
  endSetup()

  // Retrieve the query's schema context. Pooled sessions carry the static
  // core as their system message; this tail rides in the request message.
  const endRetrieval = sw.time('retrieval')
  const { tail: retrievedTail } = await buildRequestPrompt(naturalLanguageQuery, {
    signal: options?.signal,
    maxDomains: policy.retrieval.maxDomains,
    maxCards: policy.retrieval.maxCards,
    maxContextChars: policy.retrieval.maxContextChars,
  })
  endRetrieval()

  // Acquire a fresh, pre-warmed session (pool replenishes in background)
  const endSession = sw.time('session-acquire')
  const session = await acquireSession()
  endSession()

  // Register callback for this request's token. We resolve `submissionArrived`
  // the instant the model routes its `submit_slots` tool call to us — we do
  // NOT wait for `session.idle`. Anthropic models on the Copilot SDK routinely
  // emit an extra natural-language summary turn AFTER the tool call (which we
  // discard). Waiting for idle burns that time, and when the tool-call turn and
  // the summary turn together exceed the SDK's hard-coded 60s `sendAndWait`
  // ceiling it surfaces as a spurious "Timeout waiting for session.idle" —
  // even though `submit_slots` already succeeded and we have the answer.
  const requestToken = randomUUID()
  // `submissionRef` is the synchronous source of truth for precedence:
  // `submissionArrived` merely WAKES the race. A routed submission always wins
  // over a same-tick `session.idle`, so we read the ref (not the race outcome)
  // to decide the result.
  const submissionRef: { value: Submission | null } = { value: null }
  let deliverSubmission!: () => void
  const submissionArrived = new Promise<void>((resolve) => {
    deliverSubmission = resolve
  })
  const unregister = submissionRouter.register(requestToken, (s) => {
    submissionRef.value = s
    deliverSubmission()
  })

  const promptWithToken = `${naturalLanguageQuery}\n\n${renderTokenDirective(requestToken)}`
  // The server-derived schema tail precedes the user query in the request
  // message (the session only carries the static core). The tail comes from
  // the schema graph, never from user text, so the injection posture is
  // unchanged — user input only appears below the delimiter.
  const requestMessage = [retrievedTail, '---', promptWithToken].join('\n\n')
  const signal = options?.signal

  let submission: Submission | null = null
  try {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const endLlmCall = sw.time('llm-round-trip')

    // The `session.idle` wait (or the SDK's internal 60s timeout / a session
    // error), normalized so this branch never rejects on its own — it only
    // ever competes in the race. A rejection is re-surfaced explicitly below,
    // and only when no submission arrived.
    const idleOutcome: Promise<{ kind: 'idle' } | { kind: 'error'; error: unknown }> = session
      .sendAndWait({ prompt: requestMessage }, LLM_TURN_TIMEOUT_MS)
      .then(
        () => ({ kind: 'idle' as const }),
        (error: unknown) => ({ kind: 'error' as const, error })
      )

    // Resolve as soon as EITHER the submission is routed OR the session settles
    // (idle / error). We do not block on the model's post-tool-call chatter.
    const raced = Promise.race([
      submissionArrived.then(() => ({ kind: 'submitted' as const })),
      idleOutcome,
    ])

    const outcome = signal ? await raceWithSignal(raced, signal) : await raced
    endLlmCall()

    // A routed submission always wins — even if `session.idle` settled in the
    // same microtask tick. Only a genuine error with NO submission is surfaced;
    // a bare idle without a submission degrades to the deterministic fallback.
    if (submissionRef.value) {
      submission = submissionRef.value
    } else if (outcome.kind === 'error') {
      // The session finished (or the SDK timed out) without ever routing a
      // submission — surface the failure so the route reports an error rather
      // than silently degrading.
      throw outcome.error
    }
  } finally {
    unregister()
    // Discard the used session — don't reuse (prevents context accumulation).
    // Disconnecting also abandons any in-flight post-tool summary turn, which
    // we intentionally never consume.
    session.disconnect().catch(() => {
      // intentional: best-effort cleanup
    })
  }

  if (submission) {
    const response = await runSlotPipeline({
      submission,
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
