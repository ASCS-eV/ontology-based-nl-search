/**
 * Validating against a target class uses that class's property shapes only
 * (ADR 0009): two value objects share one leaf property with different
 * `sh:in` lists, and a value only the other class allows must not pass. The
 * in-process fast path is held to the same rule as the SHACL engine.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resetConfig } from '@ontology-search/core/config'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { ShaclValidator } from '../shacl-validator.js'

const NS = 'http://example.org/garage/v1/'
const SHAPES = `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix garage: <${NS}> .
garage:ColourShape a sh:NodeShape ; sh:targetClass garage:Colour ;
  sh:property [ sh:path garage:value ; sh:in ("red" "blue") ] .
garage:SizeShape a sh:NodeShape ; sh:targetClass garage:Size ;
  sh:property [ sh:path garage:value ; sh:in ("S" "L") ] .
`

let root: string

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'shacl-targets-'))
  mkdirSync(join(root, 'artifacts', 'garage'), { recursive: true })
  writeFileSync(join(root, 'artifacts', 'garage', 'garage.shacl.ttl'), SHAPES)
  vi.stubEnv('ONTOLOGY_ROOT', root)
  vi.stubEnv('ONTOLOGY_ARTIFACTS_PATH', join(root, 'artifacts'))
  resetConfig()
  ShaclValidator.reset()
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
  vi.unstubAllEnvs()
  resetConfig()
  ShaclValidator.reset()
})

describe('ShaclValidator — per-class constraints', () => {
  const colour = { iri: `${NS}value`, targetClass: `${NS}Colour` }
  const size = { iri: `${NS}value`, targetClass: `${NS}Size` }

  it('rejects a value only another class’s sh:in allows', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    expect((await validator.validateAgainstTargets([colour], 'L')).conforms).toBe(false)
    expect((await validator.validateAgainstTargets([size], 'L')).conforms).toBe(true)
    expect((await validator.validateAgainstTargets([colour, size], 'L')).conforms).toBe(true)
  }, 120_000)

  it('applies the same rule to batches', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    const batch = await validator.validateAgainstTargetsBatch([colour], ['red', 'L'])
    expect(batch.get('red')?.conforms).toBe(true)
    expect(batch.get('L')?.conforms).toBe(false)
  }, 120_000)
})
