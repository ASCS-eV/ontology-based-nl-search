---
layout: page
pageClass: slide-page conference-page
title: The dictionary and the translator
---

<script setup>
import SlideBrand from '../.vitepress/theme/components/SlideBrand.vue'
import TitleArt from '../.vitepress/theme/components/TitleArt.vue'
import '../.vitepress/theme/conference.css'
</script>

<SlideProvider :total-slides="19">
<SlideBrand />
<SlideDeck>

<Slide :index="0" variant="title">
  <div class="title-grid">
    <div class="title-text">
      <p class="eyebrow">EU project SYNERGIES · Results by BMW</p>
      <h1>Formal models are the dictionary. <span class="accent">LLMs are the translator.</span></h1>
      <p class="takeaway">Agent-assisted modelling, natural-language search and synthetic scenarios, built on open standards.</p>
      <div class="acts" aria-label="The five parts of the talk">
        <span>Model</span><span>Loop</span><span>Use</span><span>Invert</span><span>Standardize</span>
      </div>
    </div>
    <TitleArt />
  </div>
  <p class="source-line">Funded by the European Union. Views and opinions expressed are those of the author(s) only and do not necessarily reflect those of the EU or CINEA. Neither the EU nor the granting authority can be held responsible for them.</p>
</Slide>

<Slide :index="1">
  <p class="eyebrow">01 · Modelling</p>
  <h2>Formal modelling is nothing new. <span class="accent">Writing it just got cheap.</span></h2>
  <div class="timeline" aria-label="Modelling languages by year of first standardization">
    <div class="card"><span class="card-title">1997</span><span class="card-text">UML</span></div>
    <div class="card"><span class="card-title">2001</span><span class="card-text">XML Schema</span></div>
    <div class="card"><span class="card-title">2004</span><span class="card-text">OWL</span></div>
    <div class="card"><span class="card-title">2008</span><span class="card-text">SPARQL</span></div>
    <div class="card"><span class="card-title">2017</span><span class="card-text">SHACL</span></div>
    <div class="card tone-info"><span class="card-title">Now</span><span class="card-text">Agents write them fluently. Generators derive the rest.</span></div>
  </div>
  <p class="takeaway">One LinkML schema → OWL + SHACL + JSON-LD context. One UML model → XSD + OWL + SHACL.</p>
  <p class="source-line">Generators in use: LinkML (gen-owl, gen-shacl, gen-jsonld-context) · ShapeChange · owl2shacl</p>
</Slide>

<Slide :index="2">
  <p class="eyebrow">02 · Human in the loop</p>
  <h2>Agents excel against specs. <span class="accent">Specs keep humans in the loop.</span></h2>
  <div class="flow" aria-label="The specification defines correctness, the agent drafts, the human reviews">
    <div class="card"><span class="card-title">Specification</span><span class="card-text">Defines what “correct” means: W3C, ASAM</span></div>
    <span class="flow-arrow" aria-hidden="true">→</span>
    <div class="card"><span class="card-title">Agent</span><span class="card-text">Drafts the model, the examples, the tests</span></div>
    <span class="flow-arrow" aria-hidden="true">→</span>
    <div class="card tone-info"><span class="card-title">Human</span><span class="card-text">Reviews a small, declarative model diff</span></div>
  </div>
  <p class="takeaway">Review what the model means, not thousands of lines of code.</p>
</Slide>

<Slide :index="3">
  <p class="eyebrow">03 · Closed loops</p>
  <h2>Build circles, not pipelines.</h2>
  <div class="loop" aria-label="Loop: model, generator, artifacts, example data, validator, back to model">
    <div class="card"><span class="card-title">Model</span><span class="card-text">LinkML · UML</span></div>
    <span class="arrow" aria-hidden="true">→</span>
    <div class="card"><span class="card-title">Generator</span><span class="card-text">gen-owl · ShapeChange</span></div>
    <span class="arrow" aria-hidden="true">→</span>
    <div class="card"><span class="card-title">Artifacts</span><span class="card-text">OWL · SHACL · XSD</span></div>
    <span class="arrow" aria-hidden="true">↑</span>
    <p class="loop-center">AI drafts at every station. A machine checks every turn.</p>
    <span class="arrow" aria-hidden="true">↓</span>
    <div class="card tone-success"><span class="card-title">Validator</span><span class="card-text">OMB, in CI</span></div>
    <span class="return" aria-hidden="true"></span>
    <div class="card"><span class="card-title">Example data</span><span class="card-text">Valid + broken on purpose</span></div>
  </div>
  <p class="source-line">Ontology Management Base: LinkML artifacts must regenerate byte-identical; each domain's example data is SHACL-validated.</p>
