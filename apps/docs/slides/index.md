---
layout: page
---

<style>
.slide-deck {
  scroll-snap-type: y mandatory;
  overflow-y: scroll;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  background: white;
}
.slide {
  scroll-snap-align: start;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 4rem;
  position: relative;
}
.slide h2 {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
}
.slide p {
  font-size: 1.25rem;
  color: #4b5563;
  max-width: 48rem;
  text-align: center;
  line-height: 1.8;
}
.slide .callout {
  margin-top: 2rem;
  padding: 1rem 2rem;
  background: #fffbeb;
  border-left: 4px solid #f59e0b;
  border-radius: 0.5rem;
  max-width: 40rem;
}
.slide-nav {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 101;
  font-size: 0.875rem;
  color: #9ca3af;
}
</style>

<div class="slide-deck" id="slide-deck">

<div class="slide">
  <div style="display:inline-block; padding:0.25rem 1rem; background:#dbeafe; color:#1e40af; border-radius:9999px; font-size:0.875rem; font-weight:500; margin-bottom:1.5rem;">
    Proof of Concept
  </div>
  <h1 style="font-size:3.5rem; font-weight:700; text-align:center; line-height:1.2;">
    Ontology-Based<br/>
    <span style="color:#2563eb;">Natural Language Search</span>
  </h1>
  <p>Bridging the gap between natural language and structured simulation asset metadata in the ENVITED-X Data Space.</p>
  <p style="margin-top:2rem; font-size:0.875rem; color:#9ca3af;">Scroll or press ↓ to navigate</p>
</div>

<div class="slide">
  <h2>The Problem</h2>
  <p>The ENVITED-X Data Space contains simulation assets described with rich, ontology-based metadata — road types, lane configurations, geographic locations, quality measures, formats, and more.</p>
  <p style="margin-top:1rem;">But this metadata is only useful if users can <strong>query it effectively</strong>.</p>
  <div class="callout">
    <strong>Users don't know SPARQL. They don't know the ontology schema. They just want to find the right data.</strong>
  </div>
</div>

<div class="slide">
  <h2>The Solution</h2>
  <p>An AI-powered search layer that translates natural language into precise, ontology-grounded SPARQL queries.</p>
  <div style="margin-top:2rem; display:grid; grid-template-columns:repeat(3,1fr); gap:1.5rem; max-width:48rem;">
    <div style="padding:1.5rem; border:1px solid #e5e7eb; border-radius:0.75rem; text-align:center;">
      <div style="font-size:2rem;">🗣️</div>
      <div style="font-weight:600; margin-top:0.5rem;">Natural Input</div>
      <div style="font-size:0.875rem; color:#6b7280; margin-top:0.25rem;">Plain language queries</div>
    </div>
    <div style="padding:1.5rem; border:1px solid #e5e7eb; border-radius:0.75rem; text-align:center;">
      <div style="font-size:2rem;">🧠</div>
      <div style="font-weight:600; margin-top:0.5rem;">AI Interpretation</div>
      <div style="font-size:0.875rem; color:#6b7280; margin-top:0.25rem;">Ontology-grounded mapping</div>
    </div>
    <div style="padding:1.5rem; border:1px solid #e5e7eb; border-radius:0.75rem; text-align:center;">
      <div style="font-size:2rem;">🎯</div>
      <div style="font-weight:600; margin-top:0.5rem;">Precise Results</div>
      <div style="font-size:0.875rem; color:#6b7280; margin-top:0.25rem;">Verified SPARQL execution</div>
    </div>
  </div>
</div>

<div class="slide">
  <h2>Architecture</h2>
  <div style="font-family:monospace; font-size:0.9rem; background:#f9fafb; padding:2rem; border-radius:0.75rem; text-align:left; max-width:48rem;">
    <pre>
User Query ──▶ LLM Agent ──▶ Slot Compiler ──▶ SPARQL Store
    │              │               │                │
    │         Ontology         Deterministic     Oxigraph
    │         Context          Compilation      (in-memory)
    │              │               │                │
    └──────────────┴───────────────┴────────────────┘
                        Results streamed via SSE
    </pre>
  </div>
