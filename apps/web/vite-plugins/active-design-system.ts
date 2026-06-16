import path from 'node:path'

import type { Plugin } from 'vite'

/**
 * Resolves the `virtual:active-design-system` module to an OPTIONAL external
 * design-system, named by `externalModule` (wired from the `DESIGN_SYSTEM_MODULE`
 * env var). The value may be either:
 *   - a bare package name (e.g. an installed `@scope/pkg`), or
 *   - a filesystem path to the package entry — relative paths resolve against
 *     `root` (the repo root), so `.env.local` can point straight at a sibling
 *     checkout (e.g. `../acme-design-system/src/index.ts`) with NO dependency
 *     entry committed anywhere.
 *
 * This keeps the source tree brand-neutral: the external package is never named
 * in committed code — only via config. When unset, the virtual module exports
 * `null` and the app uses its bundled default (ENVITED-X).
 *
 * Shared by both the Vite build (`vite.config.ts`) and the test runner
 * (`vitest.config.ts`) so the virtual import resolves identically in tests.
 */
export function activeDesignSystemPlugin(externalModule?: string, root?: string): Plugin {
  const virtualId = 'virtual:active-design-system'
  const resolvedId = '\0' + virtualId

  let mod = externalModule?.trim()
  // A leading '.' or '/' marks a filesystem path; make it absolute so the
  // re-export below resolves regardless of the virtual module's location.
  if (mod && (mod.startsWith('.') || mod.startsWith('/'))) {
    mod = path.resolve(root ?? process.cwd(), mod)
  }

  return {
    name: 'active-design-system',
    resolveId(id) {
      return id === virtualId ? resolvedId : null
    },
    load(id) {
      if (id !== resolvedId) return null
      return mod ? `export { default } from ${JSON.stringify(mod)}` : `export default null`
    },
  }
}
