/**
 * The derived OpenSCENARIO SHACL, as text.
 *
 * Resolved relative to this module so it works from both `src` (vitest) and
 * `dist` (runtime), which sit at the same depth below the repo root. Reading
 * is best-effort: without the artifact the prompt still grounds the agent in
 * the archetype contract and the alignment step has no vocabulary, so nothing
 * throws from here.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export function readOpenScenarioShacl(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    const root = join(here, '..', '..', '..', '..')
    return readFileSync(join(root, 'artifacts', 'openscenario', 'openscenario.shacl.ttl'), 'utf-8')
  } catch {
    return ''
  }
}
