---
layout: page
pageClass: slide-page
title: Presentation
---

<SlideProvider :total-slides="12">
<SlideDeck>

<Slide :index="0" variant="title">
  <div class="badge">Architecture Overview</div>
  <p class="eyebrow">A trustworthy natural-language interface over any ontology-described data space</p>
  <h1>Ontology-Based<br /><span class="accent">Natural Language Search</span></h1>
  <p class="lead">Plain-language questions become deterministic, ontology-compliant SPARQL — and the only thing that has to change to support a new domain is the ontology, not the code.</p>
  <div class="metrics-grid">
    <div class="metric">
      <strong>0</strong>
      <span>lines of LLM-written SPARQL — the model fills typed slots, a compiler emits the query</span>
    </div>
    <div class="metric">
      <strong>0</strong>
      <span>hardcoded domain names, predicates, or class IRIs in production code</span>
    </div>
    <div class="metric">
      <strong>1</strong>
      <span>source of truth — the OWL + SHACL artifacts drive every layer</span>
    </div>
  </div>
  <p class="subtitle">Press → or Space to navigate · 1) purpose · 2) architecture &amp; standards · 3) the ontology-artifact core</p>
</Slide>

<Slide :index="1">
  <p class="eyebrow">Purpose · 30 seconds</p>
  <h2>Make rich, governed metadata reachable in plain language — without sacrificing trust.</h2>
  <p class="lead">Data spaces like ENVITED-X already publish deeply structured asset metadata as ontologies (OWL) and constraints (SHACL). That richness is wasted if reaching it requires SPARQL, prefixes, and schema expertise.</p>
  <div class="story-grid">
    <div class="story-card">
      <h3>The asset</h3>
      <p>Governed, standards-based metadata: classes, shapes, allowed values, cross-references — already curated for interoperability.</p>
    </div>
    <div class="story-card">
      <h3>The barrier</h3>
      <p>Users think in "German motorways with 3 lanes", not in <code>sh:targetClass</code>, prefixes, and hand-assembled graph patterns.</p>
    </div>
    <div class="story-card">
      <h3>The non-negotiable</h3>
      <p>Search must stay explainable, safe, and reproducible — convenience cannot come at the cost of correctness.</p>
    </div>
  </div>
</Slide>

<Slide :index="2">
  <p class="eyebrow">Why it's innovative</p>
  <h2>Flexibility in front, determinism underneath — and the ontology drives both.</h2>
  <p class="lead">The usual choice is "LLM writes the query (flexible but unsafe)" or "rigid forms (safe but rigid)". This system refuses the trade-off with two ideas working together.</p>
  <div class="compare-grid">
    <div class="compare-card compare-card--good">
      <span class="compare-label">Idea 1 · the boundary</span>
      <h3>The LLM never writes SPARQL</h3>
      <ul class="tight-list">
        <li>It fills one typed <code>submit_slots</code> tool call — a structured intermediate representation.</li>
        <li>A deterministic compiler turns those slots into SPARQL. Same slots ⇒ byte-identical query.</li>
        <li>No prompt injection can produce an arbitrary query — there is no path from text to the store.</li>
      </ul>
    </div>
    <div class="compare-card compare-card--impact">
      <span class="compare-label">Idea 2 · the source of truth</span>
      <h3>Everything is derived from the ontology</h3>
      <ul class="tight-list">
        <li>Prompt vocabulary, slot values, predicate paths, cross-reference joins, validation — all read from OWL + SHACL at runtime.</li>
        <li>No domain knowledge is baked into code.</li>
        <li>Swap the ontology, and a new domain works with zero code change.</li>
      </ul>
    </div>
  </div>
  <div class="callout">The result: an AI search experience with the safety profile of a compiler and the reach of the ontology behind it.</div>
</Slide>

<Slide :index="3" variant="diagram">
  <p class="eyebrow">Architecture · the module graph</p>
  <h2>A strictly layered monorepo — small packages, one-way dependencies, no cycles.</h2>

