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
import { dirname, join, resolve } from 'node:path'
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
  join(ROOT, 'apps/web/src/lib/lineage.ts'),
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

/**
 * C6 — no circular dependency *within* a package (intra-package import cycle).
 *
 * The layering CI gate is `madge --circular`, but madge runs nowhere in CI
 * today and is not part of `pnpm run validate` — so an intra-package cycle
 * (e.g. `compiler.ts` ⇄ `reference-index.ts`, which existed before this gate)
 * shipped undetected. This dependency-free detector builds the relative-import
 * graph per package and asserts it is acyclic, failing CI via `pnpm test`.
 *
 * Cross-package cycles are independently prevented by the layered workspace
 * graph (a package cannot import an app, and `core` has zero workspace deps);
 * those use `@ontology-search/*` specifiers, not the relative paths this graph
 * tracks. Type-only imports are erased at runtime and cannot form a runtime
 * cycle, so they are excluded — matching what actually breaks module init.
 */
function resolveRelativeImport(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec)
  const stem = base.endsWith('.js') ? base.slice(0, -3) : base
  const candidates = [`${stem}.ts`, `${stem}.tsx`, join(stem, 'index.ts'), join(stem, 'index.tsx')]
  return candidates.find((c) => existsSync(c)) ?? null
}

/** Relative (value) imports of a source file, resolved to absolute .ts paths. */
function valueImportEdges(file: SourceFile): string[] {
  const content = file.lines.join('\n')
  // Match each import statement up to its `from '...'`. Group 1 is the `type`
  // keyword for whole-statement type-only imports (skip those).
  const re = /import\s+(type\s+)?[\s\S]*?from\s+['"](\.[^'"]+)['"]/g
  const edges: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    if (m[1]) continue // `import type { … }` — erased at runtime
    const target = resolveRelativeImport(file.path, m[2]!)
    if (target) edges.push(target)
  }
  return edges
}

describe('repo-policy: C6 — no intra-package circular dependency', () => {
  it('the relative-import graph of every package is acyclic', () => {
    const graph = new Map<string, string[]>()
    for (const file of FILES) graph.set(file.path, valueImportEdges(file))

    const WHITE = 0
    const GRAY = 1
    const BLACK = 2
    const color = new Map<string, number>()
    const stack: string[] = []
    const cycles: string[] = []

    const visit = (node: string): void => {
      color.set(node, GRAY)
      stack.push(node)
      for (const next of graph.get(node) ?? []) {
        const c = color.get(next) ?? WHITE
        if (c === GRAY) {
          const from = stack.indexOf(next)
          const loop = [...stack.slice(from), next].map((p) => p.replace(`${ROOT}/`, ''))
          cycles.push(loop.join(' → '))
        } else if (c === WHITE && graph.has(next)) {
          visit(next)
        }
      }
      stack.pop()
      color.set(node, BLACK)
    }

    for (const node of graph.keys()) {
      if ((color.get(node) ?? WHITE) === WHITE) visit(node)
    }

    expect(cycles, `Circular dependencies found:\n${cycles.join('\n')}`).toEqual([])
  })
})

/**
 * C3 — namespace IRIs come from `@ontology-search/core/rdf/prefixes`, never an
 * inline `http://www.w3.org/...` literal in source (criterion 3). The pattern
 * deliberately matches `http://` (the W3C *namespace* IRIs) and not `https://`
 * (documentation links in JSDoc), so `@see https://www.w3.org/TR/...` lines are
 * untouched.
 */
const W3C_IRI_EXEMPT_FILES = new Set([
  // The single source of truth — the only module allowed to name these IRIs.
  join(ROOT, 'packages/core/src/rdf/prefixes.ts'),
  // Embedded RDF documents: these `http://www.w3.org/...` occurrences are
  // Turtle/SPARQL *data* (`@prefix`/`PREFIX` lines inside template literals),
  // not namespace constants used in logic.
  join(ROOT, 'packages/search/src/data-loader.ts'),
  join(ROOT, 'packages/sparql/src/capability-probe.ts'),
])

