/**
 * Live authoring eval: every case authored by the configured provider, scored
 * by the harness, reported with the model, ontology and engine the run pinned.
 * Report-only — the deterministic replay in `__tests__/authoring-eval.test.ts`
 * is the gate.
 *
 *   pnpm run eval:authoring:live
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getConfig } from '@ontology-search/core/config'
import { runSceneAgent } from '@ontology-search/llm/authoring'

import { AUTHORING_EVAL_CASES } from './authoring-cases.js'
import { evaluateAuthoring } from './authoring-eval.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const readJson = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(root, path), 'utf8')) as Record<string, unknown>

const config = getConfig()
const provenance = {
  model: config.AUTHORING_AI_MODEL ?? config.AI_MODEL,
  ontology: readJson('ontology-package.json')['version'],
  engine: readJson('packages/authoring-wasm/versions.json')['engineCommit'],
}

const summary = await evaluateAuthoring(
  async (evalCase) =>
    runSceneAgent(evalCase.request, evalCase.archetype ? { archetype: evalCase.archetype } : {}),
  AUTHORING_EVAL_CASES
)

console.warn([JSON.stringify(provenance), summary.table, JSON.stringify(summary.gating)].join('\n'))
