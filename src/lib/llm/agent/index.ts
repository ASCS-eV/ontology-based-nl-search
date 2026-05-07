import { readFileSync } from 'fs'
import path from 'path'
import { generateText } from 'ai'
import { getModel } from '../provider'
import { agentTools } from './tools'
import type { LlmStructuredResponse } from '../types'

const SKILL_PATH = path.join(__dirname, 'skill.md')

/**
 * Maximum tool-calling steps. With the optimized skill prompt,
 * the agent typically needs only 2 steps: validate_sparql + submit_answer.
 * Allow 5 for retries on validation failure.
 */
const MAX_STEPS = 5

/** Cached system prompt (skill + ontology vocab are static) */
let cachedSystemPrompt: string | null = null

/**
 * Load the skill definition which embeds the full ontology vocabulary.
 * Cached after first load since the ontology doesn't change at runtime.
 */
async function getSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt

  let skillContent: string
  try {
    skillContent = readFileSync(SKILL_PATH, 'utf-8')
  } catch {
    skillContent = readFileSync(
      path.join(process.cwd(), 'src', 'lib', 'llm', 'agent', 'skill.md'),
      'utf-8',
    )
  }

  cachedSystemPrompt = skillContent
  return cachedSystemPrompt
}

/**
 * Run the SPARQL generator agent with tool use.
 *
 * Optimized flow (2 steps typical):
 * 1. LLM reads vocab from system prompt → generates SPARQL → calls validate_sparql
 * 2. If valid → calls submit_answer. If invalid → fixes and retries.
 */
export async function runSparqlAgent(
  naturalLanguageQuery: string,
): Promise<LlmStructuredResponse> {
  const systemPrompt = await getSystemPrompt()
  const model = getModel()

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: naturalLanguageQuery,
    tools: agentTools,
    maxSteps: MAX_STEPS,
    toolChoice: 'required',
  })

  // Extract the submit_answer call from tool results
  const submitCall = result.steps
    .flatMap((step) => step.toolResults)
    .find((r) => r.toolName === 'submit_answer')

  if (submitCall) {
    const answer = submitCall.result as {
      interpretation: LlmStructuredResponse['interpretation']
      gaps: LlmStructuredResponse['gaps']
      sparql: string
    }
    return {
      interpretation: answer.interpretation,
      gaps: answer.gaps,
      sparql: answer.sparql,
    }
  }

  // Fallback: if agent didn't call submit_answer, try to extract from text
  if (result.text) {
    return {
      interpretation: {
        summary: 'Agent did not produce a structured answer',
        mappedTerms: [],
      },
      gaps: [],
      sparql: result.text,
    }
  }

  throw new Error('Agent failed to produce a result after maximum steps')
}
