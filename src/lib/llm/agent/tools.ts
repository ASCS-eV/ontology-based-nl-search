import { tool } from 'ai'
import { z } from 'zod'

/**
 * Tool definitions for the slot-filling agent.
 * The LLM fills structured slots instead of writing raw SPARQL.
 * SPARQL is compiled deterministically from slots by the compiler.
 */
export const agentTools = {
  /**
   * Submit the structured slot-based answer.
   * The LLM fills search slots and provides interpretation/gaps.
   */
  submit_slots: tool({
    description:
      'Submit the structured search result. Fill slots for known concepts, report gaps for unknown concepts. Call this exactly once.',
    parameters: z.object({
      slots: z
        .object({
          country: z.string().optional(),
          state: z.string().optional(),
          region: z.string().optional(),
          city: z.string().optional(),
          roadType: z.string().optional(),
          laneType: z.string().optional(),
          levelOfDetail: z.string().optional(),
          trafficDirection: z.string().optional(),
          formatType: z.string().optional(),
          formatVersion: z.string().optional(),
          dataSource: z.string().optional(),
          license: z.string().optional(),
          minLength: z.number().optional(),
          maxLength: z.number().optional(),
          minIntersections: z.number().optional(),
          minTrafficLights: z.number().optional(),
          minTrafficSigns: z.number().optional(),
          minSpeedLimit: z.number().optional(),
          maxSpeedLimit: z.number().optional(),
        })
        .describe('Search slots: only fill keys where the user expressed intent'),
      interpretation: z.object({
        summary: z.string().describe('Human-readable summary of what was understood'),
        mappedTerms: z.array(
          z.object({
            input: z.string().describe('What the user said'),
            mapped: z.string().describe('Ontology concept/slot value it maps to'),
            confidence: z.enum(['high', 'medium', 'low']).describe('Mapping confidence'),
            property: z.string().optional().describe('The slot name used'),
          })
        ),
      }),
      gaps: z.array(
        z.object({
          term: z.string().describe('Unmapped user term'),
          reason: z.string().describe('Why it could not be mapped to a slot'),
          suggestions: z.array(z.string()).optional().describe('Nearest slot values'),
        })
      ),
    }),
    execute: async (params) => {
      return params
    },
  }),
}
