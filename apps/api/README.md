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

Each contract below is guarded by a named test (test paths relative to `apps/api/`). The security model rests on A1–A2: the LLM only fills slots and the deterministic compiler is the sole SPARQL author, so no prompt injection can produce an arbitrary query.

| #   | Requirement / invariant                                                                                                                                                         | Guarded by                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **`/health` is 503 until warmup succeeds** — `starting` and `degraded` return 503; `ok` returns 200 only after warmup records readiness                                         | `src/__tests__/routes.test.ts` (`GET /health` — "returns 503 'starting' before warmup records readiness", "returns 200 'ok' once warmup succeeded", "returns 503 'degraded' with the errors when warmup failed") |
| A2  | **Slots-only / deterministic boundary** — `/search/refine` accepts only structured slots; invalid shape → 422, missing `slots` → 400, valid slots compile and execute           | `src/__tests__/routes.test.ts` (`POST /search/refine` — "returns 422 for invalid slot shape", "returns 400 for missing slots field", "returns 200 with results for valid slots")                                 |
| A3  | **SSE canonical event sequence** — `status → interpretation → gaps → sparql → graphql → status → results → meta → done`, in order                                               | `src/__tests__/routes.sse.test.ts` ("emits the canonical event sequence on success")                                                                                                                             |
| A4  | **`done` is emitted exactly once and is terminal**                                                                                                                              | `src/__tests__/routes.sse.test.ts` ("emits `done` exactly once and as the terminal event")                                                                                                                       |
| A5  | **Each SSE event's `data` is well-formed JSON of the expected shape**                                                                                                           | `src/__tests__/routes.sse.test.ts` ("each event's data is well-formed JSON of the expected shape")                                                                                                               |
| A6  | **Errors are streamed, never thrown** — when `searchNl` throws, the stream emits `event: error`, no `done`, and leaks no stack                                                  | `src/__tests__/routes.sse.test.ts` ("emits `event: error` and terminates cleanly when searchNl throws")                                                                                                          |
| A7  | **Query length is capped before the LLM** — an over-long query is rejected with an SSE `error`/`BAD_REQUEST`; `searchNl` is never called                                        | `src/__tests__/routes.sse.test.ts` ("rejects an over-long query before invoking the LLM")                                                                                                                        |
| A8  | **Body-size limit returns 413** — a `/search/*` body larger than `API_MAX_BODY_BYTES` is rejected with HTTP 413                                                                 | `src/__tests__/routes.test.ts` ("body-limit: rejects a body larger than API_MAX_BODY_BYTES with 413")                                                                                                            |
| A9  | **CORS is wired** — a cross-origin request gets `Access-Control-Allow-Origin` (default `*`)                                                                                     | `src/__tests__/routes.test.ts` ("CORS: sets Access-Control-Allow-Origin (default '\*') on a cross-origin request")                                                                                               |
| A10 | **`/vocabulary` conforms to the api-types `VocabularyResponse`** — extractor `localName` mapped to wire `name`                                                                  | `src/__tests__/routes.test.ts` ("emits a conforming VocabularyResponse, mapping localName -> name")                                                                                                              |
| A11 | **`/stats` returns store statistics** — `totalAssets` + `availableDomains` from the registry + count queries                                                                    | `src/__tests__/routes.test.ts` ("returns stats with domain counts")                                                                                                                                              |
| A12 | **`/metadata/*` validate params and forward to the service** — missing `iri`/`domain`/`group` → 400; valid params forward                                                       | `src/__tests__/routes.test.ts` (`GET /metadata/asset`, `GET /metadata/aggregate`)                                                                                                                                |
| A13 | **`/traceability` validates params and forwards lineage** — missing `asset` / non-numeric `depth` → 400                                                                         | `src/__tests__/routes.test.ts` (`GET /traceability`)                                                                                                                                                             |
| A14 | **Client abort propagates into the service** — the HTTP/SSE `AbortSignal` reaches `searchNl`/`searchRefine`                                                                     | `src/__tests__/routes.test.ts` ("forwards the request AbortSignal into searchNl"/"…searchRefine")                                                                                                                |
| A15 | **`x-request-id` correlation** — the middleware id is set on the response and passed to the service                                                                             | `src/__tests__/routes.test.ts` ("returns a response x-request-id that matches the requestId passed to searchNl")                                                                                                 |
| A16 | **Typed-error → HTTP-status mapping is by class, not message** — `CompileError`→422; `StoreUnavailable`/`Agent`/`OntologySources`→503; plain `Error`→500, no leak               | `src/__tests__/error-handler.test.ts` ("maps by class, not message — renaming a message preserves status", "falls through to 500 INTERNAL_ERROR for plain Error")                                                |
| A17 | **Optional API-key gate** — passthrough when unset; when set, requires a valid `Bearer`/`x-api-key` (constant-time compare) else 401; `/health` stays open                      | `src/__tests__/auth.test.ts` ("is an open passthrough when API_KEY is unset", "rejects a request with no credentials (401)", "leaves /health open…")                                                             |
| A18 | **Token-bucket rate limiting** — `RATE_LIMIT_RPS=0` disables; else burst → 429 (`Retry-After`), refills at RPS, per-client-IP, LRU-bounded store                                | `src/__tests__/rate-limit.test.ts` ("returns 429 once the burst is exhausted", "isolates buckets per client IP", "is a no-op when rps is 0", "evicts least-recently-used buckets when the store is full")        |
| A19 | **Graceful shutdown ordering** — on SIGINT/SIGTERM: close server, then store, then exit 0; a stalled drain force-exits 1; a second signal escalates; `EADDRINUSE` is actionable | `src/__tests__/lifecycle.test.ts` ("closes the server, then the store, then exits 0 — in that order", "force-exits 1 when a drain step stalls…", "reports EADDRINUSE with an actionable message…")               |
| A20 | **Env validated by Zod at startup** — invalid config aborts boot; prod rejects CORS `*` and refuses to start without `API_KEY`/opt-out                                          | `@ontology-search/core` `src/config/__tests__/config.test.ts` ("throws on invalid SPARQL_MODE", "rejects CORS_ALLOWED_ORIGINS='\*' in production", "refuses to start in production with no API_KEY…")            |
| A21 | **Node >= 22; ESM (`"type": "module"`)** — runtime/packaging requirement                                                                                                        | review checklist (declared in `package.json` `engines`; no automated test)                                                                                                                                       |

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
