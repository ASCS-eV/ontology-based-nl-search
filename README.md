# ontology-based-nl-search

Natural language search interface for ontology-management-base knowledge graphs, built with TypeScript.

A locally running TypeScript web application with a Google-style search bar that allows for natural language search of [EVES-003](https://github.com/ASCS-eV/EVES/) Simulation Assets zip files according to their ENVITED-X:SimulationAsset metadata from the [Ontology Management Base](https://github.com/ASCS-eV/ontology-management-base) repository which are created with the help of the [sl-5-8-asset-tools](https://github.com/openMSL/sl-5-8-asset-tools). The ontologies are used as a language translation reference for a LLM which translates natural language queries (e.g. "show me all German highways with 3 lanes") into structured search slots that are validated and compiled into SPARQL queries, then executed against a graph containing simulation asset metadata. The LLM never writes SPARQL directly — a deterministic compiler generates verified queries from validated slots.

## Tech Stack

| Layer                   | Technology                                              |
| ----------------------- | ------------------------------------------------------- |
| **Frontend**            | Vite, React 19, TanStack Router, Tailwind 4             |
| **API**                 | Hono (SSE streaming)                                    |
| **LLM Integration**     | Vercel AI SDK (OpenAI, Ollama), GitHub Copilot SDK      |
| **SPARQL Store (dev)**  | Oxigraph WASM (in-memory, zero setup)                   |
| **SPARQL Store (prod)** | Apache Jena Fuseki (remote endpoint)                    |
| **Ontology Source**     | Fetched & cached from ontology-management-base          |
| **Testing**             | Vitest (unit/integration), Playwright (E2E)             |
| **Monorepo**            | pnpm workspaces, Turborepo                              |
| **Quality**             | ESLint, Prettier, Husky, lint-staged, GitHub Actions CI |

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment config
cp .env.example .env.local

# Start development server (uses in-memory Oxigraph, no external services needed)
pnpm dev
```

The API starts on [http://localhost:3003](http://localhost:3003) and the web UI on [http://localhost:5174](http://localhost:5174).

> **Note:** The default configuration uses Ollama (free, local). Run `ollama pull qwen2.5-coder:7b` to get started without an API key. For OpenAI, set `AI_PROVIDER=openai` and `OPENAI_API_KEY` in `.env.local`.

## Architecture

```
User Query ("German highways with 3 lanes")
    │
    ▼
┌─────────────────────────────┐
│  Hono API (SSE)             │
│  POST /api/search/stream    │
└─────────────┬───────────────┘
              │
    ┌─────────▼─────────┐
    │  Prompt Builder    │◄── Auto-generated from OWL + SHACL vocabulary
    └─────────┬─────────┘
              │
    ┌─────────▼─────────┐
    │  LLM Agent         │◄── Configurable provider (OpenAI, Ollama, Copilot)
    │  NL → SearchSlots  │    Fills structured slots, never writes SPARQL
    └─────────┬─────────┘
              │
    ┌─────────▼─────────┐
    │  Slot Validator    │◄── Fuzzy matching, domain correction, confidence
    └─────────┬─────────┘
              │
    ┌─────────▼─────────┐
    │  SPARQL Compiler   │◄── Deterministic: same slots → same query
    └─────────┬─────────┘
              │
    ┌─────────▼─────────┐
    │  SPARQL Store      │◄── Oxigraph WASM (dev) or Fuseki (prod)
    │  Execute Query     │
    └─────────┬─────────┘
              │
              ▼
     SSE Stream → React UI
```

## Monorepo Structure

```
apps/
├── api/        # Hono SSE streaming API (port 3003)
├── web/        # Vite + React frontend (port 5174)
├── docs/       # VitePress documentation
└── e2e/        # Playwright E2E tests
packages/
├── core/       # Config (Zod-validated), Logging, Errors
├── sparql/     # Oxigraph WASM, Remote, Cached store implementations
├── ontology/   # Ontology source resolution, vocabulary indexing
├── search/     # Schema loader, vocabulary extractor, compiler, service
├── llm/        # Prompt builder, slot validator, LLM agents
└── testing/    # Shared test helpers and fixtures
```

## Development

```bash
pnpm dev              # Start API + web dev servers
pnpm run validate     # Full quality gate (typecheck + lint + format + test)
pnpm test             # Unit tests (Vitest)
pnpm run test:e2e     # E2E tests (Playwright)
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

## Configuration

| Variable          | Description                                   | Default                            |
| ----------------- | --------------------------------------------- | ---------------------------------- |
| `SPARQL_MODE`     | `memory` (Oxigraph WASM) or `remote` (Fuseki) | `memory`                           |
| `SPARQL_ENDPOINT` | Remote SPARQL endpoint URL                    | —                                  |
| `AI_PROVIDER`     | LLM provider: `openai`, `ollama`, `copilot`   | `ollama`                           |
| `AI_MODEL`        | Model identifier                              | `qwen2.5-coder:7b`                 |
| `OPENAI_API_KEY`  | OpenAI API key (when `AI_PROVIDER=openai`)    | —                                  |
| `OLLAMA_BASE_URL` | Ollama server URL                             | `http://localhost:11434/v1`        |
| `ONTOLOGY_REPO`   | GitHub repo for ontologies (fallback)         | `ASCS-eV/ontology-management-base` |
| `ONTOLOGY_BRANCH` | Branch to fetch ontologies from (fallback)    | `main`                             |

## License

See [LICENSE](./LICENSE).
