'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Mermaid } from '@/components/Mermaid'
import { Slide, SlideControls, SlideDeck, SlideProvider } from '@/components/slides'

const TOTAL_SLIDES = 8

export default function DocsPresentation() {
  const router = useRouter()

  return (
    <SlideProvider totalSlides={TOTAL_SLIDES} onComplete={() => router.push('/')}>
      <SlideDeck>
        {/* Slide 0: Title */}
        <Slide index={0} variant="title">
          <div className="space-y-6">
            <div className="inline-block rounded-full bg-blue-100 px-4 py-1 text-sm font-medium text-blue-800">
              Proof of Concept
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Ontology-Based
              <br />
              <span className="text-blue-600">Natural Language Search</span>
            </h1>
            <p className="mx-auto max-w-2xl text-xl text-gray-500">
              Bridging the gap between natural language and structured simulation asset metadata in
              the ENVITED-X Data Space.
            </p>
            <p className="text-sm text-gray-400">Press → or click to navigate · Space to advance</p>
          </div>
        </Slide>

        {/* Slide 1: The Problem */}
        <Slide index={1}>
          <h2 className="text-3xl font-bold text-gray-900">The Problem</h2>
          <div className="mt-8 space-y-4 text-lg text-gray-600">
            <p>
              The ENVITED-X Data Space contains simulation assets described with rich,
              ontology-based metadata — road types, lane configurations, geographic locations,
              quality measures, formats, and more.
            </p>
            <p>
              But this metadata is only useful if users can <strong>query it effectively</strong>.
            </p>
            <div className="mt-6 rounded-lg border-l-4 border-orange-400 bg-orange-50 p-4">
              <p className="font-medium text-orange-800">
                Users don&apos;t know SPARQL. They don&apos;t know the ontology schema. They just
                want to find the right data.
              </p>
            </div>
          </div>
        </Slide>

        {/* Slide 2: The Solution */}
        <Slide index={2}>
          <h2 className="text-3xl font-bold text-gray-900">The Solution</h2>
          <p className="mt-4 text-lg text-gray-600">
            An AI agent that translates natural language into precise, ontology-compliant SPARQL
            queries — with full transparency about what it understood and what it couldn&apos;t.
          </p>
          <div className="mt-8">
            <Mermaid
              chart={`graph LR
    A["🗣️ User Query"] --> B["🤖 AI Agent"]
    B --> C["🧠 Ontology Matching"]
    C --> D["📝 SPARQL Compilation"]
    D --> E["🔍 Knowledge Graph"]
    E --> F["📊 Results"]
    style A fill:#f0f9ff,stroke:#798bb3
    style B fill:#848ab7,stroke:#5a6f9f,color:#fff
    style C fill:#f0fdf4,stroke:#22c55e
    style F fill:#f0fdf4,stroke:#22c55e`}
            />
          </div>
        </Slide>

        {/* Slide 3: Architecture */}
        <Slide index={3}>
          <h2 className="text-3xl font-bold text-gray-900">Architecture</h2>
          <p className="mt-4 text-gray-600">
            A deterministic pipeline that combines LLM flexibility with ontology precision:
          </p>
          <div className="mt-6">
            <Mermaid
              chart={`graph TD
    Q["Natural Language Query"] --> M["Concept Matcher<br/>(SKOS vocabulary)"]
    M --> A["LLM Agent<br/>(Slot Filling)"]
    A --> C["SPARQL Compiler<br/>(Deterministic)"]
    C --> P["Policy Enforcement<br/>(Security)"]
    P --> X["SPARQL Execution"]
    X --> R["Structured Results"]
    style M fill:#dbeafe,stroke:#3b82f6
    style A fill:#848ab7,stroke:#5a6f9f,color:#fff
    style C fill:#dcfce7,stroke:#22c55e
    style P fill:#fef3c7,stroke:#f59e0b`}
            />
          </div>
          <p className="mt-4 text-sm text-gray-500">
            The LLM never writes SPARQL directly — it fills structured slots that are compiled
            deterministically. This ensures correctness and security.
          </p>
        </Slide>

        {/* Slide 4: Key Design Principles */}
        <Slide index={4}>
          <h2 className="text-3xl font-bold text-gray-900">Design Principles</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              {
                title: 'Ontology-First',
                desc: 'SKOS vocabularies define what can be queried. The LLM is guided, not free-form.',
              },
              {
                title: 'Deterministic Compilation',
                desc: 'Slots → SPARQL is a pure function. Same input always produces the same query.',
              },
              {
                title: 'Transparent Gaps',
                desc: "When a concept isn't in the ontology, we tell the user — with suggestions.",
              },
              {
                title: 'Security by Design',
                desc: 'Policy enforcement validates every query before execution. No injection possible.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </Slide>

        {/* Slide 5: Ontology Model */}
        <Slide index={5}>
          <h2 className="text-3xl font-bold text-gray-900">Ontology Model</h2>
          <p className="mt-4 text-gray-600">
            Built on the ENVITED-X ontology ecosystem — a set of domain-specific SHACL shapes and
            SKOS vocabularies for simulation assets.
          </p>
          <div className="mt-6">
            <Mermaid
              chart={`graph TD
    EX["ENVITED-X Core"] --> HD["HD Map Domain"]
    EX --> SC["Scenario Domain"]
    EX --> EM["Environment Model"]
    EX --> SS["Simulated Sensor"]
    HD --> SKOS["SKOS Vocabularies<br/>(road types, formats, ...)"]
    HD --> SHACL["SHACL Shapes<br/>(validation rules)"]
    style EX fill:#f0f9ff,stroke:#3b82f6
    style SKOS fill:#dcfce7,stroke:#22c55e
    style SHACL fill:#fef3c7,stroke:#f59e0b`}
            />
          </div>
          <p className="mt-4 text-sm text-gray-500">
            13 asset domains · 200+ vocabulary terms · Multi-domain query support
          </p>
        </Slide>

        {/* Slide 6: Technology Stack */}
        <Slide index={6}>
          <h2 className="text-3xl font-bold text-gray-900">Technology Stack</h2>
          <div className="mt-8 space-y-3">
            {[
              { label: 'Framework', value: 'Next.js 15 (App Router, SSE streaming)' },
              { label: 'AI', value: 'Vercel AI SDK 5 (OpenAI / Ollama / Copilot)' },
              { label: 'SPARQL', value: 'Oxigraph (WASM, in-process) or remote endpoint' },
              { label: 'Ontology', value: 'ENVITED-X SHACL + SKOS vocabularies' },
              { label: 'Validation', value: 'Zod schemas at all boundaries' },
              { label: 'Testing', value: 'Jest (unit + integration) + Playwright (E2E)' },
              { label: 'Type Safety', value: 'TypeScript 5.9 strict mode' },
            ].map((item) => (
              <div key={item.label} className="flex items-baseline gap-3">
                <span className="w-28 flex-shrink-0 text-sm font-medium text-gray-500">
                  {item.label}
                </span>
                <span className="text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </Slide>

        {/* Slide 7: Try It (CTA → live demo) */}
        <Slide index={7} variant="cta">
          <div className="space-y-8">
            <h2 className="text-4xl font-bold text-gray-900">Try it yourself</h2>
            <p className="text-xl text-gray-500">
              Ask anything about HD maps, scenarios, or simulation assets.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-3 text-lg font-medium text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl"
              >
                Launch Demo
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Link>
              <Link
                href="/docs/architecture"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 text-gray-700 transition-colors hover:bg-gray-50"
              >
                Deep Dive →
              </Link>
            </div>
            <p className="text-sm text-gray-400">
              Example queries: &quot;motorway HD maps in Germany&quot; · &quot;OpenDRIVE format with
              traffic signs&quot; · &quot;long highway maps for ADAS testing&quot;
            </p>
          </div>
        </Slide>
      </SlideDeck>

      <SlideControls />
    </SlideProvider>
  )
}
