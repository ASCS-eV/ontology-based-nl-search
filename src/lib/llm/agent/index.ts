import { readFileSync } from 'fs'
import path from 'path'
import { generateText } from 'ai'
import { getModel } from '../provider'
import { getOntologyContext } from '@/lib/ontology'
import { agentTools } from './tools'
import type { LlmStructuredResponse } from '../types'

const SKILL_PATH = path.join(__dirname, 'skill.md')

/** Maximum tool-calling steps before we force a result */
const MAX_STEPS = 10

/**
 * Load the skill definition (system prompt for the agent).
 * Appends live ontology context so the LLM has full knowledge.
 */
async function buildSystemPrompt(): Promise<string> {
  let skillContent: string
  try {
    skillContent = readFileSync(SKILL_PATH, 'utf-8')
  } catch {
    // Fallback if bundled path doesn't resolve (Next.js webpack)
    skillContent = getSkillFallback()
  }

  const ontologyContext = await getOntologyContext()

  return `${skillContent}

## Full Ontology Reference

${ontologyContext}`
}

/**
 * Run the SPARQL generator agent with tool use.
 * The agent calls tools (lookup, validate, execute) and submits
 * its final answer through the submit_answer tool.
 */
export async function runSparqlAgent(
  naturalLanguageQuery: string,
): Promise<LlmStructuredResponse> {
  const systemPrompt = await buildSystemPrompt()
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

/**
 * Inline fallback skill content for environments where file reads fail.
 */
function getSkillFallback(): string {
  return `# SPARQL Generator Agent — Skill Definition

You are a SPARQL query generation agent for the ENVITED-X HD Map knowledge graph.

## Your Task
Translate a user's natural language query into a valid SPARQL query.
You communicate ONLY through tool calls — never reply with plain text.

## Workflow
1. Call lookup_ontology_terms to find matching ontology properties
2. Build a SPARQL query using validated terms
3. Call validate_sparql to check syntax
4. Call execute_sparql to verify results
5. Call submit_answer with the final structured output

## Prefixes
PREFIX hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/>
PREFIX envited-x: <https://w3id.org/ascs-ev/envited-x/envited-x/v3/>
PREFIX georeference: <https://w3id.org/ascs-ev/envited-x/georeference/v5/>
PREFIX gx: <https://w3id.org/gaia-x/development#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>`
}
