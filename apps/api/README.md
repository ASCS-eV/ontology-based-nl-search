# @ontology-search/api

Hono-based HTTP API server (default port **3003**) and the composition root for
the search pipeline. On startup it warms the SPARQL store, loads the schema
graph, builds the domain registry, and caches the LLM prompt; results stream to
clients as Server-Sent Events.

## Endpoints

| Method & path              | Purpose                                                   |
| -------------------------- | --------------------------------------------------------- |
| `POST /search/stream`      | Run an NL query; stream interpretation + results over SSE |
| `POST /search/refine`      | Refine a prior result with corrected slots                |
| `GET  /metadata/asset`     | Per-asset shape-group facets                              |
| `GET  /metadata/aggregate` | Per-domain aggregate facets                               |
| `GET  /stats`              | Store statistics (asset counts per domain)                |
| `GET  /traceability`       | Multi-hop lineage across asset references                 |
| `GET  /health`             | Readiness probe — **503 until warmup succeeds**           |

## Scripts

```bash
pnpm --filter @ontology-search/api dev         # dev server with watch
pnpm --filter @ontology-search/api dev:clean   # dev server, fresh store
pnpm --filter @ontology-search/api start       # production start (after build)
```

See [System Architecture](../docs/architecture.md).
