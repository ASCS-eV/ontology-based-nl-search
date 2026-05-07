# Architecture

## System Overview

The Ontology-Based NL Search system converts natural language queries into precise SPARQL queries grounded in domain ontologies.

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  User Query │────▶│  LLM Agent  │────▶│ Slot Compiler│────▶│ SPARQL Store│
│  (Natural   │     │  (Concept   │     │ (Deterministic│    │  (Oxigraph) │
│   Language) │     │   Matching) │     │    Query Gen) │    │             │
└─────────────┘     └─────────────┘     └──────────────┘     └─────────────┘
```

## Package Structure

| Package                     | Responsibility                                  |
| --------------------------- | ----------------------------------------------- |
| `@ontology-search/core`     | Config, logging, error utilities                |
| `@ontology-search/sparql`   | SPARQL store, caching, policies                 |
| `@ontology-search/ontology` | SKOS loading, concept matching, domain registry |
| `@ontology-search/search`   | Search service orchestration, slot compiler     |
| `@ontology-search/llm`      | LLM agent, provider, tool definitions           |
| `@ontology-search/api`      | Hono HTTP server                                |
| `@ontology-search/web`      | Vite + React frontend                           |

## Data Flow

1. **User** enters a natural language query
2. **LLM Agent** interprets the query using ontology context
3. **Concept Matcher** maps terms to SKOS vocabulary entries
4. **Slot Compiler** generates deterministic SPARQL from structured slots
5. **SPARQL Store** executes against loaded RDF data
6. **Results** are streamed progressively back to the UI via SSE

## Key Design Principles

- **Framework-agnostic libraries** — all business logic is independent of HTTP framework
- **Deterministic compilation** — LLM fills slots, compiler generates verified SPARQL
- **Progressive streaming** — UI updates in real-time as each phase completes
- **Multi-domain** — pluggable domain registry supports any RDF-described asset type
