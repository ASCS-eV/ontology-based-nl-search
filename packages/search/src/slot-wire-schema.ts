/**
 * Shared Zod wire schemas for slot submission.
 *
 * These schemas define the canonical structure for:
 *   - Reference filters (recursive cross-domain joins)
 *   - Interpretation metadata (LLM mapping explanation)
 *   - Gap reports (unmapped user terms)
 *
 * Consumers (LLM tool definitions, submission router, API routes) import
 * these base schemas and layer on context-specific decorators (.describe(),
 * .default(), .transform()) without duplicating the structural definition.
 *
 * STANDARDS — the slot wire format is held to JSON Schema, not an invented
 * contract. The Vercel AI SDK serializes these Zod schemas to JSON Schema
 * 2020-12 for the LLM tool call (`submit_slots`), so JSON Schema is the
 * normative grounding for the entire slot interface.
 *   [JSON-SCHEMA-CORE] JSON Schema 2020-12 — docs/specs/references/json-schema-core.md
 *   [JSON-SCHEMA-VAL]  JSON Schema Validation — docs/specs/references/json-schema-validation.md
 * The "slots mechanism" itself (intent + slot-filling) is a bespoke IR with no
 * single spec; see apps/docs/standards-audit.md for provenance.
 */

import { z } from 'zod'

// ─── Reference filter (recursive) ────────────────────────────────────────────

/** Input shape for a cross-domain reference filter (recursive). */
export interface ReferenceFilterInput {
  domain: string
  label?: string
  filters?: Record<string, string | string[]>
  ranges?: Record<string, { min?: number; max?: number }>
  references?: ReferenceFilterInput[]
}

/**
 * Recursive Zod schema for cross-domain reference filters.
 * Validates nested chains like `scenario → trace → map`.
 *
 * `filters`/`ranges` constrain the REFERENCED asset itself, so the compiler
 * binds them to the reference's variable rather than the primary asset (the
 * cross-domain anchoring fix). [JSON-SCHEMA-CORE] object/optional keywords.
 */
export const referenceFilterWireSchema: z.ZodType<ReferenceFilterInput> = z.lazy(() =>
  z.object({
    domain: z.string(),
    label: z.string().optional(),
    filters: z
      .record(z.string(), z.union([z.string(), z.array(z.string())]))
      .optional()
      .describe(
        'Property filters on THIS referenced asset (keyed by SHACL leaf local name), ' +
          'e.g. { "country": ["DE","FR"] } for "referenced maps in Germany or France". ' +
          'Put constraints that describe the referenced asset here, NOT in the top-level slots.'
      ),
    ranges: z
      .record(z.string(), z.object({ min: z.number().optional(), max: z.number().optional() }))
      .optional()
      .describe(
        'Numeric range filters on THIS referenced asset, e.g. ' +
          '{ "numberIntersections": { "min": 1 } } for "referenced maps with at least one intersection".'
      ),
    references: z.array(referenceFilterWireSchema).optional(),
  })
)

// ─── Interpretation ──────────────────────────────────────────────────────────

/** Schema for a single mapped-term entry in the interpretation. */
export const mappedTermWireSchema = z.object({
  input: z.string(),
  mapped: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  property: z.string().optional(),
})

/** Schema for the LLM's interpretation metadata. */
export const interpretationWireSchema = z.object({
  summary: z.string(),
  mappedTerms: z.array(mappedTermWireSchema),
})

// ─── Gaps ────────────────────────────────────────────────────────────────────

/** Schema for a single unmapped-term gap report. */
export const gapWireSchema = z.object({
  term: z.string(),
  reason: z.string(),
  suggestions: z.array(z.string()).optional(),
})

/** Schema for the full gaps array. */
export const gapsWireSchema = z.array(gapWireSchema)

// ─── Inferred types ──────────────────────────────────────────────────────────

export type InterpretationWire = z.infer<typeof interpretationWireSchema>
export type GapWire = z.infer<typeof gapWireSchema>
export type MappedTermWire = z.infer<typeof mappedTermWireSchema>
