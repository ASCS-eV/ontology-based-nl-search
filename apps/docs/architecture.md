# System Architecture

## Pipeline Overview

The system converts natural language queries into precise SPARQL queries grounded in OWL + SHACL domain ontologies. The pipeline is designed around one core principle: **the LLM fills structured slots — it never writes SPARQL**. Compiler metadata is derived from the schema graph via `schema-queries.ts`, which builds a `CompilerVocab` with property/domain mappings, shape groups, and Range2D properties.

A second pipeline runs alongside the compiler: at warmup, `reference-index.ts` discovers every cross-asset reference signature `(sourceClass, predicatePath, targetClass)` by BFS over typed instances; `metadata-index.ts` snapshots the per-asset shape-group facets and computes per-domain aggregates. Together they back the WP3 traceability layer — per-row predicate-chain breadcrumbs, the multi-hop `/traceability` lineage endpoint, and the `/metadata/{asset,aggregate}` facet endpoints.

```mermaid
graph TD
    Q["🗣️ User Query<br/>(any language)"] --> PB["Prompt Builder"]
    PB --> LLM["LLM Agent<br/>(6 tools)"]
    LLM -.->|"investigate"| SG
    LLM --> SV["Slot Validator"]
    SV --> SC["SPARQL Compiler"]
    SC --> OX["Oxigraph Store"]
    OX --> RES["📊 Results + Meta"]

    subgraph "Schema Layer"
      SG["Schema Graph<br/>‹urn:graph:schema›"] --> SQ["Schema Queries + Vocab"]
      SQ --> PB
      SQ --> SV
      SQ --> SC
    end

    style Q fill:#f0f9ff,stroke:#3b82f6
    style LLM fill:#848ab7,stroke:#5a6f9f,color:#fff
    style SV fill:#fef3c7,stroke:#f59e0b
    style SC fill:#dcfce7,stroke:#22c55e
    style OX fill:#dbeafe,stroke:#3b82f6
    style SG fill:#dbeafe,stroke:#3b82f6
```

## Module Boundaries

The application is a **pnpm monorepo** with Turborepo orchestration. Each package has a single responsibility and clear dependency direction.

```mermaid
graph LR
    subgraph "Apps"
      API["api<br/>(Hono)"]
      WEB["web<br/>(Vite + React)"]
      DOCS["docs<br/>(VitePress)"]
    end

    subgraph "Packages"
      LLM["llm<br/>(Agent + Validator)"]
      SEARCH["search<br/>(Schema Queries + Compiler)"]
      SPARQL["sparql<br/>(Oxigraph Store)"]
      ONT["ontology<br/>(Sources + Warmup)"]
      CORE["core<br/>(Config + Logging)"]
    end

    API --> LLM
    API --> SEARCH
    LLM --> SEARCH
    SEARCH --> SPARQL
    SEARCH --> ONT
    ONT --> SPARQL
    SPARQL --> CORE
    LLM --> CORE
    SEARCH --> CORE

    style API fill:#dbeafe,stroke:#3b82f6
    style WEB fill:#dbeafe,stroke:#3b82f6
    style LLM fill:#848ab7,stroke:#5a6f9f,color:#fff
    style SEARCH fill:#dcfce7,stroke:#22c55e
    style CORE fill:#f3f4f6,stroke:#d1d5db
```

### Package Responsibilities

