---
title: Conference speaker guide
description: A 15-minute talk and 10-minute demonstration of ontology-driven search and scenario authoring.
---

# Is this the scenario I meant?

Concept prepared on 24 September 2026 for Monday, 28 September. Working assumptions: English, a mixed automotive simulation and research audience, 15 minutes of speaking followed by 10 minutes of demonstration. This is a 25-minute slot without a separate Q&A allocation.

[Open the conference deck](./) · [Research and references](./research) · [Rehearsal evidence](./rehearsal)

**Technical rehearsal recorded.** Search, authoring, preview, and export completed with the configured provider on 24 September. Slides 4–6 use labeled excerpts from that run; the opening illustration and process diagram remain schematics. The [evidence record](./rehearsal) documents the actual values, road mismatch, skipped checks, and local fallback recording. A full spoken ten-minute rehearsal and physical-projector check remain pending.

For presentation, build the documentation and serve the built site:

```bash
pnpm --filter @ontology-search/docs build
pnpm --filter @ontology-search/docs preview --host 127.0.0.1 --port 5183
```

Open `http://127.0.0.1:5183/docs/slides/`. This serves the bundled presentation, including its local vector visuals and notes. The research links need internet access; the deck itself does not fetch external images or fonts. The live application and its model provider have separate runtime requirements.

## The story

An engineer asks for a highway cut-in. A file can be structurally valid without expressing the test they intended. The story follows the question **“It produced a scenario—but is it the one I meant?”** through two separate capabilities: searching asset metadata and authoring an OpenSCENARIO scenario.

The audience should leave with one idea: **inspect an explicit interpretation, understand the limits of its checks, then make an engineering decision.** The demo should connect one actual scene detail to an accept, reject, or investigate decision. Authoring is central to the talk and receives most of the demo time.

This is a prototype demonstration of a shared design pattern, not a completed end-to-end handoff or a novelty/performance claim. Search and authoring are separate views; authoring resolves its own catalog road. The audience sees this boundary on slide 2, before either capability is presented in detail.

## Timing and visual plan

| Slide                                                      | Clock       | Time  | Spoken purpose                                                   | Visual anchor                                                    |
| ---------------------------------------------------------- | ----------- | ----- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1. Is this the scenario I meant?                           | 0:00–1:30   | 1:30  | Establish the cut-in task and the question of intended behavior. | Labeled cut-in schematic.                                        |
| 2. Two capabilities. One engineering task.                 | 1:30–3:30   | 2:00  | Disclose the two independent app paths.                          | Parallel Search and Author panels; visible no-handoff boundary.  |
| 3. Make the interpretation inspectable.                    | 3:30–5:30   | 2:00  | Explain the model/compiler boundary using one request.           | Words → explicit criteria → compilation.                         |
| 4. Why did this asset match?                               | 5:30–7:30   | 2:00  | Contrast the requested criteria with the country-only query.     | Recorded excerpt: 81 matches, but no lane-count filter.          |
| 5. What did the model decide?                              | 7:30–9:30   | 2:00  | Reject a road that fails the requested three-lane condition.     | Three requested lanes versus two driving lanes per direction.    |
| 6. Valid structure is not verified intent.                 | 9:30–11:30  | 2:00  | Show actual passes, skipped rules, playback, and the decision.   | Four equal-level observations; valid file does not fix the road. |
| 7. What this prototype demonstrates—and what remains open. | 11:30–13:30 | 2:00  | State contribution, related research, and evaluation limits.     | Implemented capabilities versus evaluation questions.            |
| 8. Judge the demo on three questions.                      | 13:30–15:00 | 1:30  | Give the audience observable criteria for the demo.              | Interpretation, checks, decision.                                |
| Live demonstration                                         | 15:00–25:00 | 10:00 | Inspect two capabilities and one concrete engineering decision.  | Eight-minute core sequence; two-minute recovery reserve.         |

Slides 4–6 contain faithful typeset excerpts from the recorded run, not screenshots or fresh live output. The evidence page records their provenance and limits. The opening road illustration and process diagram remain explanatory schematics. Large assertion headlines carry one idea each; the argument belongs in the notes. The separate [authoring technical deck](./authoring) is an older appendix, outside the 15-minute story; consult the current research brief for its claim/version caveats.

## Speaker notes and rehearsal

Full spoken notes, stage cues and cumulative timing are embedded in all eight slides. Press **P**, or use **Presenter notes**, to open a separate presenter window. Its Previous/Next controls and arrow keys advance the audience deck too. Keep the presenter window on the laptop and share only the audience window on the projector. This requires an extended display or sharing a specific window; screen mirroring shows both windows when switched.

Use Right/Space and Left to navigate the deck, Home to return to the opening, and End to jump to the demo handoff. Allow the local site to open a popup if the browser blocks the notes window. The popup shows planned timing, not an elapsed-time stopwatch; use a separate timer. The complete script is also readable in the source at `apps/docs/slides/index.md` inside the `SlideNotes` elements.

Rehearse around 105–120 spoken words per minute, leaving room to point at a diagram and pause. The notes are a spoken draft, not a measured duration or an instruction to fill every second. The hard milestone is entering the application at 15:00. If behind, keep the engineering decision and shorten the research discussion; omit query-editor exploration from the demo.

## Ten-minute demonstration

Use the existing running environment and configured provider. The default local web URL is `http://localhost:5174/`; authoring is `/author`. The docs default to `http://localhost:5173/docs/slides/`. Deployment hosts and configured ports may differ; open both app views in advance instead of relying on hardcoded links from the deck.

