import { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'

import { RequestLogger, generateRequestId } from '@/lib/logging'
import { compileSlots } from '@/lib/search/compiler'
import { getInitializedStore } from '@/lib/search/init'
import { enforceSparqlPolicy } from '@/lib/sparql/policy'

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
 * Bypasses LLM — used when user edits the interpreted query directly.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || !('slots' in body)) {
    return NextResponse.json({ error: 'Missing "slots" field in request body' }, { status: 400 })
  }

  const parseResult = searchSlotsSchema.safeParse((body as { slots: unknown }).slots)
  if (!parseResult.success) {
    const issues = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    return NextResponse.json({ error: `Invalid slots: ${issues.join('; ')}` }, { status: 422 })
  }

  const slots = parseResult.data
  const requestId = generateRequestId()
  const logger = new RequestLogger({ requestId })

  try {
    const store = await getInitializedStore()

    const endCompile = logger.time('compile-slots')
    const sparql = await compileSlots(slots)
    endCompile()

    const policy = enforceSparqlPolicy(sparql)
    if (!policy.allowed) {
      logger.warn('Refine: policy violation', { violations: policy.violations })
      return NextResponse.json(
        { error: `Query policy violation: ${policy.violations.join('; ')}`, sparql },
        { status: 422 }
      )
    }

    const endQuery = logger.time('sparql-execution')
    const sparqlResults = await store.query(policy.query)
    endQuery()

    const results = sparqlResults.results.bindings.map((binding) => {
      const row: Record<string, string> = {}
      for (const [key, value] of Object.entries(binding)) {
        row[key] = value.value
      }
      return row
    })

    logger.info('Refine completed', { matchCount: results.length })

    return NextResponse.json({
      sparql: policy.query,
      results,
      meta: {
        requestId,
        matchCount: results.length,
        executionTimeMs: logger.getTotalMs(),
        timings: logger.getTimings(),
      },
    })
  } catch (error) {
    logger.error('Refine failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
