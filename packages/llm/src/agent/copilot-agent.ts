/**
 * Copilot Agent — LLM slot-filling via GitHub Copilot SDK with session pooling.
 *
 * **Architecture:**
 * - Maintains a pool of persistent CopilotSessions (default 3), reused
 *   round-robin across all search requests
 * - Eliminates ~5.8s session-create overhead on every search
 * - Relies on SDK's infiniteSessions feature for automatic context compaction
 * - System prompt cached in memory (generated once from 22 SHACL files, 298 KB)
 * - Tool-based structured output: submit_slots is the only tool exposed to LLM
 *
 * **Why Session Pooling:**
 * - Single session funnelled all concurrent requests through one context window
 * - Pool of N sessions allows N concurrent LLM calls without interference
 * - Round-robin distribution keeps sessions evenly loaded
 * - Failed sessions are replaced transparently
 *
 * **Post-LLM Pipeline:**
 * - LLM reads raw SHACL Turtle → fills slots
 * - Validator fuzzy-matches invalid values → fixes mistakes
 * - Compiler generates domain-agnostic SPARQL from corrected slots
 *
 * @see packages/llm/src/prompt-builder.ts — Generates system prompt from raw SHACL
 * @see packages/llm/src/slot-validator.ts — Post-LLM validation and correction
 */

import { randomUUID } from 'node:crypto'

import { approveAll, CopilotClient, type CopilotSession, defineTool } from '@github/copilot-sdk'
import { getConfig } from '@ontology-search/core/config'
import { Stopwatch } from '@ontology-search/core/logging'
import { getPrimaryDomain } from '@ontology-search/ontology/domain-registry'
import {
  extractVocabulary,
  getInitializedStore,
  type OntologyVocabulary,
} from '@ontology-search/search'
import { compileSlots } from '@ontology-search/search/compiler'
import { getShaclContent } from '@ontology-search/search/shacl-reader'
import type { SearchSlots } from '@ontology-search/search/slots'

import { buildSystemPrompt } from '../prompt-builder.js'
import type { LlmStructuredResponse } from '../types.js'
import type { AgentOptions } from './index.js'
import { runSlotPipeline } from './run-slot-pipeline.js'
import { renderTokenDirective, type Submission, SubmissionRouter } from './submission-router.js'

// ─── Persistent Session Pool ─────────────────────────────────────────────────

let cachedSystemPrompt: string | null = null
let cachedVocabulary: OntologyVocabulary | null = null
let client: CopilotClient | null = null

/**
 * Routes each `submit_slots` tool call to its in-flight request callback by
 * exact `requestToken` — never by recency. The Copilot SDK exposes a single
 * global tool handler per session, so without the token a concurrent search
 * would silently resolve another request's promise.
 */
const submissionRouter = new SubmissionRouter()

/** Pool of persistent sessions, reused round-robin across search requests. */
const sessionPool: CopilotSession[] = []
/** Number of sessions to create. Small pool sufficient for typical concurrency. */
const POOL_SIZE = 3
/** Round-robin index into the session pool. */
let nextSessionIndex = 0
/** Promise that resolves when the pool is fully initialized (prevents races). */
let poolInitPromise: Promise<void> | null = null

async function getSystemPrompt(): Promise<{ prompt: string; vocabulary: OntologyVocabulary }> {
  if (cachedSystemPrompt && cachedVocabulary) {
    return { prompt: cachedSystemPrompt, vocabulary: cachedVocabulary }
  }

  // Read raw SHACL files for the system prompt (LLM reads native Turtle)
  const shaclContent = getShaclContent()
  cachedSystemPrompt = buildSystemPrompt(shaclContent)

  // Extract vocabulary separately — still needed for post-LLM slot validation
  const store = await getInitializedStore()
  cachedVocabulary = await extractVocabulary(store)

  return { prompt: cachedSystemPrompt, vocabulary: cachedVocabulary }
}

async function getClient(): Promise<CopilotClient> {
  if (client) return client
  client = new CopilotClient()
  await client.start()
  return client
}

/**
 * Build the submit_slots tool with a persistent handler.
 * The handler routes to whichever request is currently active via callback.
 */
