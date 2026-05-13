---
layout: page
pageClass: slide-page
title: Presentation
---

<SlideProvider :total-slides="8">
<SlideDeck>

<Slide :index="0" variant="title">
  <div class="badge">Conference Overview</div>
  <p class="eyebrow">Ontology-grounded retrieval for ENVITED-X simulation assets</p>
  <h1>Ontology-Based<br /><span class="accent">Natural Language Search</span></h1>
  <p class="lead">A trustworthy path from plain-language questions to deterministic, ontology-compliant SPARQL — without asking users to learn schemas, prefixes, or query languages.</p>
  <div class="metrics-grid">
    <div class="metric">
      <strong>45</strong>
      <span>OWL + SHACL files loaded into the schema graph</span>
    </div>
    <div class="metric">
      <strong>22</strong>
      <span>Ontology domains discoverable through one search interface</span>
    </div>
    <div class="metric">
      <strong>0</strong>
      <span>LLM-written SPARQL — compilation stays deterministic</span>
    </div>
  </div>
  <p class="subtitle">Press → or Space to navigate · Swipe on mobile · Live demo on the final slide</p>
</Slide>

<Slide :index="1">
  <p class="eyebrow">The challenge</p>
  <h2>Rich metadata is only useful if people can actually reach it.</h2>
  <p class="lead">The ENVITED-X Data Space already contains deeply structured simulation asset metadata — road types, lane configurations, locations, quality measures, formats, and relationships.</p>
  <div class="story-grid">
    <div class="story-card">
      <h3>Complex semantics</h3>
      <p>Assets are described through ontologies, shapes, and domain-specific properties.</p>
    </div>
    <div class="story-card">
      <h3>Access barrier</h3>
      <p>Most users do not know SPARQL, prefixes, or the ontology schema behind the data.</p>
    </div>
    <div class="story-card">
      <h3>Trust gap</h3>
      <p>Search must stay explainable, safe, and precise — not just convenient.</p>
    </div>
  </div>
  <div class="callout">Users ask for “German motorways with 3 lanes” — not for classes, predicates, and manually assembled graph queries.</div>
</Slide>

<Slide :index="2">
  <p class="eyebrow">The solution</p>
  <h2>An AI interface with deterministic guardrails.</h2>
  <p class="lead">The system translates natural language into validated search slots, then compiles those slots into verified SPARQL with full transparency about interpretation, gaps, and results.</p>
  <div class="card-grid">
    <div class="card">
      <div class="card-icon">🗣️</div>
      <h3>Natural input</h3>
      <p>Plain-language search in any language, with no ontology expertise required.</p>
    </div>
    <div class="card">
      <div class="card-icon">🧠</div>
      <h3>Ontology-grounded interpretation</h3>
      <p>The LLM maps intent against vocabulary extracted directly from OWL + SHACL.</p>
    </div>
    <div class="card">
      <div class="card-icon">🎯</div>
      <h3>Deterministic execution</h3>
      <p>Validated slots compile to precise SPARQL with confidence and traceability.</p>
    </div>
  </div>
</Slide>

<Slide :index="3" variant="diagram">
  <p class="eyebrow">System architecture</p>
  <h2>LLM flexibility in front. Deterministic compilation underneath.</h2>

```mermaid
flowchart LR
    Q(["🗣️ User query"]) --> P["Prompt\nbuilder"]
    P --> A["🧠 LLM\nagent"]
    A --> V["Slot\nvalidator"]
    V --> C["SPARQL\ncompiler"]
    C --> O[("Oxigraph\nstore")]
    O --> R(["📊 Results +\nrationale"])

    classDef input fill:#dbeafe,stroke:#2563eb,color:#0f172a;
    classDef llm fill:#6366f1,stroke:#4f46e5,color:#ffffff;
    classDef guard fill:#fef3c7,stroke:#f59e0b,color:#0f172a;
    classDef compiler fill:#dcfce7,stroke:#22c55e,color:#0f172a;
    classDef store fill:#ccfbf1,stroke:#0d9488,color:#0f172a;

    class Q,R input;
    class A llm;
    class V guard;
    class C compiler;
    class O store;
```

  <div class="signal-grid">
    <div class="signal-card">
      <h3>Structured prompt</h3>
      <p>Vocabulary tables are generated from the ontology at startup and reused across queries.</p>
    </div>
    <div class="signal-card">
      <h3>Single responsibility</h3>
      <p>The LLM interprets intent; the validator checks it; the compiler turns it into executable SPARQL.</p>
    </div>
    <div class="signal-card">
      <h3>Readable outcome</h3>
      <p>Users can inspect what the system understood before results are even returned.</p>
    </div>
  </div>
</Slide>

