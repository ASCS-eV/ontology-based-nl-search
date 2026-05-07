import { readFileSync } from 'fs'
import path from 'path'
import { CopilotClient, approveAll, defineTool, type CopilotSession } from '@github/copilot-sdk'
import { compileSlots } from '@/lib/search/compiler'
import { matchConcepts } from '@/lib/ontology'
import type { SearchSlots } from '@/lib/search/slots'
import type { LlmStructuredResponse } from '../types'

interface SlotSubmission {
  slots: SearchSlots
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
  naturalLanguageQuery: string
): Promise<LlmStructuredResponse> {
  const systemPrompt = await getSystemPrompt()
  const modelId = process.env.AI_MODEL || 'claude-sonnet-4.5'
  const c = await getClient()

  // Step 1: Ontology-driven concept matching (SKOS + SHACL vocabulary)
  const matchResult = await matchConcepts(naturalLanguageQuery)

  const preSlots: Partial<SearchSlots> = {}
  for (const match of matchResult.matches) {
    applyMatchToSlots(preSlots, match.property, match.value)
  }

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
    // Register slot-filling tool
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
                country: { type: 'string' },
                state: { type: 'string' },
                region: { type: 'string' },
                city: { type: 'string' },
                roadType: { type: 'string' },
                laneType: { type: 'string' },
                levelOfDetail: { type: 'string' },
                trafficDirection: { type: 'string' },
                formatType: { type: 'string' },
                formatVersion: { type: 'string' },
                dataSource: { type: 'string' },
                license: { type: 'string' },
                minLength: { type: 'number' },
                maxLength: { type: 'number' },
                minIntersections: { type: 'number' },
                minTrafficLights: { type: 'number' },
                minTrafficSigns: { type: 'number' },
                minSpeedLimit: { type: 'number' },
                maxSpeedLimit: { type: 'number' },
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
      // Merge pre-processed + LLM slots
      const mergedSlots: SearchSlots = {
        ...result.slots,
        ...preSlots,
      }
      const sparql = compileSlots(mergedSlots)

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
      const sparql = compileSlots(preSlots as SearchSlots)
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
 * Map an ontology property name (from SHACL) to the SearchSlots field.
 */
function applyMatchToSlots(slots: Partial<SearchSlots>, property: string, value: string): void {
  switch (property) {
    case 'country':
      slots.country = value
      break
    case 'roadTypes':
      slots.roadType = value
      break
    case 'laneTypes':
      slots.laneType = value
      break
    case 'formatType':
      slots.formatType = value
      break
    case 'trafficDirection':
      slots.trafficDirection = value
      break
    case 'state':
      slots.state = value
      break
    case 'city':
      slots.city = value
      break
    case 'region':
      slots.region = value
      break
  }
}
