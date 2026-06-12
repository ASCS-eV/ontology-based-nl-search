# @ontology-search/web

Frontend single-page app: **Vite + React 19 + TanStack Router/Query** (default
dev port **5174**, configurable via `WEB_PORT` environment variable). Users type natural-language queries; the UI streams the
LLM interpretation, gaps, and result rows from the API over SSE, and renders
per-row traceability breadcrumbs and the lineage explorer.

Talks to the API only through `@ontology-search/api-types` — it shares the wire
contract but no server code. In dev, `/api` proxies to the API on `:3003`
(see `vite.config.ts`).

## Configuration

The dev port can be changed via the `WEB_PORT` environment variable:

```bash
WEB_PORT=8080 pnpm --filter @ontology-search/web dev
```

Or in `.env.local`:

```bash
WEB_PORT=8080
```

For more details, see [PORT_CONFIGURATION.md](../../PORT_CONFIGURATION.md).

## Scripts

```bash
pnpm --filter @ontology-search/web dev         # dev server (:5174, or WEB_PORT if set)
pnpm --filter @ontology-search/web build       # production build
pnpm --filter @ontology-search/web preview     # preview the build
```
