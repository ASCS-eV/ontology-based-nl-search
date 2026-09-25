---
layout: page
pageClass: slide-page conference-page
title: Is this the scenario I meant?
---

<script setup>
import RoadSketch from '../.vitepress/theme/components/RoadSketch.vue'
import '../.vitepress/theme/conference.css'
</script>

<SlideProvider :total-slides="8">
<SlideDeck>

<Slide :index="0" variant="title">
  <p class="eyebrow">ENVITED-X · Search + scenario authoring</p>
  <h1>Is this the <span class="accent">scenario I meant?</span></h1>
  <RoadSketch />
  <p class="takeaway">A highway cut-in. An engineering decision.</p>
</Slide>

<Slide :index="1">
  <p class="eyebrow">The prototype boundary</p>
  <h2>Two capabilities.<br />One engineering task.</h2>
  <div class="demo-routes" aria-label="Two independent paths, not a connected asset handoff">
    <div class="demo-route"><strong>Search</strong><small>Ask about existing assets</small><small>Inspect matching metadata</small></div>
    <div class="demo-route"><strong>Author</strong><small>Describe a new scenario</small><small>Uses its own road catalog</small></div>
  </div>
  <p class="takeaway">Separate paths today; no selected-road handoff.</p>
</Slide>

<Slide :index="2">
  <p class="eyebrow">The design principle</p>
  <h2>Make the interpretation inspectable.</h2>
  <div class="pipeline" aria-label="Schematic: German highways with three lanes becomes explicit criteria before compilation">
    <div><strong>Your words</strong><small>“German highways with 3 lanes”</small></div>
    <span class="flow-arrow" aria-hidden="true">→</span>
    <div class="intent-box"><strong>Explicit criteria</strong><small>Supported filters + gaps</small></div>
    <span class="flow-arrow" aria-hidden="true">→</span>
    <div><strong>Compile</strong><small>From checked structure</small></div>
  </div>
  <p class="takeaway">Inspect the interpretation before trusting the result.</p>
  <p class="source-line">Schematic · the model interprets; application code compiles.</p>
</Slide>

<Slide :index="3">
  <p class="eyebrow">01 / Find</p>
  <h2>Why did this asset match?</h2>
  <div class="search-proof" aria-label="Excerpt from recorded run: only the country criterion survived validation">
    <div><strong>I asked</strong><small>Germany</small><small>Highway · 3 lanes</small></div>
    <div><strong>It retained</strong><small>Country = DE</small><small>No lane-count filter</small></div>
    <div><strong>I received</strong><small>81 metadata matches</small><small>Not 81 three-lane roads</small></div>
  </div>
  <p class="takeaway">A metadata match is a candidate—not a certified map.</p>
  <p class="source-line">Excerpt from recorded run · 24 Sep 2026 · <a href="./rehearsal" target="_blank" rel="noopener noreferrer">Evidence + limits</a></p>
</Slide>

<Slide :index="4">
  <p class="eyebrow">02 / Create</p>
  <h2>What did the model decide?</h2>
  <p class="takeaway">“A cut-in on a three-lane highway.”</p>
  <div class="demo-routes" aria-label="Excerpt from recorded run: requested three lanes versus two driving lanes per direction on the bound road">
    <div class="demo-route"><strong>I requested</strong><small>Cut-in maneuver</small><small>Three-lane highway</small></div>
    <div class="demo-route"><strong>The bound road</strong><small>2 driving lanes / direction</small><small>Decision: reject this road</small></div>
  </div>
  <p class="source-line">Excerpt from recorded run · <a href="./rehearsal" target="_blank" rel="noopener noreferrer">Recorded evidence</a> · OpenSCENARIO XSD 1.3.0.</p>
</Slide>

