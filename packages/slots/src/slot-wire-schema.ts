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

// ─── Leaf value shapes ───────────────────────────────────────────────────────

/**
 * A property filter map: SHACL leaf local name → one value or several.
 * An array carries IN-semantics for the compiler.
 */
export const slotFiltersWireSchema = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())])
)

/**
 * A single numeric range. Both bounds are optional and an empty object is
 * VALID: a model that names a range property without committing to a bound
 * has still emitted a structurally well-formed submission, and the slot
 * pipeline — not the wire schema — decides what an unbounded range means.
 * Tightening this here would make the wire contract reject payloads the
 * production agent accepts. [JSON-SCHEMA-VAL] §6.5 object/optional keywords.
 */
export const slotRangeWireSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
})

/** A numeric range map: SHACL leaf local name → range. */
export const slotRangesWireSchema = z.record(z.string(), slotRangeWireSchema)

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
    filters: slotFiltersWireSchema
      .optional()
      .describe(
        'Property filters on THIS referenced asset (keyed by SHACL leaf local name), ' +
          'i.e. a property of the referenced asset constrained to one or more values. ' +
          'Put constraints that describe the referenced asset here, NOT in the top-level slots.'
      ),
    ranges: slotRangesWireSchema
      .optional()
      .describe(
        'Numeric range filters on THIS referenced asset — a numeric property of the ' +
          'referenced asset constrained to a minimum and/or maximum.'
      ),
    references: z.array(referenceFilterWireSchema).optional(),
  })
)

// ─── Search slots ────────────────────────────────────────────────────────────

/**
 * The canonical structure of the `slots` object the LLM fills.
 *
 * This is the single structural definition of the slot payload. The agent's
 * `submit_slots` tool layers prompt-facing `.describe()` text over these
 * fields, and the evaluation harness scores against the very same schema, so
 * a submission the production agent accepts can never be rejected downstream.
 * [JSON-SCHEMA-CORE] §10.3 object applicators.
 */
export const searchSlotsWireSchema = z.object({
  domains: z.array(z.string()).default([]),
  filters: slotFiltersWireSchema.default({}),
  ranges: slotRangesWireSchema.default({}),
  references: z.union([referenceFilterWireSchema, z.array(referenceFilterWireSchema)]).optional(),
})

export type SearchSlotsWire = z.infer<typeof searchSlotsWireSchema>

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