describe('repo-policy: C3 — no inline W3C namespace IRI outside core/rdf/prefixes', () => {
  it('every production module sources W3C namespace IRIs from the prefixes helper', () => {
    const violations: string[] = []
    for (const file of FILES) {
      if (W3C_IRI_EXEMPT_FILES.has(file.path)) continue
      for (let i = 0; i < file.lines.length; i++) {
        const line = file.lines[i]!
        if (!line.includes('http://www.w3.org/')) continue
        // Ignore comment lines (block-comment `*` or `//`).
        if (/^\s*(\*|\/\/)/.test(line)) continue
        violations.push(`${file.path}:${i + 1} → ${line.trim()}`)
      }
    }
    expect(
      violations,
      `Inline W3C namespace IRIs (use iri()/sparqlPrefix()):\n${violations.join('\n')}`
    ).toEqual([])
  })
})

describe('repo-policy: C4 — the retrieval surface names no loaded ontology domain', () => {
  /**
   * The schema-retrieval surface must stay absolutely ontology-agnostic:
   * everything it knows comes from the loaded artifacts at runtime. The
   * forbidden-token list is DERIVED from the artifact tree (domain
   * directory names), so the gate updates itself when the ontology grows
   * and hardcodes no ontology identifier of its own.
   *
   * Several real domain names are ordinary English words (`description`,
   * `example`, `general`), so a raw word grep would drown in prose. The
   * gate targets the two vectors hardcoding actually takes in code:
   * a string literal that IS the domain name (`'hdmap'`), and an IRI path
   * segment (`/hdmap/v`). Comment lines are skipped, like C3.
   */
  const RETRIEVAL_SURFACE_DIRS = [
    join(ROOT, 'packages/search/src/schema-index'),
    join(ROOT, 'packages/llm/src/prompt'),
    join(ROOT, 'packages/llm/src/agent'),
  ]

  it('no schema-index or prompt/agent source hardcodes a loaded domain identifier', () => {
    const artifactsRoot = join(ROOT, 'submodules/ontology-management-base/artifacts')
    if (!existsSync(artifactsRoot)) return // submodule not initialized — nothing to derive

    const domainNames = readdirSync(artifactsRoot).filter(
      (name) => name.length >= 2 && statSync(join(artifactsRoot, name)).isDirectory()
    )
    // A present-but-empty artifact tree would derive zero patterns and pass
    // vacuously — the gate must have real domain names to forbid.
    expect(domainNames.length, `no domain directories under ${artifactsRoot}`).toBeGreaterThan(0)
    // Escape regex metacharacters so a future artifact directory name carrying
    // a `.`/`+`/`(` etc. matches literally instead of as a pattern (or throwing).
    const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const patterns = domainNames.map(
      (name) =>
        [
          name,
          new RegExp(`(['"\`]${escapeRegExp(name)}['"\`]|/${escapeRegExp(name)}/v)`, 'i'),
        ] as const
    )

    const violations: string[] = []
    for (const file of FILES) {
      if (!RETRIEVAL_SURFACE_DIRS.some((dir) => file.path.startsWith(dir))) continue
      for (let i = 0; i < file.lines.length; i++) {
        const line = file.lines[i]!
        if (/^\s*(\*|\/\/)/.test(line)) continue
        for (const [name, pattern] of patterns) {
          if (pattern.test(line)) {
            violations.push(`${file.path}:${i + 1} → hardcodes "${name}": ${line.trim()}`)
          }
        }
      }
    }
    expect(
      violations,
      `Ontology-specific identifiers in the retrieval surface (discover them from the schema graph instead):\n${violations.join('\n')}`
    ).toEqual([])
  })
})

describe('repo-policy: turbo hashes the ontology artifacts', () => {
  /**
   * Every package's behaviour is a function of the loaded ontology, so the
   * task hash must change when the pinned artifacts change. A blanket
   * `!submodules/**` exclusion once made `pnpm run validate` replay stale
   * cached results across a submodule bump — reporting green for artifact
   * changes it never tested.
   */
  it('globalDependencies covers the artifact tree and never blanket-excludes submodules', () => {
    const turbo = JSON.parse(readFileSync(join(ROOT, 'turbo.json'), 'utf-8')) as {
      globalDependencies?: string[]
    }
    const globs = turbo.globalDependencies ?? []

    expect(globs).toContain('submodules/ontology-management-base/artifacts/**')
    expect(globs).toContain('submodules/ontology-management-base/imports/**')
    expect(globs).toContain('ontology-sources.json')
    expect(globs.some((g) => g.startsWith('!submodules'))).toBe(false)
  })
})