</div>

<div class="slide">
  <h2>Key Innovation: Slot-Based Compilation</h2>
  <p>The LLM doesn't generate SPARQL directly. Instead, it fills structured <strong>slots</strong> that a deterministic compiler translates to verified queries.</p>
  <div style="margin-top:2rem; display:grid; grid-template-columns:1fr 1fr; gap:2rem; max-width:48rem; text-align:left;">
    <div style="padding:1rem; background:#fef2f2; border-radius:0.5rem;">
      <div style="font-weight:600; color:#991b1b;">❌ Direct Generation</div>
      <ul style="margin-top:0.5rem; font-size:0.875rem; color:#6b7280;">
        <li>Can hallucinate invalid SPARQL</li>
        <li>Non-deterministic outputs</li>
        <li>Hard to validate/refine</li>
      </ul>
    </div>
    <div style="padding:1rem; background:#f0fdf4; border-radius:0.5rem;">
      <div style="font-weight:600; color:#166534;">✅ Slot Compilation</div>
      <ul style="margin-top:0.5rem; font-size:0.875rem; color:#6b7280;">
        <li>Always valid SPARQL</li>
        <li>Deterministic & reproducible</li>
        <li>Users can edit slots directly</li>
      </ul>
    </div>
  </div>
</div>

<div class="slide">
  <h2>Ontology Grounding</h2>
  <p>Every term mapping is backed by SKOS vocabulary entries and SHACL shape definitions.</p>
  <div style="margin-top:2rem; max-width:40rem; text-align:left;">
    <div style="padding:1rem; background:#f9fafb; border-radius:0.5rem; font-family:monospace; font-size:0.8rem;">
      "German highways with 3 lanes"<br/><br/>
      → "German" → skos:altLabel "Germany" → country: "DE"<br/>
      → "highways" → skos:altLabel "highway" → roadTypes: "motorway"<br/>
      → "3 lanes" → sh:path laneCount → ranges: { laneCount: { min: 3 } }
    </div>
  </div>
</div>

<div class="slide">
  <h2>Progressive Streaming</h2>
  <p>Results arrive in real-time as each pipeline phase completes — no waiting for the full pipeline.</p>
  <div style="margin-top:2rem; max-width:32rem; text-align:left; font-size:0.9rem;">
    <div style="padding:0.75rem; border-left:3px solid #3b82f6; margin-bottom:0.5rem;">1. Interpretation (AI mapping)</div>
    <div style="padding:0.75rem; border-left:3px solid #8b5cf6; margin-bottom:0.5rem;">2. Ontology Gaps (unmapped terms)</div>
    <div style="padding:0.75rem; border-left:3px solid #10b981; margin-bottom:0.5rem;">3. SPARQL Query (compiled)</div>
    <div style="padding:0.75rem; border-left:3px solid #f59e0b; margin-bottom:0.5rem;">4. Results (from graph)</div>
    <div style="padding:0.75rem; border-left:3px solid #6b7280;">5. Metadata (timing, counts)</div>
  </div>
</div>

<div class="slide">
  <h2>Try It Yourself</h2>
  <p>The search interface is live — enter any natural language query about simulation assets.</p>
  <div style="margin-top:2rem;">
    <a href="http://localhost:3000" style="display:inline-block; padding:0.75rem 2rem; background:#2563eb; color:white; border-radius:9999px; text-decoration:none; font-weight:600;">
      Launch Search →
    </a>
  </div>
  <p style="margin-top:2rem; font-size:0.875rem; color:#9ca3af;">Example queries: "HD maps in Germany with motorways" · "OpenDRIVE files with 3 lanes"</p>
</div>

</div>

<div class="slide-nav">
  Press ↓ or scroll to navigate
</div>

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  const deck = document.getElementById('slide-deck')
  if (!deck) return

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault()
      deck.scrollBy({ top: window.innerHeight, behavior: 'smooth' })
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      deck.scrollBy({ top: -window.innerHeight, behavior: 'smooth' })
    }
  })
})
</script>
