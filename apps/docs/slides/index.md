---
layout: page
title: Presentation
---

<SlideProvider :total-slides="8">
<SlideDeck>

<Slide :index="0" variant="title">
  <div class="badge">Proof of Concept</div>
  <h1>Ontology-Based<br/><span class="accent">Natural Language Search</span></h1>
  <p>Bridging the gap between natural language and structured simulation asset metadata in the ENVITED-X Data Space.</p>
  <p class="subtitle">Press → or Space to navigate · Swipe on mobile</p>
</Slide>

<Slide :index="1">
  <h2>The Problem</h2>
  <p>The ENVITED-X Data Space contains simulation assets described with rich, ontology-based metadata — road types, lane configurations, geographic locations, quality measures, formats, and more.</p>
  <p>But this metadata is only useful if users can <strong>query it effectively</strong>.</p>
  <div class="callout">Users don't know SPARQL. They don't know the ontology schema. They just want to find the right data.</div>
</Slide>

<Slide :index="2">
  <h2>The Solution</h2>
  <p>An AI agent that translates natural language into precise, ontology-compliant SPARQL queries — with full transparency about what it understood and what it couldn't.</p>
  <div class="card-grid">
    <div class="card">
      <div class="card-icon">🗣️</div>
      <h3>Natural Input</h3>
      <p>Plain language queries in any language</p>
    </div>
    <div class="card">
      <div class="card-icon">🧠</div>
      <h3>AI Interpretation</h3>
      <p>Ontology-grounded mapping with validation</p>
    </div>
    <div class="card">
      <div class="card-icon">🎯</div>
      <h3>Precise Results</h3>
      <p>Verified SPARQL execution with confidence scores</p>
    </div>
  </div>
</Slide>

<Slide :index="3">
  <h2>Architecture</h2>
  <p>A deterministic pipeline that combines LLM flexibility with ontology precision:</p>

```mermaid
graph LR
    Q["🗣️ Query"] --> PB["Prompt Builder"]
    PB --> A["LLM Agent"]
    A --> SV["Slot Validator"]
    SV --> C["SPARQL Compiler"]
    C --> X["Oxigraph"]
    X --> R["📊 Results"]
    style PB fill:#dbeafe,stroke:#3b82f6
    style A fill:#848ab7,stroke:#5a6f9f,color:#fff
    style SV fill:#fef3c7,stroke:#f59e0b
    style C fill:#dcfce7,stroke:#22c55e
```

  <p class="subtitle">The LLM never writes SPARQL directly — it fills structured slots that are validated and compiled deterministically.</p>
</Slide>

<Slide :index="4">
  <h2>Key Innovation: Slot-Based Compilation</h2>
  <p>The LLM doesn't generate SPARQL directly. Instead, it fills structured <strong>slots</strong> that a deterministic compiler translates to verified queries.</p>
  <div class="compare-grid">
    <div class="compare-bad">
      <h3>❌ Direct Generation</h3>
      <ul>
        <li>Can hallucinate invalid SPARQL</li>
        <li>Non-deterministic outputs</li>
        <li>Hard to validate/refine</li>
      </ul>
    </div>
    <div class="compare-good">
      <h3>✅ Slot Compilation</h3>
      <ul>
        <li>Always valid SPARQL</li>
        <li>Deterministic &amp; reproducible</li>
        <li>Post-LLM validation layer</li>
      </ul>
    </div>
  </div>
</Slide>

<Slide :index="5">
  <h2>Ontology Grounding</h2>
  <p>Vocabulary is auto-extracted from OWL + SHACL ontologies at startup — no manual vocabulary layer.</p>
  <div class="mono-block">
    "German highways with 3 lanes"<br/><br/>
    → LLM infers "German" → country: "DE"<br/>
    → LLM infers "highways" → roadTypes: "motorway"<br/>
    → LLM infers "3 lanes" → ranges: { laneCount: { min: 3 } }<br/><br/>
    → Slot Validator confirms "DE", "motorway" against sh:in vocabulary<br/>
    → Domain corrector verifies hdmap is the correct domain
  </div>
</Slide>

<Slide :index="6">
  <h2>Technology Stack</h2>
  <div class="stack-list">
    <div class="stack-item"><span class="stack-label">Runtime</span><span class="stack-value">Node.js + TypeScript 5.9 (strict mode)</span></div>
    <div class="stack-item"><span class="stack-label">Frontend</span><span class="stack-value">Vite + React + TanStack Router</span></div>
    <div class="stack-item"><span class="stack-label">API</span><span class="stack-value">Hono (lightweight, edge-ready)</span></div>
    <div class="stack-item"><span class="stack-label">AI</span><span class="stack-value">Copilot SDK / Vercel AI SDK (multi-provider)</span></div>
    <div class="stack-item"><span class="stack-label">SPARQL</span><span class="stack-value">Oxigraph (in-process, WASM-compatible)</span></div>
    <div class="stack-item"><span class="stack-label">Ontology</span><span class="stack-value">OWL + SHACL (auto-extracted vocabulary)</span></div>
    <div class="stack-item"><span class="stack-label">Monorepo</span><span class="stack-value">pnpm workspaces + Turborepo</span></div>
    <div class="stack-item"><span class="stack-label">Testing</span><span class="stack-value">Vitest (unit) + Playwright (E2E)</span></div>
  </div>
</Slide>

<Slide :index="7" variant="cta">
  <h2 style="font-size: 2.5rem;">Try it yourself</h2>
  <p style="font-size: 1.25rem;">Ask anything about HD maps, scenarios, or simulation assets — in any language.</p>
  <div class="cta-buttons">
    <a href="http://localhost:5174" class="btn-primary">Launch Search →</a>
    <a href="/docs/architecture" class="btn-secondary">Deep Dive →</a>
  </div>
  <p class="subtitle">Example queries: "motorway HD maps in Germany" · "OpenDRIVE with 3 lanes" · "Autobahnen mit Überholmanöver"</p>
</Slide>

</SlideDeck>
<SlideControls />
</SlideProvider>
