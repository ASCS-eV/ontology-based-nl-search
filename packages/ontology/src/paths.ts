import { getConfig } from '@ontology-search/core/config'
import { existsSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Get the workspace root directory: ONTOLOGY_ROOT from the validated config,
 * else the checkout ({@link findCheckoutRoot}). A relative ONTOLOGY_ROOT
 * resolves against the checkout, not against the directory the process runs
 * in (`apps/api` for the API), so every entry point and the setup preflight
 * agree on it.
 */
export function getProjectRoot(): string {
  const override = getConfig().ONTOLOGY_ROOT
  const checkout = findCheckoutRoot()
  return override ? resolve(checkout, override) : checkout
}

/**
 * The checkout: walk up from this package's source to find
 * pnpm-workspace.yaml, then walk up from cwd as a last resort.
 */
function findCheckoutRoot(): string {
  // From packages/ontology/src/ → workspace root is ../../..
  const fromPackage = join(__dirname, '..', '..', '..')
  if (existsSync(join(fromPackage, 'pnpm-workspace.yaml'))) {
    return fromPackage
  }

  // Walk up from cwd as fallback
  let dir = process.cwd()
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    if (existsSync(join(dir, 'ontology-sources.json'))) return dir
    dir = dirname(dir)
  }

  return process.cwd()
}

/**
 * Resolve a path relative to the project root.
 */
export function resolveFromRoot(...segments: string[]): string {
  return join(getProjectRoot(), ...segments)
}
