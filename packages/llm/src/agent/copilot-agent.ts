import { approveAll, CopilotClient, type CopilotSession, defineTool } from '@github/copilot-sdk'
import { getConfig } from '@ontology-search/core/config'
import { extractVocabulary, getInitializedStore } from '@ontology-search/search'
import { compileSlots } from '@ontology-search/search/compiler'
import type { SearchSlots } from '@ontology-search/search/slots'

import { buildSystemPrompt } from '../prompt-builder.js'
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
let client: CopilotClient | null = null

/**
 * Build system prompt from live ontology vocabulary.
 * Cached after first build — the ontology doesn't change at runtime.
 */
async function getSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt

  const store = await getInitializedStore()
  const vocabulary = await extractVocabulary(store)
  cachedSystemPrompt = buildSystemPrompt(vocabulary)

  return cachedSystemPrompt
}

async function getClient(): Promise<CopilotClient> {
  if (client) return client
  client = new CopilotClient()
  await client.start()
  return client
}

/**
 * Run the slot-filling agent via the Copilot SDK's native tool calling.
 *
 * The LLM receives the full ontology vocabulary in its system prompt
 * (auto-generated from SHACL shapes) and directly fills search slots.
 * No pre-processing or SKOS matching — the LLM IS the synonym resolver.
 */
export async function runCopilotAgent(
  naturalLanguageQuery: string,
  options?: AgentOptions
): Promise<LlmStructuredResponse> {
  const targetDomain = options?.domain ?? 'hdmap'
  const systemPrompt = await getSystemPrompt()
  const config = getConfig()
  const modelId = config.AI_MODEL
  const c = await getClient()

  let submittedSlots: SlotSubmission | null = null

  const session: CopilotSession = await c.createSession({
    model: modelId,
    onPermissionRequest: approveAll,
    systemMessage: {
      mode: 'replace',
      content: systemPrompt,
    },
  })

  try {
    session.registerTools([
      defineTool('submit_slots', {
        description:
          'Submit the structured search result with filled slots, interpretation, and gaps. Call exactly once.',
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
          submittedSlots = params as SlotSubmission
          return { accepted: true }
        },
      }),
    ])

    await session.sendAndWait({ prompt: naturalLanguageQuery })

    const result = submittedSlots as SlotSubmission | null
    if (result) {
      const slots: SearchSlots = {
        domains: result.slots.domains ?? [targetDomain],
        filters: result.slots.filters ?? {},
        ranges: result.slots.ranges ?? {},
        location: result.slots.location,
        license: result.slots.license,
      }
      const sparql = await compileSlots(slots)

      return {
        interpretation: result.interpretation,
        gaps: result.gaps,
        sparql,
      }
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
    }
  } finally {
    await session.disconnect()
  }
}
