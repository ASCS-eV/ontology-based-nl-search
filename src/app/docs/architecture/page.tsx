'use client'

import { useRouter } from 'next/navigation'

import { Mermaid } from '@/components/Mermaid'
import { Slide, SlideControls, SlideDeck, SlideProvider } from '@/components/slides'

const TOTAL_SLIDES = 5

export default function ArchitecturePresentation() {
  const router = useRouter()

  return (
    <SlideProvider totalSlides={TOTAL_SLIDES} onComplete={() => router.push('/docs/flow')}>
      <SlideDeck>
        <Slide index={0} variant="title">
          <h1 className="text-4xl font-bold text-gray-900">System Architecture</h1>
          <p className="mt-4 text-lg text-gray-500">
            How natural language becomes structured SPARQL queries
          </p>
        </Slide>

        <Slide index={1}>
          <h2 className="text-3xl font-bold text-gray-900">Pipeline Overview</h2>
          <div className="mt-6">
            <Mermaid
              chart={`graph TD
    subgraph "Search Service"
      Q["User Query"] --> INIT["Store Init"]
      INIT --> LLM["LLM Agent<br/>(generateStructuredSearch)"]
      LLM --> EXEC["executeSparql()"]
      EXEC --> RES["Results + Meta"]
    end
    subgraph "Refine Path"
      S["Edited Slots"] --> COMP["compileSlots()"]
      COMP --> EXEC2["executeSparql()"]
      EXEC2 --> RES2["Results"]
    end
    style Q fill:#f0f9ff,stroke:#3b82f6
    style LLM fill:#848ab7,stroke:#5a6f9f,color:#fff
    style EXEC fill:#dcfce7,stroke:#22c55e
    style EXEC2 fill:#dcfce7,stroke:#22c55e`}
            />
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Two paths converge on a shared execution layer. The service module owns all
            orchestration — routes are thin HTTP adapters.
          </p>
        </Slide>

        <Slide index={2}>
          <h2 className="text-3xl font-bold text-gray-900">Module Boundaries</h2>
          <div className="mt-6 space-y-3 text-sm">
            {[
              {
                module: 'src/lib/search/service.ts',
                role: 'Orchestration — single entry point for all search operations',
              },
              {
                module: 'src/lib/llm/',
                role: 'LLM agent — translates NL to structured slots via tool calling',
              },
              {
                module: 'src/lib/search/compiler.ts',
                role: 'Deterministic SPARQL compilation from slots + ontology registry',
              },
              {
                module: 'src/lib/sparql/policy.ts',
                role: 'Security — validates queries before execution (SELECT-only, no federation)',
              },
              {
                module: 'src/lib/sparql/',
                role: 'Store abstraction — Oxigraph (WASM) or remote SPARQL endpoint',
              },
              {
                module: 'src/lib/ontology/',
                role: 'Vocabulary indexing, concept matching, domain registry',
              },
              { module: 'src/lib/config/', role: 'Centralized Zod-validated configuration' },
            ].map((item) => (
              <div
                key={item.module}
                className="flex items-start gap-3 rounded border border-gray-100 p-3"
              >
                <code className="flex-shrink-0 rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-700">
                  {item.module}
                </code>
                <span className="text-gray-600">{item.role}</span>
              </div>
            ))}
          </div>
        </Slide>

        <Slide index={3}>
          <h2 className="text-3xl font-bold text-gray-900">Data Flow</h2>
          <div className="mt-6">
            <Mermaid
              chart={`sequenceDiagram
    participant U as User
    participant R as Route (SSE)
    participant S as SearchService
    participant L as LLM Agent
    participant C as Compiler
    participant P as Policy
    participant DB as SPARQL Store

    U->>R: POST /api/search/stream
    R->>S: searchNl(query)
    S->>L: generateStructuredSearch()
    L-->>S: { interpretation, gaps, sparql }
    S->>P: enforceSparqlPolicy(sparql)
    P-->>S: { allowed, query }
    S->>DB: store.query(sparql)
    DB-->>S: bindings[]
    S-->>R: SearchResult
    R-->>U: SSE events (interpretation, gaps, results, meta)`}
            />
          </div>
        </Slide>

        <Slide index={4}>
          <h2 className="text-3xl font-bold text-gray-900">Security Model</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-lg border-l-4 border-green-500 bg-green-50 p-4">
              <h3 className="font-semibold text-green-900">LLM Never Writes SPARQL</h3>
              <p className="mt-1 text-sm text-green-700">
                The agent fills structured slots. The compiler generates SPARQL deterministically.
                No prompt injection can produce arbitrary queries.
              </p>
            </div>
            <div className="rounded-lg border-l-4 border-yellow-500 bg-yellow-50 p-4">
              <h3 className="font-semibold text-yellow-900">Policy Enforcement</h3>
              <p className="mt-1 text-sm text-yellow-700">
                Every query is parsed and validated: SELECT-only, no SERVICE federation, prefix
                allowlist, automatic LIMIT capping at 500.
              </p>
            </div>
            <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50 p-4">
              <h3 className="font-semibold text-blue-900">Zod Validation</h3>
              <p className="mt-1 text-sm text-blue-700">
                All API inputs validated with Zod schemas. Configuration validated at startup. No
                untyped data flows through the system.
              </p>
            </div>
          </div>
        </Slide>
      </SlideDeck>

      <SlideControls />
    </SlideProvider>
  )
}
