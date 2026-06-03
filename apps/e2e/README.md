# @ontology-search/e2e

End-to-end tests (Playwright) that drive the web UI against a running API.

## Scripts

```bash
pnpm --filter @ontology-search/e2e test:e2e      # headless run
pnpm --filter @ontology-search/e2e test:e2e:ui   # Playwright UI mode
```

> Bring up the stack (`pnpm dev`) — or let the Playwright config start it —
> before running. These tests exercise the full pipeline, so the first run
> pays the store warmup cost.
