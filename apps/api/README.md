# @ontology-search/api

> Hono SSE API server and composition root for the natural-language search pipeline.

**Layer:** Application. The HTTP/SSE entry point that wires together `core`,
`sparql`, `ontology`, `search`, and `llm`. It serves the `web` app and any
other client over HTTP, sharing only the wire contract via
`@ontology-search/api-types`.

## Purpose

This app is the composition root for the search pipeline. On startup it warms
the SPARQL store, loads the schema graph, builds the domain registry, and
caches the LLM prompt. At request time it turns natural-language queries into
validated `SearchSlots`, compiles deterministic SPARQL, executes it, and
streams interpretation, gaps, and result rows back to clients as Server-Sent
Events. It exists so the pipeline has a single, secure boundary — the LLM never
writes SPARQL.

## Public interface

HTTP routes (default port **3003**), mounted in `src/app.ts`:

| Path / method     | Purpose                                                         |
| ----------------- | --------------------------------------------------------------- |
| `/search/*`       | Run/refine NL queries; stream interpretation + results over SSE |
| `/metadata/*`     | Per-asset shape-group facets and per-domain aggregate facets    |
| `/stats`          | Store statistics (asset counts per domain)                      |
| `/traceability/*` | Multi-hop lineage across asset references                       |
| `/vocabulary/*`   | Discovered property / vocabulary metadata                       |
| `GET /health`     | Readiness probe — **503 until warmup succeeds**                 |

Clients consume the wire types from `@ontology-search/api-types`.

## Requirements & invariants

- Node >= 22; ESM (`"type": "module"`).
- Environment loaded from `.env.local` and validated by Zod at startup (via
  `@ontology-search/core`).
- The LLM never writes SPARQL; the compiler is deterministic — identical slots
  always produce identical queries.
- `/health` returns 503 until the startup warmup (store + schema + prompt)
  succeeds.

## How to interface

```bash
pnpm --filter @ontology-search/api dev         # dev server with watch (:3003)
pnpm --filter @ontology-search/api dev:clean   # dev server, free the port first
pnpm --filter @ontology-search/api build       # tsc build
pnpm --filter @ontology-search/api start       # production start (after build)
```

## See also

- Root README: [../../README.md](../../README.md)
- System architecture: [../docs/architecture.md](../docs/architecture.md)
- Wire contract: `@ontology-search/api-types`; frontend: `@ontology-search/web`