</Slide>

<Slide :index="4">
  <p class="eyebrow">04 · Leverage</p>
  <h2>Stop building proprietary tools. <span class="accent">Plug into open standards.</span></h2>
  <div class="tool-grid" aria-label="Standards and the open-source tools they unlock">
    <div class="card"><span class="card-title">RDF · JSON-LD</span><span class="card-text">Any graph database</span></div>
    <div class="card"><span class="card-title">SPARQL 1.1</span><span class="card-text">Oxigraph · Apache Jena Fuseki</span></div>
    <div class="card"><span class="card-title">SHACL</span><span class="card-text">Validation is a library call</span></div>
    <div class="card"><span class="card-title">GraphQL</span><span class="card-text">The API developers already know</span></div>
    <div class="card"><span class="card-title">JSON Schema</span><span class="card-text">Typed tool calls for agents</span></div>
    <div class="card"><span class="card-title">OWL 2</span><span class="card-text">Editors, reasoners, generators</span></div>
  </div>
  <p class="takeaway">The code we wrote is glue between standards.</p>
</Slide>

<Slide :index="5">
  <p class="eyebrow">05 · Translation</p>
  <h2>LLMs translate. <span class="accent">OWL + SHACL are dictionary and grammar.</span></h2>
  <div class="flow" aria-label="A sentence is translated into typed slots, which a compiler turns into SPARQL">
    <div class="card"><span class="card-title">Your words</span><span class="card-text">“HD-Karten von Autobahnen in Deutschland”</span></div>
    <span class="flow-arrow" aria-hidden="true">→</span>
    <div class="card tone-info"><span class="card-title">LLM + ontology</span><span class="card-text">Dictionary: classes, allowed values. Grammar: shapes.</span></div>
    <span class="flow-arrow" aria-hidden="true">→</span>
    <div class="card"><span class="card-title">Typed slots</span><span class="card-text">One tool call, checked against SHACL</span></div>
    <span class="flow-arrow" aria-hidden="true">→</span>
    <div class="card"><span class="card-title">Compiler</span><span class="card-text">Deterministic SPARQL</span></div>
  </div>
  <p class="takeaway">The LLM never writes the query. A prompt injection can change what is asked, never what runs.</p>
</Slide>

<Slide :index="6" variant="cta">
  <p class="eyebrow">Live demo · Search</p>
  <h2>Ask in your own words.</h2>
  <ol class="prompts prompts--compact" aria-label="Search prompts for the live demo">
    <li>motorway HD maps in Germany<small>SPARQL · GraphQL · 19 maps</small></li>
    <li>HD-Karten von Autobahnen in Deutschland<small>the identical query</small></li>
    <li>motorway HD maps in Germany with potholes<small>plus one gap</small></li>
    <li>cut-in scenarios and the HD maps they reference<small>lineage</small></li>
  </ol>
  <div class="watch" aria-label="What to watch for">
    <span class="watch-label">Watch for</span><span>Interpretation</span><span>Gaps</span><span>SPARQL</span><span>Lineage</span>
  </div>
</Slide>

<Slide :index="7" variant="cta">
  <p class="eyebrow">Backup · recorded run · search 1 of 4</p>
  <h2 class="backup-title">motorway HD maps in Germany</h2>
  <div class="screen" tabindex="0" role="region" aria-label="Recorded run; scroll to see the whole page">
    <img src="./demo-backup/1-search-motorway.png" alt="Recorded search: the interpretation with road type motorway and country DE, the GraphQL and SPARQL queries, and 19 matching HD maps" />
  </div>
