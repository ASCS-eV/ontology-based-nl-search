import { tool } from 'ai'
import { z } from 'zod'

/**
 * Tool schema for the LLM slot-filling agent.
 *
 * Design: The schema mirrors SearchSlots directly — no conversion needed.
 * The LLM fills property names matching the ontology local names
 * (e.g., "roadTypes", "laneTypes", "formatType") as documented in skill.md.
 */
const slotSubmissionSchema = z.object({
  slots: z
    .object({
      domains: z.array(z.string()).default([]).describe('Target domain(s)'),
      filters: z
        .record(z.string(), z.union([z.string(), z.array(z.string())]))
        .default({})
        .describe('Property filters: localName → value(s)'),
      ranges: z
        .record(z.string(), z.object({ min: z.number().optional(), max: z.number().optional() }))
        .default({})
        .describe('Numeric ranges: localName → { min?, max? }'),
      location: z
        .object({
          country: z.string().optional(),
          state: z.string().optional(),
          region: z.string().optional(),
          city: z.string().optional(),
        })
        .optional()
        .describe('Geographic location filters'),
      license: z.string().optional().describe('License identifier'),
    })
    .describe('Search slots: fill only properties where the user expressed intent'),
  interpretation: z.object({
    summary: z.string().describe('Human-readable summary of what was understood'),
    mappedTerms: z.array(
      z.object({
        input: z.string().describe('What the user said'),
        mapped: z.string().describe('Ontology concept/slot value it maps to'),
        confidence: z.enum(['high', 'medium', 'low']).describe('Mapping confidence'),
        property: z.string().optional().describe('The property name used'),
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
})

export type SlotSubmissionParams = z.infer<typeof slotSubmissionSchema>

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
  submit_slots: tool<SlotSubmissionParams, SlotSubmissionParams>({
    description:
      'Submit the structured search result. Fill slots for known concepts, report gaps for unknown concepts. Call this exactly once.',
    inputSchema: slotSubmissionSchema,
    execute: async (params) => {
      return params
    },
  }),
}