```mermaid
flowchart TD
    subgraph L0["Leaf contracts (rank 0)"]
      AT["api-types\nwire JSON shapes"]
      SL["slots\nthe search IR + Zod schema"]
    end
    CORE["core\nconfig · logging · RDF prefixes · SSE · LRU"]
    subgraph L2["Capability layer (rank 2)"]
      SP["sparql\nOxigraph + remote + policy gate"]
      ONT["ontology\nSHACL discovery + validation"]
      GIR["graphql-ir\nslot ↔ GraphQL codec"]
    end
    SEARCH["search\ncompiler · discovery · lineage · service"]
    LLM["llm\nSHACL prompt · slot validation · agents"]
    APPS["apps · api (Hono SSE) + web (React)"]

    CORE --> SP & ONT & GIR
    SL --> GIR
    AT & SL & SP & ONT & GIR --> SEARCH
    SEARCH --> LLM
    LLM --> APPS
    AT --> APPS

    classDef leaf fill:#e0e7ff,stroke:#6366f1,color:#0f172a;
    classDef core fill:#ccfbf1,stroke:#0d9488,color:#0f172a;
    classDef cap fill:#dcfce7,stroke:#22c55e,color:#0f172a;
    classDef hub fill:#fef3c7,stroke:#f59e0b,color:#0f172a;
    classDef app fill:#dbeafe,stroke:#2563eb,color:#0f172a;
    class AT,SL leaf;
    class CORE core;
    class SP,ONT,GIR cap;
    class SEARCH,LLM hub;
    class APPS app;
```

  <div class="callout">A CI layer-gate enforces the arrows: every dependency points strictly downward, so the graph can never grow a cycle. Each box is a publishable unit with its own README, requirements table, and tests.</div>
</Slide>

<Slide :index="4" variant="diagram">
  <p class="eyebrow">Architecture · the request pipeline</p>
  <h2>One query, end to end — and where each module does its job.</h2>

```mermaid
flowchart LR
    Q(["🗣️ query"]) --> PB["llm: prompt-builder\nembeds raw SHACL"]
    PB --> AG["llm: agent\nsubmit_slots only"]
    AG --> SV["llm: slot-validator\nfuzzy + SHACL gate"]
    SV --> CO["search: compiler\nSHACL-discovered paths"]
    CO --> PG["sparql: policy gate\nsandbox boundary"]
    PG --> OX[("Oxigraph\nWASM, off-thread")]
    OX --> SVC["search: service\n+ traceability"]
    SVC --> SSE(["📊 SSE stream\ninterpretation · gaps · SPARQL · results · lineage"])

    DISC[("ontology + search\ndiscovery indexes")] -.->|warmup| PB
    DISC -.-> SV
    DISC -.-> CO

    classDef llm fill:#6366f1,stroke:#4f46e5,color:#ffffff;
    classDef search fill:#dcfce7,stroke:#22c55e,color:#0f172a;
    classDef guard fill:#fef3c7,stroke:#f59e0b,color:#0f172a;
    classDef store fill:#ccfbf1,stroke:#0d9488,color:#0f172a;
    classDef io fill:#dbeafe,stroke:#2563eb,color:#0f172a;
    class PB,AG,SV llm;
    class CO,SVC search;
    class PG guard;
    class OX,DISC store;
    class Q,SSE io;
```

  <div class="signal-grid">
    <div class="signal-card">
      <h3>Two-stage validation</h3>
      <p>The validator fuzzy-corrects values against <code>sh:in</code>, then a SHACL gate drops anything that violates a real constraint — surfaced to the user as gaps.</p>
    </div>
    <div class="signal-card">
      <h3>Deterministic compile</h3>
      <p>The compiler walks SHACL-discovered predicate paths and reference chains — no fixed predicate names — and emits one reproducible query.</p>
    </div>
    <div class="signal-card">
      <h3>Streamed transparency</h3>
      <p>Every phase is an SSE event: users see the interpretation, gaps, and the exact SPARQL before results, plus per-row lineage after.</p>
    </div>
  </div>
</Slide>

<Slide :index="5">
  <p class="eyebrow">Architecture · the modules</p>
  <h2>Each package owns one responsibility, with a contract its tests pin.</h2>
  <div class="stack-grid">
    <div class="stack-card">
      <span>slots · rank 0</span>
      <strong>The search IR</strong>
      <p><code>SearchSlots</code> + the Zod wire schema. The system's central contract; held to JSON Schema 2020-12.</p>
    </div>
    <div class="stack-card">
      <span>api-types · rank 0</span>
      <strong>Wire shapes</strong>
      <p>Zero-dependency, browser-safe HTTP/SSE types shared by server and client — drift is impossible by construction.</p>
    </div>
    <div class="stack-card">
      <span>core · rank 1</span>
      <strong>Foundations</strong>
      <p>Zod config, structured logging, typed errors, the canonical RDF prefix map, SSE framing, a bounded LRU.</p>
    </div>
    <div class="stack-card">
      <span>sparql · rank 2</span>
      <strong>Execution + sandbox</strong>
      <p>Oxigraph (WASM, off-thread) and a remote Fuseki store behind one cache, plus the policy gate that is the security boundary.</p>
    </div>
    <div class="stack-card">
      <span>ontology · rank 2</span>
      <strong>Discovery + validation</strong>
      <p>Domain registry from <code>sh:targetClass</code> + <code>rdfs:subClassOf</code>; SHACL Core validation; source resolution.</p>
    </div>
    <div class="stack-card">
      <span>graphql-ir · rank 2</span>
      <strong>Slot ↔ GraphQL codec</strong>
      <p>Serializes slots to a spec-valid GraphQL query and parses it back — the editable surface the web app mirrors.</p>
    </div>
    <div class="stack-card">
      <span>search · rank 3</span>
      <strong>Compiler + pipeline</strong>
      <p>Deterministic SPARQL compilation, schema discovery, lineage, and the orchestration service.</p>
    </div>
    <div class="stack-card">
      <span>llm · rank 4</span>
      <strong>Interpretation</strong>
      <p>SHACL-grounded prompt, fuzzy + SHACL slot validation, and a multi-provider agent restricted to one tool.</p>
    </div>
  </div>
