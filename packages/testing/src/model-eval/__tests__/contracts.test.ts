import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { candidateInventory } from '../candidates.js'
import { parseCliArgs } from '../cli.js'
import { assertCorpusInvariants, envitedGoldCases, protocolGoldCases } from '../corpus.js'
import { planProfile, roundRobinSamples } from '../profiles.js'
import { assertSchemaArtifactsCurrent, generateSchemaArtifacts } from '../schema-artifacts.js'

const modelEvalRoot = dirname(fileURLToPath(new URL('../types.ts', import.meta.url)))

describe('evaluation contracts', () => {
  it('parses strict CLI commands and rejects conflicting server control', () => {
    expect(parseCliArgs(['list'])).toEqual({ command: 'list' })
    expect(parseCliArgs(['smoke', '--api-key', 'sk-test'])).toMatchObject({
      command: 'smoke',
      model: 'gpt-5.4-mini',
      caseId: 'env-001',
      apiKey: 'sk-test',
      timeoutMs: 120_000,
    })
    // The hosted smoke authenticates only with a platform API key.
    expect(() => parseCliArgs(['smoke'])).toThrow(/--api-key is required/)
    expect(
      parseCliArgs([
        'run',
        '--candidate',
        'qwen3.5-9b',
        '--profile',
        'quality',
        '--base-url',
        'http://localhost:8000/v1',
      ])
    ).toMatchObject({
      command: 'run',
      candidate: 'qwen3.5-9b',
      profile: 'quality',
      suite: 'envited-x',
      timeoutMs: 120_000,
    })
    expect(() =>
      parseCliArgs([
        'run',
        '--candidate',
        'qwen3.5-9b',
        '--profile',
        'quality',
        '--base-url',
        'http://localhost:8000/v1',
        '--server-pid',
        '12',
        '--launch',
        'server.json',
      ])
    ).toThrow(/mutually exclusive/)
    expect(() =>
      parseCliArgs([
        'run',
        '--candidate',
        'qwen3.5-9b',
        '--profile',
        'quality',
        '--base-url',
        'not-a-url',
      ])
    ).toThrow(/absolute HTTP/)
  })

  it('pins unique permissively licensed runtime artifacts', () => {
    const ids = new Set<string>()
    const artifacts = new Set<string>()
    for (const candidate of candidateInventory.candidates) {
      expect(ids.has(candidate.id)).toBe(false)
      ids.add(candidate.id)
      expect(candidate.source.revision).toMatch(/^[0-9a-f]{40}$/)
      expect(['Apache-2.0', 'MIT']).toContain(candidate.source.license)
      expect(candidate).toMatchObject({
        contextTokens: 65_536,
        runtime: { reasoning: 'disabled', temperature: 0, concurrency: 1 },
      })
      const artifact = [
        candidate.source.huggingFaceId,
        candidate.source.revision,
        candidate.runtime.engine,
        candidate.quantization,
        candidate.runtime.toolParser,
      ].join(':')
      expect(artifacts.has(artifact)).toBe(false)
      artifacts.add(artifact)
    }
    expect([...ids].sort()).toEqual(
      [
        'qwen3.5-9b',
        'granite-4.1-8b',
        'ministral-3-8b-instruct',
        'gemma-4-12b-it',
        'gpt-oss-20b',
        'qwen3-8b-control',
        'qwen3.5-4b',
        'ministral-3-14b-instruct',
        'gemma-4-26b-a4b-it',
        'qwen3.6-35b-a3b',
        'glm-4.7-flash',
        'gpt-oss-120b',
      ].sort()
    )
  })

  it('keeps corpus size, language balance, legacy migration, and protocol subset fixed', () => {
    expect(() => assertCorpusInvariants()).not.toThrow()
    expect(envitedGoldCases).toHaveLength(150)
    expect(protocolGoldCases).toHaveLength(30)
    expect(envitedGoldCases.filter((gold) => gold.legacyId)).toHaveLength(99)
  })

  it('schedules warmups and repetitions in deterministic round-robin order', () => {
    const cases = envitedGoldCases.slice(0, 2)
    const plan = planProfile('warm-performance', cases, cases)
    const scheduled = roundRobinSamples(plan)

    expect(plan).toMatchObject({ repetitions: 5, warmups: 2 })
    expect(
      scheduled.slice(0, 4).map(({ gold, repetition, warmup }) => [gold.id, repetition, warmup])
    ).toEqual([
      [cases[0]!.id, 1, true],
      [cases[1]!.id, 1, true],
      [cases[0]!.id, 2, true],
      [cases[1]!.id, 2, true],
    ])
    expect(scheduled.filter((sample) => !sample.warmup)).toHaveLength(10)
  })

  it('keeps committed JSON Schema 2020-12 artifacts in sync', () => {
    expect(() => assertSchemaArtifactsCurrent(join(modelEvalRoot, 'schemas'))).not.toThrow()
    for (const schema of Object.values(generateSchemaArtifacts())) {
      expect(schema).toMatchObject({ $schema: 'https://json-schema.org/draft/2020-12/schema' })
    }
  })
})
