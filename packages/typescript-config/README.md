# @ontology-search/typescript-config

> Shared TypeScript base configs for the workspace.

**Layer:** Shared dev-tooling config. Sits below every package and app; each
workspace member's `tsconfig.json` extends one of its bases.

## Purpose

A single source for the workspace's TypeScript compiler baseline so packages
don't each restate strictness and module settings. It exists to keep type
checking consistent across Node libraries, the API server, and the React web
app.

## Public interface

Base configs, referenced by `extends`:

| File         | For                               |
| ------------ | --------------------------------- |
| `node.json`  | Node libraries and the API server |
| `react.json` | The Vite + React web app          |

All bases enable strict mode, `noUncheckedIndexedAccess`, target ES2022, and
module NodeNext.

## Requirements & invariants

- Consumers `extends` a base and add only path-specific options
  (`outDir`, `rootDir`, `include`, `exclude`).
- The bases are the single place strictness is defined — packages must not relax
  it locally.

## How to interface

```jsonc
// tsconfig.json in a consuming package
{
  "extends": "@ontology-search/typescript-config/node.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
  },
  "include": ["src/**/*.ts"],
}
```

The web app extends `@ontology-search/typescript-config/react.json` instead.

## See also

- Root README: [../../README.md](../../README.md)
- Companion config: `@ontology-search/eslint-config`
