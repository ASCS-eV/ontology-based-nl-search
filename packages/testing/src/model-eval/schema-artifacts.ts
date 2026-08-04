import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { z } from 'zod'

import { RunManifestSchema, SampleSchema, SummarySchema } from './types.js'

const definitions = {
  'run-manifest.schema.json': RunManifestSchema,
  'sample.schema.json': SampleSchema,
  'summary.schema.json': SummarySchema,
} as const

export function generateSchemaArtifacts(): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(definitions).map(([name, schema]) => [
      name,
      z.toJSONSchema(schema, {
        target: 'draft-2020-12',
        unrepresentable: 'any',
      }),
    ])
  )
}

export function writeSchemaArtifacts(directory: string): void {
  mkdirSync(directory, { recursive: true })
  for (const [name, schema] of Object.entries(generateSchemaArtifacts())) {
    writeFileSync(join(directory, name), `${JSON.stringify(schema, null, 2)}\n`)
  }
}

export function assertSchemaArtifactsCurrent(directory: string): void {
  const expected = generateSchemaArtifacts()
  const drift: string[] = []
  for (const [name, schema] of Object.entries(expected)) {
    let committed: unknown
    try {
      committed = JSON.parse(readFileSync(join(directory, name), 'utf8'))
    } catch (error) {
      throw new Error(`Cannot read committed schema ${name}`, { cause: error })
    }
    if (JSON.stringify(committed) !== JSON.stringify(schema)) drift.push(name)
  }
  if (drift.length > 0) {
    throw new Error(`Evaluation schema drift in ${drift.join(', ')}. Run pnpm eval:models schemas.`)
  }
}
