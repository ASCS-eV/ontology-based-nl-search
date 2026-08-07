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
  '@ontology-search/slots': 0,
  '@ontology-search/authoring-ir': 0,
  '@ontology-search/authoring-wasm': 0,
  '@ontology-search/road-catalog': 0,
  '@ontology-search/scenario-viewer-wasm': 0,
  '@ontology-search/core': 1,
  '@ontology-search/sparql': 2,
  '@ontology-search/ontology': 2,
  '@ontology-search/authoring': 2,
  '@ontology-search/graphql-ir': 2,
  '@ontology-search/search': 3,
  '@ontology-search/authoring-gate': 3,
  '@ontology-search/llm': 4,
  '@ontology-search/testing': 5,
  '@ontology-search/api': 5,
  '@ontology-search/web': 5,
  '@ontology-search/e2e': 5,
  '@ontology-search/docs': 5,
  '@ontology-search/lsp-server': 5,
}

/**
 * `export … from '@ontology-search/x'` — the direct form of a cross-package
 * re-export. Covers `export *`, `export { … }` and `export type { … }`.
 */
const CROSS_PACKAGE_REEXPORT =
  /export\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s*from\s*['"](@ontology-search\/[^'"]+)['"]/g

/** `import { a, b as c } from '@ontology-search/x'` — binds workspace names locally. */
const CROSS_PACKAGE_IMPORT =
  /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"](@ontology-search\/[^'"]+)['"]/g

/** Any `export { … }` list; the caller decides whether a `from` clause follows. */
const EXPORT_LIST = /export\s+(?:type\s+)?\{([^}]*)\}/g

/** Split an import/export specifier list into the names it binds locally. */
function importedNames(list) {
  return list
    .split(',')
    .map((part) =>
      part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim()
    )
    .filter(Boolean)
}

/** Split an export list into the names it takes from local scope. */
function exportedNames(list) {
  return list
    .split(',')
    .map((part) =>
      part
        .trim()
        .split(/\s+as\s+/)[0]
        ?.trim()
    )
    .filter(Boolean)
}

/**
 * Find the indirect form: `import { X } from '@ontology-search/x'` followed by
 * a bare `export { X }`. Semantically identical to the direct form and just as
 * invisible to the declared-graph check, so the gate must see both.
 */
function indirectReexports(src, subpath) {
  const fromWorkspace = new Map() // local name -> owning workspace package
  for (const match of src.matchAll(CROSS_PACKAGE_IMPORT)) {
    const target = match[2].split('/').slice(0, 2).join('/')
    for (const name of importedNames(match[1])) fromWorkspace.set(name, target)
  }
  if (fromWorkspace.size === 0) return []

  const found = []
  for (const match of src.matchAll(EXPORT_LIST)) {
    // A `from` clause after the brace means the direct rule already saw it.
    const after = src.slice(match.index + match[0].length)
    if (/^\s*from\b/.test(after)) continue
    for (const name of exportedNames(match[1])) {
      const target = fromWorkspace.get(name)
      if (target) found.push({ subpath, target })
    }
  }
  return found
}

/**
 * The `.ts` entry points a package publishes, read from its `exports` map —
 * exactly the files that define its public surface.
 */
function entryPointFiles(pkgDir, pkg) {
  const files = []
  for (const [subpath, value] of Object.entries(pkg.exports ?? {})) {
    const target = typeof value === 'string' ? value : value?.types
    if (typeof target !== 'string' || !target.endsWith('.ts')) continue
    files.push({ subpath, file: join(pkgDir, target) })
  }
  return files
}

/** Read `{ name, deps[], reexports[] }` for every workspace package. */
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
      const pkgDir = join(root, group, entry.name)
      let pkg
      try {
        pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
      } catch {
        continue
      }
      const deps = Object.keys({
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
      }).filter((d) => d.startsWith(WORKSPACE_PREFIX))

      // Scan each published entry point for re-exports of another package.
      const reexports = []
      for (const { subpath, file } of entryPointFiles(pkgDir, pkg)) {
        let src
        try {
          src = readFileSync(file, 'utf8')
        } catch {
          continue
        }
        for (const match of src.matchAll(CROSS_PACKAGE_REEXPORT)) {
          // `@ontology-search/foo/bar` -> `@ontology-search/foo`
          const target = match[1].split('/').slice(0, 2).join('/')
          if (target !== pkg.name) reexports.push({ subpath, target })
        }
        for (const found of indirectReexports(src, subpath)) {
          if (found.target !== pkg.name) reexports.push(found)
        }
      }
      pkgs.push({ name: pkg.name, deps, reexports })
    }
  }
  return pkgs
}

/**
 * Analyze a workspace graph against the layer ranks. Returns a list of violation
 * messages — empty means the graph is acyclic and strictly downward.
 *
 * @param {{name:string, deps:string[], reexports?:{subpath:string,target:string}[]}[]} pkgs
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

  // 3) No entry point may re-export another workspace package's API.
  //
  // This rule exists because rule 2 reads the DECLARED package.json graph, and
  // a re-export launders a real edge past it: when `search`'s barrel carried
  // `export { ShaclValidator } from '@ontology-search/ontology/...'`, `llm`
  // consumed the validator while declaring only `search`, so the gate saw
  // `llm -> search` and the true `llm -> ontology` edge was invisible. It also
  // forces consumers to pull a heavy package to reach a leaf one's types.
  //
  // The fix is always the same: delete the re-export and let the consumer
  // import from — and declare — the package that owns the symbol.
  for (const p of pkgs) {
    for (const { subpath, target } of p.reexports ?? []) {
      if (!names.has(target)) continue
      violations.push(
        `re-export laundering: "${p.name}" entry point "${subpath}" re-exports from "${target}" — ` +
          `import it directly from "${target}" and declare that dependency instead`
      )
    }
  }

  // 4) Defensive cycle detection (independent of ranks).
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
