import { approveAll, CopilotClient, defineTool } from '@github/copilot-sdk'
import { getConfig } from '@ontology-search/core/config'
import { Stopwatch } from '@ontology-search/core/logging'
import {
  extractVocabulary,
  getInitializedStore,
  type OntologyVocabulary,
} from '@ontology-search/search'
import { compileSlots } from '@ontology-search/search/compiler'
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

let cachedSystemPrompt: string | null = null
let cachedVocabulary: OntologyVocabulary | null = null
let client: CopilotClient | null = null

/**
 * Build system prompt from live ontology vocabulary.
 * Cached after first build — the ontology doesn't change at runtime.
 */
async function getSystemPrompt(): Promise<{ prompt: string; vocabulary: OntologyVocabulary }> {
  if (cachedSystemPrompt && cachedVocabulary) {
    return { prompt: cachedSystemPrompt, vocabulary: cachedVocabulary }
  }

  const store = await getInitializedStore()
  cachedVocabulary = await extractVocabulary(store)
  cachedSystemPrompt = buildSystemPrompt(cachedVocabulary)

  return { prompt: cachedSystemPrompt, vocabulary: cachedVocabulary }
}

async function getClient(): Promise<CopilotClient> {
  if (client) return client
  client = new CopilotClient()
  await client.start()
  return client
}

/**
 * Build the submit_slots tool definition.
 * The handler captures submission into the provided ref object.
 */
function buildSubmitSlotsTool(ref: { value: SlotSubmission | null }) {
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
      ref.value = params as SlotSubmission
      return { accepted: true }
    },
  })
}

/**
 * Run the slot-filling agent via the Copilot SDK's native tool calling.
 *
 * The LLM receives the full ontology vocabulary in its system prompt
 * (auto-generated from SHACL shapes) and directly fills search slots.
 * No pre-processing or SKOS matching — the LLM IS the synonym resolver.
 *
 * Tools are registered at session creation time (required by the SDK).
 */
export async function runCopilotAgent(
  naturalLanguageQuery: string,
  options?: AgentOptions
): Promise<LlmStructuredResponse> {
  const sw = new Stopwatch()
  const targetDomain = options?.domain ?? 'hdmap'

  // Parallelize: build prompt & create session concurrently
  const endSetup = sw.time('setup')
  const [{ prompt, vocabulary }, c] = await Promise.all([getSystemPrompt(), getClient()])
  const config = getConfig()
  const modelId = config.AI_MODEL
  endSetup()

  const submissionRef: { value: SlotSubmission | null } = { value: null }

  const endSession = sw.time('session-create')
  const session = await c.createSession({
    model: modelId,
    onPermissionRequest: approveAll,
    systemMessage: {
      mode: 'replace',
      content: prompt,
    },
    tools: [buildSubmitSlotsTool(submissionRef)],
    availableTools: ['submit_slots'],
  })
  endSession()

  try {
    const endLlmCall = sw.time('llm-round-trip')
    await session.sendAndWait({ prompt: naturalLanguageQuery })
    endLlmCall()

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
  } finally {
    await session.disconnect()
  }
}
