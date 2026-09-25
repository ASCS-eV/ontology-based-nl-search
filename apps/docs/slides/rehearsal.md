---
title: Conference rehearsal evidence
description: Recorded provider-run evidence, engineering decisions, and demonstration limits.
---

# Rehearsal evidence

**Status: recorded technical rehearsal.** On 24 September 2026, a clean browser submitted both prompts to the existing local application and configured provider, without request interception or mocked responses. Search, authoring, preview, and export completed. This is one observed run, not a reliability benchmark. A full spoken ten-minute rehearsal and physical-projector check remain pending.

[Conference deck](./) · [Speaker guide and demo](./conference) · [Research](./research)

## What was requested

- Search: “German highways with 3 lanes”.
- Author: “a cut-in on a three-lane highway”.

The search and authoring views use separate paths. No selected search road was passed to authoring. The existing API, web, and docs services were reused without restarting or changing their configuration.

## What the output contains

### Search: a narrower query than the summary suggested

The interpretation summary said “German highway assets with exactly 3 lanes.” The validated slots instead retained the map domain and only `country = DE`, with no numeric range. The response reported highway classification and lane count as unsupported; the attempted `numberOfLanes` range was not retained.

The observed result was **81 metadata matches out of 358 assets**. An inspected result contained `country: DE`; the returned fields did not establish lane count. These are not 81 verified three-lane highways. Asset identifiers, names, and account details are intentionally omitted here.

### Authoring: a valid file with an unmet road requirement

The returned scene contained two vehicles (`Ego`, `CutInVehicle`) and five actions. Both the scene and exported XML referenced `german_highway_short.xodr`. The pinned road catalog describes **two driving lanes per direction**; road 37 has travel-side driving lanes `-3` and `-4`, with `3` and `4` in the other direction. The interpretation summary nevertheless called it a three-lane highway.

Faithful typeset excerpt from the recorded scene, not a screenshot or fresh live output:

| Inspected item            | Recorded value                                    | Origin and limit                                                                                                  |
| ------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Bound road                | `german_highway_short.xodr`                       | Final bound scene and XML; raw selection versus catalog fallback is not established by this capture.              |
| Ego placement             | Road `37`, lane `-3`, longitudinal position `100` | Returned scene; not specified by the prompt.                                                                      |
| CutInVehicle placement    | Road `37`, lane `-4`, longitudinal position `150` | Returned scene; not specified by the prompt.                                                                      |
| Both initial speeds       | **25 m/s**                                        | Explicit scene values; model response also reports speed as an assumption.                                        |
| Maneuver start / duration | **2 s / 3 s**                                     | Explicit scene values; model response reports both as assumptions.                                                |
| Relative lane target      | `entityRef="Ego"`, `value="0"`                    | Exported XML targets Ego's lane. Its separate `targetLaneOffset="-1"` must not be described as a lane identifier. |
| Stop time                 | **10 s**                                          | Returned scene and emitted XML, not a measured demo duration.                                                     |

The speed/timing assumptions are in the stream's `meta.reportedGaps`; the visible scene displays their values. That does not mean every reported assumption is displayed as a warning in the current UI. Standard vehicle dimensions and other omitted fields may be supplied by lowering; do not call those model choices.

## What the checks established

| Observation            | Recorded outcome                                                           | What it does not establish                                                       |
| ---------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Semantic gate          | Pass; 0 gaps                                                               | Agreement with every natural-language requirement.                               |
| Structural gate        | Pass; 0 gaps                                                               | Correct engineering intent or safety.                                            |
| Residual geometry gate | Pass; 0 gaps; **2 skipped rules**                                          | That skipped simulation rules passed.                                            |
| Overall validity       | `true`, after **1 attempt**                                                | This verdict combines semantic and structural outcomes, not all residual checks. |
| Preview                | esmini reached `playing`; frames eight seconds apart show vehicle movement | Correctness across simulators or complete behavioral validation.                 |
| Export                 | `scenario.xosc`, **6,575 bytes**, byte-identical to the streamed XML       | A standalone simulator-ready asset bundle; the referenced road is also needed.   |

The skipped rule identifiers were:

- `envited-x.net:xosc:1.0.0:simulation.no_collision_at_scenario_start`
- `envited-x.net:xosc:1.0.0:simulation.reachable_target_within_horizon`

The page's “All gates passed” summary must be read alongside the residual chip's **skipped** marker. No start-collision or target-reachability success was established. No browser page errors or failed browser requests were recorded in this technical run.

## Engineering decision

