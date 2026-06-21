# @ontology-search/docs

> VitePress documentation site for the project.

**Layer:** Application. A static VitePress site (with Mermaid and Cytoscape
diagrams) served independently of the runtime. It documents the other modules
but is not depended on by any of them.

## Purpose

The project's documentation site: architecture, generic-design, query-flow,
ontology-model, agent, and data-model guides, the SPARQL reference, and the
presentation slides. It exists to explain how the pipeline works and to keep
design rationale next to the code, served under the `/docs/` base.

## Public interface

- Dev URL: **http://localhost:5173/docs/** (or `DOCS_PORT` if set).
- Content is authored as Markdown; navigation and the `/docs/` base live in
  `.vitepress/config.ts`. `vitepress build` emits a static site.

## Requirements & invariants

- Node >= 22; ESM (`"type": "module"`).
- Reference pages use neutral `http://example.org/` example IRIs — the demo
  ENVITED-X ontology is referenced only as the running example, never as the
  system's definition.

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

## How to interface

```bash
pnpm --filter @ontology-search/docs dev       # local docs server (:5173, or DOCS_PORT if set)
pnpm --filter @ontology-search/docs build     # static build
pnpm --filter @ontology-search/docs preview   # preview the static build
```

## See also

- Root README: [../../README.md](../../README.md)
- Architecture guide: [architecture.md](./architecture.md)
- Port configuration: [PORT_CONFIGURATION.md](/PORT_CONFIGURATION.md)