| Demo clock | Action                                                                           | Say / establish                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–2:00  | Submit **German highways with 3 lanes**; compare interpretation with one result. | “What criteria were preserved, and which metadata supports this match?” No fixed result count.                                         |
| 2:00–2:30  | Switch to Author.                                                                | “This separate path uses its own road catalog; the search result is not carried over.”                                                 |
| 2:30–4:30  | Submit **a cut-in on a three-lane highway**; inspect the returned scene.         | Identify actors, actions, and the actual bound road. Do not anticipate unobserved values.                                              |
| 4:30–5:30  | Inspect one actual scene detail and state a decision.                            | “The request specified X; the output contains Y; I accept, reject, or investigate it because Z.” Use only a genuine rehearsed example. |
| 5:30–6:30  | Open individual gate results and gaps.                                           | “Reference and structural checks determine Valid; geometry is separate. Skipped means unchecked.”                                      |
| 6:30–7:30  | Preview, inspect the XML, and export.                                            | State what behavior was actually observed and identify the scenario's road dependency.                                                 |
| 7:30–8:00  | Close with the result and next evaluation.                                       | “What did we establish, and what remains my engineering responsibility?”                                                               |
| 8:00–10:00 | Reserve for loading, transitions, and recovery.                                  | This is contingency time, not an extra feature tour.                                                                                   |

Both exact prompts were submitted in the recorded technical rehearsal. Search took 11.643 seconds and authoring 13.178 seconds from the browser's submit action to completed response stream. These are one-run observations, not latency guarantees. The author-viewer E2E test separately mocks its stream; it is not the source of this evidence. The current page does not expose iterative scene refinement or an XML editor, so neither appears in this demonstration. Do not invent a deliberate invalid-edit step in the live UI.

The recorded inspection example is concrete: search retained only `country = DE` and returned 81 metadata matches, while authoring bound `german_highway_short.xodr`, which has two driving lanes per direction despite the three-lane request. Reject that road for this test. The scene also contains 25 m/s initial speeds, a 2 s start and a 3 s lane-change duration, explicitly reported as model assumptions. Do not attribute the bound-road selection itself to the model; the final scene does not distinguish raw selection from catalog fallback.

The recorded semantic and structural gates passed. Residual geometry displayed pass with two skipped simulation rules. Hover the skipped chip to inspect the rule names; the headline “All gates passed” does not establish those checks. Preview played and the downloaded XML matched the streamed output. In a new live run, inspect the values actually returned instead of assuming this recording will repeat.

The technical sequence lasted 74.207 seconds; the silent recording lasts 75.160 seconds. This automated walkthrough does not establish human presentation pacing. Keep the eight-minute core plus two-minute reserve, and rehearse the explanation aloud.

## Before Monday

1. Run `pnpm run check:setup` with the pinned `.ontology/` cache available. Use the existing services if already running. The root `pnpm dev` script cleans configured service ports; for a fresh isolated startup, see the repository quick-start instructions.
2. Check `http://localhost:3003/health` at the configured API port. Review warnings privately: a healthy response alone does not prove that the chosen LLM or a separate authoring model is available.
3. Rehearse both exact prompts with the actual provider, model, road catalog, browser and display. Confirm actors/actions, resolved road, gate results, visible motion, and the downloaded file. Record latency rather than guessing how long to narrate generation.
4. Check the `.xosc` references the expected catalog road. Keep the corresponding `.xodr` available for any external simulator. A standalone `.xosc` download is not a complete asset bundle.
5. Open the existing fallback before presenting: `.playground/conference-rehearsal-2026-09-24/technical-rehearsal.webm`. The same local directory holds the scene/gate/preview captures, `scenario.xosc`, and matching `german_highway_short.xodr`. These are gitignored and not deployed with the docs. Review returned asset metadata before public distribution; keep raw traces private.
6. Load the deck and both app tabs in advance. Test presenter-popup placement, browser zoom and projector contrast. Disable notifications and keep credentials, terminals and unrelated tabs off the shared screen.

## Failure and time budget

If a live request errors or exceeds its rehearsed budget, allow at most about 30 seconds of visible recovery. Switch to the saved recording and say, “This is a recorded run of the same workflow.” Walk through the saved interpretation, checks and artifact. Never present the mocked browser-test stream as a live generation result.

Use the silent local recording with your own narration. Pause around 0:14 for search, 0:45–0:54 for scene inspection, 0:59 for gates/preview, and 1:08 for export. It records genuine provider responses, but the three-lane requirement was not fulfilled; retain that engineering conclusion when presenting the fallback.

If no recording has been prepared, use the deck schematics and state that the live path is unavailable. A saved XML file may be inspected in an editor, but this UI does not provide an arbitrary-file import workflow. If preview fails, continue with the scene, gate results and exported file, and say that playback has not been shown successfully.

## Likely questions

- **Is this GraphRAG?** It is schema-driven structured retrieval: the model emits slots and a compiler produces SPARQL. Describe that mechanism rather than adopting a broader label that obscures it.
- **Is the result deterministic?** The compilation of the same validated structure is deterministic under fixed schema/compiler versions. Natural-language interpretation can vary.
- **Is it safe against every prompt attack?** The typed contract and query policy restrict the executable path. They do not prove correct interpretation or universal security.
- **Can I use the latest OpenSCENARIO version?** This checkout pins XSD 1.3.0. ASAM's current release is 1.4.0; support requires separate verification and an engine/schema update.
- **Does Valid mean the scenario is safe?** It summarizes semantic and structural checks. Inspect residual findings and skipped rules separately, and evaluate behavior and safety with appropriate downstream methods.
- **Does search feed authoring automatically?** Not yet. They are complementary views in this prototype; authoring binds its own catalog road.
- **What would you measure next?** Interpretation correctness, unsupported-request handling, success in a fixed simulator, agreement with expert intent, latency, and engineer task completion against the existing workflow.