</Slide>

<Slide :index="6">
  <p class="eyebrow">Standards · not invention</p>
  <h2>Every boundary speaks a standard.</h2>
  <p class="lead">The system is glue between well-specified contracts. Each interface cites its normative spec, audited in <code>docs/standards-audit.md</code>.</p>
  <div class="card-grid">
    <div class="card">
      <div class="card-icon">◆</div>
      <h3>The graph</h3>
      <p><strong>RDF 1.1 · OWL · SHACL</strong> describe and constrain the data; <strong>SKOS</strong> gives concept hierarchies for query expansion.</p>
    </div>
    <div class="card">
      <div class="card-icon">◆</div>
      <h3>The query</h3>
      <p><strong>SPARQL 1.1</strong> is the only thing that touches the store — compiled, escaped to grammar, and policy-checked.</p>
    </div>
    <div class="card">
      <div class="card-icon">◆</div>
      <h3>The contracts</h3>
      <p><strong>JSON Schema 2020-12</strong> grounds the slot tool call; <strong>GraphQL</strong> is the editable query surface; <strong>RFC 8259 / 9110 / SSE</strong> carry it over the wire.</p>
    </div>
  </div>
  <div class="mono-block">
    <span class="mono-label">Why it matters</span><br />
    Standards-pinned boundaries mean each layer is independently testable, swappable, and partner-consumable — and "is this correct?" reduces to "does it conform to the spec?".
  </div>
</Slide>

<Slide :index="7">
  <p class="eyebrow">Open source · leverage, don't reinvent</p>
  <h2>Best-in-class libraries do the heavy lifting.</h2>
  <div class="stack-grid">
    <div class="stack-card">
      <span>SPARQL engine</span>
      <strong>Oxigraph (WASM)</strong>
      <p>In-process SPARQL 1.1, run off the main thread in a worker; a remote Apache Jena Fuseki store swaps in for production.</p>
    </div>
    <div class="stack-card">
      <span>SHACL + RDF</span>
      <strong>rdf-validate-shacl · N3 · rdfjs</strong>
      <p>Zazuko's validator, the N3 Turtle parser, and the RDF/JS dataset model parse and check the shapes graph.</p>
    </div>
    <div class="stack-card">
      <span>Query tooling</span>
      <strong>sparqljs · graphql-js 17 · @zazuko/prefixes</strong>
      <p>SPARQL parsing/validation, the GraphQL codec, and the canonical prefix map — single sources of truth.</p>
    </div>
    <div class="stack-card">
      <span>AI</span>
      <strong>Vercel AI SDK + GitHub Copilot SDK</strong>
      <p>Five providers (OpenAI, Anthropic, claude-cli, vibe-cli/Mistral, Ollama) plus Copilot — one validation pipeline behind them all.</p>
    </div>
    <div class="stack-card">
      <span>App platform</span>
      <strong>Hono · Vite · React 19 · TanStack Router</strong>
      <p>An SSE-native API and a streaming React UI, built and orchestrated by pnpm workspaces + Turborepo.</p>
    </div>
    <div class="stack-card">
      <span>Deliberate keeps</span>
      <strong>SSE parser · LRU · Levenshtein</strong>
      <p>Three small bespoke utilities, each justified in an ADR — kept because the library alternatives are not drop-in or add no measurable benefit.</p>
    </div>
  </div>
</Slide>

