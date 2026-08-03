import { createServer, type Server } from 'node:http'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let server: Server | undefined
let baseUrl: string
let requestBody: Record<string, unknown> | undefined
let responsesRequestBody: Record<string, unknown> | undefined

beforeAll(async () => {
  const created = createServer((request, response) => {
    if (request.url !== '/v1/chat/completions' && request.url !== '/v1/responses') {
      response.writeHead(404).end()
      return
    }
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
      const submission = {
        slots: { domains: ['hdmap'], filters: { roadTypes: 'motorway' }, ranges: {} },
        interpretation: { summary: 'ignored by exact-slot scoring', mappedTerms: [] },
        gaps: [],
      }
      if (request.url === '/v1/responses') {
        responsesRequestBody = parsed
        const call = {
          type: 'function_call',
          id: 'item-submit-1',
          call_id: 'submit-response-1',
          name: 'submit_slots',
          arguments: JSON.stringify(submission),
        }
        const events = [
          {
            type: 'response.created',
            response: {
              id: 'resp-local-test',
              created_at: 1_786_000_000,
              model: 'fake-responses-model',
            },
          },
          { type: 'response.output_item.added', output_index: 0, item: call },
          {
            type: 'response.output_item.done',
            output_index: 0,
            item: { ...call, status: 'completed' },
          },
          {
            type: 'response.completed',
            response: {
              usage: { input_tokens: 90, output_tokens: 15 },
            },
          },
        ]
        response.writeHead(200, { 'content-type': 'text/event-stream' })
        response.end(
          `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')}data: [DONE]\n\n`
        )
        return
      }
      requestBody = parsed
      response.setHeader('content-type', 'application/json')
      response.end(
        JSON.stringify({
          id: 'chatcmpl-local-test',
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
                    id: 'submit-1',
                    type: 'function',
                    function: { name: 'submit_slots', arguments: JSON.stringify(submission) },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
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
})

afterAll(async () => {
  if (!server?.listening) return
  await new Promise<void>((resolve, reject) =>
    server?.close((error) => (error ? reject(error) : resolve()))
  )
})

describe('OpenAI-compatible evaluation path', () => {
  it('accepts a fake tool-call response without a real model', async () => {
    // Test-only provider guard; model endpoint configuration remains explicit.
    process.env['NODE_ENV'] = 'test'
    const { createEvaluationPolicy, createOpenAICompatibleModel, evaluateStructuredSearch } =
      await import('@ontology-search/llm/evaluation')
    const model = createOpenAICompatibleModel({
      baseUrl,
      model: 'fake-local-model',
    })

    const result = await evaluateStructuredSearch('motorway maps', {
      model,
      policy: createEvaluationPolicy('fake-local-model'),
    })

    expect(result.rawSubmission?.slots).toEqual({
      domains: ['hdmap'],
      filters: { roadTypes: 'motorway' },
      ranges: {},
    })
    expect(result.validatedResponse.slots?.domains).toContain('hdmap')
    expect(result.trace).toMatchObject({
      missingSubmitFallback: false,
      usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
    })
    expect(result.trace.toolCalls.map((call) => call.toolName)).toEqual(['submit_slots'])
    expect(requestBody?.['tool_choice']).toBe('required')
    expect(requestBody?.['tools']).toHaveLength(5)
    expect(JSON.stringify(requestBody?.['messages'])).toContain('submit_slots')
  })

  it('uses a streaming Responses endpoint for hosted smoke calls', async () => {
    process.env['NODE_ENV'] = 'test'
    const { createEvaluationPolicy, createOpenAIResponsesModel, evaluateStructuredSearch } =
      await import('@ontology-search/llm/evaluation')
    const model = createOpenAIResponsesModel({
      baseUrl,
      model: 'fake-responses-model',
      apiKey: 'test-only',
    })

    const result = await evaluateStructuredSearch('motorway maps', {
      model,
      policy: createEvaluationPolicy('fake-responses-model'),
      streaming: true,
    })

    expect(result.rawSubmission?.slots.domains).toEqual(['hdmap'])
    expect(result.trace).toMatchObject({
      missingSubmitFallback: false,
      usage: { inputTokens: 90, outputTokens: 15, totalTokens: 105 },
    })
    expect(responsesRequestBody?.['stream']).toBe(true)
    expect(responsesRequestBody?.['tool_choice']).toBe('required')
    expect(responsesRequestBody?.['tools']).toHaveLength(5)
  })
})