<Slide :index="5">
  <p class="eyebrow">03 / Inspect</p>
  <h2>Valid structure is not verified intent.</h2>
  <div class="evidence-steps check-grid" aria-label="Four separate observations, not a ladder to safety assurance">
    <div><strong>Reference integrity</strong><span>Semantic gate: pass</span></div>
    <div><strong>Document structure</strong><span>Structural gate: pass</span></div>
    <div><strong>Road geometry</strong><span>Pass; 2 rules skipped</span></div>
    <div><strong>Playback</strong><span>Playing; XML exported</span></div>
  </div>
  <p class="takeaway">Valid file. Wrong road for this request.</p>
  <p class="source-line">Excerpt from recorded run · Skipped ≠ checked. Valid ≠ safe. <a href="./rehearsal" target="_blank" rel="noopener noreferrer">Check scope</a></p>
</Slide>

<Slide :index="6">
  <p class="eyebrow">Contribution + evaluation</p>
  <h2>What this prototype demonstrates—and what remains open.</h2>
  <div class="demo-routes" aria-label="Implemented capabilities versus questions requiring evaluation">
    <div class="demo-route"><strong>Implemented</strong><small>Inspectable search</small><small>Scene → checked file</small></div>
    <div class="demo-route"><strong>Still to evaluate</strong><small>Intent agreement</small><small>Engineer task outcomes</small></div>
  </div>
  <p class="source-line">Research-informed design: ClinSKOS-ICU · Talk2Traffic · TrafficAlign. <a href="./research" target="_blank" rel="noopener noreferrer">Research brief</a></p>
</Slide>

<Slide :index="7" variant="cta">
  <p class="eyebrow">Live demonstration · 10 minutes</p>
  <h2>Judge the demo on three questions.</h2>
  <div class="evidence-steps" aria-label="Three questions for judging the demonstration">
    <div><strong>Interpretation</strong><span>What was understood?</span></div>
    <div><strong>Checks</strong><span>What was established?</span></div>
    <div><strong>Decision</strong><span>What must I review?</span></div>
  </div>
  <p class="takeaway">Search and authoring: two separate app views.</p>
  <p class="source-line"><a href="./conference" target="_blank" rel="noopener noreferrer">Demo runbook + rehearsal guide</a></p>
</Slide>

</SlideDeck>

<SlideNotes :index="0" title="Is this the scenario I meant?" timing="0:00–1:30 · 90 seconds">
  <p>Imagine asking an assistant for a highway cut-in scenario. A vehicle changes into the lane ahead of the ego vehicle. A file appears, and perhaps a preview runs. We have produced something. But have we produced the test we actually meant?</p>
  <p>The drawing is a schematic, not a generated result. It leaves important questions unanswered: which road, which actors, and which initial conditions? A short request cannot settle every engineering choice. The interesting question is whether we can see the choices that were made before deciding to use the result.</p>
  <p>This prototype explores two places where that matters: discovering simulation assets and authoring an OpenSCENARIO scenario. In both, language becomes an explicit representation that the application can process and the engineer can inspect.</p>
  <p>For fifteen minutes, I will explain that boundary using this cut-in task. Then we will spend ten minutes in the application. Keep one question in mind: is this the scenario I meant?</p>
  <p>[Cue: point to the two vehicles; identify the drawing as a schematic. Transition: “First, here is exactly what the prototype connects—and what it does not.”]</p>
</SlideNotes>

<SlideNotes :index="1" title="Two capabilities. One engineering task." timing="1:30–3:30 · 2 minutes">
  <p>An engineer preparing this test has two different questions. What suitable assets already exist? And how can I describe the maneuver I want to create? The prototype supports both questions, through separate application views.</p>
  <p>On the left is search. It interprets a request against the vocabulary used to describe simulation assets. Our reference deployment uses ENVITED-X metadata. I can ask for German highways with three lanes, then inspect the criteria and matching metadata.</p>
  <p>On the right is authoring. It interprets a scenario description, creates a structured scene, and produces an OpenSCENARIO document through the application’s engine. It resolves a road from its own curated catalog.</p>
  <p>The boundary on the slide is important: selecting a search result does not carry that road into authoring. These are two capabilities for the same engineering task, not a completed end-to-end asset handoff. That missing connection is an integration opportunity, not something I will pretend the demo already does.</p>
  <p>What connects the two today is the design question. Can an engineer compare their words with the system’s explicit interpretation, rather than judge only the final answer? That is the contribution we can inspect here.</p>
  <p>[Cue: point to the parallel panels, then read the handoff disclosure once. Transition: “The useful boundary is between interpretation and compilation.”]</p>
