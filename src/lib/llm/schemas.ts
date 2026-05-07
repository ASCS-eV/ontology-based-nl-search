import { z } from 'zod'

/** Zod schema for a single mapped term */
export const MappedTermSchema = z.object({
  input: z.string(),
  mapped: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  property: z.string().optional(),
})

/** Zod schema for an ontology gap */
export const OntologyGapSchema = z.object({
  term: z.string(),
  reason: z.string(),
  suggestions: z.array(z.string()).optional(),
})

/** Zod schema for the query interpretation */
export const QueryInterpretationSchema = z.object({
  summary: z.string(),
  mappedTerms: z.array(MappedTermSchema),
})

/** Zod schema for the full LLM structured response */
export const LlmStructuredResponseSchema = z.object({
  interpretation: QueryInterpretationSchema,
  gaps: z.array(OntologyGapSchema),
  sparql: z.string().min(1, 'SPARQL query must not be empty'),
})

export type ValidatedLlmResponse = z.infer<typeof LlmStructuredResponseSchema>

/**
 * Validate and coerce raw LLM output into a typed structured response.
 * Returns a safe default on failure rather than throwing.
 */
export function validateLlmOutput(
  raw: unknown
):
  | { success: true; data: ValidatedLlmResponse }
  | { success: false; error: string; data: ValidatedLlmResponse } {
  const result = LlmStructuredResponseSchema.safeParse(raw)

  if (result.success) {
    return { success: true, data: result.data }
  }

  // Return a safe fallback with the error message
  const errorMessages = result.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ')

  return {
    success: false,
    error: errorMessages,
    data: {
      interpretation: {
        summary: 'Query processed (validation errors in LLM output)',
        mappedTerms: [],
      },
      gaps: [],
      sparql:
        typeof raw === 'object' && raw !== null && 'sparql' in raw
          ? String((raw as Record<string, unknown>).sparql)
          : '',
    },
  }
}
