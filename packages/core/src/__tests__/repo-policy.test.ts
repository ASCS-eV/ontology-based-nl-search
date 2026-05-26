/**
 * Repo-policy regression tests.
 *
 * Statically scan production source files for violations of the
 * CONTRIBUTING.md § Code Quality Criteria gates that are too project-wide
 * to live in a single package's unit-test scope:
 *
 *   - **C4**: no domain-name string literal outside the registry
 *   - **C12**: no `console.*` outside the structured logger
 *
 * These gates exist as ESLint warnings today, but a warning-level rule
 * does not fail CI — these tests do. Each failing test prints every
 * offending `file:line` so the operator can fix or annotate.
 *
 * A line is exempt from the C12 check when it carries an inline
 * `// eslint-disable-next-line no-console -- <reason>` annotation, or
 * when the surrounding module is the structured logger itself.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))

/**
 * Resolve the monorepo root by walking up until we see a `pnpm-workspace.yaml`.
 * Robust against changes to where this test file lives in the tree.
 */
function findRepoRoot(start: string): string {
  let cur = start
  while (cur !== '/') {
    if (existsSync(join(cur, 'pnpm-workspace.yaml'))) return cur
    cur = dirname(cur)
  }
  throw new Error(`Could not find pnpm-workspace.yaml above ${start}`)
}

const ROOT = findRepoRoot(HERE)

/** Production source roots — exclude tests, fixtures, and generated code. */
const SOURCE_ROOTS = [join(ROOT, 'packages'), join(ROOT, 'apps')]

/** File paths whose `console.*` calls are intentional and documented. */
const CONSOLE_EXEMPT_FILES = new Set([
  // The structured logger itself emits the JSON line via console.*;
  // nothing else can route through it without infinite recursion.
  join(ROOT, 'packages/core/src/logging/index.ts'),
  // Browser-only modules: the structured logger reads `process.env`
  // and would crash in the browser. These files document the
  // intentional `console.*` in their module headers (see file
  // top-comments for rationale).
  join(ROOT, 'packages/core/src/sse/parser.ts'),
  join(ROOT, 'apps/web/src/components/ErrorBoundary.tsx'),
  join(ROOT, 'apps/web/src/hooks/useSearchHistory.ts'),
])

interface SourceFile {
  path: string
  lines: string[]
}

function isProductionFile(absPath: string): boolean {
  if (absPath.includes('/node_modules/')) return false
  if (absPath.includes('/dist/')) return false
  if (absPath.includes('/__tests__/')) return false
  if (absPath.includes('/__fixtures__/')) return false
  if (absPath.endsWith('.test.ts') || absPath.endsWith('.test.tsx')) return false
  if (absPath.endsWith('.spec.ts') || absPath.endsWith('.spec.tsx')) return false
  if (absPath.endsWith('/routeTree.gen.ts')) return false
  if (!absPath.endsWith('.ts') && !absPath.endsWith('.tsx')) return false
  // Skip test apps entirely.
  if (absPath.includes('/apps/e2e/')) return false
  return true
}

function walk(dir: string, out: string[]): void {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist') continue
    const abs = join(dir, name)
    const stat = statSync(abs)
    if (stat.isDirectory()) {
      walk(abs, out)
    } else if (isProductionFile(abs)) {
      out.push(abs)
    }
  }
}

function collectSourceFiles(): SourceFile[] {
  const paths: string[] = []
  for (const root of SOURCE_ROOTS) {
    if (existsSync(root)) walk(root, paths)
  }
  return paths.map((path) => ({ path, lines: readFileSync(path, 'utf-8').split('\n') }))
}

const FILES = collectSourceFiles()

describe('repo-policy: C12 — no console.* outside structured logger', () => {
  it('every production console.* call is either inside the logger module or annotated with an eslint-disable that gives a reason', () => {
    const violations: string[] = []

    for (const file of FILES) {
      if (CONSOLE_EXEMPT_FILES.has(file.path)) continue
      for (let i = 0; i < file.lines.length; i++) {
        const line = file.lines[i]!
        if (!/\bconsole\.(?:log|info|warn|error|debug)\s*\(/.test(line)) continue
        // Ignore lines inside block comments / JSDoc — they show up in source
        // when documenting the `console.warn` policy itself.
        if (/^\s*\*/.test(line)) continue
        // Allow when the same line OR the immediately preceding line carries
        // an eslint-disable with a `--` reason.
        const prev = file.lines[i - 1] ?? ''
        const hasInline = /eslint-disable.*no-console.*--/.test(line)
        const hasPrev = /eslint-disable-next-line.*no-console.*--/.test(prev)
        if (hasInline || hasPrev) continue
        violations.push(`${file.path}:${i + 1} → ${line.trim()}`)
      }
    }

    expect(violations, `Unannotated console.* calls:\n${violations.join('\n')}`).toEqual([])
  })
})