</Slide>

<Slide :index="8" variant="cta">
  <p class="eyebrow">Backup · recorded run · search 2 of 4</p>
  <h2 class="backup-title">HD-Karten von Autobahnen in Deutschland</h2>
  <div class="screen" tabindex="0" role="region" aria-label="Recorded run; scroll to see the whole page">
    <img src="./demo-backup/2-search-german.png" alt="Recorded search in German: the same two filters and the same 19 HD maps" />
  </div>
</Slide>

<Slide :index="9" variant="cta">
  <p class="eyebrow">Backup · recorded run · search 3 of 4</p>
  <h2 class="backup-title">motorway HD maps in Germany with potholes</h2>
  <div class="screen" tabindex="0" role="region" aria-label="Recorded run; scroll to see the whole page">
    <img src="./demo-backup/3-search-gap.png" alt="Recorded search with potholes: the same 19 maps and potholes reported under Not in ontology" />
  </div>
</Slide>

<Slide :index="10" variant="cta">
  <p class="eyebrow">Backup · recorded run · search 4 of 4</p>
  <h2 class="backup-title">cut-in scenarios and the HD maps they reference</h2>
  <div class="screen" tabindex="0" role="region" aria-label="Recorded run; scroll to see the whole page">
    <img src="./demo-backup/4-search-lineage.png" alt="Recorded search for cut-in scenarios: five results with their references, the first expanded into a lineage tree of seven assets" />
  </div>
</Slide>

<Slide :index="11">
  <p class="eyebrow">06 · Learn from users</p>
  <h2>Every gap shows <span class="accent">what the ontology cannot say yet.</span></h2>
  <div class="columns" aria-label="Three kinds of gaps reported to the user">
    <div class="card tone-warning"><span class="card-title">Not in ontology</span><span class="card-text">The concept does not exist yet</span></div>
    <div class="card tone-info"><span class="card-title">Understood, not filtered</span><span class="card-text">Recognized, but no property to filter on</span></div>
    <div class="card tone-neutral"><span class="card-title">Query limitation</span><span class="card-text">The engine cannot express it yet</span></div>
  </div>
  <p class="takeaway">Experts model the language first. Users then show where it needs to grow.</p>
</Slide>

<Slide :index="12">
  <p class="eyebrow">07 · Lineage</p>
  <h2>Data lineage has never been easier.</h2>
  <div class="flow" aria-label="References in the graph form the lineage of an asset">
    <div class="card"><span class="card-title">Scenario</span><span class="card-text">Cut-in in Frankfurt</span></div>
    <span class="flow-arrow" aria-hidden="true">→</span>
    <div class="card"><span class="card-title">OSI trace</span><span class="card-text">Frankfurt motorway</span></div>
    <span class="flow-arrow" aria-hidden="true">→</span>
    <div class="card"><span class="card-title">HD maps</span><span class="card-text">Frankfurt interchange</span></div>
  </div>
  <p class="takeaway">A reference is a typed link, not free text. Lineage is a graph walk, not a feature you build.</p>
  <p class="source-line">From the demo data: one scenario reaches 7 assets through its manifest, each with a did:web identifier.</p>
</Slide>

<Slide :index="13">
  <p class="eyebrow">08 · The inverse</p>
  <h2>If we can search it, <span class="accent">we can generate it.</span></h2>
  <div class="mirror" aria-label="Search and authoring use the same pattern in opposite directions">
    <span class="mirror-label">Search</span>
    <div class="mirror-row card tone-info">words → typed slots → SPARQL → existing assets</div>
    <span class="mirror-label">Author</span>
    <div class="mirror-row card tone-success">words → typed scene → OpenSCENARIO XML → checks → playback</div>
  </div>
  <p class="takeaway">The future: synthetic data that is valid by construction and described by the same ontology.</p>
  <p class="source-line">Checks: SHACL from ASAM's OpenSCENARIO model · XSD 1.3.0 via the open-source OpenSCENARIO API (WebAssembly) · road rules · esmini</p>
</Slide>