<Slide :index="8">
  <p class="eyebrow">The security model</p>
  <h2>Two gates make the AI path safe by construction.</h2>
  <div class="panel-grid">
    <div class="panel panel--quote">
      <h3>Gate 1 · the slot IR</h3>
      <p class="query-quote">text → typed slots → SPARQL</p>
      <ul class="tight-list">
        <li>The model's only output channel is the <code>submit_slots</code> tool — prose is ignored.</li>
        <li>Slots are validated and corrected against the live SHACL vocabulary before they reach the compiler.</li>
        <li>The compiler is the sole, deterministic SPARQL author.</li>
      </ul>
    </div>
    <div class="panel">
      <h3>Gate 2 · the policy sandbox</h3>
      <ul class="tight-list">
        <li>Only <code>SELECT</code> runs; writes, <code>SERVICE</code>, and graph redirection are rejected.</li>
        <li>The prefix allowlist derives from the same <code>RDF_PREFIXES</code> the compiler emits — it cannot drift.</li>
        <li>A <code>LIMIT</code> ceiling is enforced; literals are escaped to the SPARQL 1.1 grammar (fuzz-tested).</li>
      </ul>
    </div>
  </div>
  <div class="callout">Neither gate trusts the model. Prompt injection can change <em>what</em> is asked, never <em>what query runs</em>.</div>
</Slide>

<Slide :index="9" variant="diagram">
  <p class="eyebrow">The beautiful core</p>
  <h2>The ontology artifacts are the program.</h2>
  <p class="lead">One set of OWL + SHACL files, discovered once at warmup, becomes every moving part below. Nothing about a specific ontology is written in code.</p>

```mermaid
flowchart LR
    ART[("OWL + SHACL\nartifacts")]:::art
    ART --> D1["domain registry\ntargetClass · subClassOf"]
    ART --> D2["property paths\nasset → leaf chains"]
    ART --> D3["reference chains\ncross-asset joins"]
    ART --> D4["vocabulary\nsh:in · ranges"]
    ART --> D5["SKOS concepts\nquery expansion"]

    D4 --> P["LLM prompt"]
    D4 --> V["slot validator"]
    D1 --> C["SPARQL compiler"]
    D2 --> C
    D3 --> C
    D1 --> G["GraphQL schema"]
    D2 --> G

    classDef art fill:#f59e0b,stroke:#b45309,color:#0f172a;
    classDef d fill:#dcfce7,stroke:#22c55e,color:#0f172a;
    classDef use fill:#dbeafe,stroke:#2563eb,color:#0f172a;
    class D1,D2,D3,D4,D5 d;
    class P,V,C,G use;
```

  <div class="mono-block">
    <span class="mono-label">Discovery, not configuration</span><br />
    Predicate paths and reference signatures <code>(sourceClass, path, targetClass)</code> are found by walking the shapes graph and typed instances at warmup — so the meta-model is read, never assumed.
  </div>
</Slide>

<Slide :index="10">
  <p class="eyebrow">What this enables · long run</p>
  <h2>Generality is the product.</h2>
  <p class="lead">Because the artifacts are the source of truth, the same engine generalizes far beyond ENVITED-X — and the model it discovers can itself become a published asset.</p>
  <div class="card-grid">
    <div class="card">
      <div class="card-icon">♻️</div>
      <h3>Any data space, for free</h3>
      <p>Point it at a retail, biomedical, or industrial ontology and "waterproof boots under €100" works with no code change. The data space's governance artifacts <em>become</em> its search interface.</p>
    </div>
    <div class="card">
      <div class="card-icon">📦</div>
      <h3>The discovered model as an artifact</h3>
      <p>The search surface the system derives — domains, paths, vocabulary, the GraphQL SDL — can be published and versioned: a cacheable, partner-consumable contract that warm-starts the engine.</p>
    </div>
    <div class="card">
      <div class="card-icon">🤝</div>
      <h3>Standard partner contracts</h3>
      <p>Because the query surface is GraphQL and the store is standard SPARQL 1.1 / Fuseki, partners integrate through interfaces they already know — no bespoke API to learn.</p>
    </div>
  </div>
  <div class="callout">Today it answers questions about simulation assets. The architecture's real claim is that <strong>publishing a good ontology is enough to get a trustworthy natural-language interface over your data.</strong></div>
</Slide>

<Slide :index="11" variant="cta">
  <div class="badge">Live Demo</div>
  <p class="eyebrow">The whole architecture in one sentence</p>
  <h2>The LLM interprets; the ontology decides; the compiler executes.</h2>
  <p class="lead">Ask about HD maps, scenarios, or simulation assets in plain language — then inspect the interpretation, the gaps, the compiled SPARQL, and the per-row lineage in the live app.</p>
  <div class="cta-buttons">
    <a href="http://localhost:5174" class="btn-primary">Launch live demo →</a>
    <a href="/docs/architecture" class="btn-secondary">Read the architecture →</a>
  </div>
  <p class="subtitle">Try: “motorway HD maps in Germany” · “OpenDRIVE with 3 lanes” · “Autobahnen mit Überholmanöver”</p>
</Slide>

</SlideDeck>
<SlideControls />
</SlideProvider>
