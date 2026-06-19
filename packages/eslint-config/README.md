# @ontology-search/eslint-config

> Shared ESLint flat config for the workspace.

**Layer:** Shared dev-tooling config. Sits below every package and app; any
workspace member's `eslint.config.mjs` can import its presets. It depends only
on `@eslint/js`, `typescript-eslint`, and `globals`.

## Purpose

A single source for the workspace's lint baseline so packages don't each
restate TypeScript rules. It bundles `@eslint/js` recommended + the
`typescript-eslint` strict rules, ignores `dist/`, `node_modules/`, and
`coverage/`, and codifies project conventions (e.g. `no-non-null-assertion` as a
warning, unused-vars ignoring `_`-prefixed names).

## Public interface

Flat-config presets exported from `index.mjs` (`"main": "index.mjs"`):

- `base` — Node globals + TypeScript strict rules + shared ignores.
- `react` — `base` plus browser globals, for the web app.

## Requirements & invariants

- ESM only (`"type": "module"`); requires a flat-config-capable ESLint 9+.
- Presets are arrays of flat-config objects — spread them into the consumer's
  exported config.

## How to interface

```js
// eslint.config.mjs in a consuming package
import { base } from '@ontology-search/eslint-config'

export default [...base /* , package-specific overrides */]
```

```js
// for the web app
import { react } from '@ontology-search/eslint-config'

export default [...react]
```

## See also

- Root README: [../../README.md](../../README.md)
- Companion config: `@ontology-search/typescript-config`