<Slide :index="14" variant="cta">
  <p class="eyebrow">Live demo · Authoring</p>
  <h2>Describe it. Get a valid OpenSCENARIO file.</h2>
  <ol class="prompts" aria-label="Authoring prompt for the live demo">
    <li>A cut-in on a highway: a vehicle 30 m ahead of the ego vehicle in the neighbouring lane changes into the ego's lane.<small>Actors, actions, and the road the scene binds to</small></li>
  </ol>
  <div class="watch" aria-label="What to watch for">
    <span class="watch-label">Watch for</span><span>Model choices</span><span>Semantic · structural · road checks</span><span>esmini preview</span><span>.xosc export</span>
  </div>
</Slide>

<Slide :index="15" variant="cta">
  <p class="eyebrow">Backup · recorded run · authoring 1 of 2</p>
  <h2 class="backup-title">A cut-in on a highway: a vehicle 30 m ahead of the ego vehicle in the neighbouring lane changes into the ego's lane.</h2>
  <div class="screen" tabindex="0" role="region" aria-label="Recorded run; scroll to see the whole page">
    <img src="./demo-backup/5-author.png" alt="Recorded authoring run: the interpretation, the scene with two vehicles, three passing validation gates, the OpenSCENARIO XML and the esmini preview" />
  </div>
</Slide>

<Slide :index="16" variant="cta">
  <p class="eyebrow">Backup · recorded run · authoring 2 of 2</p>
  <h2 class="backup-title">The generated scenario, played by esmini</h2>
  <div class="screen screen--fit">
    <video
      src="./demo-backup/6-author-preview.webm"
      poster="./demo-backup/6-author-preview.png"
      autoplay
      loop
      muted
      playsinline
      aria-label="Recording of the esmini preview: the vehicle 30 m ahead in the neighbouring lane moves into the ego vehicle's lane"
    ></video>
  </div>
</Slide>

<Slide :index="17">
  <p class="eyebrow">09 · Standardization</p>
  <h2>Standardize in models, <span class="accent">not in prose.</span></h2>
  <div class="columns" aria-label="Standardization today and with model-based pipelines">
    <div class="card tone-neutral"><span class="card-title">Today</span><span class="card-text">Text + XSD per standard. Ontologies derived afterwards, one silo each.</span></div>
    <div class="card tone-info"><span class="card-title">Next</span><span class="card-text">One ASAM OpenX ontology. Models authored with agents, reviewed like code.</span></div>
    <div class="card tone-success"><span class="card-title">Open pipelines</span><span class="card-text">Generate XSD, OWL, SHACL and docs from one source.</span></div>
  </div>
  <p class="takeaway">Already working: OpenSCENARIO.xsd regenerated byte-identical from ASAM's UML model.</p>
  <p class="source-line">UML → ShapeChange → OWL → owl2shacl → SHACL · fixes contributed upstream to both tools</p>
</Slide>

<Slide :index="18" variant="cta">
  <p class="eyebrow">Close the loop</p>
  <h2>Model. Generate. Validate. <span class="accent">Translate. Create. Standardize.</span></h2>
  <div class="thesis card tone-info">
    <span>Formal models are the dictionary.</span>
    <span>LLMs are the translator.</span>
    <span>Agents close the loop, and humans stay in it.</span>
  </div>
  <p class="source-line">synergies-ccam.eu · github.com/ASCS-eV/ontology-based-nl-search · github.com/ASCS-eV/ontology-management-base</p>
  <p class="source-line">Funded by the European Union. Views and opinions expressed are those of the author(s) only and do not necessarily reflect those of the EU or CINEA. Neither the EU nor the granting authority can be held responsible for them.</p>
</Slide>

</SlideDeck>

<SlideNotes :index="0" title="Formal models are the dictionary. LLMs are the translator." timing="0:00–1:00 · 60 seconds">
  <p>I am presenting results that BMW created in the EU research project SYNERGIES.</p>
  <p>For twenty-five years we have been able to describe data formally. And for twenty-five years most of that rigor stayed locked away: in models only experts could write, and in data hardly anyone could query.</p>
  <p>Today I want to show you why that has changed. Formal models are the dictionary and the grammar. Large language models are the translator. Put them together in closed loops, with a human reviewing every turn, and you get search in plain language, synthetic data that is valid by construction, and standards that are modelled instead of written.</p>
  <p>Five parts, two live demos.</p>
  <p>[Cue: name SYNERGIES and BMW first, then read the headline slowly and point along the five parts. Transition: “Let me start with a confession.”]</p>
