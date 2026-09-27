---
title: Conference speaker guide
description: Storyline, timing, live-demo runbook and Q&A for the talk "Formal models are the dictionary. LLMs are the translator."
---

# Speaker guide: the dictionary and the translator

A 25-minute talk with two live demos: search and scenario authoring. The thesis fits in one sentence. **Formal models are the dictionary and the grammar, LLMs are the translator, and agents close the loop with humans in it.**

[Open the deck](./) · [Architecture appendix](./architecture) · [Authoring appendix](./authoring)

## Presenting

Serve the built site rather than the dev server:

```bash
pnpm --filter @ontology-search/docs build
pnpm --filter @ontology-search/docs preview --host 127.0.0.1 --port 5183
```

Open `http://127.0.0.1:5183/docs/slides/`. The deck loads no external images or fonts. Press **P** to open the presenter window. It shows the script and the planned clock, and its Previous/Next buttons also move the audience deck. Put the presenter window on the laptop and share only the audience window. Keyboard: Right/Space moves forward, Left moves back, Home jumps to the start and End to the close.

## Branding

The talk presents results that BMW created in the EU project SYNERGIES. It uses the ENVITED-X brand of the ASCS brand book (2025): Open Sans, uppercase headings, brand blue `#7891BB` with green `#60AC24` and navy `#111727`, and the ENVITED-X logo on the blue corner tab. Cards and chips use the ENVITED-X design system's tone tokens, re-toned to that palette. The SYNERGIES logo and the EU emblem are on every slide, and the EU funding disclaimer is on the first and last slides.

## The storyline

Nine messages, in four acts. Each slide makes one claim, and the notes carry the argument.

| Act          | Slide                     | Message                                                                                          | Evidence you can point to                                                                                                                                    |
| ------------ | ------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Opening      | 1 · Title                 | Formal models are the dictionary. LLMs are the translator.                                       | Everything that follows.                                                                                                                                     |
| I · Model    | 2 · 01 Modelling          | Formal modelling is decades old. Generators and agents fluent in it make it cheap.               | OMB `linkml/<domain>/<domain>.yaml` → `just generate` (gen-owl, gen-shacl, gen-jsonld-context).                                                              |
|              | 3 · 02 Human in the loop  | Agents do best against a specification. A model diff is something a human can review.            | Every OMB change is a reviewable Turtle or LinkML diff in a pull request.                                                                                    |
|              | 4 · 03 Closed loops       | Model → generator → artifacts → example data → validator → model.                                | OMB CI: LinkML artifacts must regenerate byte-identical; `tests/data/<domain>` holds valid and failing fixtures. Probe measurements are in `linkml/GAPS.md`. |
| II · Use     | 5 · 04 Leverage           | Formal data plugs into open source: graph databases, SPARQL, SHACL, GraphQL, JSON Schema.        | [Standards audit](../standards-audit): every boundary cites its specification. Oxigraph for development, Fuseki in production.                               |
|              | 6 · 05 Translation        | The LLM translates into typed slots. A deterministic compiler writes the SPARQL.                 | `packages/llm/src/prompt/compose.ts` (retrieved SHACL fragments), `slot-validator.ts`, `packages/search/src/compiler.ts`.                                    |
|              | 7 · **Demo: search**      | Show the translation, the gaps and the lineage live.                                             | The running app.                                                                                                                                             |
|              | 8–11 · Backup: search     | Recorded runs of the four search steps, scrollable.                                              | The recorded fallback.                                                                                                                                       |
|              | 12 · 06 Learn from users  | Gaps are user research for the ontology backlog.                                                 | `OntologyGapsDisplay.tsx`: gaps are unmapped, recognized or limitation.                                                                                      |
|              | 13 · 07 Lineage           | References are typed links, so lineage is a graph walk.                                          | `GET /api/traceability` (`apps/api/src/routes/traceability.ts`), `LineageExplorer.tsx`.                                                                      |
| III · Invert | 14 · 08 The inverse       | Search, run backwards, gives generation: words → scene → OpenSCENARIO → checks → playback.       | `scene-agent.ts`, `ir-to-engine.ts`, `run-scene-pipeline.ts`; engine pin in `packages/authoring-wasm/versions.json`.                                         |
|              | 15 · **Demo: authoring**  | Show the scene, assumptions, gates, preview and export live.                                     | The running app.                                                                                                                                             |
|              | 16–17 · Backup: authoring | Recorded authoring run and preview, scrollable.                                                  | The recorded fallback.                                                                                                                                       |
| IV · Future  | 18 · 09 Standardization   | One ASAM OpenX ontology; standards modelled with agents; open pipelines generate every artifact. | asam-openx-standards pipeline (UML → ShapeChange → OWL → owl2shacl → SHACL); OpenSCENARIO.xsd regenerated byte-identical.                                    |
| Close        | 19 · Close the loop       | Restate the thesis and invite people to contribute.                                              | The repositories.                                                                                                                                            |

