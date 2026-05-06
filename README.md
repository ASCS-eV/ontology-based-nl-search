# ontology-based-nl-search

Natural language search interface for ontology-management-base knowledge graphs, built with TypeScript.

A locally running TypeScript web application with a Google-style search bar that allows for natural language search of EVES-003 (https://github.com/ASCS-eV/EVES/) Simulation Assets zip files according to their ENVITED-X:SimulationAsset metadata from the [Ontology Management Base](https://github.com/ASCS-eV/ontology-management-base) repository which are created with the help of the [sl-5-8-asset-tools](https://github.com/openMSL/sl-5-8-asset-tools). The ontologies are used as a language translation reference for a LLM which translates natural language queries (e.g. "show me all German highways with 3 lanes") into SPARQL queries that are validated and executed against a graph containing simulation asset metadata.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 (App Router), React 18, TailwindCSS |
| **LLM Integration** | Vercel AI SDK (OpenAI, Anthropic, Ollama, etc.) |
| **SPARQL Store (dev)** | Oxigraph WASM (in-memory, zero setup) |
| **SPARQL Store (prod)** | Apache Jena Fuseki (remote endpoint) |
| **Ontology Source** | Fetched & cached from ontology-management-base |
| **Testing** | Jest (unit/integration), Playwright (E2E) |
| **Quality** | ESLint, Prettier, Husky, lint-staged, GitHub Actions CI |

## Quick Start

```bash
# Install dependencies
npm install --legacy-peer-deps

# Copy environment config
cp .env.example .env.local

# Start development server (uses in-memory Oxigraph, no external services needed)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start searching.

> **Note:** You need a configured LLM provider (set `OPENAI_API_KEY` in `.env.local`) for the NL-to-SPARQL translation to work. For local development without an API key, you can use Ollama.

## Architecture

```
User Query ("German highways with 3 lanes")
    │
    ▼
┌─────────────────────────────┐
│  Next.js API Route          │
│  POST /api/search           │
└─────────────┬───────────────┘
              │
    ┌─────────▼─────────┐
    │  Ontology Context  │◄── Cached from ontology-management-base
    └─────────┬─────────┘
              │
    ┌─────────▼─────────┐
    │  Vercel AI SDK     │◄── Configurable provider (OpenAI, Ollama, etc.)
    │  NL → SPARQL       │
    └─────────┬─────────┘
              │
    ┌─────────▼─────────┐
    │  SPARQL Store      │◄── Oxigraph WASM (dev) or Fuseki (prod)
    │  Execute Query     │
    └─────────┬─────────┘
              │
              ▼
         JSON Results → UI
```

## Development

```bash
npm run dev           # Start dev server
npm run validate      # Full quality gate (typecheck + lint + format + test)
npm run test          # Unit tests
npm run test:e2e      # E2E tests (Playwright)
npm run test:coverage # Tests with coverage report
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `SPARQL_MODE` | `memory` (Oxigraph WASM) or `remote` (Fuseki) | `memory` |
| `SPARQL_ENDPOINT` | Remote SPARQL endpoint URL | — |
| `AI_PROVIDER` | LLM provider: `openai`, `ollama` | `openai` |
| `AI_MODEL` | Model identifier | `gpt-4o` |
| `OPENAI_API_KEY` | OpenAI API key | — |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` |
| `ONTOLOGY_REPO` | GitHub repo for ontologies | `ASCS-eV/ontology-management-base` |

## License

See [LICENSE](./LICENSE).