</SlideNotes>

<SlideNotes :index="1" title="Formal modelling is nothing new. Writing it just got cheap." timing="1:00–2:30 · 90 seconds">
  <p>Let me start with a confession: nothing on this timeline is new. From UML in 1997 to SHACL in 2017, we have had precise, machine-checkable modelling languages for a generation.</p>
  <p>What held us back was the cost of writing them. A good ontology needed a rare expert and a lot of patience, and it drifted away from the code around it.</p>
  <p>Two things changed. First, the generators matured. With LinkML I write one schema and derive OWL, SHACL and a JSON-LD context from it. ShapeChange and owl2shacl do the same from a UML model. Second, these languages are exactly what language models are good at: small, precisely specified, and documented in public in great detail. An agent drafts a SHACL shape the way it drafts a function.</p>
  <p>So modelling becomes a conversation with an assistant, not a solo expert task. That is how we are re-modelling the domains of the Ontology Management Base in LinkML right now: an agent at the keyboard, a human deciding.</p>
  <p>[Cue: sweep left to right along the years, stop on “Now”. Transition: “Why does an agent do this well?”]</p>
</SlideNotes>

<SlideNotes :index="2" title="Agents excel against specs. Specs keep humans in the loop." timing="2:30–4:00 · 90 seconds">
  <p>Why does this work so well? Because agents are at their best when there is a specification to develop against. The specification tells the agent what correct means, and it tells me how to check the result. That is the difference between an agent that improvises and an agent that engineers.</p>
  <p>It also gives us something we are often afraid of losing: the human in the loop. When an agent writes thousands of lines of imperative code, I can test it, but I can hardly review it. When an agent changes a model, the diff is small and declarative. A new class. A new allowed value. A cardinality. I can read that. My domain experts can read that. We can discuss it in a pull request.</p>
  <p>So the division of labour is simple. The specification defines correctness. The agent does the typing: the model, the examples, the tests. The human decides what the model should mean. We still understand what is happening, and that is the precondition for trusting anything that comes afterwards.</p>
  <p>[Cue: point to the three boxes in order; rest on “Human”. Transition: “But a model on its own proves nothing.”]</p>
</SlideNotes>

<SlideNotes :index="3" title="Build circles, not pipelines." timing="4:00–5:30 · 90 seconds">
  <p>A model on its own proves nothing. So the third ingredient is the most important one: we build circles, not pipelines.</p>
  <p>The model feeds a generator. The generator produces artifacts: OWL, SHACL, JSON-LD contexts, and in the ASAM case, XML Schemas. Then we need example data: valid instances, and instances that are broken on purpose. And a validator checks that data against the artifacts. In our case that is the Ontology Management Base, OMB, which validates the example data of every domain in continuous integration. Whatever fails goes back to the model, and the loop turns again.</p>
  <p>The AI helps at every station. It drafts the model, writes examples, explains a violation. But every turn is checked by a machine. OMB regenerates its LinkML artifacts in CI and fails on a single byte of difference. And when we port a hand-written ontology to LinkML, we measure it: we derive adversarial instances from every existing shape and count how many the new shapes still catch.</p>
  <p>That is how an agent can work fast while we still trust the result.</p>
  <p>[Cue: trace the loop with your hand, clockwise from Model back to Model. Transition: “Once you trust your models, something interesting happens.”]</p>
</SlideNotes>

