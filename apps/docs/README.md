# @ontology-search/docs

VitePress documentation site (default dev port **5173**, served under the
`/docs/` base, configurable via `DOCS_PORT` environment variable). Source for the architecture, generic-design, query-flow,
ontology-model, agent, and data-model guides, the SPARQL reference, and the
presentation slides.

## Configuration

The dev port can be changed via the `DOCS_PORT` environment variable:

```bash
DOCS_PORT=8081 pnpm --filter @ontology-search/docs dev
```

Or in `.env.local`:

```bash
DOCS_PORT=8081
```

For more details, see [PORT_CONFIGURATION.md](/PORT_CONFIGURATION.md).

## Scripts

```bash
pnpm --filter @ontology-search/docs dev      # local docs server (:5173, or DOCS_PORT if set)
pnpm --filter @ontology-search/docs build    # static build
```

Navigation lives in `.vitepress/config.ts`. Reference pages use neutral
`http://example.org/` example IRIs — the demo ENVITED-X ontology is referenced
only as the running example, never as the system's definition.
