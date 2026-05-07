import { readFileSync } from 'fs'
import path from 'path'
import { generateText } from 'ai'
import { getModel } from '../provider'
import { agentTools } from './tools'
import { compileSlots } from '@/lib/search/compiler'
import { extractKnownTerms } from '@/lib/search/synonyms'
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

  // Step 1: Deterministic synonym pre-processing
  const { terms: preExtracted, remainder } = extractKnownTerms(naturalLanguageQuery)

  // Convert pre-extracted terms to partial slots
  const preSlots: Partial<SearchSlots> = {}
  for (const term of preExtracted) {
    switch (term.property) {
      case 'country':
        preSlots.country = term.value
        break
      case 'roadType':
        preSlots.roadType = term.value
        break
      case 'formatType':
        preSlots.formatType = term.value
        break
      case 'dataSource':
        preSlots.dataSource = term.value
        break
      case 'laneType':
        preSlots.laneType = term.value
        break
    }
  }

  // Step 2: LLM fills remaining slots from the remainder
  const promptContext =
    preExtracted.length > 0
      ? `Pre-extracted slots (already determined, do not override unless wrong): ${JSON.stringify(preSlots)}\n\nRemaining query to classify: "${remainder || naturalLanguageQuery}"\n\nOriginal full query: "${naturalLanguageQuery}"`
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

    return {
      interpretation: answer.interpretation,
      gaps: answer.gaps,
      sparql,
    }
  }

  // Fallback: if agent didn't call submit_slots, compile from pre-extracted only
  if (preExtracted.length > 0) {
    const sparql = compileSlots(preSlots as SearchSlots)
    return {
      interpretation: {
        summary: 'Partial interpretation from deterministic extraction',
        mappedTerms: preExtracted.map((t) => ({
          input: t.original,
          mapped: t.value,
          confidence: 'high' as const,
          property: t.property,
        })),
      },
      gaps: [],
      sparql,
    }
  }

  throw new Error('Agent failed to produce a result after maximum steps')
}