</SlideNotes>

<SlideNotes :index="2" title="Make the interpretation inspectable." timing="3:30–5:30 · 2 minutes">
  <p>Consider the request on the left: German highways with three lanes. The center shows supported filters and gaps, not a promise that every word becomes a filter. This is a schematic of the process, not a screenshot of a model response. We compare the interpretation with the sentence before relying on the result.</p>
  <p>The ontology supplies the vocabulary and relationships the search pipeline understands. Constraints describe what values and structures are allowed. Technically, the search path reads OWL and SHACL, and the application compiles the checked search representation into SPARQL. The model does not write that query directly.</p>
  <p>Authoring applies a related pattern to actors and actions. The model submits a scene representation; application code lowers it into the engine’s document structure. It does not ask the model to write the final XML. The two paths share a design principle, not an identical implementation.</p>
  <p>This boundary gives us something concrete to test. Under fixed schema and compiler versions, the same validated structure produces the same compilation. Repeating the sentence can still produce a different interpretation. And a supported value can still be the wrong choice for my request.</p>
  <p>[Cue: compare the sentence with supported filters and gaps. Transition: “Here is what happened when we actually made that request.”]</p>
</SlideNotes>

<SlideNotes :index="3" title="Why did this asset match?" timing="5:30–7:30 · 2 minutes">
  <p>This is an excerpt from a real recorded run, not an idealized example. I asked for German highways with three lanes. The interpretation summary described exactly that. But the validated criteria retained only country equals DE, within the map domain. Highway classification and lane count were reported as unsupported.</p>
  <p>The application returned eighty-one metadata matches. That does not mean eighty-one three-lane highways. A displayed result had country DE, which supports the retained country filter; its returned fields did not establish the requested lane count. The count describes this dataset and this run, not a promise for the next request.</p>
  <p>Here is the engineering decision: treat these as candidates, not as answers satisfying the entire sentence. Before choosing a road for my test, I need evidence for the criteria the query could not represent. A confident summary is not a substitute for that evidence.</p>
  <p>This is why the explicit structure matters. It lets me compare the request, executable criteria, reported gaps, and returned metadata. The boundary remains metadata retrieval, not independent verification of road geometry or simulator suitability. And none of these search results is automatically transferred into authoring.</p>
  <p>[Cue: contrast the request with country-only filtering and 81 matches. Transition: “The authoring run exposed an equally concrete boundary.”]</p>
</SlideNotes>

<SlideNotes :index="4" title="What did the model decide?" timing="7:30–9:30 · 2 minutes">
  <p>Now the real authoring request: a cut-in on a three-lane highway. The recorded output contained two vehicles and five actions. It supplied a speed of twenty-five meters per second, a two-second start time, and a three-second lane-change duration. The model also reported those unspecified values as assumptions. They are actual returned scene values, not values invented for this slide.</p>
  <p>But the more decisive detail is the road. The scene and exported file reference german highway short. Its pinned catalog geometry has two driving lanes per direction, not the three requested. The interpretation summary nevertheless called it a three-lane highway.</p>
  <p>My decision is to reject this road for the requested test. I can inspect the generated maneuver, but I cannot approve the artifact as satisfying that road requirement. The final scene shows the bound road; it does not establish whether the raw model selected it or catalog fallback supplied it. I will not attribute that choice without evidence.</p>
  <p>The application generated a document with its pinned XSD 1.3.0 engine, and the preview and export worked. Those successes matter, but they do not remove the mismatch. This page supports inspection, not an in-place scene or XML correction workflow.</p>
  <p>[Cue: compare three requested lanes with two catalog driving lanes per direction. Transition: “The validation badge was green. Here is exactly what that meant.”]</p>
</SlideNotes>

