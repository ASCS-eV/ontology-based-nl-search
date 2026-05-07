import { NextRequest } from 'next/server'
import { z } from 'zod'

import { badRequest, extractErrorMessage, internalError, unprocessable } from '@/lib/errors'
import { searchRefine } from '@/lib/search/service'

/** Zod schema for validating SearchSlots from the client */
const searchSlotsSchema = z.object({
  domains: z.array(z.string().min(1)).min(1).default(['hdmap']),
  filters: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
  ranges: z
    .record(z.string(), z.object({ min: z.number().optional(), max: z.number().optional() }))
    .default({}),
  location: z
    .object({
      country: z.string().optional(),
      state: z.string().optional(),
      region: z.string().optional(),
      city: z.string().optional(),
    })
    .optional(),
  license: z.string().optional(),
})

/**
 * Refine endpoint: takes pre-filled slots, compiles SPARQL, executes.
 * Thin HTTP adapter — validates input then delegates to search service.
 * Bypasses LLM — used when user edits the interpreted query directly.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  if (!body || typeof body !== 'object' || !('slots' in body)) {
    return badRequest('Missing "slots" field in request body')
  }

  const parseResult = searchSlotsSchema.safeParse((body as { slots: unknown }).slots)
  if (!parseResult.success) {
    const issues = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    return unprocessable('Invalid slots', issues)
  }

  try {
    const result = await searchRefine({ slots: parseResult.data })

    if (result.execution.error) {
      return unprocessable(result.execution.error)
    }

    return Response.json({
      sparql: result.sparql,
      results: result.execution.results,
      meta: result.meta,
    })
  } catch (error) {
    console.error('Refine search failed:', extractErrorMessage(error))
    return internalError()
  }
}
