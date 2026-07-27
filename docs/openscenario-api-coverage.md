# Implementation plan — OpenSCENARIO API coverage & qc-framework alignment

Scope: how far this repo's authoring feature covers the ASAM OpenSCENARIO API
its engine embeds, and the ASAM Quality Checker rule bundles its gates cite.

| Phase   | Tracking issue                                                                                                                     | State |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 0       | [#171](https://github.com/ASCS-eV/ontology-based-nl-search/issues/171) — rule identities must resolve; gate against UID drift      | done  |
| 1       | [#172](https://github.com/ASCS-eV/ontology-based-nl-search/issues/172) — register the checkers compiled into the WASM engine       | done  |
| 2.1     | [#173](https://github.com/ASCS-eV/ontology-based-nl-search/issues/173) — the lowering reports what it cannot express               | done  |
| 2.2     | [#183](https://github.com/ASCS-eV/ontology-based-nl-search/issues/183) — archetype width (maneuvers, entity triggers, `stopTime`)  | open  |
| 3.1–3.3 | [#174](https://github.com/ASCS-eV/ontology-based-nl-search/issues/174) — qc-framework interop (`.xqar`, manifest, run the bundles) | done  |
| 3.4     | [#182](https://github.com/ASCS-eV/ontology-based-nl-search/issues/182) — ontology-derived rules into the C++ checker               | open  |
| 4       | [#175](https://github.com/ASCS-eV/ontology-based-nl-search/issues/175) — upstream contributions                                    | done  |

## Working on this locally

Three setup steps that are easy to miss; the second and third are what make the
authoring tests resolve at all:

```bash
git submodule update --init submodules/openscenario-api   # not checked out by default
pnpm install
pnpm --filter @ontology-search/road-catalog... build      # else packages/authoring tests fail to resolve
```

Rebuilding the engine additionally needs the pinned Emscripten SDK and a JDK —
see `packages/authoring-wasm/native/BUILD.md`.

Note that `.playground/` **and any `plans/` directory** are gitignored
(`.gitignore:26-29`), which is why this plan lives in `docs/` rather than
following the repo's usual scratch convention — an untracked plan does not
survive a cloud session's container.

## Verifying a claim in this plan

Claims here are stated from executing the committed WASM artifact, not from
reading source. To re-check, load `packages/authoring-wasm/src/engine.js` and
call `validate()` on `src/__fixtures__/cut-in.xosc` with a mutation applied.
Every row is also held by a test in
`packages/authoring-wasm/src/__tests__/engine.test.ts`.

| Mutation                                            | Expected       | Enforced by                        |
| --------------------------------------------------- | -------------- | ---------------------------------- |
| `maxSpeed="-5"` / `maxSteering="99"` / `width="-3"` | one error each | generated range rules `[OSC-RCR]`  |
| `revMinor="9"`                                      | `ok=false`     | `VersionCheckerRule`               |
| dangling `<CatalogReference>`                       | `ok=false`     | catalog import                     |
| …the same, with the catalog staged via `files`      | `ok=true`      | catalog import                     |
| injected parameter overriding a declared value      | override wins  | parameter resolution + range rules |
| `vehicleCategory="spaceship"`                       | `ok=false`     | enum parsing                       |
| `${10 +}` (malformed expression)                    | `ok=false`     | the expression evaluator           |
| `<Vehicle>` without `<BoundingBox>`                 | `ok=false`     | generated cardinality rules        |

## Sources

Every external identity this plan relies on, and the pin it is read from:

| Source                                | Reference                                                                                                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ASAM OpenSCENARIO XML 1.3.0           | `submodules/ontology-management-base/imports/OpenScenario/OpenSCENARIO.xsd` (pinned submodule) — `[OSC-XSD]`                                                           |
| RA Consulting `openscenario.api.test` | Apache-2.0; pinned submodule `submodules/openscenario-api`, upstream base `292d0be`. Range rules from `RangeCheckerRulesV1_3.cpp` — `[OSC-RCR]`                        |
| ASAM Quality Checker Framework        | `asam-ev/qc-framework` (MPL-2.0) — the rule-UID grammar (`doc/manual/file_formats.md`) and the `.xqar` result schema (`doc/schema/xqar_result_format.xsd`) — `[QC-FW]` |
| `qc-openscenarioxml` bundle           | `asam-ev/qc-openscenarioxml`, pinned + checksummed in `packages/authoring-gate/qc-bundles/qc-openscenarioxml.bundle.json` — `[QC-XOSC]`                                |
| `qc-opendrive` bundle                 | `asam-ev/qc-opendrive`, pinned + checksummed in `packages/authoring-gate/qc-bundles/qc-opendrive.bundle.json` — `[QC-XODR]`                                            |
| Emscripten SDK                        | version pinned in `packages/authoring-wasm/versions.json`; `native/build.mjs` rebuilds the artifact from it                                                            |

Tags are registered in `docs/specs/references/README.md` and
`apps/docs/standards-audit.md` (criterion #31).

## Why

Two independent findings drive this plan.

**1. The pinned RAC engine ships far more than the authoring feature uses.**
`packages/authoring-wasm` compiles the RA Consulting `openscenario.api.test` C++
API in full. Its loaders register only the cardinality, variable and deprecation
rules, so the range rules, the `xsd:choice` union rules, the version rule,
catalog import and injected parameters are the embedder's to register — the
library registers them for nobody
([upstream #228](https://github.com/RA-Consulting-GmbH/openscenario.api.test/issues/228)).
Phase 1 registers them all.

Writer coverage is 49 of 295 writer types; the IR lowering understands four
action kinds and emits at most one maneuver.

**2. Rule identities must resolve where they claim to come from.** Measured from
the pinned bundle lists, `qc-opendrive` publishes 26 rules and
`qc-openscenarioxml` 17. Neither publishes an analytic G1/G2 geometry-continuity
rule — the nearest OpenDRIVE members are the `road.geometry.parampoly3.*` family
and `lane_smoothness.contact_point_no_horizontal_gaps`, which are different
checks — so the residual gate's continuity rule is declared by this repo under
its own emanating entity per the `[QC-FW]` grammar, and gated against the pinned
lists (Phase 0).

Against `qc-openscenarioxml`'s 17 rules the repo covers roughly 7–8. Two of the
misses (`data_type.non_negative_transition_time_in_light_state_action`,
`data_type.positive_duration_in_phase`) are implemented inside the engine binary
as range rules, and Phase 1 is what runs them.

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

## Phase 0 — rule identities that resolve — **done**

### 0.1 Declare the authority

Each `QC_RULES` entry declares `origin: 'asam' | 'repo'`. An ASAM rule keeps the
`asam.net` emanating entity; a rule this repo declares — cross-file road
resolution, analytic G1/G2 continuity, lowering completeness, the two
simulation-only residual rules — carries this repo's own entity, per the
`[QC-FW]` grammar
`<emanating-entity>:<standard>:<definition-setting>:<rule-set>.<name>`. Where a
published ASAM rule is merely _adjacent_ to one of ours, the catalog records it
as `relatedAsamRule`: orientation for a reader, never attribution.

### 0.2 Pin the bundle rule lists and gate on them

`packages/authoring-gate/qc-bundles/*.bundle.json` pin each bundle's own
`checker_bundle_doc.md` by commit, with the source SHA-256, the build version,
and every checker with the rules it addresses. `qc-bundles/refresh.mjs`
regenerates them (`--check` verifies without writing); nothing is transcribed by
hand. Same discipline as `native/verify-checksum.mjs`, and no network at test
time.

`src/__tests__/qc-rules.test.ts` is the gate: an `origin: 'asam'` UID must appear
in a pinned list, an `origin: 'repo'` UID must not claim `asam.net` and must not
collide with a published one, a `relatedAsamRule` must itself resolve, and no
`asam.net` UID may exist outside the pinned lists.

### 0.3 Companion catalogs participate in validation

`packages/authoring-wasm/README.md` and the `AuthoringValidateOptions.files`
docstring document catalogs as participating in validation. Phase 1.3 is what
makes that true, and a test holds it.

---

## Phase 1 — register the checkers the artifact contains — **done**

The engine's loaders register the cardinality, variable and deprecation rules.
Everything else it compiles in is the embedder's to register, which
`native/osc_engine_embind.cpp` does.

### 1.1 Range checker rules

`RangeCheckerHelper::AddAllRangeCheckerRules` on a `ScenarioCheckerImpl`, run via
`CheckScenarioInFileContext` — only when the load produced no errors, since a
checker walking a half-resolved tree reports noise rather than findings.

This covers `data_type.non_negative_transition_time_in_light_state_action` and
`data_type.positive_duration_in_phase` from `[QC-XOSC]`, and puts the runtime
checker on the same bounds as the `sh:minInclusive`/`sh:maxInclusive` values
`artifacts/openscenario/DERIVATION.md` derives from `[OSC-RCR]` — one source,
two consumers.

### 1.2 Union and version rules

The engine generates one `xsd:choice` exclusivity rule per union type (48 at this
pin) but ships no helper that registers them, so `build.mjs` derives the wiring
from the engine's own `UnionCheckerRulesV1_3.h`, pairs each rule with its
`Add<Type>CheckerRule` slot in `IScenarioCheckerV1_3.h`, and **fails the build**
on an unpaired rule. A pin bump re-derives it; nothing is transcribed.

`VersionCheckerRule` takes its revision from `versions.json` (`OSC_REV_MAJOR` /
`OSC_REV_MINOR`, generated), so it cannot check a version the build does not
claim to implement.

### 1.3 Catalog resolution

`validate` loads through `XmlScenarioImportLoaderFactory` with its own catalog
message logger, whose diagnostics are merged into the returned set: a scenario
whose catalog does not parse is not a valid scenario. This is what makes
`EngineFiles` functional, and it opens
`parameters.valid_parameter_declaration_in_catalogs` from `[QC-XOSC]`.

### 1.4 Injected parameters

`OscEngine.validate(xosc, { files, parameters })` →
`AuthoringBackend.validate(xosc, { files, parameters })` → the loader's injected
parameter map, the contract `openScenarioReader -p` implements. Overrides apply
before parameter resolution, so the checkers see resolved values.

**Tests** (criterion #30) — the five mutation rows in _Verifying a claim_ above.

---

## Phase 2 — the lowering reports what it drops

### 2.1 Report what the lowering cannot express — **done**

The archetype lowers four action kinds and one maneuver, so an IR can carry more
than the lowering can emit. `lowerScene` returns the dropped actions alongside
the tree and is the single source for both `irToEngineTree` and
`unexpressibleActions`, so the two cannot disagree about what "supported" means.
`runScenePipeline` emits one rule-attributed `SceneGap` per drop, which makes the
result `valid: false` and gives the bounded repair loop something to act on.

Detection belongs here rather than in the model's self-report: the prompt asks
the LLM to report what it cannot express, but the deterministic lowering is what
knows.

**Test** — an IR with two `LaneChangeAction`s and one `AcquirePositionAction`
yields two gaps and `valid: false`.

### 2.2 Widen the archetype — open (#183)

- Multiple events / maneuvers rather than one.
- Entity-based trigger conditions (`TimeHeadway`, `RelativeDistance`); the
  archetype has only `SimulationTimeCondition`, which is not how a cut-in is
  triggered in practice.
- `stopTime` from the IR instead of the hardcoded `30` (`ir-to-engine.ts`).

Keep the condition vocabulary SHACL-discovered — this is the budget-sensitive
step.

---

## Phase 3 — interoperate instead of reimplementing

Full surface and contracts: `packages/authoring-gate/QC-INTEROP.md`.

### 3.1 Emit `.xqar` — **done**

`gapsToXqar` renders gaps as a `[QC-FW]` result file: one `<CheckerBundle>`, one
`<Checker>` per gate, one `<Issue>` per gap, with a `<FileLocation row column>`
where a finding has a source position. Each checker declares every rule its gate
can emit as an `<AddressedRule>`, read from the catalog through `QcRule.gate`, so
a clean run is distinguishable from a rule that was never evaluated.

### 3.2 Ship a checker-bundle manifest — **done**

`qc-bundle/qc_authoring_gate.json` registers the file-scoped gate as a bundle and
`qc-bundle/main.mjs` implements the `exec_command` /
`$ASAM_QC_FRAMEWORK_CONFIG_FILE` contract. Scope is one `.xodr`: the semantic
gate resolves `.xosc`↔`.xodr` over a merged RDF graph built from a validated IR,
which a per-file checker cannot be handed.

### 3.3 Run the real bundles behind the external seam — **done**

`RESIDUAL_MODE=external` plus `RESIDUAL_EXTERNAL_COMMAND` invokes a bundle out of
process and imports its `.xqar` as gaps carrying **the bundle's own** rule UIDs.
That is how the published OpenDRIVE rules are covered — by running the bundle
that implements them. A bundle that exits non-zero, times out or writes nothing
is reported through `skipped` with the `external-bundle-unavailable: ` prefix.

### 3.4 Push ontology-derived rules into the C++ checker — open (#182)

`IScenarioChecker` exposes 295 `Add*CheckerRule` slots — upstream's documented
extension point, and the natural home for rules derived from the ontology. It is
last on purpose, so repo-declared rules stay clearly separated from ASAM ones,
and it needs its own artifact rebuild.

---

## Phase 4 — upstream — **done**

Compiling the engine to WebAssembly needs five edits to it, and surfaces two
behaviour questions. Each is with the maintainer of
`RA-Consulting-GmbH/openscenario.api.test` in the shape that fits it:

| Item                                                        | Upstream                                                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Three `__EMSCRIPTEN__` platform branches                    | PR [#227](https://github.com/RA-Consulting-GmbH/openscenario.api.test/pull/227)                                           |
| Vendored `ghc::filesystem` — one-line map _or_ library bump | PR [#230](https://github.com/RA-Consulting-GmbH/openscenario.api.test/pull/230)                                           |
| `FE_OVERFLOW`/`FE_UNDERFLOW` absent from Emscripten         | issue [#229](https://github.com/RA-Consulting-GmbH/openscenario.api.test/issues/229) — a behaviour trade-off, not a PR    |
| No loader registers `AddAllRangeCheckerRules`               | issue [#228](https://github.com/RA-Consulting-GmbH/openscenario.api.test/issues/228) — asks before patching               |
| `XmlSequenceParser` occurrence counting                     | comment on [#209](https://github.com/RA-Consulting-GmbH/openscenario.api.test/issues/209) — not reproducible at `292d0be` |

Why upstreaming is worth the effort: the engine's Java product line is frozen
(`doc/main.adoc:370`), esmini embeds its own pugixml-based reader rather than
this API, and ASAM's own `qc-openscenarioxml` bundle is Python. This repo is
plausibly the only project compiling the API to WebAssembly, so every carried
edit is one nobody else maintains. `carry/wasm` carries each PR's commit as a
verbatim cherry-pick, so what this repo builds is what upstream is asked to
merge; see `packages/authoring-wasm/native/patches/upstream/README.md` and
ADR 0007.

---

## Sequencing

| Phase | Rebuild  | Delivers                                           |
| ----- | -------- | -------------------------------------------------- |
| 0     | no       | rule identities that resolve; a gate against drift |
| 1     | **yes**  | range + union + version rules, catalogs, params    |
| 2.1   | no       | the lowering reports what it drops                 |
| 2.2   | no       | archetype width                                    |
| 3     | 3.4 only | qc-framework interop; the 26 OpenDRIVE rules       |
| 4     | no       | fewer permanently carried engine edits             |

Phase 3 depends on Phase 0 for rule identities a framework consumer can resolve.
The rest are independent.
