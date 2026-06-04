# Roadmap

## Completed ✅

| Feature                            | Description                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| **NL → SPARQL pipeline**           | Full natural language to SPARQL query pipeline                                             |
| **Unified ontology store**         | OWL + SHACL loaded directly, no manual SKOS layer                                          |
| **Auto-generated LLM prompt**      | System prompt built from raw SHACL Turtle                                                  |
| **Post-LLM slot validation**       | Fuzzy + tokenised matching, domain correction, confidence recomputation                    |
| **Streaming SSE responses**        | Progressive UI updates as each pipeline phase completes                                    |
| **Query refinement UI**            | Users can edit filters directly and re-execute                                             |
| **Data-driven cross-references**   | Reference signatures discovered by BFS over typed instances at warmup                      |
| **Flattened slot shape**           | Country / region / city / license route through `filters` like any other leaf              |
| **Traceability — predicate chain** | `compileSlotsWithTrace` binds intermediate JOIN vars; per-row breadcrumb UI                |
| **Lineage explorer**               | `/traceability?asset=<iri>` walks outgoing `@id` references multi-hop; nested-tree UI      |
| **Metadata facets**                | `/metadata/asset` (per-asset snapshot) and `/metadata/aggregate` (per-domain distribution) |
| **Multi-provider LLM**             | 5 providers via Vercel AI SDK (OpenAI, Anthropic, claude-cli, vibe-cli, Ollama) + Copilot  |
| **LLM tuning surface**             | `LLM_TEMPERATURE`, `LLM_THINKING_BUDGET`, `LLM_MAX_AGENT_STEPS` as typed env knobs         |
| **Honest gap reporting**           | Dropped cross-reference slots and SHACL-rejected values surface explanatory gaps           |
| **Forced tool choice**             | `toolChoice` targets `submit_slots` by name — 1-step structured output across providers    |
| **Multi-domain architecture**      | All discovered asset classes joined by SHACL-discovered cross-references                   |
| **Monorepo**                       | pnpm workspaces + Turborepo orchestration                                                  |
| **Hono API**                       | Lightweight HTTP server (port 3003)                                                        |
| **Vite + React frontend**          | TanStack Router, modern React patterns                                                     |
| **VitePress docs**                 | Full-screen slide presentations + reference docs                                           |
| **CI/CD**                          | GitHub Actions with typecheck + lint + test                                                |

## In Progress 🔄

| Feature                | Description                                                 |
| ---------------------- | ----------------------------------------------------------- |
| **E2E test expansion** | Comprehensive search query test suite (Playwright)          |
| **Concept document**   | PDF ≥ 5 pages capturing the traceability concept end-to-end |

## Planned 📋

| Feature                       | Description                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **N-hop reference chains**    | `slots.references` currently binds one hop; full chain support would express `scenario → trace → hdmap` literally |
| **Quality-metadata UI**       | API surface is complete; dedicated UI deferred until the concept doc shapes what to surface                       |
| **Additional domain data**    | Vehicle models, simulated sensors                                                                                 |
| **Federated SPARQL**          | Cross-endpoint queries across the ENVITED-X Data Space                                                            |
| **OpenAPI specification**     | Formal API documentation                                                                                          |
| **Conversational refinement** | Multi-turn dialogue for iterative query building                                                                  |
| **Performance benchmarks**    | Latency profiling and optimization targets                                                                        |
| **Deployment automation**     | Container builds, staging, production pipelines                                                                   |

## Architecture Decisions

| Decision                   | Rationale                                                                |
| -------------------------- | ------------------------------------------------------------------------ |
| Eliminated SKOS layer      | Redundant — `sh:in` already defines vocabulary; LLM handles synonyms     |
| Single `submit_slots` tool | Constrains LLM to valid structured output                                |
| Post-LLM validation        | Defense-in-depth — catches LLM mistakes before SPARQL compilation        |
| Oxigraph in-process        | Zero-infrastructure development; swap to remote endpoint in production   |
| Auto-generated prompt      | Vocabulary changes propagate automatically, no manual prompt maintenance |

---

<div style="text-align: center; margin-top: 3rem;">
  <a href="http://localhost:5174" style="display: inline-block; padding: 0.75rem 2rem; background: #2563eb; color: white; border-radius: 0.5rem; text-decoration: none; font-weight: 600;">Launch Search Demo →</a>
  <span style="margin: 0 1rem; color: #9ca3af;">or</span>
  <a href="https://github.com/ASCS-eV/ontology-based-nl-search" style="color: #2563eb; text-decoration: none; font-weight: 500;">View on GitHub</a>
</div>
