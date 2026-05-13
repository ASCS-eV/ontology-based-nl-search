# Contributing

Thank you for contributing to `ontology-based-nl-search`! This guide covers our quality standards, development workflow, and conventions.

## Development Setup

```bash
# Install dependencies (project uses pnpm workspaces)
pnpm install

# Start development server (API on :3003, web UI on :5174)
pnpm dev

# Run full validation (typecheck + lint + format + tests)
pnpm run validate
```

## Quality Standards

### Code Style

- **TypeScript strict mode** — no `any` unless explicitly justified
- **Prettier** for formatting (auto-applied on commit via Husky)
- **ESLint** with Prettier config
- **Conventional Commits** for all commit messages

### Testing Requirements

| Type        | Tool       | Coverage Target    | When     |
| ----------- | ---------- | ------------------ | -------- |
| Unit        | Vitest     | 70% branches/lines | Every PR |
| Integration | Vitest     | Key flows          | Every PR |
| E2E         | Playwright | Critical paths     | Every PR |

### Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add SPARQL query validation
fix: handle empty results from Oxigraph
docs: update ontology integration guide
test: add E2E tests for search flow
chore: update dependencies
refactor: extract SPARQL parsing utility
ci: add caching to CI workflow
```

Always sign commits: `git commit -s -S`

## Monorepo Architecture

The project is a **pnpm monorepo** with Turborepo orchestration. Each package has a single responsibility and clear dependency direction.

```
apps/
├── api/                    # Hono SSE streaming API server (port 3003)
│   ├── src/
│   │   ├── routes/search.ts    # POST /search/stream, POST /search/refine
│   │   ├── routes/stats.ts     # GET /stats
│   │   ├── middleware/         # Error handler, request ID
│   │   ├── warmup.ts           # Startup initialization
│   │   └── app.ts              # Hono app setup
├── web/                    # Vite + React 19 frontend
│   ├── src/
│   │   ├── routes/             # TanStack Router file-based routes
│   │   ├── components/         # React UI components
│   │   └── main.tsx
├── docs/                   # VitePress documentation site
│   └── *.md                    # Architecture, query flow, ontology, etc.
├── e2e/                    # Playwright E2E tests
│   └── tests/search.spec.ts
packages/
├── core/                   # Shared foundation (zero internal deps)
│   ├── config/                 # Zod-validated environment config
│   ├── logging/                # Structured JSON logger with correlation IDs
│   └── errors/                 # Shared error types
├── sparql/                 # SPARQL store abstraction
│   ├── oxigraph-store.ts       # In-memory Oxigraph WASM (dev)
│   ├── remote-store.ts         # HTTP client for remote endpoints (prod)
│   ├── cached-store.ts         # LRU query cache decorator
│   ├── cache.ts                # LRU cache implementation
│   ├── policy.ts               # Query validation policies
│   └── types.ts                # SparqlStore interface
├── ontology/               # Ontology source management
│   ├── paths.ts                # Project root resolution
│   ├── warmup.ts               # Loads instance TTL data at startup
│   ├── domain-registry.ts      # Domain lookups
│   └── vocabulary-index.ts     # Vocabulary indexing
├── search/                 # Search pipeline core (graph-driven compiler)
│   ├── schema-loader.ts        # Loads OWL+SHACL files into schema graph
│   ├── schema-queries.ts       # SPARQL helpers for asset domains, references, shape groups
│   ├── vocabulary-extractor.ts # SPARQL-based extraction of sh:in enums
│   ├── compiler.ts             # SearchSlots → deterministic SPARQL via CompilerVocab
│   ├── service.ts              # Orchestrates init → interpret → compile → execute
│   ├── factory.ts              # Service factory and dependency wiring
│   ├── slots.ts                # SearchSlots type definitions
│   ├── data-loader.ts          # Loads 5 sample TTL files (267 dev/test assets)
│   ├── init.ts                 # Initialization sequence
│   └── types.ts                # Shared types
├── llm/                    # LLM integration
│   ├── prompt-builder.ts       # Auto-generates LLM system prompt from raw SHACL
│   ├── slot-validator.ts       # Post-LLM validation: fuzzy match, multi-domain set-based correction
│   ├── provider.ts             # AI provider configuration
│   ├── agent/index.ts          # Vercel AI SDK agent (OpenAI/Ollama)
│   ├── agent/copilot-agent.ts  # GitHub Copilot SDK agent
│   └── agent/tools.ts          # submit_slots tool definition
├── testing/                # Shared test helpers and fixtures
│   └── helpers/index.ts        # Mock logger, test utilities
├── eslint-config/          # Shared ESLint configuration
└── typescript-config/      # Shared TypeScript configuration
```

### Dependency Rules

- **`core`** has zero internal workspace dependencies — it is the foundation
- **`sparql`** depends only on `core`
- **`ontology`** depends only on `core`
- **`search`** depends on `core`, `sparql`, and `ontology`
- **`llm`** depends on `core`, `ontology`, and `search`
- **Apps** (`api`, `web`) depend on packages — packages never depend on apps
- **`testing`** provides shared test utilities — not used in production code

## Available Scripts

| Script                  | Description                      |
| ----------------------- | -------------------------------- |
| `pnpm dev`              | Start API + web dev servers      |
| `pnpm run build`        | Production build (all packages)  |
| `pnpm run lint`         | Run ESLint                       |
| `pnpm run format`       | Format all files                 |
| `pnpm run format:check` | Check formatting                 |
| `pnpm run check-types`  | TypeScript type checking         |
| `pnpm test`             | Run unit tests (Vitest)          |
| `pnpm run test:e2e`     | Run E2E tests (Playwright)       |
| `pnpm run validate`     | Full quality gate (CI runs this) |

## Pull Request Checklist

- [ ] `pnpm run validate` passes locally
- [ ] New code has tests (unit and/or E2E as appropriate)
- [ ] Commit messages follow Conventional Commits
- [ ] No `console.log` statements (use `console.warn`/`console.error` if needed)
- [ ] No hardcoded secrets or API keys
- [ ] Documentation updated if behavior changed

## Environment Configuration

Copy `.env.example` to `.env.local` and configure:

- `SPARQL_MODE`: `memory` (dev) or `remote` (production)
- `AI_PROVIDER`: `ollama` (default, free), `openai`, or `copilot`
- `AI_MODEL`: Model identifier (e.g., `qwen2.5-coder:7b`, `gpt-4o`)
- `OPENAI_API_KEY`: Your API key (for OpenAI provider)
- `OLLAMA_BASE_URL`: Ollama server URL (default: `http://localhost:11434/v1`)