<SlideNotes :index="5" title="Valid structure is not verified intent." timing="9:30–11:30 · 2 minutes">
  <p>In the recorded run, semantic and structural checks passed on the first authoring attempt. The overall badge said Valid. Reference integrity concerns relationships inside the representation. Document structure concerns the emitted file and pinned engine. Neither checked that the road fulfilled the three-lane request.</p>
  <p>The residual gate also displayed pass, but marked two simulation rules as skipped: collision at the start and reaching the target within the time horizon. Zero reported gaps is not evidence that those rules passed. The overall Valid value combines semantic and structural outcomes; residual findings are separate. Read the individual outcomes and skipped markers, not just the headline.</p>
  <p>The esmini preview entered playing state, and the two captured frames showed moving vehicles. The downloaded XML matched the emitted response. That establishes playback and export in this environment, not universal behavior, absence of collisions, or intended scenario correctness. ASAM also cautions that results can differ across simulators.</p>
  <p>These observations are separate pieces of evidence, not a ladder to safety. The road mismatch remains. My decision is therefore unchanged: do not accept this as the requested three-lane test. Inspection has made the reason concrete and auditable, even though the file is valid.</p>
  <p>[Cue: point to the four equal-level checks, then the human decision below. Transition: “What can we claim from this prototype, and what still needs an experiment?”]</p>
</SlideNotes>

<SlideNotes :index="6" title="What this prototype demonstrates—and what remains open." timing="11:30–13:30 · 2 minutes">
  <p>What does this work add? It implements two concrete applications of the same controlled-generation pattern for simulation engineers: ontology-driven asset search, and scene-based OpenSCENARIO authoring with visible checks. The interfaces expose representations and artifacts. Whether that makes engineering work faster or more accurate is a separate evaluation question.</p>
  <p>Recent research supports the design choices. ClinSKOS-ICU, in the 2026 KG-LLM workshop proceedings, studies ontology-grounded query generation in a different domain. Talk2Traffic, at the 2025 CVPR workshops, uses structured representations and interactive feedback for scenario generation. TrafficAlign, at CVPR 2026, studies traffic-scenario generation with validation and model alignment.</p>
  <p>Those are precedents, not results we inherit. Talk2Traffic’s interactive editing is not a feature claim about this page, and TrafficAlign’s evaluation is not an evaluation of our prototype. The research brief gives the full sources and differences.</p>
  <p>The next experiment should use fixed schema and catalog versions and expert-defined requests. Measure agreement with intended meaning, unsupported-request handling, execution in a specified simulator, latency, and engineer task outcomes. Compare against the existing workflow. Today’s demonstration is a worked example of what can be inspected, not a claim that those measurements have already been completed.</p>
  <p>[Cue: distinguish implemented capabilities from evaluation questions; give only one sentence per research strand. Transition: “Here are the three questions to judge the demonstration by.”]</p>
</SlideNotes>

<SlideNotes :index="7" title="Judge the demo on three questions." timing="13:30–15:00 · 90 seconds">
  <p>Keep the cut-in task in mind as we open the application. First, we will search for assets and compare one result with the interpreted request. Then we will switch to the independent authoring view. The selected search road is not passed across; authoring uses its own catalog.</p>
  <p>Judge what follows by three questions. What was understood? What did the checks actually establish? And what remains an engineering decision? In authoring, I want to connect one visible detail in the output to that final question, then inspect the gates, preview, and exported file.</p>
  <p>We have ten minutes, including room for loading and recovery. If the live path becomes unavailable, I have a genuine recording of the technical rehearsal. I will identify it as recorded, pause at the relevant evidence, and distinguish its observed values from whatever the live run returns.</p>
  <p>The proposition is modest and testable: make the interpretation and its limits visible enough to support the next decision. Let us see what the application exposes.</p>
  <p>[Cue: switch to the prepared search tab at 15:00. Follow the eight-minute core demo with two minutes reserved for recovery. Keep authoring and the engineering decision; omit query-editor exploration if behind.]</p>
</SlideNotes>

<SlideControls />
</SlideProvider>
