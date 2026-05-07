import { readFileSync } from 'fs'
import path from 'path'
import { generateText } from 'ai'
import { getModel } from '../provider'
import { agentTools } from './tools'
import { compileSlots } from '@/lib/search/compiler'
import { matchConcepts } from '@/lib/ontology'
import type { SearchSlots } from '@/lib/search/slots'
import type { LlmStructuredResponse } from '../types'

const SKILL_PATH = path.join(__dirname, 'skill.md')

/**
 * Maximum tool-calling steps. With slot-filling, the agent typically
 * needs only 1 step: submit_slots. Allow 3 for retries.
 */
const MAX_STEPS = 3

/** Cached system prompt (skill + ontology vocab are static) */
let cachedSystemPrompt: string | null = null

/**
 * Load the skill definition which embeds the slot vocabulary.
 * Cached after first load since it doesn't change at runtime.
 */
async function getSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt

  let skillContent: string
  try {
    skillContent = readFileSync(SKILL_PATH, 'utf-8')
  } catch {
    skillContent = readFileSync(
      path.join(process.cwd(), 'src', 'lib', 'llm', 'agent', 'skill.md'),
      'utf-8'
    )
  }

  cachedSystemPrompt = skillContent
  return cachedSystemPrompt
}

/**
 * Run the slot-filling agent.
 *
 * Pipeline:
 * 1. Pre-process query with deterministic synonym extraction
 * 2. LLM fills remaining slots (only needs to handle ambiguity)
 * 3. Merge pre-processed + LLM slots
 * 4. Compile slots to SPARQL deterministically
 */
export async function runSparqlAgent(naturalLanguageQuery: string): Promise<LlmStructuredResponse> {
  const systemPrompt = await getSystemPrompt()
  const model = getModel()

  // Step 1: Ontology-driven concept matching (SKOS + SHACL vocabulary)
  const matchResult = await matchConcepts(naturalLanguageQuery)

  // Convert matched concepts to partial slots
  const preSlots: Partial<SearchSlots> = {}
  for (const match of matchResult.matches) {
    applyMatchToSlots(preSlots, match.property, match.value)
  }

  // Step 2: LLM fills remaining slots from the remainder
  const promptContext =
    matchResult.matches.length > 0
      ? `Pre-extracted slots (already determined, do not override unless wrong): ${JSON.stringify(preSlots)}\n\nRemaining query to classify: "${matchResult.remainder || naturalLanguageQuery}"\n\nOriginal full query: "${naturalLanguageQuery}"`
      : naturalLanguageQuery

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: promptContext,
    tools: agentTools,
    maxSteps: MAX_STEPS,
    toolChoice: 'required',
  })

  // Extract the submit_slots call from tool results
  const submitCall = result.steps
    .flatMap((step) => step.toolResults)
    .find((r) => r.toolName === 'submit_slots')

  if (submitCall) {
    const answer = submitCall.result as {
      slots: SearchSlots
      interpretation: LlmStructuredResponse['interpretation']
      gaps: LlmStructuredResponse['gaps']
    }

    // Step 3: Merge pre-processed slots with LLM slots (pre-processed wins for conflicts)
    const mergedSlots: SearchSlots = { ...answer.slots, ...preSlots }

    // Step 4: Compile to SPARQL
    const sparql = compileSlots(mergedSlots)

    // Merge deterministic gaps with LLM-reported gaps (deduplicate by term)
    const llmGapTerms = new Set(answer.gaps.map((g) => g.term.toLowerCase()))
    const mergedGaps = [
      ...answer.gaps,
      ...matchResult.gaps.filter((g) => !llmGapTerms.has(g.term.toLowerCase())),
    ]

    return {
      interpretation: answer.interpretation,
      gaps: mergedGaps,
      sparql,
    }
  }

  // Fallback: if agent didn't call submit_slots, compile from pre-extracted only
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

  throw new Error('Agent failed to produce a result after maximum steps')
}

/**
 * Map an ontology property name (from SHACL) to the SearchSlots field.
 * Generic: maps property local names to slot fields.
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
    // Georeference properties
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
