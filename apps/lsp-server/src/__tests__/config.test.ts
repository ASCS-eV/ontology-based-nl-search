import { describe, expect, it } from 'vitest'

import { parseCliConfig, UsageError } from '../config.js'

describe('parseCliConfig', () => {
  it('requires stdio and exactly one source', () => {
    expect(() => parseCliConfig([], {})).toThrow(UsageError)
    expect(() => parseCliConfig(['--stdio'], {})).toThrow(/vocabulary/i)
    expect(() =>
      parseCliConfig(['--stdio', '--vocabulary-url', 'https://example.test/vocab'], {
        ONTOLOGY_SEARCH_VOCABULARY_FILE: '/ignored.json',
      })
    ).not.toThrow()
  })

  it('rejects conflicting CLI or environment sources', () => {
    expect(() =>
      parseCliConfig(
        [
          '--stdio',
          '--vocabulary-url',
          'https://example.test/vocab',
          '--vocabulary-file',
          'vocab.json',
        ],
        {}
      )
    ).toThrow(/exactly one/i)
    expect(() =>
      parseCliConfig(['--stdio'], {
        ONTOLOGY_SEARCH_VOCABULARY_URL: 'https://example.test/vocab',
        ONTOLOGY_SEARCH_VOCABULARY_FILE: 'vocab.json',
      })
    ).toThrow(/exactly one/i)
  })

  it('supports help and version without a transport or source', () => {
    expect(parseCliConfig(['--help'], {})).toEqual({ action: 'help' })
    expect(parseCliConfig(['--version'], {})).toEqual({ action: 'version' })
  })
})
