/**
 * Copilot Agent — LLM slot-filling via GitHub Copilot SDK with persistent sessions.
 *
 * **Architecture:**
 * - Uses a single persistent CopilotSession reused across all requests
 * - Eliminates ~5.8s session-create overhead on every search
 * - Relies on SDK's infiniteSessions feature for automatic context compaction
 * - System prompt cached in memory (generated once from 22 SHACL files, 298 KB)
 * - Tool-based structured output: submit_slots is the only tool exposed to LLM
 *
 * **Why Persistent Sessions:**
 * - Creating a new session on every search introduced unacceptable latency
 * - Single persistent session + stateless requests = fast + simple
 * - Active submission callbacks route tool calls to the correct in-flight request
 *
 * **Post-LLM Pipeline:**
 * - LLM reads raw SHACL Turtle → fills slots
 * - Validator fuzzy-matches invalid values → fixes mistakes
 * - Compiler generates domain-agnostic SPARQL from corrected slots
 *
 * @see packages/llm/src/prompt-builder.ts — Generates system prompt from raw SHACL
 * @see packages/llm/src/slot-validator.ts — Post-LLM validation and correction
 */

import { approveAll, CopilotClient, type CopilotSession, defineTool } from '@github/copilot-sdk'
import { getConfig } from '@ontology-search/core/config'
import { Stopwatch } from '@ontology-search/core/logging'
import {
  extractVocabulary,
  getInitializedStore,
  type OntologyVocabulary,
} from '@ontology-search/search'
import { compileSlots } from '@ontology-search/search/compiler'
import { getShaclContent } from '@ontology-search/search/shacl-reader'
import type { SearchSlots } from '@ontology-search/search/slots'

import { buildSystemPrompt } from '../prompt-builder.js'
import { correctDomains, correctFilters, validateSlots } from '../slot-validator.js'
import type { LlmStructuredResponse } from '../types.js'
import type { AgentOptions } from './index.js'

interface SlotSubmission {
  slots: {
    domains?: string[]
    filters?: Record<string, string | string[]>
    ranges?: Record<string, { min?: number; max?: number }>
    location?: { country?: string; state?: string; region?: string; city?: string }
    license?: string
  }
  interpretation: LlmStructuredResponse['interpretation']
  gaps: LlmStructuredResponse['gaps']
}

// ─── Persistent Session Pool ─────────────────────────────────────────────────

let cachedSystemPrompt: string | null = null
let cachedVocabulary: OntologyVocabulary | null = null
let client: CopilotClient | null = null

/**
 * Active submission callback — set per-request before sendAndWait,
 * invoked by the persistent tool handler to deliver results.
 */
let activeSubmissionCallback: ((params: SlotSubmission) => void) | null = null

/** The persistent session, reused across all search requests */
let persistentSession: CopilotSession | null = null

/** Promise that resolves when session creation finishes (prevents races) */
let sessionCreatePromise: Promise<CopilotSession> | null = null

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
      'Submit the structured search result with filled slots, interpretation, and gaps. Call exactly once.',
    skipPermission: true,
    parameters: {
      type: 'object',
      properties: {
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
                country: { type: 'string' },
                state: { type: 'string' },
                region: { type: 'string' },
                city: { type: 'string' },
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
      required: ['slots', 'interpretation', 'gaps'],
    },
    handler: async (params: unknown) => {
      if (activeSubmissionCallback) {
        activeSubmissionCallback(params as SlotSubmission)
      }
      return { accepted: true }
    },
  })
}

/**
 * Get or create the persistent Copilot session.
 * The session is created once and reused — saves ~5.8s per request.
 * infiniteSessions handles context compaction automatically.
 *
 * Exported so it can be called during server warmup to pre-pay
 * the session creation cost before any user request arrives.
 */
export async function getPersistentSession(): Promise<CopilotSession> {
  if (persistentSession) return persistentSession

  // Prevent parallel session creation races
  if (sessionCreatePromise) return sessionCreatePromise

  sessionCreatePromise = (async () => {
    const [{ prompt }, c] = await Promise.all([getSystemPrompt(), getClient()])
    const config = getConfig()

    const session = await c.createSession({
      model: config.AI_MODEL,
      reasoningEffort: 'low',
      onPermissionRequest: approveAll,
      systemMessage: { mode: 'replace', content: prompt },
      tools: [buildPersistentSubmitSlotsTool()],
      availableTools: ['submit_slots'],
      infiniteSessions: { enabled: true },
    })

    persistentSession = session
    sessionCreatePromise = null
    return session
  })()

  return sessionCreatePromise
}

/**
 * Invalidate the persistent session (e.g., on error) so the next call recreates it.
 */
async function invalidateSession(): Promise<void> {
  const s = persistentSession
  persistentSession = null
  sessionCreatePromise = null
  if (s) {
    try {
      await s.disconnect()
    } catch {
      // Best-effort cleanup
    }
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
  const targetDomain = options?.domain ?? 'hdmap'

  const endSetup = sw.time('setup')
  const { vocabulary } = await getSystemPrompt()
  endSetup()

  // Get or create persistent session (first call pays ~5.8s, subsequent ~0ms)
  const endSession = sw.time('session-acquire')
  let session: CopilotSession
  try {
    session = await getPersistentSession()
  } catch (err) {
    // Session creation failed — invalidate and propagate
    await invalidateSession()
    throw err
  }
  endSession()

  // Set up per-request submission capture via callback
  const submissionRef: { value: SlotSubmission | null } = { value: null }
  activeSubmissionCallback = (params) => {
    submissionRef.value = params
  }

  try {
    const endLlmCall = sw.time('llm-round-trip')
    await session.sendAndWait({ prompt: naturalLanguageQuery })
    endLlmCall()
  } catch (err) {
    // Session may have died — invalidate so next request recreates
    await invalidateSession()
    throw err
  } finally {
    activeSubmissionCallback = null
  }

  if (submissionRef.value) {
    const result = submissionRef.value

    const endValidation = sw.time('post-llm-validation')
    const correctedFilters = correctFilters(result.slots.filters ?? {}, vocabulary)
    const ranges = result.slots.ranges ?? {}
    const correctedDomains = correctDomains(
      result.slots.domains ?? [targetDomain],
      correctedFilters,
      ranges,
      vocabulary
    )
    endValidation()

    const slots: SearchSlots = {
      domains: correctedDomains,
      filters: correctedFilters,
      ranges,
      location: result.slots.location,
      license: result.slots.license,
    }

    const endCompile = sw.time('sparql-compile')
    const sparql = await compileSlots(slots)
    endCompile()

    const rawResponse: LlmStructuredResponse = {
      interpretation: result.interpretation,
      gaps: result.gaps,
      sparql,
    }

    const validated = validateSlots(rawResponse, vocabulary)
    return { ...validated, timings: sw.getTimings() }
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
