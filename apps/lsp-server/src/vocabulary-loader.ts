import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import type { VocabularyResponse } from '@ontology-search/api-types'
import { buildGraphQLSchema } from '@ontology-search/graphql-ir'
import { z } from 'zod'

import type { VocabularySource } from './config.js'

export const MAX_VOCABULARY_BYTES = 5 * 1024 * 1024
export const DEFAULT_VOCABULARY_TIMEOUT_MS = 10_000

const commonProperty = {
  name: z.string(),
  label: z.string(),
  description: z.string(),
  domain: z.string(),
}

const vocabularySchema = z
  .object({
    domains: z.array(z.string()),
    properties: z.array(
      z.discriminatedUnion('type', [
        z.object({ ...commonProperty, type: z.literal('enum'), allowedValues: z.array(z.string()).optional() }).strict(), // prettier-ignore
        z.object({ ...commonProperty, type: z.literal('numeric'), datatype: z.enum(['integer', 'float']).optional() }).strict(), // prettier-ignore
        z.object({ ...commonProperty, type: z.literal('string') }).strict(),
      ])
    ),
  })
  .strict()

export interface VocabularyLoadOptions {
  fetchImpl?: typeof fetch
  apiKey?: string
  timeoutMs?: number
  maxBytes?: number
}

/** Load, validate, and schema-check an untrusted vocabulary source. */
export async function loadVocabulary(
  source: VocabularySource,
  options: VocabularyLoadOptions = {}
): Promise<VocabularyResponse> {
  const raw =
    source.type === 'file'
      ? await readFile(resolve(source.value), 'utf8')
      : await fetchVocabulary(source.value, options)

  let input: unknown
  try {
    input = JSON.parse(raw)
  } catch {
    throw new Error('Vocabulary is not valid JSON.')
  }

  const result = vocabularySchema.safeParse(input)
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    throw new Error(`Vocabulary has an invalid shape: ${issues.join('; ')}`)
  }

  const vocabulary: VocabularyResponse = result.data
  buildGraphQLSchema(vocabulary)
  return vocabulary
}

async function fetchVocabulary(urlValue: string, options: VocabularyLoadOptions): Promise<string> {
  let url: URL
  try {
    url = new URL(urlValue)
  } catch {
    throw new Error('Vocabulary URL is invalid.')
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Vocabulary URL must use HTTP or HTTPS.')
  }
  if (url.username || url.password) {
    throw new Error('Vocabulary URL must not contain credentials.')
  }

  // Keep credentials in the standalone server process environment, not CLI arguments.
  // eslint-disable-next-line no-restricted-syntax
  const apiKey = options.apiKey ?? process.env.ONTOLOGY_SEARCH_API_KEY
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined
  const timeoutMs = options.timeoutMs ?? DEFAULT_VOCABULARY_TIMEOUT_MS
  let response: Response
  try {
    response = await (options.fetchImpl ?? fetch)(url, {
      headers,
      redirect: apiKey ? 'error' : 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    if (isTimeout(error)) throw new Error(`Vocabulary request timed out after ${timeoutMs} ms.`)
    throw new Error('Vocabulary request failed.')
  }

  if (!response.ok) {
    throw new Error(`Vocabulary request returned HTTP ${response.status}.`)
  }
  if (!response.body) throw new Error('Vocabulary response has no body.')

  const maxBytes = options.maxBytes ?? MAX_VOCABULARY_BYTES
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`Vocabulary response exceeds the ${maxBytes}-byte limit.`)
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > maxBytes) {
      await reader.cancel()
      throw new Error(`Vocabulary response exceeds the ${maxBytes}-byte limit.`)
    }
    chunks.push(value)
  }

  const combined = new Uint8Array(bytes)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(combined)
}

function isTimeout(error: unknown): boolean {
  return (
    error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')
  )
}
