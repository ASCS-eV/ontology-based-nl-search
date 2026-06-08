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
 */

import { z } from 'zod'

// ─── Reference filter (recursive) ────────────────────────────────────────────

/** Input shape for a cross-domain reference filter (recursive). */
export interface ReferenceFilterInput {
  domain: string
  label?: string
  references?: ReferenceFilterInput[]
}

/**
 * Recursive Zod schema for cross-domain reference filters.
 * Validates nested chains like `scenario → trace → map`.
 */
export const referenceFilterWireSchema: z.ZodType<ReferenceFilterInput> = z.lazy(() =>
  z.object({
    domain: z.string(),
    label: z.string().optional(),
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
