# Contributing

Thank you for contributing to `ontology-based-nl-search`! This guide covers our quality standards, development workflow, and conventions.

## Development Setup

```bash
# Install dependencies
npm install --legacy-peer-deps

# Start development server
npm run dev

# Run full validation (typecheck + lint + format + tests)
npm run validate
```

## Quality Standards

### Code Style

- **TypeScript strict mode** — no `any` unless explicitly justified
- **Prettier** for formatting (auto-applied on commit via Husky)
- **ESLint** with Next.js + Prettier config
- **Conventional Commits** for all commit messages

### Testing Requirements

| Type        | Tool       | Coverage Target    | When     |
| ----------- | ---------- | ------------------ | -------- |
| Unit        | Jest       | 70% branches/lines | Every PR |
| Integration | Jest       | Key flows          | Every PR |
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

## Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── api/search/         # API routes
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home page
├── components/             # React UI components
│   ├── SearchBar.tsx
│   ├── ResultsDisplay.tsx
│   └── SparqlPreview.tsx
├── lib/                    # Core business logic
│   ├── sparql/             # SPARQL store abstraction
│   │   ├── types.ts        # Interfaces
│   │   ├── oxigraph-store.ts  # In-memory (dev)
│   │   ├── remote-store.ts    # Remote endpoint (prod)
│   │   └── index.ts        # Factory
│   ├── llm/                # LLM integration
│   │   ├── provider.ts     # AI provider config
│   │   ├── sparql-utils.ts # SPARQL extraction utils
│   │   └── index.ts        # NL-to-SPARQL generation
│   ├── ontology/           # Ontology fetch/cache
│   │   └── index.ts
│   └── data/               # Sample/test data
│       └── loader.ts
e2e/                        # Playwright E2E tests
.github/workflows/          # CI/CD
```

## Available Scripts

| Script                  | Description                      |
| ----------------------- | -------------------------------- |
| `npm run dev`           | Start dev server                 |
| `npm run build`         | Production build                 |
| `npm run lint`          | Run ESLint                       |
| `npm run lint:fix`      | Auto-fix lint issues             |
| `npm run format`        | Format all files                 |
| `npm run format:check`  | Check formatting                 |
| `npm run typecheck`     | TypeScript type checking         |
| `npm run test`          | Run unit tests                   |
| `npm run test:coverage` | Tests with coverage report       |
| `npm run test:e2e`      | Run E2E tests                    |
| `npm run validate`      | Full quality gate (CI runs this) |

## Pull Request Checklist

- [ ] `npm run validate` passes locally
- [ ] New code has tests (unit and/or E2E as appropriate)
- [ ] Commit messages follow Conventional Commits
- [ ] No `console.log` statements (use `console.warn`/`console.error` if needed)
- [ ] No hardcoded secrets or API keys
- [ ] Documentation updated if behavior changed

## Environment Configuration

Copy `.env.example` to `.env.local` and configure:

- `SPARQL_MODE`: `memory` (dev) or `remote` (production)
- `AI_PROVIDER`: `openai`, `ollama`
- `AI_MODEL`: Model identifier (e.g., `gpt-4o`, `llama3`)
- `OPENAI_API_KEY`: Your API key (for OpenAI provider)
