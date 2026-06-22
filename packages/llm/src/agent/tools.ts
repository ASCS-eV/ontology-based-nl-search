import {
  gapsWireSchema,
  interpretationWireSchema,
  referenceFilterWireSchema,
} from '@ontology-search/search/slot-wire-schema'
import { tool } from 'ai'
import { z } from 'zod'

/**
 * Tool schema for the LLM slot-filling agent.
 *
 * Design: The schema mirrors SearchSlots directly — no conversion needed.
 * The LLM fills property names matching the ontology local names
 * (from SHACL sh:path declarations) as documented in skill.md.
 */

export const slotSubmissionSchema = z.object({
  slots: z
    .object({
      domains: z.array(z.string()).default([]).describe('Target domain(s)'),
      filters: z
        .record(z.string(), z.union([z.string(), z.array(z.string())]))
        .default({})
        .describe(
          'Property filters keyed by SHACL leaf local name. Includes EVERY literal/IRI constraint — geography, license, etc. Geographic filters use the property local names declared in the ontology (e.g. "country", "state", "region", "city" when the SHACL has those leaves); the compiler discovers the chain from the asset class to each leaf. Use arrays for IN-semantics (e.g. ["DE","FR"] when the user expresses a region).'
        ),
      ranges: z
        .record(z.string(), z.object({ min: z.number().optional(), max: z.number().optional() }))
        .default({})
        .describe('Numeric ranges: localName → { min?, max? }'),
      references: z
        .union([referenceFilterWireSchema, z.array(referenceFilterWireSchema)])
        .optional()
        .describe(
          'Cross-reference filter(s): find assets that reference one or more other domains. ' +
            'Pass an ARRAY with one entry per referenced domain when the user names several ' +
            '(AND-combined — the asset must reference all). A single object is also accepted. ' +
            'Put constraints that describe the REFERENCED asset inside that entry via its ' +
            '`filters`/`ranges` (e.g. referenced maps in a country, or with >= N intersections) — ' +
            'NOT in the top-level slots. Each entry may also nest its own `references` for a chain.'
        ),
    })
    .describe('Search slots: fill only properties where the user expressed intent'),
  interpretation: interpretationWireSchema.extend({
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
  gaps: gapsWireSchema.element
    .extend({
      term: z.string().describe('Unmapped user term'),
      reason: z.string().describe('Why it could not be mapped to a slot'),
      suggestions: z.array(z.string()).optional().describe('Nearest slot values'),
    })
    .array(),
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
