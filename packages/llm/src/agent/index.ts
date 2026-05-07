import { matchConcepts } from '@ontology-search/ontology'
import { compileSlots } from '@ontology-search/search/compiler'
import type { SearchSlots } from '@ontology-search/search/slots'
import { generateText, stepCountIs } from 'ai'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { getModel } from '../provider.js'
import type { LlmStructuredResponse } from '../types.js'
import { agentTools, type SlotSubmissionParams } from './tools.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SKILL_PATH = join(__dirname, 'skill.md')

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

  cachedSystemPrompt = readFileSync(SKILL_PATH, 'utf-8')
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
    toolChoice: 'required',
    stopWhen: stepCountIs(MAX_STEPS),
  })

  // Extract the submit_slots call from tool results
  const submitCall = result.steps
    .flatMap((step) => step.toolResults)
    .find((r) => r.toolName === 'submit_slots')

  if (submitCall) {
    const answer = submitCall.output as SlotSubmissionParams

    // Step 3: LLM now emits SearchSlots directly — merge with pre-extracted
    const llmSlots: SearchSlots = {
      domains: answer.slots.domains ?? [targetDomain],
      filters: answer.slots.filters ?? {},
      ranges: answer.slots.ranges ?? {},
      location: answer.slots.location,
      license: answer.slots.license,
    }
    const mergedSlots = mergeSlots(llmSlots, preSlots)

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

  // Fallback: compile from pre-extracted slots or broad domain query
  const fallbackSlots: SearchSlots =
    matchResult.matches.length > 0
      ? preSlots
      : { domains: [options?.domain ?? 'hdmap'], filters: {}, ranges: {} }
  const sparql = await compileSlots(fallbackSlots)
  return {
    interpretation: {
      summary:
        matchResult.matches.length > 0
          ? 'Interpreted via ontology concept matching (SKOS)'
          : `Broad ${options?.domain ?? 'hdmap'} search (no specific filters matched)`,
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

/**
 * Convert concept match results to generic SearchSlots.
 * Groups by domain based on the property's ontology prefix.
 */
/** Supporting ontologies that should not override the primary asset domain */
const SUPPORTING_DOMAINS = new Set([
  'georeference',
  'manifest',
  'gx',
  'envited-x',
  'general',
  'openlabel',
  'unknown',
])

function matchResultToSlots(
  matches: { property: string; value: string; domain?: string }[],
  defaultDomain = 'hdmap'
): SearchSlots {
  const slots: SearchSlots = {
    domains: [defaultDomain],
    filters: {},
    ranges: {},
  }

  const detectedAssetDomains = new Set<string>()

  for (const match of matches) {
    const domain = match.domain || defaultDomain

    // Only track actual asset domains (not supporting ontologies)
    if (!SUPPORTING_DOMAINS.has(domain)) {
      detectedAssetDomains.add(domain)
    }

    // Location properties go to the location field
    if (['country', 'state', 'region', 'city'].includes(match.property)) {
      if (!slots.location) slots.location = {}
      slots.location[match.property as keyof NonNullable<SearchSlots['location']>] = match.value
    } else if (match.property === 'license') {
      slots.license = match.value
    } else if (match.value === 'range') {
      // Quantity properties: signal "has any value" via min: 1
      slots.ranges[match.property] = { min: 1 }
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

  if (detectedAssetDomains.size > 0) {
    slots.domains = [...detectedAssetDomains]
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
