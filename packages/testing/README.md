# @ontology-search/testing

> Shared Vitest test helpers and fixtures used across the workspace. Not production code.

**Layer:** test-only. Declared as a dev dependency by the packages it serves and imported solely from Vitest suites. Pulls in `@ontology-search/ontology`, `@ontology-search/search`, and `@ontology-search/sparql` as dev dependencies to warm up real stores in integration tests. **Never import this from a runtime path.**

## Purpose

Encapsulates the repeated setup that integration suites need — most importantly the `getInitializedStore() + buildDomainRegistry()` warmup sequence — so each test file does not re-invent it. Also serves static fixture files (sample ontologies, slots, etc.) used across suites.

## Public interface

| Subpath        | Purpose                                                                     |
| -------------- | --------------------------------------------------------------------------- |
| `./helpers`    | `getSearchTestContext` (store + domain registry warmup), `createMockLogger` |
| `./fixtures/*` | Static fixture files (sample ontologies, slots, …)                          |

## Requirements & invariants

- **Test-only**: nothing here is shipped or imported from production code paths.
- `getSearchTestContext` loads the **real** ontology from disk into an in-memory store; the first call is slow because it is warmup, not a bug.
- Search and ontology suites that use it need generous timeouts (≈120 s) and low concurrency — call it inside a `beforeAll` with an explicit timeout.

## How to interface

```ts
import { getSearchTestContext } from '@ontology-search/testing/helpers'

let ctx: Awaited<ReturnType<typeof getSearchTestContext>>

beforeAll(async () => {
  ctx = await getSearchTestContext()
}, 120_000)

// ctx.store and ctx.registry are ready for query/compilation tests.
```

## See also

- [Root README](../../README.md)
- [`@ontology-search/search`](../search/README.md) and [`@ontology-search/ontology`](../ontology/README.md) — the layers these helpers warm up
