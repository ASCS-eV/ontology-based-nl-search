# Implementation plan — OpenSCENARIO API coverage & qc-framework alignment

Status: proposed · Branch: `claude/open-scenario-api-cpp-coverage-x6c5je`

## Why

Two independent findings drive this plan.

**1. The pinned RAC engine ships far more than the authoring feature uses.**
`packages/authoring-wasm` compiles the RA Consulting `openscenario.api.test` C++
API, but `validate()` wires only the checkers the loader wires by default. Range
rules, union rules, the version rule, catalog resolution and injected parameters
are all compiled into the artifact and never invoked. Verified against the
committed `wasm/osc-engine.wasm`:

| Probe                                             | Result                                                                |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| `maxSpeed="-5"`, `maxSteering="99"`, `width="-3"` | `ok=true` — the 60 `RangeCheckerRules` never run                      |
| `revMinor="9"`                                    | `ok=true` — `VersionCheckerRule` unwired                              |
| Dangling `<CatalogReference>`                     | `ok=true` — `validate` uses the plain loader, not the _Import_ loader |
| Same + a staged companion catalog file            | `ok=true` — the documented `files` option is inert for catalogs       |

Writer coverage is 49 of 295 writer types; the IR lowering understands four
action kinds and emits at most one maneuver.

**2. The gates claim ASAM qc rule identities they do not have.**
`asam.net:xodr:1.7.0:road.geometry.continuity` is not in the published
`qc-opendrive` rule list (23 rules; nearest real ones are the `parampoly3_*`
family and `lane_smoothness_contact_point_no_horizontal_gaps`), yet
`qc-rules.ts` presents it as `[QC-XODR]` transcribed verbatim and
`RESIDUAL-QC.md` calls it canonical. `semantic-gate.ts` describes the bundles as
"submodule-vendored"; they are not vendored at all.

Against `qc-openscenarioxml`'s 16 rules the repo covers roughly 7–8. Two of the
misses (`non_negative_transition_time_in_light_state_action`,
`positive_duration_in_phase`) are already implemented inside the binary as range
rules.

## Non-goals

- Reimplementing the qc bundles in TypeScript. Where a bundle rule is not
  covered, the answer is to **run the bundle** (Phase 3), not transcribe its UID.
- Full 295-type writer coverage. Phase 2 widens the archetype; a model-generated
  writer facade is a separate, later slice.

## Constraints

- **Criterion #30** — every fix carries a regression test that fails before it.
- **Criterion #31** — cite the governing standard inline (`[OSC-XSD] §x`,
  `[QC-XOSC]`, …).
- **Ontology-name budget is monotonically decreasing.** Phases 0, 1 and 3 add
  zero ontology-specific identifiers. Phase 2's condition work is the one place
  at risk — drive it from SHACL discovery, never from literals.
- Phase 1 changes the C++ embind surface, so it needs one WASM rebuild
  (`native/BUILD.md`) and a `wasm/osc-engine.wasm.sha256` bump. Batch the whole
  phase into a single artifact bump.

---

## Phase 0 — make the claims true

Accuracy defects. No engine rebuild.

### 0.1 Correct the fabricated OpenDRIVE rule UID

- `packages/authoring-gate/src/qc-rules.ts` — either re-tag
  `geometryContinuity` as a cross-file/extension UID (reuse the honest pattern
  already used by `resolvableRoadReference`) or map it to the real
  `lane_smoothness_contact_point_no_horizontal_gaps`.
- Fix the "transcribed verbatim" / "submodule-vendored" wording in
  `qc-rules.ts`, `semantic-gate.ts`, `RESIDUAL-QC.md`,
  `docs/specs/references/README.md`.

### 0.2 Pin the bundle rule lists and gate on them

The durable fix: make UID drift impossible rather than correcting it once.

- Vendor the `qc-openscenarioxml` / `qc-opendrive` rule lists (submodule pin or
  a checked-in manifest, matching the discipline of `verify-checksum.mjs`).
- CI gate: every UID emitted by `QC_RULES` must exist in the pinned list, or be
  explicitly marked as a repo extension.

**Test** — a unit test asserting each non-extension UID resolves against the
pinned list; fails today on `geometryContinuity`.

### 0.3 Remove or implement the inert catalog claim

`packages/authoring-wasm/README.md:28` and the `AuthoringValidateOptions.files`
docstring both describe companion catalogs as participating in validation. They
do not. Correct the docs now; Phase 1.3 makes the claim true.

---

## Phase 1 — harvest what the artifact already contains

Best coverage-per-line in the plan. One rebuild for the whole phase.

### 1.1 Wire the range checker rules

`native/osc_engine_embind.cpp` — after a clean load, register
`RangeCheckerHelper::AddAllRangeCheckerRules` on a `ScenarioCheckerImpl` and run
`CheckScenarioInFileContext`. 60 model-derived rules for a few lines of C++.

Closes `non_negative_transition_time_in_light_state_action` and
`positive_duration_in_phase` outright, and aligns the runtime checker with the
`sh:minInclusive`/`sh:maxInclusive` bounds `artifacts/openscenario/DERIVATION.md`
transcribes by hand from the _same_ source file.

**Test** — negative `maxSpeed` and out-of-range `maxSteering` must produce
`severity: 'error'`. Both currently pass.