## Timing

| Clock       | Slides    | Duration | Note                                      |
| ----------- | --------- | -------- | ----------------------------------------- |
| 0:00–1:00   | 1         | 1:00     | Say the thesis early.                     |
| 1:00–7:00   | 2–5       | 6:00     | 90 seconds each.                          |
| 7:00–8:30   | 6         | 1:30     | Ends with “Let me show you.”              |
| 8:30–12:30  | 7 · demo  | 4:00     | Hard stop at 12:30. Backups 8–11 follow.  |
| 12:30–15:00 | 12–13     | 2:30     | Refer back to what the audience just saw. |
| 15:00–16:30 | 14        | 1:30     | Ends with “Let me show you.”              |
| 16:30–20:30 | 15 · demo | 4:00     | Hard stop at 20:30. Backups 16–17 follow. |
| 20:30–24:00 | 18–19     | 3:30     | Land the thesis, then stop talking.       |
| 24:00–25:00 | –         | 1:00     | Buffer.                                   |

**If the slot is shorter.** For 20 minutes, cut each demo to 3 minutes and skip slide 13 (lineage is shown in the demo). For 15 minutes, drop slide 3 into slide 2's notes, show one search prompt only, and keep the authoring demo: it is the strongest moment.

Aim for about 110 spoken words per minute. The notes are drafts to speak from, not text to read out.

## Live demo runbook

Open two tabs before the talk: search at `http://localhost:5174/` and authoring at `http://localhost:5174/author`. Warm both up with one request each, because the first request after startup is slower. Keep the authoring prompt in the clipboard; it is too long to type on stage.

### Demo 1 · Search (8:30–12:30)

| Step | Prompt / action                                   | Show                                                    | Say                                                           |
| ---- | ------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------- |
| 1    | `motorway HD maps in Germany`                     | Interpretation: road type motorway, country DE; 19 maps | “This is the translation: values that exist in the ontology.” |
| 2    | Expand the GraphQL and SPARQL panels              | The compiled query                                      | “The model did not write this. The compiler did.”             |
| 3    | `HD-Karten von Autobahnen in Deutschland`         | The same two filters, the same 19 maps                  | “Same dictionary, another language.”                          |
| 4    | `motorway HD maps in Germany with potholes`       | The same 19 maps, plus “potholes” under Not in ontology | “Not silently dropped. Reported. That is my next slide.”      |
| 5    | `cut-in scenarios and the HD maps they reference` | First result card → Explore lineage: 7 assets reachable | “Everything this scenario depends on, through typed links.”   |

### Demo 2 · Authoring (16:30–20:30)

Prompt: `A cut-in on a highway: a vehicle 30 m ahead of the ego vehicle in the neighbouring lane changes into the ego's lane.`

| Step | Action                           | Show                                                       | Say                                                                    |
| ---- | -------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1    | Paste the prompt and submit      | The streaming pipeline                                     | “The model fills a typed scene. It may not write XML.”                 |
| 2    | Scene and interpretation         | Two vehicles, the 30 m offset, the speed and timing chosen | “What I did not specify, the model chose, and it tells me what.”       |
| 3    | Validation gates                 | Semantic, structural and residual pass; 2 skipped rules    | “Three independent checks. Skipped means not checked, and it says so.” |
| 4    | Preview, then XML, then download | esmini playback and the `.xosc` file                       | “A standard OpenSCENARIO file. Any compliant tool opens it.”           |

State the position in the prompt. Without it, the model sometimes starts the other vehicle behind the ego, and the lane change then happens behind it. That file still passes every gate, because the gates check form, not intent. If it happens live, say exactly that: it is the human-in-the-loop argument of slide 3.

The authoring road catalog holds one road, `german_highway_short.xodr`, with two driving lanes per direction. A request for three lanes still binds to it, so avoid lane counts in live prompts.

### Measured reliability