<SlideNotes :index="4" title="Stop building proprietary tools. Plug into open standards." timing="5:30–7:00 · 90 seconds">
  <p>Now we have formal data models, and we are confident in working with them. This is where the payoff starts. We do not have to build tooling any more. We plug in.</p>
  <p>Our data is RDF, so any graph database can hold it. Oxigraph runs in-process during development, Apache Jena Fuseki in production. Both speak SPARQL 1.1: one standard query language for all of it. The constraints are SHACL, so validation is a library call, not a project. The same shapes give us a GraphQL surface that every web developer already knows. And the agents build on the same foundations: their tool calls are typed with JSON Schema, one more open standard.</p>
  <p>Think about what this replaces. In our industry, many organizations have spent years building proprietary databases, query builders and validators for simulation data. Here, the code we wrote is glue between standards, and every boundary cites its specification. Ask whether a component is correct, and the question becomes: does it conform to the standard?</p>
  <p>[Cue: point to two or three tiles, not all six. Transition: “Which brings me to natural language.”]</p>
</SlideNotes>

<SlideNotes :index="5" title="LLMs translate. OWL + SHACL are dictionary and grammar." timing="7:00–8:30 · 90 seconds">
  <p>Which brings me to natural language. The distance between how people talk and how formal models are written has always been the last mile. Here is the insight: that distance is a translation problem, and translating is what large language models are genuinely great at.</p>
  <p>So we give the model a dictionary and a grammar. The dictionary is the ontology: classes, properties, allowed values. The grammar is SHACL: which property belongs to which shape, with which datatype. For every question we look up the right pages, and the matching SHACL fragments go into the prompt. The model's only job is to translate a sentence, in any language, into typed slots through one tool call. Then the slots are checked against the same shapes.</p>
  <p>What the model never does is write SPARQL. A deterministic compiler does, so the same slots always produce the same query. That is also our security model: a prompt injection can change what is asked, but never what runs against the database. Let me show you.</p>
  <p>[Cue: follow the four boxes; pause on “Compiler”. Transition: switch to the prepared search tab.]</p>
</SlideNotes>

<SlideNotes :index="6" title="Ask in your own words." timing="8:30–12:30 · 4 minutes">
  <p>Switch to the search tab. Submit “motorway HD maps in Germany”. While it streams, say: “Watch the pipeline. The model interprets, the slots are validated, the compiler writes the query.” Open the interpretation and point at the two filters: road type motorway, country DE. “This is the translation: values that exist in the ontology.” Expand the GraphQL and SPARQL panels: “The model did not write this. The compiler did.” Point at the 19 maps.</p>
  <p>Submit “HD-Karten von Autobahnen in Deutschland”. “Same dictionary, another language.” Point out that the filters and the 19 maps are identical.</p>
  <p>Submit “motorway HD maps in Germany with potholes”. Open the gaps panel: “Same 19 maps, plus one term the ontology cannot express. Not silently dropped, reported. Remember this; it is my next slide.”</p>
  <p>Submit “cut-in scenarios and the HD maps they reference”. On the first result card, open “Explore lineage”: “Seven assets, reached by following typed links through the graph.” Then return to the deck.</p>
  <p>[Cue: at most 30 seconds of recovery if a request fails: resubmit once, then press → for the four recorded backup slides. If the demo ran live, press → five times to skip them. Transition: “What you just saw in the gaps panel is the most underrated part.”]</p>
</SlideNotes>

<SlideNotes :index="7" title="motorway HD maps in Germany" timing="12:30–12:30 · backup, only if the live demo fails">
  <p>Recorded run. Say: “This is a recorded run of the same flow.” Scroll down: the interpretation with its two filters, the GraphQL query, the SPARQL the compiler wrote, and the 19 maps.</p>
  <p>[Cue: scroll the screenshot with the mouse wheel or trackpad.]</p>
</SlideNotes>

<SlideNotes :index="8" title="HD-Karten von Autobahnen in Deutschland" timing="12:30–12:30 · backup, only if the live demo fails">
  <p>Recorded run. Say: “This is a recorded run of the same flow.” The German query produced the same two filters and the same 19 maps.</p>
  <p>[Cue: scroll the screenshot with the mouse wheel or trackpad.]</p>
</SlideNotes>

<SlideNotes :index="9" title="motorway HD maps in Germany with potholes" timing="12:30–12:30 · backup, only if the live demo fails">
  <p>Recorded run. Say: “This is a recorded run of the same flow.” Scroll to the gaps panel: “potholes” under Not in ontology, next to the same 19 maps.</p>
  <p>[Cue: scroll the screenshot with the mouse wheel or trackpad.]</p>