| Package                     | Module                         | Role                                                                                                          |
| --------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `@ontology-search/core`     | `config/`                      | Zod-validated env config                                                                                      |
|                             | `logging/`                     | Structured JSON logger with correlation IDs                                                                   |
|                             | `errors/`                      | Shared error types and base classes                                                                           |
| `@ontology-search/sparql`   | `oxigraph-store.ts`            | Oxigraph WASM wrapper, SPARQL execution                                                                       |
|                             | `remote-store.ts`              | HTTP client for any SPARQL 1.1 endpoint                                                                       |
|                             | `cached-store.ts`              | LRU query cache decorator (wraps either store)                                                                |
|                             | `cache.ts`                     | LRU cache implementation                                                                                      |
|                             | `policy.ts`                    | Query validation policies                                                                                     |
| `@ontology-search/ontology` | `warmup.ts`                    | Loads instance TTL data at startup                                                                            |
|                             | `paths.ts`                     | Resolves project root and ontology file paths                                                                 |
|                             | `domain-registry.ts`           | Domain lookups and registration                                                                               |
|                             | `vocabulary-index.ts`          | Vocabulary indexing for property → domain mapping                                                             |
| `@ontology-search/search`   | `schema-loader.ts`             | Loads 45 OWL+SHACL files into `<urn:graph:schema>`                                                            |
|                             | `schema-queries.ts`            | Graph-driven SPARQL helpers for domains, references, and shape groups                                         |
|                             | `property-paths.ts`            | Discovers predicate chains from SHACL (ontology-agnostic)                                                     |
|                             | `vocabulary-extractor.ts`      | SPARQL-based extraction of `sh:in` enums + numeric props                                                      |
|                             | `reference-index.ts`           | WP3: BFS-discovered `(source, predicate, target)` reference signatures                                        |
|                             | `metadata-index.ts`            | WP3: per-asset facet snapshot + per-domain aggregate distribution                                             |
|                             | `compiler.ts`                  | `compileSlots` + `compileSlotsWithTrace` (the trace variant binds intermediate JOIN vars for per-row lineage) |
|                             | `sparql-validator.ts`          | Post-compilation SPARQL syntax validation                                                                     |
|                             | `service.ts`                   | Orchestrates init → interpret → compile → execute                                                             |
|                             | `factory.ts`                   | Service factory and dependency wiring                                                                         |
|                             | `slots.ts`                     | SearchSlots type definitions (flattened — no `location`/`license` slots; new `references` slot)               |
|                             | `data-loader.ts`               | Loads sample TTL + JSON-LD files for dev/test                                                                 |
|                             | `init.ts`                      | Initialization sequence                                                                                       |
| `@ontology-search/llm`      | `prompt-builder.ts`            | Auto-generates LLM system prompt from raw SHACL                                                               |
|                             | `slot-validator.ts`            | Post-LLM validation: tokenised fuzzy match, multi-domain correction, gap enrichment                           |
|                             | `agent/copilot-agent.ts`       | Copilot SDK agent path + investigation tools                                                                  |
|                             | `agent/index.ts`               | Vercel AI SDK agent path (5 providers; `toolChoice` forces `submit_slots`)                                    |
|                             | `agent/submission-router.ts`   | Dispatches the LLM submission to the appropriate post-processing pipeline                                     |
|                             | `agent/run-slot-pipeline.ts`   | Validates slots, enriches gaps, and emits honest dropped-reference gaps                                       |
|                             | `agent/tools.ts`               | `submit_slots` tool definition                                                                                |
|                             | `agent/investigation-tools.ts` | 5 schema discovery tools (kept available; rarely used now)                                                    |
| `@ontology-search/api`      | `routes/search.ts`             | Hono SSE streaming endpoint (search + refine)                                                                 |
|                             | `routes/traceability.ts`       | WP3: `GET /traceability?asset=<iri>&depth=N` — multi-hop lineage walk                                         |
|                             | `routes/metadata.ts`           | WP3: `GET /metadata/asset` (per-asset facets) and `/metadata/aggregate` (per-domain stats)                    |
|                             | `routes/stats.ts`              | Statistics endpoint                                                                                           |
|                             | `warmup.ts`                    | Startup orchestration (load ontology, init store, warm reference + metadata indices)                          |
| `@ontology-search/testing`  | `helpers/`                     | Shared test utilities (mock logger, fixtures)                                                                 |

### Dependency Rules

Packages follow a strict layered dependency direction — no circular dependencies allowed:

