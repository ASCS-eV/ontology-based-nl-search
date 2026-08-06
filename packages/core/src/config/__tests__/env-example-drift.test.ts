/**
 * Drift gate between the config schema and `.env.example`.
 *
 * `.env.example` is the only place an operator can discover what is
 * configurable, and it is the reference the `.env.local` preflight
 * (`scripts/check-env.mjs`) checks against. Two silent failures follow from
 * letting the two drift:
 *
 *   - a schema variable missing from the example is invisible — nobody knows
 *     the knob exists, and the preflight flags it as an unknown key when
 *     someone finds it in the source and sets it anyway;
 *   - an example variable missing from the schema is dead documentation — it
 *     is set in good faith and silently ignored at runtime.
 *
 * The exemptions below are variables the runtime supplies, not the operator.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CONFIG_ENV_KEYS } from '../index.js'

const HERE = dirname(fileURLToPath(import.meta.url))

function findRepoRoot(start: string): string {
  let cur = start
  while (cur !== '/') {
    if (existsSync(join(cur, 'pnpm-workspace.yaml'))) return cur
    cur = dirname(cur)
  }
  throw new Error(`Could not find pnpm-workspace.yaml above ${start}`)
}

/** Set by the process manager / test runner — never authored in `.env.local`. */
const RUNTIME_PROVIDED = new Set(['NODE_ENV'])

/**
 * Documented outside the Zod schema because they are consumed by tooling that
 * never calls `getConfig()`: the Vite/VitePress dev-server ports and the
 * design-system selection the Vite config reads at build time.
 */
const CONSUMED_OUTSIDE_THE_SCHEMA = new Set([
  'WEB_PORT',
  'DOCS_PORT',
  'VITE_DESIGN_SYSTEM',
  'DESIGN_SYSTEM_MODULE',
])

const EXAMPLE_PATH = join(findRepoRoot(HERE), '.env.example')

/** Assignment keys in the example, in both the live and the commented form. */
function documentedKeys(): Set<string> {
  const content = readFileSync(EXAMPLE_PATH, 'utf8')
  const keys = new Set<string>()
  for (const line of content.split(/\r?\n/)) {
    const match = /^\s*#?\s*([A-Z][A-Z0-9_]*)\s*=/.exec(line)
    if (match?.[1]) keys.add(match[1])
  }
  return keys
}

describe('.env.example / config schema drift', () => {
  it('documents every environment variable the schema reads', () => {
    const documented = documentedKeys()
    const undocumented = CONFIG_ENV_KEYS.filter(
      (key) => !documented.has(key) && !RUNTIME_PROVIDED.has(key)
    )
    expect(undocumented).toEqual([])
  })

  it('does not document variables the app ignores', () => {
    const known = new Set([...CONFIG_ENV_KEYS, ...CONSUMED_OUTSIDE_THE_SCHEMA])
    const dead = [...documentedKeys()].filter((key) => !known.has(key))
    expect(dead).toEqual([])
  })
})
