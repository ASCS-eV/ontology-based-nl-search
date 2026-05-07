import { tool } from 'ai'
import { z } from 'zod'
import { validateSparql } from './validator'
import { lookupOntologyTerms } from './ontology-lookup'
import { getSparqlStore } from '@/lib/sparql'

/**
 * Tool definitions for the SPARQL generator agent.
 * These are called by the LLM via function calling — the LLM never generates
 * raw text, it only communicates through structured tool invocations.
 */
export const agentTools = {
  /**
   * Look up concepts in the ontology to find matching properties/classes.
   * The LLM MUST call this before writing any SPARQL to verify term names.
   */
  lookup_ontology_terms: tool({
    description:
      'Look up one or more concepts in the HD map ontology. Returns matching properties/classes and suggestions for unmatched terms. ALWAYS call this before writing SPARQL.',
    parameters: z.object({
      terms: z
        .array(z.string())
        .describe('Concepts to look up (e.g., ["country", "motorway", "lanes", "traffic lights"])'),
    }),
    execute: async ({ terms }) => {
      const results = await lookupOntologyTerms(terms)
      return { results }
    },
  }),

  /**
   * Validate a SPARQL query for syntactic correctness.
   * The LLM MUST call this before submitting the final answer.
   */
  validate_sparql: tool({
    description:
      'Validate a SPARQL query for syntactic correctness. Returns whether the query is valid and any error messages. ALWAYS call this before submit_answer.',
    parameters: z.object({
      query: z.string().describe('The SPARQL query string to validate'),
    }),
    execute: async ({ query }) => {
      return validateSparql(query)
    },
  }),

  /**
   * Execute a SPARQL query against the store and return result count + sample.
   * Useful for the LLM to verify the query returns results before submitting.
   */
  execute_sparql: tool({
    description:
      'Execute a SPARQL query against the knowledge graph and return the result count and first 3 sample results. Use this to verify your query returns data.',
    parameters: z.object({
      query: z.string().describe('The SPARQL query to execute'),
    }),
    execute: async ({ query }) => {
      try {
        const store = getSparqlStore()
        const results = await store.query(query)
        const bindings = results.results.bindings
        const sample = bindings.slice(0, 3).map((b) => {
          const row: Record<string, string> = {}
          for (const [key, value] of Object.entries(b)) {
            row[key] = value.value
          }
          return row
        })
        return {
          success: true,
          count: bindings.length,
          sample,
          variables: results.head.vars,
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          count: 0,
          sample: [],
        }
      }
    },
  }),

  /**
   * Submit the final answer. This is how the LLM returns its structured result.
   * The LLM MUST call this exactly once as the final step.
   */
  submit_answer: tool({
    description:
      'Submit the final structured answer. Call this exactly once as your last action after validating the SPARQL query.',
    parameters: z.object({
      interpretation: z.object({
        summary: z.string().describe('Human-readable summary of what was understood'),
        mappedTerms: z.array(
          z.object({
            input: z.string().describe('What the user said'),
            mapped: z.string().describe('Ontology concept it maps to'),
            confidence: z.enum(['high', 'medium', 'low']).describe('Mapping confidence'),
            property: z.string().optional().describe('The ontology property used'),
          })
        ),
      }),
      gaps: z.array(
        z.object({
          term: z.string().describe('Unmapped user term'),
          reason: z.string().describe('Why it could not be mapped to the ontology'),
          suggestions: z.array(z.string()).optional().describe('Nearest ontology concepts'),
        })
      ),
      sparql: z.string().describe('The validated SPARQL query'),
    }),
    execute: async (params) => {
      // This is a "return" tool — we just pass through the structured result
      return params
    },
  }),
}