```mermaid
graph BT
    CORE["core<br/>(zero deps)"]
    SPARQL["sparql"] --> CORE
    ONT["ontology"] --> CORE
    SEARCH["search"] --> CORE
    SEARCH --> SPARQL
    SEARCH --> ONT
    LLM["llm"] --> CORE
    LLM --> ONT
    LLM --> SEARCH

    style CORE fill:#f3f4f6,stroke:#d1d5db
    style SPARQL fill:#dbeafe,stroke:#3b82f6
    style ONT fill:#dcfce7,stroke:#22c55e
    style SEARCH fill:#dcfce7,stroke:#22c55e
    style LLM fill:#848ab7,stroke:#5a6f9f,color:#fff
```

- **`core`** has zero workspace dependencies — it is the shared foundation
- **`sparql`** and **`ontology`** depend only on `core`
- **`search`** depends on `core`, `sparql`, and `ontology`
- **`llm`** depends on `core`, `ontology`, and `search`
- **Apps** (`api`, `web`) compose packages — packages never depend on apps
- **`testing`** provides shared test utilities — not used in production code

## Ontology-Agnostic Design

The system is designed to work with **any set of OWL + SHACL ontologies** — no hardcoded domain names, predicates, or class IRIs exist in production code. All structure is discovered at runtime from the schema graph.

### Graph-Driven Discovery

| Component               | What It Discovers                  | Source                               |
| ----------------------- | ---------------------------------- | ------------------------------------ |
| **Domain Registry**     | Asset types (hdmap, scenario, ...) | `rdfs:subClassOf` + `sh:targetClass` |
| **Property Paths**      | Predicate chains (asset → leaf)    | `sh:property` / `sh:node` traversal  |
| **Schema Queries**      | Shape groups, cross-domain refs    | SPARQL against `<urn:graph:schema>`  |
| **Investigation Tools** | Anything — LLM explores at runtime | Ad-hoc SPARQL SELECT                 |

### RDF Reasoning Capability

The LLM has **5 investigation tools** that query the schema graph using SPARQL. This enables runtime ontology exploration beyond the static prompt — the LLM can verify concepts, discover relationships, and explore property hierarchies before filling slots.

See: [Generic Design](/generic-design) for the full architecture of the ontology-agnostic approach, property path discovery, and RDF reasoning capabilities.

## Data Flow (Swim Lane)

### Request Phase

```mermaid
sequenceDiagram
    participant U as User
    participant R as API (SSE)
    participant S as SearchService
    participant PB as Prompt Builder
    participant L as LLM Agent

    U->>R: POST /api/search/stream
    R->>S: searchNl(query)
    R-->>U: event: status (interpreting)

    S->>PB: buildSystemPrompt(vocabulary)
    PB-->>S: system prompt (auto-generated)
    S->>L: generateStructuredSearch(query, prompt)
    L->>L: LLM calls submit_slots tool
    L-->>S: { interpretation, gaps, slots }
```

### Execution Phase

```mermaid
sequenceDiagram
    participant U as User
    participant R as API (SSE)
    participant S as SearchService
    participant V as Slot Validator
    participant C as Compiler
    participant DB as Oxigraph

    S->>V: correctFilters(filters, vocabulary)
    V-->>S: corrected filters
    S->>V: correctDomains(domains, filters, ranges, vocabulary)
    V-->>S: corrected domains
    R-->>U: event: interpretation

    S->>C: compileSlots(validatedSlots)
    C-->>S: SPARQL query
    R-->>U: event: sparql

    S->>DB: store.query(sparql)
    DB-->>S: bindings[]
    R-->>U: event: results

    S->>V: validateSlots(response, vocabulary)
    V-->>S: validated response (recomputed confidence)
    R-->>U: event: gaps + meta + done
```

## Security Model

The system is designed with defense-in-depth — no single layer failure can produce arbitrary queries:

::: info LLM Never Writes SPARQL
The agent fills structured slots via a single tool (`submit_slots`). The compiler generates SPARQL deterministically. No prompt injection can produce arbitrary queries.
:::

::: warning Slot Validation
Every filter value is validated against `sh:in` vocabulary from the ontology. Unknown values are rejected or fuzzy-matched to the nearest valid term. Domain mismatches are corrected automatically.
:::

::: tip Zod Validation
All API inputs are validated with Zod schemas. Configuration is validated at startup. No untyped data flows through the system.
:::