**Reject this road for the requested three-lane test.** The requested road characteristic is explicit; the bound catalog road has two driving lanes per direction. Successful lowering, a Valid badge, playback, and export do not resolve that mismatch.

Treat the search results as country-filtered candidates requiring further evidence, not full matches to every requested criterion. Review the authored speed, timing, and duration as assumptions rather than user-approved conditions. The current UI does not provide an in-place scene or XML correction workflow, and this rehearsal did not demonstrate one.

This is a decision about this recorded artifact. A later live response may differ; inspect its actual values instead of narrating this recording's numbers over it.

## Provenance and timing

- Capture start: **2026-09-24 14:48:54 UTC** (16:48:54 Europe/Berlin).
- Checkout: `4e6b0bb10fa77892012c54e34df39e1fc8798cd2`, with the existing uncommitted conference documentation. Application runtime source was unchanged.
- Tracked dirty-diff SHA-256 at capture: `e0cc5503535e1acfc259f146dd8691d63ff4f46caa9b4e3f3880197524886a4a`. This identifies the tracked patch, not untracked files or secret environment contents.
- Configured provider: **`claude-cli`**; configured model: **`claude-haiku-4-5`**; no authoring-model override in the checked configuration. The application response does not include an independently attested provider model identifier.
- Ontology cache: `ontology-management-base` **0.5.0**; setup preflight passed without fetching a new ontology.
- Authoring engine: `RAC openscenario.api.test`, tag `v1.4.1-2-g292d0be8`, commit `292d0be84530145f7a09ae5a2a7f9bd63db7e3f3`; OpenSCENARIO **1.3**, XSD **1.3.0**.
- Viewer: esmini commit `77028d83e6d402de52f7187e5384d1b1c02b7d1f`, Emscripten **6.0.3**; Chromium software rendering for this browser capture.
- Road catalog source: ASAM OpenX assets at `cc27e09daccb06d816eba1dece8e4435fcc3b788` (MPL-2.0). Attribution: ASAM OpenX Data and Assets © Persival GmbH; OpenDRIVE authored with blender-driving-scenario-creator (Johannes Schmitz).

| Measured step                                    | Time                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| Search submit action → completed response stream | **11.643 s**                                                          |
| Search server-reported execution                 | **10.524 s**; a different measurement boundary                        |
| Search inspection finished                       | **30.408 s** from run start                                           |
| Independent Author view opened                   | **31.408 s** from run start                                           |
| Author submit action → completed response stream | **13.178 s**                                                          |
| Scene / gates inspected                          | **53.413 s / 58.846 s** from run start                                |
| Preview first inspected in playing state         | **59.011 s** from run start; not a measurement of first-frame latency |
| Download saved                                   | **68.144 s** from run start                                           |
| Automated technical sequence completed           | **74.207 s**                                                          |
| Saved video duration                             | **75.160 s**, silent, unedited browser recording                      |

These timings include automated UI interaction and short inspection pauses, not the presenter's spoken explanation. They show that the observed provider calls fit the allocated request windows, not that a human has completed the entire ten-minute talk-through or that future latency is guaranteed.

Artifact SHA-256 values:

- `scenario.xosc`: `08b509f5ea7469e98eb6809a5d31538a3612f5134a9fd39d074b984bca70dd54`
- `german_highway_short.xodr` (18,727 bytes): `0fc49721e782d6c3b84fc84c0eb0dcc72160902a2ee20dc99a033eb54a97d110`

## Capture boundaries

The source record and fallback recording are preserved locally in the gitignored directory `.playground/conference-rehearsal-2026-09-24/`: `manifest.json`, `technical-rehearsal.webm`, response events, scene/gate/preview captures, `scenario.xosc`, and its catalog `.xodr`. These local files are **not bundled or published with the documentation**. The raw recording includes returned asset metadata; review it before any public distribution. Provider-use approval is not approval to publish raw traces or recordings.

Only the minimal typeset excerpts above are included in the documentation. No raw HAR, credential, account detail, asset identifier, or private endpoint is included. The displayed XML file-header date is a deterministic writer value, not the capture date.

For recovery, open the local recording before presenting and identify it as a recorded technical run. Pause around 0:14 for search, 0:45–0:54 for the authored scene, 0:59 for gates/preview, and 1:08 for export. It has no narration; the presenter supplies the explanation. Rehearse the eight-minute core sequence aloud with two minutes reserved for recovery. After about thirty seconds of unproductive recovery, switch to the genuine recording and state what the live path did not establish.
