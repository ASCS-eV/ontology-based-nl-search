import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import type { VocabularyResponse } from '@ontology-search/api-types'
import { buildGraphQLSchema } from '@ontology-search/graphql-ir'
import { describe, expect, it } from 'vitest'

import {
  flattenGraphQLDocumentSymbols,
  getGraphQLCompletions,
  getGraphQLDiagnostics,
  getGraphQLDocumentSymbols,
  getGraphQLHover,
} from '../graphql-features.js'

const fixturePath = fileURLToPath(new URL('../__fixtures__/vocabulary.json', import.meta.url))
const vocabulary = JSON.parse(await readFile(fixturePath, 'utf8')) as VocabularyResponse
const schema = buildGraphQLSchema(vocabulary)

describe('GraphQL language features', () => {
  it('completes domains and domain fields', () => {
    expect(labelsAt('query {\n  |\n}')).toContain('hdmap')
    const fields = labelsAt('query {\n  hdmap {\n    |\n  }\n}')
    expect(fields).toEqual(expect.arrayContaining(['_all', 'title', 'roadTypes', 'references']))
  })

  it('completes string arguments, enum values, and referenced domains', () => {
    expect(labelsAt('query { hdmap { title(|) } }')).toContain('values')
    expect(labelsAt('query { hdmap { roadTypes(values: [|]) } }')).toEqual(
      expect.arrayContaining(['motorway', 'urban'])
    )
    expect(labelsAt('query { trace { references { | } } }')).toEqual(
      expect.arrayContaining(['hdmap', 'trace'])
    )
  })

  it('returns protocol-only serializable completion items', () => {
    const { text, position } = marked('query { | }')
    const completions = getGraphQLCompletions(schema, text, position)
    expect(() => JSON.stringify(completions)).not.toThrow()
    expect(completions.every((item) => !('type' in item) && !('rawInsert' in item))).toBe(true)
  })

  it('returns diagnostics for unknown and malformed fields and none for valid text', () => {
    expect(getGraphQLDiagnostics(schema, 'query { hdmap { unknown } }')[0]).toMatchObject({
      source: 'ontology-graphql',
    })
    expect(getGraphQLDiagnostics(schema, 'query {')).not.toHaveLength(0)
    expect(getGraphQLDiagnostics(schema, 'query { hdmap { _all } }')).toHaveLength(0)
  })

  it('returns property hover with signature and discovered description', () => {
    const { text, position } = marked('query { hdmap { ti|tle(values: ["Map"]) } }')
    const hover = getGraphQLHover(schema, text, position)
    expect(hover?.contents).toMatchObject({ value: expect.stringMatching(/title.*Filter/is) })
    expect(JSON.stringify(hover)).toContain('Human-readable asset title')

    const legacyHover = getGraphQLHover(schema, text, position, false)
    expect(typeof legacyHover?.contents).toBe('string')
    expect(legacyHover?.contents).toMatch(/title.*Filter/is)
  })

  it('returns hierarchical operation and field document symbols', () => {
    const symbols = getGraphQLDocumentSymbols(
      'query FindMap { hdmap { references { trace { _all } } } }'
    )
    expect(symbols[0]?.name).toContain('FindMap')
    expect(JSON.stringify(symbols[0]?.children)).toContain('hdmap')
    expect(JSON.stringify(symbols[0]?.children)).toContain('trace')
    const flattened = flattenGraphQLDocumentSymbols('file:///query.graphql', symbols)
    expect(flattened.map((symbol) => symbol.name).join(' ')).toContain('trace')
    expect(flattened.every((symbol) => symbol.location.uri === 'file:///query.graphql')).toBe(true)
    expect(flattened.some((symbol) => symbol.containerName)).toBe(true)
    expect(getGraphQLDocumentSymbols('query {')).toEqual([])
  })

  it('uses UTF-16 character offsets when a non-BMP value precedes completion', () => {
    const { text, position } = marked('query { hdmap { title(values: ["😀"]) | } }')
    expect(position.character).toBe(text.indexOf(' } }'))
    expect(labelsAt('query { hdmap { title(values: ["😀"]) | } }')).toContain('references')
  })
})

function labelsAt(source: string): string[] {
  const { text, position } = marked(source)
  return getGraphQLCompletions(schema, text, position).map((item) => item.label)
}

function marked(source: string): { text: string; position: { line: number; character: number } } {
  const offset = source.indexOf('|')
  if (offset < 0) throw new Error('Test source must contain a | cursor marker.')
  const text = source.slice(0, offset) + source.slice(offset + 1)
  const before = source.slice(0, offset)
  const lines = before.split('\n')
  return {
    text,
    position: { line: lines.length - 1, character: lines.at(-1)!.length },
  }
}
