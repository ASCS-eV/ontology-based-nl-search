# @ontology-search/docs

VitePress documentation site (default dev port **5173**, served under the
`/docs/` base). Source for the architecture, generic-design, query-flow,
ontology-model, agent, and data-model guides, the SPARQL reference, and the
presentation slides.

## Scripts

```bash
pnpm --filter @ontology-search/docs dev      # local docs server (:5173)
pnpm --filter @ontology-search/docs build    # static build
```

Navigation lives in `.vitepress/config.ts`. Reference pages use neutral
`http://example.org/` example IRIs — the demo ENVITED-X ontology is referenced
only as the running example, never as the system's definition.