</SlideNotes>

<SlideNotes :index="10" title="cut-in scenarios and the HD maps they reference" timing="12:30–12:30 · backup, only if the live demo fails">
  <p>Recorded run. Say: “This is a recorded run of the same flow.” Scroll to the first result card: its references, then the lineage tree with seven reachable assets.</p>
  <p>[Cue: scroll the screenshot with the mouse wheel or trackpad.]</p>
</SlideNotes>

<SlideNotes :index="11" title="Every gap shows what the ontology cannot say yet." timing="12:30–14:00 · 90 seconds">
  <p>What you just saw in the gaps panel is, for me, the most underrated part of this work. The expert models the language first. But the users are the ones who reveal what the language cannot say yet.</p>
  <p>Every query that mentions something the ontology does not cover produces a gap, and there are three kinds: not in the ontology, understood but not filterable, or a limitation of the query engine. None of this is silently dropped.</p>
  <p>Here is a real one. Ask for German highways with three lanes, and the answer is: the HD-map ontology has no lane count. The concept exists, but in OpenLABEL's vocabulary, not where the maps are described. Keep that in mind for the end of the talk.</p>
  <p>Now imagine collecting those gaps across all users of a data space. That is user research nobody had to organize, in the users' own words. The expert still decides how to model each one, but the backlog writes itself, and every improvement flows back through the loop.</p>
  <p>[Cue: point to the three columns, then make a circular gesture for the loop. Transition: “And one more thing you saw: lineage.”]</p>
</SlideNotes>

<SlideNotes :index="12" title="Data lineage has never been easier." timing="14:00–15:00 · 60 seconds">
  <p>One more thing you saw: lineage. In a formal graph, a reference is not a string in a comment field. It is a typed link to another resource, declared in the asset's manifest.</p>
  <p>In the demo, one cut-in scenario in Frankfurt reached seven assets: the HD maps it uses, and an OSI sensor trace that points to the maps it was recorded on. Every one of them has a decentralized identifier. So lineage is not a feature we had to build. It is a graph walk: a query we run, as deep as you want to follow it.</p>
  <p>[Cue: follow the chain left to right. Transition: “Now the crown.”]</p>
</SlideNotes>

<SlideNotes :index="13" title="If we can search it, we can generate it." timing="15:00–16:30 · 90 seconds">
  <p>Now the crown. If we can search ontology-conform data, we can also create it. We run the same idea backwards.</p>
  <p>In search, words become slots and slots become SPARQL. In authoring, words become a scene: actors, a road, actions. Again a typed intermediate representation, never raw XML from the model. Application code lowers the scene into ASAM OpenSCENARIO XML.</p>
  <p>And the circle from earlier comes back. The scene is checked against SHACL shapes generated from ASAM's own OpenSCENARIO model. The document is validated against the official XML Schema by the open-source OpenSCENARIO API, compiled to WebAssembly and running inside the application. Residual rules check the scenario against the road. And esmini plays it back in the browser.</p>
  <p>This is where I believe the future is: artificial data that is valid by construction and described by the same ontology. The next step is to feed it back into the data space, where the same search can find it. Let me show you.</p>
  <p>[Cue: point to the two rows as mirror images. Transition: switch to the prepared authoring tab.]</p>
</SlideNotes>

<SlideNotes :index="14" title="Describe it. Get a valid OpenSCENARIO file." timing="16:30–20:30 · 4 minutes">
  <p>Switch to the authoring tab. Paste the prompt and submit it. While it streams, say: “The model fills a typed scene. It is not allowed to write XML.”</p>
  <p>Open the scene. Name the two vehicles and the actions, and point at the 30 metres I asked for. Read the summary: “Speed and lane-change timing I did not specify. The model chose them, and it tells me what it chose.” Name the road the scene is bound to.</p>
  <p>Open the gate results: “Three independent checks. Semantic, against ASAM's OpenSCENARIO shapes. Structural, against the official schema. Residual, against the road.” Point at the two skipped rules: “Skipped means not checked, and the tool says so.”</p>
  <p>Start the preview: “This is esmini, playing the generated file in the browser. The car ahead moves into my lane.” Then show the XML and download the .xosc: “A standard OpenSCENARIO file. Any compliant tool can open it.” Return to the deck.</p>
  <p>[Cue: at most 30 seconds of recovery if generation fails: resubmit once, then press → for the two recorded backup slides. If the demo ran live, press → three times to skip them. Transition: “Let me end with where this leads.”]</p>
