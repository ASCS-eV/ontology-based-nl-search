# @ontology-search/testing

Shared test helpers and fixtures used across the workspace's Vitest suites.
**Not production code** — never import this from a runtime path.

## Exports

| Subpath        | Purpose                                            |
| -------------- | -------------------------------------------------- |
| `./helpers`    | Test setup utilities (store warmup, builders, …)   |
| `./fixtures/*` | Static fixture files (sample ontologies, slots, …) |

> **Note:** search/ontology suites drive a real cold-start store — they need
> generous timeouts (≈120 s) and low concurrency. A slow first run is warmup,
> not a bug.
