/**
 * Layer-boundary gate — enforces the monorepo's dependency layering.
 *
 * CLAUDE.md / CONTRIBUTING describe a strict layering with no cycles and no
 * upward dependencies:
 *
 *   configs <- core <- {sparql, ontology, api-types} <- search <- llm <- apps
 *
 * `madge --circular` cannot enforce this here: production code imports packages
 * via `exports`-map subpaths (e.g. `@ontology-search/core/graphql/enum`) and the
 * root tsconfig has no `compilerOptions.paths`, so a source-import resolver
 * cannot follow cross-package edges — it would pass vacuously. Instead we check
 * the **declared** workspace-dependency graph straight from each `package.json`,
 * which is resolver-independent and is exactly the layering contract. pnpm
 * already blocks *undeclared* imports; this catches a *declared* upward or cyclic
 * dependency that nothing else would flag.
 *
 * Pure (`analyzeLayers`) so it is unit-testable; the CLI reads the real graph.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORKSPACE_PREFIX = '@ontology-search/'

/**
 * Layer rank per workspace package. An edge `A -> B` is legal only when
 * `rank(B) < rank(A)` (strictly downward). Build-only configs are rank -1 (any
 * package may depend on them); `api-types` and `design-system` are rank-0 leaves
 * importable by any higher layer. This rank map is the only hardcoded knob — the
 * edges themselves are read from `package.json`. A new package that is not ranked
 * here fails the gate (so it cannot silently bypass the layering).
 */
export const RANKS = {
  '@ontology-search/typescript-config': -1,
  '@ontology-search/eslint-config': -1,
  '@ontology-search/api-types': 0,
  '@ontology-search/design-system': 0,
  '@ontology-search/core': 1,
  '@ontology-search/sparql': 2,
  '@ontology-search/ontology': 2,
  '@ontology-search/search': 3,
  '@ontology-search/llm': 4,
  '@ontology-search/testing': 5,
  '@ontology-search/api': 5,
  '@ontology-search/web': 5,
  '@ontology-search/e2e': 5,
  '@ontology-search/docs': 5,
}

/** Read `{ name, deps[] }` for every workspace package under packages/ and apps/. */
export function readWorkspaceGraph(root = ROOT) {
  const pkgs = []
  for (const group of ['packages', 'apps']) {
    let entries
    try {
      entries = readdirSync(join(root, group), { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      let pkg
      try {
        pkg = JSON.parse(readFileSync(join(root, group, entry.name, 'package.json'), 'utf8'))
      } catch {
        continue
      }
      const deps = Object.keys({
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
      }).filter((d) => d.startsWith(WORKSPACE_PREFIX))
      pkgs.push({ name: pkg.name, deps })
    }
  }
  return pkgs
}

/**
 * Analyze a workspace graph against the layer ranks. Returns a list of violation
 * messages — empty means the graph is acyclic and strictly downward.
 *
 * @param {{name:string, deps:string[]}[]} pkgs
 * @param {Record<string, number>} ranks
 */
export function analyzeLayers(pkgs, ranks = RANKS) {
  const violations = []
  const names = new Set(pkgs.map((p) => p.name))

  // 1) Every package must be ranked — a new package cannot silently bypass.
  for (const p of pkgs) {
    if (!(p.name in ranks)) {
      violations.push(`unranked package "${p.name}" — add it to RANKS in scripts/check-layers.mjs`)
    }
  }

  // 2) Every declared workspace edge must point strictly downward.
  for (const p of pkgs) {
    const rp = ranks[p.name]
    for (const dep of p.deps) {
      if (!names.has(dep)) continue // a workspace name not in this graph (e.g. fixtures)
      const rd = ranks[dep]
      if (rp === undefined || rd === undefined) continue // already flagged as unranked
      if (rd >= rp) {
        violations.push(
          `illegal dependency "${p.name}" (layer ${rp}) -> "${dep}" (layer ${rd}): not strictly downward`
        )
      }
    }
  }

  // 3) Defensive cycle detection (independent of ranks).
  const adj = new Map(pkgs.map((p) => [p.name, p.deps.filter((d) => names.has(d))]))
  const state = new Map() // undefined = unseen, 0 = on stack, 1 = done
  const stack = []
  const visit = (n) => {
    state.set(n, 0)
    stack.push(n)
    for (const m of adj.get(n) ?? []) {
      if (state.get(m) === 0) {
        violations.push(`dependency cycle: ${[...stack.slice(stack.indexOf(m)), m].join(' -> ')}`)
      } else if (state.get(m) === undefined) {
        visit(m)
      }
    }
    state.set(n, 1)
    stack.pop()
  }
  for (const p of pkgs) if (state.get(p.name) === undefined) visit(p.name)

  return [...new Set(violations)]
}

// CLI: run the gate against the real workspace graph.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const violations = analyzeLayers(readWorkspaceGraph())
  if (violations.length > 0) {
    console.error(
      'check-layers: layer-boundary violations:\n' + violations.map((v) => `  - ${v}`).join('\n')
    )
    process.exit(1)
  }
  console.log('check-layers: workspace dependency graph is acyclic and strictly downward ✓')
}
