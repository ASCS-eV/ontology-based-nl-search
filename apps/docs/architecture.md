# System Architecture

## Pipeline Overview

The system converts natural language queries into precise SPARQL queries grounded in OWL + SHACL domain ontologies. The pipeline is designed around one core principle: **the LLM fills structured slots — it never writes SPARQL**.

```mermaid
graph TD
    Q["🗣️ User Query<br/>(any language)"] --> PB["Prompt Builder"]
    PB --> LLM["LLM Agent<br/>(submit_slots tool)"]
    LLM --> SV["Slot Validator"]
    SV --> SC["SPARQL Compiler"]
    SC --> OX["Oxigraph Store"]
    OX --> RES["📊 Results + Meta"]

    subgraph "Ontology Layer"
      OWL["OWL + SHACL<br/>(45 files, 22 domains)"] --> VE["Vocabulary Extractor"]
      VE --> PB
      VE --> SV
    end

    style Q fill:#f0f9ff,stroke:#3b82f6
    style LLM fill:#848ab7,stroke:#5a6f9f,color:#fff
    style SV fill:#fef3c7,stroke:#f59e0b
    style SC fill:#dcfce7,stroke:#22c55e
    style OX fill:#dbeafe,stroke:#3b82f6
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
      SEARCH["search<br/>(Compiler + Vocab)"]
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

| Package                     | Module                    | Role                                                      |
| --------------------------- | ------------------------- | --------------------------------------------------------- |
| `@ontology-search/core`     | `config/`                 | Zod-validated env config                                  |
|                             | `logging/`                | Structured JSON logger with correlation IDs               |
| `@ontology-search/sparql`   | `store.ts`                | Oxigraph WASM wrapper, SPARQL execution                   |
| `@ontology-search/ontology` | `warmup.ts`               | Loads instance TTL data at startup                        |
|                             | `sources.ts`              | Resolves ontology file paths from `ontology-sources.json` |
| `@ontology-search/search`   | `schema-loader.ts`        | Loads 45 OWL+SHACL files into `<urn:graph:schema>`        |
|                             | `vocabulary-extractor.ts` | SPARQL-based extraction of `sh:in` enums + numeric props  |
|                             | `compiler.ts`             | SearchSlots → deterministic SPARQL                        |
|                             | `service.ts`              | Orchestrates init → interpret → compile → execute         |
| `@ontology-search/llm`      | `prompt-builder.ts`       | Auto-generates LLM system prompt from vocabulary          |
|                             | `slot-validator.ts`       | Post-LLM validation: fuzzy match, domain correction       |
|                             | `agent/copilot-agent.ts`  | Copilot SDK agent path                                    |
|                             | `agent/index.ts`          | Vercel AI SDK agent path (OpenAI/Ollama)                  |
| `@ontology-search/api`      | `routes/search.ts`        | Hono SSE streaming endpoint                               |

## Data Flow (Swim Lane)

```mermaid
sequenceDiagram
    participant U as User
    participant R as Hono Route (SSE)
    participant S as SearchService
    participant PB as Prompt Builder
    participant L as LLM Agent
    participant V as Slot Validator
    participant C as Compiler
    participant DB as Oxigraph

    U->>R: POST /api/search/stream
    R->>S: searchNl(query)
    R-->>U: event: status (interpreting)

    S->>PB: buildSystemPrompt(vocabulary)
    PB-->>S: system prompt (auto-generated)
    S->>L: generateStructuredSearch(query, prompt)
    L->>L: LLM calls submit_slots tool
    L-->>S: { interpretation, gaps, slots }

    S->>V: correctFilters(filters, vocabulary)
    V-->>S: corrected filters
    S->>V: correctDomains(domains, filters, vocabulary)
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