</SlideNotes>

<SlideNotes :index="15" title="A cut-in on a highway: a vehicle 30 m ahead of the ego vehicle in the neighbouring lane changes into the ego's lane." timing="20:30–20:30 · backup, only if the live demo fails">
  <p>Recorded run. Say: “This is a recorded run of the same flow.” Scroll down: the interpretation, the scene with two vehicles, the validation gates with the two skipped rules, the OpenSCENARIO file, and the esmini preview at the bottom.</p>
  <p>[Cue: scroll the screenshot with the mouse wheel or trackpad.]</p>
</SlideNotes>

<SlideNotes :index="16" title="The generated scenario, played by esmini" timing="20:30–20:30 · backup, only if the live demo fails">
  <p>Recorded run. Say: “This is a recorded run of the same flow.” The recording of the esmini preview loops: the vehicle 30 metres ahead starts its lane change into my lane after two seconds.</p>
  <p>[Cue: scroll the screenshot with the mouse wheel or trackpad.]</p>
</SlideNotes>

<SlideNotes :index="17" title="Standardize in models, not in prose." timing="20:30–22:30 · 2 minutes">
  <p>Let me end with where this leads for standardization. Today, an ASAM OpenX standard is primarily a text document plus an XML Schema. Ontologies are derived afterwards, and every standard lives in its own silo. OpenSCENARIO, OpenDRIVE, OSI, OpenLABEL: each with its own idea of a road, a lane, a vehicle.</p>
  <p>Everything in this talk points to a different way. First, one overarching ASAM OpenX ontology, where a lane is the same concept whether it appears in a map, a scenario or a sensor trace. Second, standards are modelled, not written: agent-assisted, in formal models that the working group reviews like code. Third, open pipelines generate every artifact from that one source: the XML Schema, the OWL, the SHACL, the documentation. Text and schema can no longer drift apart.</p>
  <p>This is not hypothetical. We have taken ASAM's UML models for OpenSCENARIO and OpenDRIVE through ShapeChange and owl2shacl, regenerated the OpenSCENARIO XML Schema byte-identical from the model, and contributed fixes upstream to both tools. And because those ontologies are consistent, a real OpenSCENARIO file can be lifted into RDF completely, without a single hardcoded element name.</p>
  <p>That is the pipeline I would like us to build together, in the open.</p>
  <p>[Cue: left to right across the three columns; land on the byte-identical claim. Transition: “So, to bring it together.”]</p>
</SlideNotes>

<SlideNotes :index="18" title="Model. Generate. Validate. Translate. Create. Standardize." timing="22:30–24:00 · 90 seconds">
  <p>So, to bring it together. Formal modelling is old. What is new is that agents can write it with us, against specifications, while we stay in the loop. We close every loop with generators, example data and validators.</p>
  <p>Once the models are formal, decades of open-source tooling come for free. Language models do what they are best at: translating between our words and the formal language. Users show us what the ontology is still missing. Lineage comes straight from the graph. The same models let us generate valid synthetic data. And finally, we can do standardization itself this way.</p>
  <p>Formal models are the dictionary. LLMs are the translator. Agents close the loop, and humans stay in it.</p>
  <p>This work was created by BMW in SYNERGIES, funded by the European Union, and everything you saw is open source. If you work on a data space, an ontology, or an ASAM standard, bring your gaps, your models and your use cases. Thank you.</p>
  <p>[Cue: read the three thesis lines slowly, then stop talking. One minute of buffer remains before 25:00.]</p>
</SlideNotes>

<SlideControls />
</SlideProvider>
