import {
  gapsWireSchema,
  interpretationWireSchema,
  searchSlotsWireSchema,
} from '@ontology-search/slots/slot-wire-schema'
import { tool, type ToolSet } from 'ai'
import { z } from 'zod'

import { SCHEMA_TOOL_DEFINITIONS, SCHEMA_TOOL_NAMES } from './schema-tools.js'

/** The single tool that ends a slot-filling run. */
export const SUBMIT_TOOL_NAME = 'submit_slots' as const

/**
 * Every tool name the agent may legitimately call. Consumers that classify
 * tool traces read this instead of restating the registry.
 */
export const AGENT_TOOL_NAMES = [...SCHEMA_TOOL_NAMES, SUBMIT_TOOL_NAME] as const

/**
 * Tool schema for the LLM slot-filling agent.
 *
 * Design: The schema mirrors SearchSlots directly — no conversion needed.
 * The LLM fills property names matching the ontology local names
 * (from SHACL sh:path declarations) as documented in the agent-tools
 * catalog (apps/docs/agent-tools.md).
 */

export const slotSubmissionSchema = z.object({
  // Structure comes from `searchSlotsWireSchema` — the single definition of the
  // slot payload shared with the compiler and the evaluation harness. Only
  // prompt-facing description text is layered on here, per the wire-schema
  // module's stated contract: decorate, never redeclare.
  slots: z
    .object({
      domains: searchSlotsWireSchema.shape.domains.describe('Target domain(s)'),
      filters: searchSlotsWireSchema.shape.filters.describe(
        'Property filters keyed by SHACL leaf local name. Includes EVERY literal/IRI constraint — geography, license, etc. Geographic filters use the property local names declared in the ontology (e.g. "country", "state", "region", "city" when the SHACL has those leaves); the compiler discovers the chain from the asset class to each leaf. Use arrays for IN-semantics (e.g. ["DE","FR"] when the user expresses a region).'
      ),
      ranges: searchSlotsWireSchema.shape.ranges.describe(
        'Numeric ranges: localName → { min?, max? }'
      ),
      references: searchSlotsWireSchema.shape.references.describe(
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
export const agentTools: ToolSet = {
  /**
   * Submit the structured slot-based answer.
   * The LLM fills search slots and provides interpretation/gaps.
   */
  // Input and output types are INFERRED from `inputSchema` and `execute`
  // rather than given explicitly. `tool()`'s trailing generic is now
  // `CONTEXT extends Context`, so a two-argument `tool<INPUT, OUTPUT>` binds
  // the submission type to CONTEXT and matches no overload.
  submit_slots: tool({
    description:
      'Submit the structured search result. Fill slots for known concepts, report gaps for unknown concepts. Call this exactly once.',
    inputSchema: slotSubmissionSchema,
    execute: async (params: SlotSubmissionParams): Promise<SlotSubmissionParams> => {
      return params
    },
  }),
}

/**
 * Vercel-SDK wrappers for the schema-lookup tools. The canonical
 * definitions (args, handlers, security notes) live in schema-tools.ts;
 * this only adapts them to `ai`'s tool shape.
 */
export const lookupTools: ToolSet = Object.fromEntries(
  SCHEMA_TOOL_DEFINITIONS.map((def) => [
    def.name,
    tool({
      description: def.description,
      inputSchema: def.argsSchema,
      execute: (args: unknown) => def.handler(args),
    }),
  ])
)
