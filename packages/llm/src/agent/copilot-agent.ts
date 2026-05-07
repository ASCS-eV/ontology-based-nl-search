import { approveAll, CopilotClient, type CopilotSession, defineTool } from '@github/copilot-sdk'
import { getConfig } from '@ontology-search/core/config'
import { matchConcepts } from '@ontology-search/ontology'
import { compileSlots } from '@ontology-search/search/compiler'
import type { SearchSlots } from '@ontology-search/search/slots'
import { readFileSync } from 'fs'
import path from 'path'

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

const SKILL_PATH = path.join(__dirname, 'skill.md')

let cachedSystemPrompt: string | null = null
let client: CopilotClient | null = null

async function getSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt

  try {
    cachedSystemPrompt = readFileSync(SKILL_PATH, 'utf-8')
  } catch {
    cachedSystemPrompt = readFileSync(
      path.join(process.cwd(), 'src', 'lib', 'llm', 'agent', 'skill.md'),
      'utf-8'
    )
  }

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
 * Pipeline: synonym pre-process → LLM fills slots → compile to SPARQL.
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

  // Step 1: Ontology-driven concept matching (SKOS + SHACL vocabulary)
  const matchResult = await matchConcepts(naturalLanguageQuery)

  const preSlots = matchResultToSlots(matchResult.matches, targetDomain)

  // Track the submitted answer
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
    // Register slot-filling tool with generic SearchSlots schema
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

    // Build prompt with pre-extracted context
    const promptContext =
      matchResult.matches.length > 0
        ? `Pre-extracted slots (already determined): ${JSON.stringify(preSlots)}\n\nRemaining query: "${matchResult.remainder || naturalLanguageQuery}"\n\nOriginal: "${naturalLanguageQuery}"`
        : naturalLanguageQuery

    await session.sendAndWait({ prompt: promptContext })

    const result = submittedSlots as SlotSubmission | null
    if (result) {
      // LLM now emits SearchSlots directly — merge with pre-extracted
      const llmSlots: SearchSlots = {
        domains: result.slots.domains ?? [targetDomain],
        filters: result.slots.filters ?? {},
        ranges: result.slots.ranges ?? {},
        location: result.slots.location,
        license: result.slots.license,
      }
      const mergedSlots: SearchSlots = mergeSlots(llmSlots, preSlots)
      const sparql = await compileSlots(mergedSlots)

      // Merge deterministic gaps with LLM-reported gaps (deduplicate by term)
      const llmGapTerms = new Set(result.gaps.map((g) => g.term.toLowerCase()))
      const mergedGaps = [
        ...result.gaps,
        ...matchResult.gaps.filter((g) => !llmGapTerms.has(g.term.toLowerCase())),
      ]

      return {
        interpretation: result.interpretation,
        gaps: mergedGaps,
        sparql,
      }
    }

    // Fallback: compile from pre-extracted only
    if (matchResult.matches.length > 0) {
      const sparql = await compileSlots(preSlots)
      return {
        interpretation: {
          summary: 'Interpreted via ontology concept matching (SKOS)',
          mappedTerms: matchResult.matches.map((m) => ({
            input: m.input,
            mapped: m.value,
            confidence: m.confidence,
            property: m.property,
          })),
        },
        gaps: matchResult.gaps,
        sparql,
      }
    }

    throw new Error('Agent did not call submit_slots')
  } finally {
    await session.disconnect()
  }
}

/**
 * Convert concept match results to generic SearchSlots.
 */
function matchResultToSlots(
  matches: { property: string; value: string; domain?: string }[],
  defaultDomain = 'hdmap'
): SearchSlots {
  const slots: SearchSlots = {
    domains: [defaultDomain],
    filters: {},
    ranges: {},
  }

  const detectedDomains = new Set<string>()

  for (const match of matches) {
    const domain = match.domain || defaultDomain
    detectedDomains.add(domain)

    if (['country', 'state', 'region', 'city'].includes(match.property)) {
      if (!slots.location) slots.location = {}
      slots.location[match.property as keyof NonNullable<SearchSlots['location']>] = match.value
    } else {
      const existing = slots.filters[match.property]
      if (existing) {
        slots.filters[match.property] = Array.isArray(existing)
          ? [...existing, match.value]
          : [existing, match.value]
      } else {
        slots.filters[match.property] = match.value
      }
    }
  }

  if (detectedDomains.size > 0) {
    slots.domains = [...detectedDomains]
  }

  return slots
}

/**
 * Merge two slot sets. Pre-extracted (deterministic) wins on conflicts.
 */
function mergeSlots(base: SearchSlots, override: SearchSlots): SearchSlots {
  return {
    domains: override.domains.length > 0 ? override.domains : base.domains,
    filters: { ...base.filters, ...override.filters },
    ranges: { ...base.ranges, ...override.ranges },
    location: { ...base.location, ...override.location },
    license: override.license || base.license,
  }
}
