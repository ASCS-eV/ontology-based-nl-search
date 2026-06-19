# @ontology-search/e2e

> Playwright end-to-end tests for the search UI.

**Layer:** Application (test harness). Drives the `web` UI in a real browser
against a running `@ontology-search/api`, exercising the full pipeline
end-to-end. Nothing depends on it.

## Purpose

Playwright tests that load the web app, run natural-language queries, and assert
on the streamed results and editor behavior (e.g. autocomplete references and
enum values). They exist to guard the whole stack — UI, wire contract, API, and
SPARQL pipeline — against regressions that unit tests cannot catch.

## Public interface

- Entry: Playwright specs under this package, run via the `test:e2e` scripts.
- The Playwright config can bring up the stack itself, or you can start it
  beforehand with `pnpm dev`.

## Requirements & invariants

- Node >= 22; ESM (`"type": "module"`).
- A running stack (`web` + `api`) — started manually via `pnpm dev` or by the
  Playwright config.
- The first run pays the store warmup cost, since these tests hit the live
  pipeline.

## How to interface

```bash
pnpm --filter @ontology-search/e2e test:e2e      # headless run
pnpm --filter @ontology-search/e2e test:e2e:ui   # Playwright UI mode
```

## See also

- Root README: [../../README.md](../../README.md)
- Under test: `@ontology-search/web` and `@ontology-search/api`
