# Roadmap

## Completed ✅

| Feature                       | Description                                                 |
| ----------------------------- | ----------------------------------------------------------- |
| **NL → SPARQL pipeline**      | Full natural language to SPARQL query pipeline              |
| **Unified ontology store**    | OWL + SHACL loaded directly, no manual SKOS layer           |
| **Auto-generated LLM prompt** | System prompt built from extracted vocabulary               |
| **Post-LLM slot validation**  | Fuzzy matching, domain correction, confidence recomputation |
| **Streaming SSE responses**   | Progressive UI updates as each pipeline phase completes     |
| **Query refinement UI**       | Users can edit filters directly and re-execute              |
| **Multi-domain architecture** | HD map + scenario with cross-domain joins                   |
| **Monorepo**                  | pnpm workspaces + Turborepo orchestration                   |
| **Hono API**                  | Lightweight HTTP server (port 3003)                         |
| **Vite + React frontend**     | TanStack Router, modern React patterns                      |
| **VitePress docs**            | Full-screen slide presentations + reference docs            |
| **Multi-provider LLM**        | Copilot SDK + Vercel AI SDK (OpenAI/Ollama)                 |
| **CI/CD**                     | GitHub Actions with typecheck + lint + test                 |

## In Progress 🔄

| Feature                          | Description                           |
| -------------------------------- | ------------------------------------- |
| **E2E test expansion**           | Comprehensive search query test suite |
| **Domain correction validation** | Testing cross-domain query accuracy   |

## Planned 📋

| Feature                       | Description                                            |
| ----------------------------- | ------------------------------------------------------ |
| **Additional domain data**    | Environment models, vehicle models, simulated sensors  |
| **LLM response streaming**    | Stream interpretation tokens for perceived speed       |
| **Federated SPARQL**          | Cross-endpoint queries across the ENVITED-X Data Space |
| **OpenAPI specification**     | Formal API documentation                               |
| **Conversational refinement** | Multi-turn dialogue for iterative query building       |
| **Performance benchmarks**    | Latency profiling and optimization targets             |
| **Deployment automation**     | Container builds, staging, production pipelines        |

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
