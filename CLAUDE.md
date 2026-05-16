# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Natural language search over ENVITED-X simulation asset metadata. Users type queries like "German highways with 3 lanes"; an LLM fills structured `SearchSlots` (never writes SPARQL); a deterministic compiler generates SPARQL from those slots; Oxigraph executes the query. The ontology (OWL + SHACL) is the single source of truth for prompt generation, slot validation, and query compilation.

## Commands

```bash
pnpm install                        # Install all dependencies
pnpm dev                            # Start API (:3003) + web (:5174) + docs (:5173)
pnpm run validate                   # Full quality gate: typecheck + lint + format + tests
pnpm test                           # Unit tests (Vitest, all packages)
pnpm run test:e2e                   # E2E tests (Playwright)
pnpm run check-types                # TypeScript type checking only
pnpm run lint                       # ESLint only
pnpm run format:check               # Prettier check only
pnpm run build                      # Production build (all packages)
```

### Running a single package or test

```bash
pnpm --filter @ontology-search/search test          # Tests for one package
pnpm --filter @ontology-search/api dev:clean         # Dev server for one app
npx vitest run packages/search/src/__tests__/compiler.test.ts  # Single test file
```

### Submodules

Ontology files come from a nested git submodule chain. If ontology data is missing:

```bash
git submodule update --init --recursive
```

## Architecture

**pnpm monorepo** with Turborepo. Strict layered dependencies — no cycles allowed:

```
core (zero deps) <-- sparql, ontology <-- search <-- llm <-- api (app)
                                                              web (app, frontend only)
```

### Key pipeline (search flow)

1. **Schema loading** (startup) — `schema-loader.ts` loads 45 OWL+SHACL files into `<urn:graph:schema>` named graph
2. **Prompt generation** — `prompt-builder.ts` embeds raw SHACL Turtle into the LLM system prompt
3. **LLM interpretation** — Agent calls `submit_slots` tool producing `SearchSlots` (domains, filters, ranges, gaps)
4. **Slot validation** — `slot-validator.ts` fuzzy-matches filter values against `sh:in` vocabulary, corrects domains via property→domain map
5. **SPARQL compilation** — `compiler.ts` generates deterministic SPARQL using `CompilerVocab` from `schema-queries.ts`
6. **Execution** — Oxigraph WASM (dev) or Fuseki (prod) runs the query
7. **SSE streaming** — Results streamed as Server-Sent Events to React UI

### Critical invariant

The LLM never writes SPARQL. It fills `SearchSlots` via a single tool call. The compiler is deterministic — same slots always produce the same query. This is the security model: no prompt injection can produce arbitrary queries.

### Package workspace names

| Directory           | Workspace name              | Role                                            |
| ------------------- | --------------------------- | ----------------------------------------------- |
| `packages/core`     | `@ontology-search/core`     | Config (Zod), logging, errors                   |
| `packages/sparql`   | `@ontology-search/sparql`   | Oxigraph WASM + remote store + LRU cache        |
| `packages/ontology` | `@ontology-search/ontology` | Source resolution, vocabulary indexing          |
| `packages/search`   | `@ontology-search/search`   | Schema queries, compiler, service orchestration |
| `packages/llm`      | `@ontology-search/llm`      | Prompt builder, slot validator, AI agents       |
| `packages/testing`  | `@ontology-search/testing`  | Shared test helpers (not production)            |
| `apps/api`          | `@ontology-search/api`      | Hono SSE API server                             |
| `apps/web`          | `@ontology-search/web`      | Vite + React 19 + TanStack Router frontend      |
| `apps/e2e`          | `@ontology-search/e2e`      | Playwright E2E tests                            |
| `apps/docs`         | `@ontology-search/docs`     | VitePress documentation                         |

## Conventions

- **Commits**: Conventional Commits format, signed (`git commit -s -S`). Enforced by commitlint hook. Never add AI co-author attribution.
- **Pre-commit hook**: runs `lint-staged` (ESLint fix + Prettier on staged files). Does NOT run tests or type-checking — run `pnpm run validate` before pushing.
- **TypeScript**: strict mode, `noUncheckedIndexedAccess` enabled, target ES2022, module NodeNext.
- **Imports**: sorted by `eslint-plugin-simple-import-sort` (auto-fixed on commit).
- **No `console.log`**: use `console.warn`/`console.error`, or the structured logger from `@ontology-search/core`.
- **No `any`**: `@typescript-eslint/no-explicit-any` is a warning.
- **Environment**: Node >= 22. Config via `.env.local` (copied from `.env.example`). Validated by Zod at startup.
- **Schema metadata is graph-driven**: `schema-queries.ts` discovers domains, properties, and shape groups from SHACL at runtime — do not hardcode domain metadata.

## Code Quality Criteria

This repository has 30 reviewable quality criteria (constants, architecture,
code health, concurrency, testing, security, process). They live in
**[`CONTRIBUTING.md` § Code Quality Criteria](./CONTRIBUTING.md#code-quality-criteria)**
and are the canonical contract for any code change.

When generating or modifying code, read those criteria first and uphold them
strictly. Several have grep- or `madge`-based CI gates; the rest are
review-checklist rules.

- **Never introduce a new violation** of a criterion in unrelated code. If
  you spot one and cannot fix it within the current task's scope, surface it
  rather than bundling.
- **Every fix carries a regression test** that would have failed before the
  fix (criterion #30). No test = no fix.

## Working with local scratch

`.playground/` (gitignored) is a per-developer scratch area for transient
working state — audits, refactor plans, exploration notes. The user may
maintain a refactor plan there and ask you to "continue the refactor" or
"pick up the next task." If a `.playground/` directory exists in the working
tree, follow its conventions (typically: one task per file, lowest-numbered
unblocked task next, one task per branch/PR, do not auto-chain). The plan is
intentionally not tracked: it shrinks as tasks land in main, and only the
resulting code change is part of repo history.
