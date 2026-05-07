import { readFileSync } from 'fs'
import path from 'path'

import { generateText } from 'ai'

import { matchConcepts } from '@/lib/ontology'
import { compileSlots } from '@/lib/search/compiler'
import { type LegacySearchSlots, type SearchSlots, fromLegacySlots } from '@/lib/search/slots'

import { getModel } from '../provider'
import type { LlmStructuredResponse } from '../types'
import { agentTools } from './tools'

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

export interface AgentOptions {
  domain?: string
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
export async function runSparqlAgent(
  naturalLanguageQuery: string,
  options?: AgentOptions
): Promise<LlmStructuredResponse> {
  const targetDomain = options?.domain ?? 'hdmap'
  const systemPrompt = await getSystemPrompt()
  const model = getModel()

  // Step 1: Ontology-driven concept matching (SKOS + SHACL vocabulary)
  const matchResult = await matchConcepts(naturalLanguageQuery)

  // Convert matched concepts to generic slots
  const preSlots = matchResultToSlots(matchResult.matches, targetDomain)

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
      slots: LegacySearchSlots
      interpretation: LlmStructuredResponse['interpretation']
      gaps: LlmStructuredResponse['gaps']
    }

    // Step 3: Convert LLM legacy slots + merge with pre-extracted
    const llmSlots = fromLegacySlots(answer.slots)
    const mergedSlots: SearchSlots = mergeSlots(llmSlots, preSlots)

    // Step 4: Compile to SPARQL
    const sparql = await compileSlots(mergedSlots)

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

  throw new Error('Agent failed to produce a result after maximum steps')
}

/**
 * Convert concept match results to generic SearchSlots.
 * Groups by domain based on the property's ontology prefix.
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

    // Location properties go to the location field
    if (['country', 'state', 'region', 'city'].includes(match.property)) {
      if (!slots.location) slots.location = {}
      slots.location[match.property as keyof NonNullable<SearchSlots['location']>] = match.value
    } else {
      // All other properties go to filters
      const existing = slots.filters[match.property]
      if (existing) {
        // Multiple values for same property → array
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
