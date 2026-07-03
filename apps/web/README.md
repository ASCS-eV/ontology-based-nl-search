# @ontology-search/web

> Vite + React 19 frontend for ontology-based natural-language search.

**Layer:** Application. A browser single-page app (Vite + React 19 + TanStack
Router/Query) that talks to `@ontology-search/api` over HTTP/SSE. It depends on
no server code — only the shared wire contract in `@ontology-search/api-types`.

## Purpose

The UI where users type natural-language queries. It streams the LLM
interpretation, gaps, and result rows from the API over Server-Sent Events,
renders per-row traceability breadcrumbs and a lineage explorer, and includes a
CodeMirror-based GraphQL DSL editor with schema-aware autocomplete. It exists
to make the search pipeline usable interactively without exposing any backend
internals.

## Public interface

- Dev URL: **http://localhost:5174** (or `WEB_PORT` if set).
- Talks to the API only through `@ontology-search/api-types` — it shares the
  wire contract but no server code.
- In dev, requests to `/api` are proxied to the API on `:3003` and the `/api`
  prefix is stripped (see `vite.config.ts`).

## Requirements & invariants

- Node >= 22; ESM (`"type": "module"`).
- A running `@ontology-search/api` (the `/api` proxy target) for live data.
- Imports the API's types but never its runtime code — the client/server
  boundary is the wire contract only.

## Configuration

The dev port can be changed via the `WEB_PORT` environment variable:

```bash
WEB_PORT=8080 pnpm --filter @ontology-search/web dev
```

Or in `.env.local`:

```bash
WEB_PORT=8080
```

For more details, see [PORT_CONFIGURATION.md](/PORT_CONFIGURATION.md).

## How to interface

```bash
pnpm --filter @ontology-search/web dev         # dev server (:5174, or WEB_PORT if set)
pnpm --filter @ontology-search/web build       # production build
pnpm --filter @ontology-search/web preview     # preview the build
```

## See also

- Root README: [../../README.md](../../README.md)
- Backend: `@ontology-search/api`; wire contract: `@ontology-search/api-types`
- Port configuration: [PORT_CONFIGURATION.md](/PORT_CONFIGURATION.md)
