import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Get the workspace root directory.
 * Strategy: walk up from this package's source to find pnpm-workspace.yaml.
 * Fallback: ONTOLOGY_ROOT env var, then process.cwd().
 */
export function getProjectRoot(): string {
  if (process.env['ONTOLOGY_ROOT']) {
    return process.env['ONTOLOGY_ROOT']
  }

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