### 1.2 Wire the union and version rules

Union rules enforce `xsd:choice` exclusivity; `VersionCheckerRule(1, 3)` rejects
a document declaring a version this build does not implement.

**Test** — `revMinor="9"` must fail. Currently passes.

### 1.3 Resolve catalogs

Switch `validate` from `XmlScenarioLoaderFactory` to
`XmlScenarioImportLoaderFactory`, pass a catalog message logger, and merge its
diagnostics into the returned set. Makes `EngineFiles` functional and opens
`parameters.valid_parameter_declaration_in_catalogs`.

**Test** — a dangling `<CatalogReference>` fails; the same reference resolves
when the catalog is supplied via `files`.

### 1.4 Thread injected parameters

`validate(mainPath)` hardcodes an empty parameter map. Accept a
`Record<string, string>` through `OscEngine.validate` → `AuthoringBackend`.

**Test** — a scenario whose declaration is overridden by an injected value
validates against the injected value.

---

## Phase 2 — stop the silent drops

The only wrong-answer bug in the plan. No rebuild for 2.1.

### 2.1 Report what the lowering cannot express

`irToEngineTree` drops unrecognised action kinds (`default: break`,
`ir-to-engine.ts:209`) and every maneuver after the first (`maneuver ??=`,
line 207). Nothing reports it: the semantic gate checks refs/uniqueness/roads,
and the structural gate validates the emitted document — which is valid
precisely because the action is missing. The pipeline returns `valid: true`.

This contradicts the feature's own contract in two places: `scene-tool.ts`
("gaps … never drop silently") and `scene-prompt.ts` ("Report anything you
cannot express as a gap"). The LLM is asked to self-report, but the _lowering_
is what knows.

- `irToEngineTree` returns the dropped actions alongside the tree.
- `runScenePipeline` emits one rule-attributed `SceneGap` per drop, so the
  repair loop can act on it.

**Test** — an IR with two `LaneChangeAction`s and one `AcquirePositionAction`
yields gaps and `valid: false`. Today: `valid: true`, one maneuver, no gap.

### 2.2 Widen the archetype

- Multiple events / maneuvers rather than one.
- Entity-based trigger conditions (`TimeHeadway`, `RelativeDistance`) — today
  only `SimulationTimeCondition` exists, which is not how a cut-in is triggered
  in practice.
- `stopTime` from the IR instead of the hardcoded `30` (`ir-to-engine.ts:237`).

Keep the condition vocabulary SHACL-discovered — this is the budget-sensitive
step.

---

## Phase 3 — interoperate instead of reimplementing

### 3.1 Emit `.xqar`

Gaps already carry a rule UID and line/col, so the mapping to
`<CheckerResults><CheckerBundle><Checker><Issue><Locations><FileLocation row
column>` is direct. A small adapter in `packages/authoring-gate` makes the
output consumable by the framework's ReportGUI.

### 3.2 Ship a checker-bundle manifest

Let the gates run _inside_ the framework via the standard `exec_command` /
`$ASAM_QC_FRAMEWORK_CONFIG_FILE` contract.

### 3.3 Run the real bundles behind the existing external seam

`RESIDUAL_MODE=external` (`residual-gate.ts`) already exists as a documented
seam with no runner wired. Wire it to invoke `qc-opendrive` /
`qc-openscenarioxml` and import their `.xqar` back as gaps. This is the honest
route to those rule identities — run them rather than transcribe them — and it
delivers the 23 OpenDRIVE rules the repo currently has none of.

### 3.4 Push ontology-derived rules into the C++ checker

`IScenarioChecker` exposes 295 `Add*CheckerRule` slots — upstream's headline
extension point ("write your own checker rules for your company's authoring
guidelines"), and the natural home for rules derived from the ontology. Do this
only after 3.1–3.3, so repo-specific rules are clearly separated from ASAM ones.

---

## Phase 4 — upstream

- Offer `patches/0001-emscripten-portability.patch` (already staged) upstream.
- Raise the `FE_OVERFLOW`/`FE_UNDERFLOW` shim: overflow/underflow detection is
  silently disabled under WASM.
- Raise that neither loader wires `AddAllRangeCheckerRules`, so every embedder
  of the library silently loses 60 rules.

Context: the engine has ~40 stars / 13 forks, its Java line is frozen
(`doc/main.adoc:370`), esmini uses its own pugixml reader, and ASAM's own
`qc-openscenarioxml` bundle is Python. This repo is plausibly the only project
compiling the API to WASM — nobody upstream will carry these fixes for us.

---

## Sequencing

| Phase | Effort  | Rebuild  | Unblocks                              |
| ----- | ------- | -------- | ------------------------------------- |
| 0     | ~1 day  | no       | honest UID claims; gate against drift |
| 1     | ~2 days | **yes**  | 60+ rules, catalogs, injected params  |
| 2     | ~2 days | 2.2 only | removes the wrong-answer bug          |
| 3     | ~1 week | no       | real qc interop; 23 OpenDRIVE rules   |
| 4     | ~1 day  | no       | reduces long-term patch burden        |

Phases 0 and 1 are independent and can land in either order. Phase 2.1 is the
highest-severity item and depends on nothing — pull it forward if the wrong
answers matter more than the coverage.
