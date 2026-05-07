import { join } from 'path'

/**
 * Get the project root directory.
 * In a monorepo, packages run from their own directory, but ontology files
 * live at the workspace root. Use ONTOLOGY_ROOT env var to override.
 */
export function getProjectRoot(): string {
  return process.env['ONTOLOGY_ROOT'] ?? process.cwd()
}

/**
 * Resolve a path relative to the project root.
 */
export function resolveFromRoot(...segments: string[]): string {
  return join(getProjectRoot(), ...segments)
}
