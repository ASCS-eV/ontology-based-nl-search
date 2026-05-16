# ontology-based-nl-search

Natural language search interface for ontology-management-base knowledge graphs, built with TypeScript.

A locally running TypeScript web application with a Google-style search bar that allows for natural language search of [EVES-003](https://github.com/ASCS-eV/EVES/) Simulation Assets zip files according to their ENVITED-X:SimulationAsset metadata from the [Ontology Management Base](https://github.com/ASCS-eV/ontology-management-base) repository which are created with the help of the [sl-5-8-asset-tools](https://github.com/openMSL/sl-5-8-asset-tools). The ontologies are used as a language translation reference for a LLM which translates natural language queries (e.g. "show me all German highways with 3 lanes") into structured search slots that are validated and compiled into graph-driven SPARQL queries, then executed against a graph containing simulation asset metadata. The LLM never writes SPARQL directly — a deterministic compiler queries the SHACL schema graph to generate verified queries from validated slots.

## Tech Stack

| Layer                   | Technology                                                                |
| ----------------------- | ------------------------------------------------------------------------- |
| **Frontend**            | Vite, React 19, TanStack Router, Tailwind 4                               |
| **API**                 | Hono (SSE streaming)                                                      |
| **LLM Integration**     | Vercel AI SDK (OpenAI, Ollama, Anthropic, Claude CLI), GitHub Copilot SDK |
| **SPARQL Store (dev)**  | Oxigraph WASM (in-memory, zero setup)                                     |
| **SPARQL Store (prod)** | Apache Jena Fuseki (remote endpoint)                                      |
| **Ontology Source**     | Fetched & cached from ontology-management-base                            |
| **Testing**             | Vitest (unit/integration), Playwright (E2E)                               |
| **Monorepo**            | pnpm workspaces, Turborepo                                                |
| **Quality**             | ESLint, Prettier, Husky, lint-staged, GitHub Actions CI                   |

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
# Copy the example config
cp .env.example .env.local

# Edit .env.local and set AI_PROVIDER to one of:
# - "ollama"     (default, free local) - requires: ollama pull qwen2.5-coder:7b
# - "openai"     (requires OPENAI_API_KEY)
# - "anthropic"  (requires ANTHROPIC_API_KEY)
# - "claude-cli" (uses ~/.claude/.credentials.json; run `claude` once to log in)
# - "copilot"    (requires GitHub Copilot Enterprise)
```

### 3. Start development servers

```bash
# Start all services (API + web + docs)
pnpm dev
```

This command automatically:

- ✅ **Cleans ports** (kills any zombie processes on 3003, 5173, 5174)
- ✅ Starts the API server (port 3003)
- ✅ Starts the web frontend (port 5174)
- ✅ Starts the documentation (port 5173)

**Services will be available at:**

- **API:** http://localhost:3003
- **Web UI:** http://localhost:5174
- **Docs:** http://localhost:5173/docs/

> **First launch?** The web page may show white initially. Press **Ctrl+Shift+R** (hard refresh) to clear the cache.

### Alternative: Start services individually

If you prefer to run services separately or troubleshoot issues:

```bash
# Terminal 1: Start API only (with port cleanup)
pnpm run --filter @ontology-search/api dev:clean

# Terminal 2: Start web frontend only (with port cleanup)
pnpm run --filter @ontology-search/web dev:clean

# Terminal 3 (optional): Start docs
pnpm run --filter @ontology-search/docs dev
```

**Manual port cleanup** if ports are still blocked:

```bash
pnpm run clean:ports                    # Clean default ports
node scripts/clean-ports.mjs 3003 5174  # Clean specific ports
```

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
    │  Prompt Builder    │◄── Auto-generated from raw OWL + SHACL shapes
    └─────────┬─────────┘
              │
    ┌─────────▼─────────┐
    │  LLM Agent         │◄── Configurable provider (OpenAI, Ollama, Anthropic, Claude CLI, Copilot)
    │  NL → SearchSlots  │    Fills structured slots, never writes SPARQL
    └─────────┬─────────┘
              │
    ┌─────────▼─────────┐
    │  Slot Validator    │◄── Fuzzy matching, domain correction, confidence
    └─────────┬─────────┘
              │
    ┌─────────▼─────────┐
    │  SPARQL Compiler   │◄── Graph-driven via schema-queries.ts
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

Schema metadata is discovered from the ontology graph at runtime. `packages/search/src/schema-queries.ts` replaces hardcoded domain metadata by deriving asset domains, cross-domain references, property shape groups, and `CompilerVocab` entries directly from SHACL.

The default sample dataset loads **267 assets** across **5 domains**: **117 HD maps**, **50 scenarios**, **50 OSI traces**, **30 environment models**, and **20 surface models**. The ontology registry currently exposes **22 domains** overall.

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
├── search/     # Schema loader, schema queries, compiler, service
├── llm/        # Prompt builder, slot validator, LLM agents
└── testing/    # Shared test helpers and fixtures
```

## Development

```bash
pnpm dev              # Start all dev servers (API + web + docs)
pnpm run validate     # Full quality gate (typecheck + lint + format + test)
pnpm test             # Unit tests (Vitest)
pnpm run test:e2e     # E2E tests (Playwright)
```

### Troubleshooting

**White page in browser?**

- Press **Ctrl+Shift+R** (hard refresh) to clear cache
- Check browser console (F12) for errors
- Verify API is running: `curl http://localhost:3003/health`

**API not starting?**

- Check `.env.local` exists in project root
- For Ollama: ensure `ollama pull qwen2.5-coder:7b` completed
- For OpenAI: verify `OPENAI_API_KEY` is set
- For Anthropic: verify `ANTHROPIC_API_KEY` is set
- For Claude CLI: run `claude` once to authenticate (token written to `~/.claude/.credentials.json`)
- Check logs for port conflicts (3003, 5174, 5173)

**Search returns no results?**

- Verify SPARQL store loaded: `curl http://localhost:3003/stats` (should show 267 assets across 5 domains)
- Check ontology submodules: `git submodule update --init --recursive`

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

## Configuration

| Variable            | Description                                                                       | Default                            |
| ------------------- | --------------------------------------------------------------------------------- | ---------------------------------- |
| `SPARQL_MODE`       | `memory` (Oxigraph WASM) or `remote` (Fuseki)                                     | `memory`                           |
| `SPARQL_ENDPOINT`   | Remote SPARQL endpoint URL                                                        | —                                  |
| `AI_PROVIDER`       | LLM provider: `openai`, `ollama`, `anthropic`, `claude-cli`, `copilot`            | `ollama`                           |
| `AI_MODEL`          | Model identifier (see `.env.example` for per-provider model lists)                | `qwen2.5-coder:7b`                 |
| `OPENAI_API_KEY`    | OpenAI API key (when `AI_PROVIDER=openai`)                                        | —                                  |
| `ANTHROPIC_API_KEY` | Anthropic API key (when `AI_PROVIDER=anthropic`; `claude-cli` uses OAuth instead) | —                                  |
| `OLLAMA_BASE_URL`   | Ollama server URL                                                                 | `http://localhost:11434/v1`        |
| `ONTOLOGY_REPO`     | GitHub repo for ontologies (fallback)                                             | `ASCS-eV/ontology-management-base` |
| `ONTOLOGY_BRANCH`   | Branch to fetch ontologies from (fallback)                                        | `main`                             |

## License

See [LICENSE](./LICENSE).