function buildPersistentSubmitSlotsTool() {
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
            location: {
              type: 'object',
              properties: {
                // Each field accepts string or array — use an array to express
                // a region/continent as the explicit list of country codes it
                // covers. Never silently substitute one country for a region.
                country: {
                  oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
                },
                state: {
                  oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
                },
                region: {
                  oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
                },
                city: {
                  oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
                },
              },
            },
            license: { type: 'string' },
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

/**
 * Resolve when `promise` settles or reject with `AbortError` when `signal`
 * fires — whichever happens first. The original promise is not cancelled
 * (the Copilot SDK has no abort surface for sendAndWait); we just stop
 * awaiting it, and any late tool-call reply is dropped by the router.
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
 * Create a single Copilot session with the given system prompt.
 */
async function createSession(prompt: string): Promise<CopilotSession> {
  const c = await getClient()
  const config = getConfig()

  // reasoningEffort is only supported by certain models (e.g. claude-sonnet-4.6).
  // Models that don't support it will reject the session.create call.
  const supportsReasoning = config.AI_MODEL.includes('4.6') || config.AI_MODEL.includes('opus')

  return c.createSession({
    model: config.AI_MODEL,
    ...(supportsReasoning ? { reasoningEffort: 'low' } : {}),
    onPermissionRequest: approveAll,
    systemMessage: { mode: 'replace', content: prompt },
    tools: [buildPersistentSubmitSlotsTool()],
    availableTools: ['submit_slots'],
    infiniteSessions: { enabled: true },
  })
}

/**
 * Initialize the session pool. Creates POOL_SIZE sessions in parallel.
 * Called once — subsequent calls return the cached promise.
 *
 * Exported so it can be called during server warmup to pre-pay
 * the session creation cost before any user request arrives.
 */
export async function getPersistentSession(): Promise<CopilotSession> {
  await initSessionPool()
  return acquireSession()
}

/**
 * Initialize the full session pool. Idempotent — the first call creates
 * all sessions, subsequent calls are no-ops.
 */
async function initSessionPool(): Promise<void> {
  if (sessionPool.length >= POOL_SIZE) return
  if (poolInitPromise) return poolInitPromise

  poolInitPromise = (async () => {
    const { prompt } = await getSystemPrompt()

    // Only create the deficit — never exceed POOL_SIZE
    const needed = POOL_SIZE - sessionPool.length
    if (needed <= 0) {
      poolInitPromise = null
      return
    }

    const sessions = await Promise.all(Array.from({ length: needed }, () => createSession(prompt)))

    sessionPool.push(...sessions)
    poolInitPromise = null
  })()

  return poolInitPromise
}

/**
 * Acquire a session from the pool via round-robin.
 * Each session is independent — concurrent requests on different sessions
 * cannot interfere with each other's context windows.
 *
 * Takes a snapshot of the pool length to protect against concurrent
 * `invalidateSession` calls that `splice()` the array.
 */
function acquireSession(): CopilotSession {
  const len = sessionPool.length
  if (len === 0) {
    throw new Error('Copilot session pool exhausted — all sessions failed')
  }
  const idx = nextSessionIndex % len
  const session = sessionPool[idx]
  if (!session) {
    // Pool mutated between length check and index access — use first available
    const fallback = sessionPool[0]
    if (!fallback) throw new Error('Copilot session pool exhausted — all sessions failed')
    return fallback
  }
  nextSessionIndex = (nextSessionIndex + 1) % len
  return session
}

/**
 * Invalidate a specific session from the pool (e.g., on error) and
 * replace it with a fresh one so the pool stays at full capacity.
 */
async function invalidateSession(session: CopilotSession): Promise<void> {
  const idx = sessionPool.indexOf(session)
  if (idx === -1) return // Already removed

  // Remove the dead session
  sessionPool.splice(idx, 1)

  // Best-effort disconnect
  try {
    await session.disconnect()
  } catch {
    // intentional: best-effort cleanup — the session may already be
    // closed by the server or the network may be unavailable
  }

  // Replenish the pool with a fresh session
  try {
    const { prompt } = await getSystemPrompt()
    const replacement = await createSession(prompt)
    sessionPool.push(replacement)
  } catch {
    // Pool temporarily reduced — next request will still work with
    // remaining sessions. The pool will heal on the next init call
    // if it falls below POOL_SIZE.
  }
}

/**
 * Run the slot-filling agent via the Copilot SDK's native tool calling.
 *
 * Uses a persistent session that is created once and reused across requests.
 * This eliminates the ~5.8s session-create overhead on every search.
 * The SDK's infiniteSessions feature handles context compaction automatically
 * when conversation history grows too large.
 */
export async function runCopilotAgent(
  naturalLanguageQuery: string,
  options?: AgentOptions
): Promise<LlmStructuredResponse> {
  const sw = new Stopwatch()
  const targetDomain = options?.domain ?? (await getPrimaryDomain())

  const endSetup = sw.time('setup')
  const { vocabulary } = await getSystemPrompt()
  endSetup()

  // Get or create persistent session (first call pays ~5.8s, subsequent ~0ms)
  const endSession = sw.time('session-acquire')
  let session: CopilotSession
  try {
    session = await getPersistentSession()
  } catch (err) {
    // Pool creation failed — propagate (nothing to invalidate yet)
    throw err
  }
  endSession()

  // Per-request callback registration: the router pairs the tool-call reply
  // to this exact request by token, so concurrent searches cannot resolve each
  // other's promises (the old LIFO lookup did exactly that).
  const requestToken = randomUUID()
  const submissionRef: { value: Submission | null } = { value: null }
  const unregister = submissionRouter.register(requestToken, (submission) => {
    submissionRef.value = submission
  })

  const promptWithToken = `${naturalLanguageQuery}\n\n${renderTokenDirective(requestToken)}`

  // The Copilot SDK does not accept an AbortSignal on sendAndWait, and the
  // session is shared across requests, so we cannot call session.abort()
  // without harming other in-flight callers. Best effort: race the call
  // against the signal and stop awaiting on abort. The router rejects any
  // late tool call for this request because unregister() runs in finally.
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
  } catch (err) {
    // Aborts propagate cleanly without invalidating the session — other
    // in-flight requests still need it.
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    // Session may have died — invalidate so pool replaces it
    await invalidateSession(session)
    throw err
  } finally {
    unregister()
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

  // Fallback: LLM didn't call the tool — return broad search
  const fallbackSlots: SearchSlots = { domains: [targetDomain], filters: {}, ranges: {} }
  const sparql = await compileSlots(fallbackSlots)
  return {
    interpretation: {
      summary: `Searching all ${targetDomain} datasets (LLM did not extract specific filters)`,
      mappedTerms: [],
    },
    gaps: [
      {
        term: naturalLanguageQuery,
        reason: 'Could not extract structured filters from the query',
      },
    ],
    sparql,
    timings: sw.getTimings(),
  }
}
