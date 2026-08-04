/**
 * A single unscoreable sample must never abort a run.
 *
 * Regression: slots were parsed with a throwing `parse` outside the sample's
 * error boundary, so one malformed payload propagated out of the sample loop
 * and the run ended with partial NDJSON and no summary — the exact failure a
 * harness for weak models must survive.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { readSamplesNdjson, readSummary } from '../artifacts.js'
import { envitedGoldCases } from '../corpus.js'
import { runEvaluation } from '../runner.js'

let server: Server | undefined
let baseUrl: string
let repoRoot: string
let requestCount = 0

/** Alternates a well-formed submission with one the scorer cannot use. */
function submissionFor(index: number): unknown {
  return index % 2 === 0
    ? {
        slots: { domains: ['hdmap'], filters: { country: 'DE' }, ranges: {} },
        interpretation: { summary: 'ok', mappedTerms: [] },
        gaps: [],
      }
    : {
        slots: { domains: 'not-an-array', filters: 42, ranges: { lanes: 'nonsense' } },
        interpretation: { summary: 'malformed', mappedTerms: [] },
        gaps: [],
      }
}

beforeAll(async () => {
  process.env['NODE_ENV'] = 'test'
  repoRoot = mkdtempSync(join(tmpdir(), 'model-eval-resilience-'))
  const created = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      const index = requestCount++
      response.setHeader('content-type', 'application/json')
      response.end(
        JSON.stringify({
          id: 'chatcmpl-resilience',
          object: 'chat.completion',
          created: 1_786_000_000,
          model: 'fake-local-model',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: `submit-${index}`,
                    type: 'function',
                    function: {
                      name: 'submit_slots',
                      arguments: JSON.stringify(submissionFor(index)),
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        })
      )
    })
  })
  server = created
  await new Promise<void>((resolve, reject) => {
    created.once('error', reject)
    created.listen(0, '127.0.0.1', resolve)
  })
  const address = created.address()
  if (!address || typeof address === 'string') throw new Error('Fake server has no TCP address')
  baseUrl = `http://127.0.0.1:${address.port}/v1`
}, 120_000)

afterAll(async () => {
  if (server?.listening) {
    await new Promise<void>((resolve, reject) =>
      server?.close((error) => (error ? reject(error) : resolve()))
    )
  }
  if (repoRoot) rmSync(repoRoot, { recursive: true, force: true })
})

describe('runner resilience', () => {
  it('completes the run and writes a summary even when samples are unscoreable', async () => {
    const cases = envitedGoldCases.slice(0, 2)
    const result = await runEvaluation({
      repoRoot,
      candidateId: 'qwen3.5-4b',
      profile: 'protocol',
      baseUrl,
      servedModel: 'fake-local-model',
      cases,
      protocolCases: cases,
      timeoutMs: 60_000,
    })

    // Every scheduled sample is present: none aborted the loop.
    expect(result.samples).toHaveLength(cases.length * 3)
    expect(readSamplesNdjson(result.artifacts.samplesPath)).toHaveLength(cases.length * 3)

    // The malformed halves are recorded as protocol findings, not crashes.
    const unscoreable = result.samples.filter((sample) => sample.validatedSlots === null)
    expect(unscoreable.length).toBeGreaterThan(0)
    expect(unscoreable[0]?.diagnostic.protocolErrors.join(' ')).toMatch(/submission|slots/i)
    // They are model-side findings, so no transport error is attributed.
    expect(result.samples.every((sample) => sample.transportError === undefined)).toBe(true)

    // The summary artifact exists and the run is marked complete.
    expect(readSummary(result.artifacts.summaryPath).runId).toBe(result.manifest.runId)
    expect(result.manifest.completedAt).toBeDefined()
  }, 240_000)
})
