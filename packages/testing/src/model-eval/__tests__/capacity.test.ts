/**
 * Capacity outcomes must distinguish "the candidate failed" from "we could not
 * measure". Conflating them made a missing tokenizer endpoint — the documented
 * default — exit nonzero as if the model had been disproved.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { readSummary } from '../artifacts.js'
import { runCapacityEvaluation } from '../capacity.js'

let server: Server | undefined
let baseUrl: string
let tokenizerUrl: string
let repoRoot: string

beforeAll(async () => {
  repoRoot = mkdtempSync(join(tmpdir(), 'model-eval-capacity-'))
  const created = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { prompt?: string }
      response.setHeader('content-type', 'application/json')
      if (request.url === '/tokenize') {
        // Two tokens per "ontology " unit, so the binary search converges.
        response.end(JSON.stringify({ count: (body.prompt ?? '').split('ontology').length * 2 }))
        return
      }
      if (request.url === '/unsupported-tokenize') {
        response.writeHead(404).end()
        return
      }
      response.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }))
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
  tokenizerUrl = `http://127.0.0.1:${address.port}/tokenize`
})

afterAll(async () => {
  if (server?.listening) {
    await new Promise<void>((resolve, reject) =>
      server?.close((error) => (error ? reject(error) : resolve()))
    )
  }
  if (repoRoot) rmSync(repoRoot, { recursive: true, force: true })
})

describe('capacity evaluation', () => {
  it('reports not-supported without failing the gate when no tokenizer is available', async () => {
    const result = await runCapacityEvaluation({
      repoRoot,
      candidateId: 'qwen3.5-4b',
      baseUrl,
      servedModel: 'fake-local-model',
    })

    expect(result.summary.capacity?.status).toBe('not-supported')
    // Not measurable is not a failure — the CLI maps this to exit 0.
    expect(result.summary.gates.passing).toBe(true)
    expect(result.summary.gates.failures).toEqual([])
  })

  it('records semantic metrics as not-measured rather than zero', async () => {
    const result = await runCapacityEvaluation({
      repoRoot,
      candidateId: 'qwen3.5-4b',
      baseUrl,
      servedModel: 'fake-local-model',
    })

    expect(result.summary.metrics.validatedExact).toBeNull()
    expect(result.summary.metrics.compilationValidity).toBeNull()
    expect(readSummary(result.artifacts.summaryPath).metrics.submissionRate).toBeNull()
  })

  it('records the policy that actually ran, not restated constants', async () => {
    const result = await runCapacityEvaluation({
      repoRoot,
      candidateId: 'qwen3.5-4b',
      baseUrl,
      servedModel: 'fake-local-model',
    })

    expect(result.manifest.policy.maxAgentSteps).toBe(3)
    expect(result.manifest.policy.temperature).toBe(0)
    expect(result.manifest.policy.lookupTools).toEqual([
      'find_terms',
      'describe_shape',
      'list_values',
      'probe_data',
    ])
  })

  it('passes when a tokenizer endpoint verifies a near-64k prompt', async () => {
    const result = await runCapacityEvaluation({
      repoRoot,
      candidateId: 'qwen3.5-4b',
      baseUrl,
      servedModel: 'fake-local-model',
      tokenizerUrl,
      timeoutMs: 30_000,
    })

    expect(result.summary.capacity?.status).toBe('passed')
    expect(result.summary.capacity?.promptTokens).toBeGreaterThan(0)
    expect(result.summary.gates.passing).toBe(true)
  }, 60_000)

  it('treats an absent tokenizer protocol as not-supported, not as a failure', async () => {
    const result = await runCapacityEvaluation({
      repoRoot,
      candidateId: 'qwen3.5-4b',
      baseUrl,
      servedModel: 'fake-local-model',
      tokenizerUrl: tokenizerUrl.replace('/tokenize', '/unsupported-tokenize'),
      timeoutMs: 30_000,
    })

    expect(result.summary.capacity?.status).toBe('not-supported')
    expect(result.summary.gates.passing).toBe(true)
  }, 60_000)
})
