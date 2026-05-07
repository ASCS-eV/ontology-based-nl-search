import { NextRequest, NextResponse } from 'next/server'

import { RequestLogger, generateRequestId } from '@/lib/logging'
import { compileSlots } from '@/lib/search/compiler'
import { getInitializedStore } from '@/lib/search/init'
import type { SearchSlots } from '@/lib/search/slots'
import { enforceSparqlPolicy } from '@/lib/sparql/policy'

/**
 * Refine endpoint: takes pre-filled slots, compiles SPARQL, executes.
 * Bypasses LLM — used when user edits the interpreted query directly.
 */
export async function POST(request: NextRequest) {
  let body: { slots?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { slots } = body
  if (!slots || typeof slots !== 'object') {
    return NextResponse.json({ error: 'Missing or invalid "slots" field' }, { status: 400 })
  }

  const requestId = generateRequestId()
  const logger = new RequestLogger({ requestId })

  try {
    const store = await getInitializedStore()

    const endCompile = logger.time('compile-slots')
    const sparql = await compileSlots(slots as SearchSlots)
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
