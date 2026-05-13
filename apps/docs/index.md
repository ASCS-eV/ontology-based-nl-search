---
layout: home
hero:
  name: Ontology-Based NL Search
  text: ENVITED-X Simulation Assets
  tagline: Translating natural language into precise, ontology-grounded SPARQL queries — with full transparency about what the AI understood and what it couldn't.
  actions:
    - theme: brand
      text: View Presentation →
      link: /slides/
    - theme: alt
      text: Architecture
      link: /architecture
features:
  - title: 🗣️ Natural Language Input
    details: Users describe what they need in plain language — in any language. No SPARQL or ontology knowledge required.
  - title: 🧠 Ontology-Grounded AI
    details: OWL + SHACL ontologies are loaded at startup; raw SHACL shapes ground the LLM while graph-driven schema queries feed the compiler.
  - title: ✅ Post-LLM Validation
    details: A slot validator corrects filter values, applies multi-domain-aware domain correction, and recomputes confidence against the real ontology.
  - title: 🎯 Deterministic SPARQL
    details: LLM fills structured slots — a deterministic compiler generates verified SPARQL. No hallucinated queries, ever.
  - title: 🌐 Graph-Driven Multi-Domain Search
    details: Shared properties such as `roadTypes` can span HD maps, OSI traces, scenarios, environment models, and surface models without hardcoded domain tables.
  - title: ⚡ Progressive Streaming
    details: Results stream via SSE as each pipeline phase completes. Users see the AI interpretation immediately while execution runs.
  - title: 🔌 Multi-Provider
    details: Works with GitHub Copilot, OpenAI, or Ollama. Same validation pipeline, different LLM backends.
---