Measured on 27 September 2026 on the local stack with `claude-haiku-4-5` through `claude-cli`, three runs per prompt:

| Prompt                                            | Outcome                                          | Latency |
| ------------------------------------------------- | ------------------------------------------------ | ------- |
| `motorway HD maps in Germany`                     | 3/3 identical: 2 filters, 19 maps, no gaps       | ~3 s    |
| `HD-Karten von Autobahnen in Deutschland`         | 3/3 identical to the English prompt              | ~3 s    |
| `motorway HD maps in Germany with potholes`       | 3/3: 19 maps and one “potholes” gap              | ~5 s    |
| `cut-in scenarios and the HD maps they reference` | 3/3: 5 matches with references and lineage       | ~3 s    |
| Authoring prompt above                            | 3/3 valid, other vehicle 30 m ahead in every run | ~12 s   |

Avoid `Autobahnen mit Überholmanöver` and `German highways with 3 lanes` live. Both vary between runs: domains change, and one run in three returns no filters at all. Use them as spoken examples instead.

### When something fails

Resubmit once. Allow at most 30 seconds of visible recovery, then press → to the backup slides that follow the demo slide: four after the search demo, two after the authoring demo. Say “This is a recorded run of the same flow” and scroll each screenshot with the mouse wheel or trackpad, as in the browser. If the demo ran live, skip the backups: press → five times after the search demo and three times after the authoring demo. Never present a mocked or recorded output as live. If preview fails, continue with the scene, the gates and the exported file, and say that playback did not run.

## Before going on stage

1. `pnpm run check:setup`, then `pnpm dev`. Wait until `http://localhost:3003/health` returns 200. A healthy API does not prove that the model provider answers, so submit one real request.
2. Run every demo prompt once with the actual provider, browser and display.
3. Click through the backup slides once and scroll each screenshot, so the fallback is rehearsed too.
4. Load the deck and both app tabs. Test the presenter window on the venue display, check zoom and projector contrast, turn off notifications, and close terminals and unrelated tabs.

## Likely questions

- **Isn't this just an LLM writing SPARQL?** No. The model fills typed slots through one tool call. A deterministic compiler writes the SPARQL, so the same slots always give the same query. The model never has a path to the database.
- **Is the answer deterministic?** Compilation is deterministic for fixed ontology and compiler versions. Interpreting the sentence can vary between runs. That is why the interpretation and the gaps are shown before the results.
- **What about prompt injection?** Injection can change what is asked. It cannot change what runs: only compiled `SELECT` queries pass the policy gate, and writes, `SERVICE` and graph redirection are rejected.
- **Why not fine-tune a model on the ontology?** The ontology changes with every release. Retrieving the relevant SHACL at query time means a new release works without retraining. Any tool-calling model can do the translation, including local models.
- **How do you know the LinkML port matches the hand-written ontology?** It is measured, not assumed: adversarial instances are derived from every existing shape and we count how many the new shapes still catch. The remaining differences are listed per domain.
- **Does this work for other domains?** No domain names are hardcoded in the query path. Domains, properties and vocabularies are discovered from SHACL at startup. The claim is that a good ontology is enough to get this interface.
- **Why is lane count a gap?** The HD-map shapes describe lane types, not a lane count. The concept exists in OpenLABEL's operational-design-domain vocabulary. One overarching ASAM OpenX ontology would close exactly this kind of gap.
- **Which OpenSCENARIO version?** The engine pins XSD 1.3.0. ASAM's current release is OpenSCENARIO XML 1.4.0. Supporting it means updating the pinned engine and schema.
- **Does “valid” mean the scenario is safe?** No. It means the document passed the semantic and structural checks. Behaviour and safety need simulation-based evaluation, and ASAM itself notes that different simulators can produce different results from the same file.
- **Is ASAM doing this?** Not yet as a process. The model-based pipeline for OpenSCENARIO and OpenDRIVE is open work in progress on ASAM's published UML models, with fixes contributed to ShapeChange and owl2shacl. The proposal is to make it the way standards are produced.
- **Related work?** Ontology-grounded query generation: ClinSKOS-ICU (KG-LLM workshop, LREC 2026), which also separates entity extraction from deterministic query generation. Language-to-scenario generation: Talk2Traffic (CVPR Workshops 2025), TrafficAlign (CVPR 2026), TARGET (IEEE TSE 2025) and Txt2Sce (arXiv 2025).