<Slide :index="4">
  <p class="eyebrow">Core innovation</p>
  <h2>Why slot-based compilation beats direct query generation.</h2>
  <p class="lead">The model never writes raw SPARQL. It fills structured slots, and a deterministic compiler turns those slots into safe, reproducible queries.</p>
  <div class="compare-grid">
    <div class="compare-card compare-card--bad">
      <span class="compare-label">Direct generation</span>
      <h3>Unstructured SPARQL from the model</h3>
      <ul class="tight-list">
        <li>Can hallucinate invalid graph patterns</li>
        <li>Outputs vary between runs</li>
        <li>Hard to validate or refine safely</li>
      </ul>
    </div>
    <div class="compare-card compare-card--good">
      <span class="compare-label">Slot compilation</span>
      <h3>LLM fills typed search intent</h3>
      <ul class="tight-list">
        <li>Compiler always emits valid SPARQL</li>
        <li>Results stay deterministic and reproducible</li>
        <li>Post-LLM validation corrects mistakes</li>
      </ul>
    </div>
    <div class="compare-card compare-card--impact">
      <span class="compare-label">What changes</span>
      <h3>Better trust, safer execution</h3>
      <ul class="tight-list">
        <li>Confidence can be recomputed against real ontology values</li>
        <li>Domain mismatches are corrected before execution</li>
        <li>Users see gaps instead of silent failure</li>
      </ul>
    </div>
  </div>
</Slide>

<Slide :index="5">
  <p class="eyebrow">Ontology grounding</p>
  <h2>The vocabulary comes from the ontology itself.</h2>
  <p class="lead">Allowed values are auto-extracted from OWL + SHACL at startup, so the search assistant stays synchronized with the source ontologies instead of relying on a manually curated vocabulary layer.</p>
  <div class="panel-grid">
    <div class="panel panel--quote">
      <h3>Example query</h3>
      <p class="query-quote">“German highways with 3 lanes”</p>
      <ul class="tight-list">
        <li><strong>German</strong> → <code>country: "DE"</code></li>
        <li><strong>highways</strong> → <code>roadTypes: "motorway"</code></li>
        <li><strong>3 lanes</strong> → <code>laneCount.min = 3</code></li>
      </ul>
    </div>
    <div class="panel">
      <h3>Validation after interpretation</h3>
      <ul class="tight-list">
        <li>Slot Validator confirms <code>DE</code> and <code>motorway</code> against <code>sh:in</code> vocabulary.</li>
        <li>Domain correction verifies that the query belongs to the <code>hdmap</code> domain.</li>
        <li>Only then does the compiler produce the final SPARQL query.</li>
      </ul>
    </div>
  </div>
  <div class="mono-block">
    <span class="mono-label">Runtime path</span><br />
    Query → slot extraction → vocabulary check (<code>sh:in</code>) → domain correction → deterministic compiler
  </div>
</Slide>

<Slide :index="6">
  <p class="eyebrow">Implementation</p>
  <h2>Built for transparency, speed, and maintainability.</h2>
  <div class="stack-grid">
    <div class="stack-card">
      <span>Runtime</span>
      <strong>Node.js + TypeScript 5.9</strong>
      <p>Strict-mode foundation for predictable backend logic.</p>
    </div>
    <div class="stack-card">
      <span>Frontend</span>
      <strong>Vite + React + TanStack Router</strong>
      <p>Fast, modern UI for streaming search results.</p>
    </div>
    <div class="stack-card">
      <span>API</span>
      <strong>Hono</strong>
      <p>Lightweight SSE-ready interface for progressive responses.</p>
    </div>
    <div class="stack-card">
      <span>AI</span>
      <strong>Copilot SDK / Vercel AI SDK</strong>
      <p>Multi-provider agent layer with the same validation pipeline.</p>
    </div>
    <div class="stack-card">
      <span>SPARQL</span>
      <strong>Oxigraph</strong>
      <p>In-process query execution with a graph-native data model.</p>
    </div>
    <div class="stack-card">
      <span>Ontology</span>
      <strong>OWL + SHACL</strong>
      <p>Vocabulary and constraints extracted directly from source ontologies.</p>
    </div>
    <div class="stack-card">
      <span>Monorepo</span>
      <strong>pnpm workspaces + Turborepo</strong>
      <p>Clear package boundaries for API, search, ontology, and docs.</p>
    </div>
    <div class="stack-card">
      <span>Testing</span>
      <strong>Vitest + Playwright</strong>
      <p>Unit and end-to-end coverage for deterministic behavior.</p>
    </div>
  </div>
</Slide>

<Slide :index="7" variant="cta">
  <div class="badge">Live Demo</div>
  <p class="eyebrow">Experience the search assistant end to end</p>
  <h2>See the ontology search workflow in action.</h2>
  <p class="lead">Ask about HD maps, scenarios, or simulation assets in plain language — then inspect the interpretation, gaps, and compiled SPARQL with the live application.</p>
  <div class="cta-buttons">
    <a href="http://localhost:5174" class="btn-primary">Launch live demo →</a>
    <a href="/docs/architecture" class="btn-secondary">Read the architecture →</a>
  </div>
  <p class="subtitle">Live demo: <a href="http://localhost:5174" class="demo-link">http://localhost:5174</a> · Example prompts: “motorway HD maps in Germany” · “OpenDRIVE with 3 lanes” · “Autobahnen mit Überholmanöver”</p>
</Slide>

</SlideDeck>
<SlideControls />
</SlideProvider>
