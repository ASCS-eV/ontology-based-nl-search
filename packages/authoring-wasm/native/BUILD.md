# Building `osc-engine.{mjs,wasm}`

The files under `../wasm/` are a **prebuilt, committed artifact** — the repo does
not build WASM in CI (exactly as [`@ontology-search/sparql`](../../sparql) ships
Oxigraph as a prebuilt dependency). This document is the authoritative,
reproducible recipe; `build.mjs` automates it. Rebuild only when the engine
source (submodule pin), the embind wrapper, or the carried edits change.

## Provenance

| Item          | Value                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| Engine        | RA Consulting `openscenario.api.test`                                  |
| License       | Apache-2.0 (see `../NOTICE`)                                           |
| Source        | `submodules/openscenario-api` (git submodule → ASCS-eV fork)           |
| Upstream      | https://github.com/RA-Consulting-GmbH/openscenario.api.test            |
| Fork          | https://github.com/ASCS-eV/openscenario.api.test (branch `carry/wasm`) |
| Upstream base | `292d0be84530145f7a09ae5a2a7f9bd63db7e3f3` (`v1.4.1-2-g292d0be`)       |
| Pinned commit | `carry/wasm` HEAD = upstream base **+ the carried edits as commits**   |
| OpenSCENARIO  | 1.3 (`SUPPORT_OSC_1_3`)                                                |
| ANTLR         | 4.8 (vendored jar + runtime zip, in the submodule)                     |

The submodule pins the fork's `carry/wasm` branch, which is the upstream base
with our portability edits applied **as commits** (no build-time patch). As
those edits land upstream, `carry/wasm` is rebased and the merged commits drop
out; see `docs/adr/0007-openscenario-fork-carry-branch.md` and
`patches/upstream/README.md`. `versions.json.engineCommit` continues to name the
**upstream base** — the OSC/XSD/checker version identity the engine implements is
unchanged by the build-portability carries.

The engine is loaded **in-process** as an ES module and drives author +
serialize + validate over a MEMFS working directory — the same seam the repo
uses for Oxigraph.

## Prerequisites (not installed by this repo)

- **Emscripten SDK** — provides `em++`. Pin the exact version this artifact was
  built with: **6.0.3** — the `emscripten` field in
  `packages/authoring-wasm/versions.json` (the single source of truth for the
  build pin). Activate it with `emsdk install 6.0.3 && emsdk activate 6.0.3`.
- **JDK 11+** — `java`, to run the vendored ANTLR 4.8 jar for grammar codegen.
- **CMake** — used only as a cross-platform archive extractor (`cmake -E tar`).

## Reproduce

```bash
git submodule update --init submodules/openscenario-api
pnpm --filter @ontology-search/authoring-wasm build:wasm
```

`build.mjs` performs, deterministically:

1. **(no patch step)** — the submodule already points at the pre-patched fork
   `carry/wasm`. See _Carried edits_ below.
2. **Extract** the vendored ANTLR 4.8 C++ runtime zip into `.build/antlr/`.
3. **Generate** four grammars with the vendored jar (`-Dlanguage=Cpp -visitor
-listener`): `XMLLexer`/`XMLParser` and `OscExprLexer`/`OscExprParser`
   (`-package OscExpression`).
4. **Compile** (`em++ -std=c++17 -Oz -fexceptions -DSUPPORT_OSC_1_3
-Wno-deprecated-declarations -Wno-inconsistent-missing-override`) three
   source sets:
   - the ANTLR4 C++ runtime (single-threaded; `thread_local`/`mutex` are fine
     under Emscripten's single-thread model);
   - `expressionsLib/src/*.cpp` **excluding the dead stub `OscExprEvaluator.cpp`**
     - the generated `OscExpr` grammar;
   - `openScenarioLib/src/**` **excluding `v1_0`/`v1_1`/`v1_2`** + `generated/v1_3/**`
     - the generated `XML` grammar + `externalLibs/TinyXML2/tinyxml2.cpp` + our
       `osc_engine_embind.cpp`.
5. **Link** to an ES module:
   `-lembind -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createOscEngine
-sALLOW_MEMORY_GROWTH=1 -sEXIT_RUNTIME=0 -sFORCE_FILESYSTEM=1
-sEXPORTED_RUNTIME_METHODS=['FS'] -g0` → `../wasm/osc-engine.{mjs,wasm}`.

Include roots (headers live next to sources in this engine): the ANTLR runtime
`src`, both generated grammar dirs, `openScenarioLib/{src,generated/v1_3}`,
`expressionsLib/{inc,generated}`, `externalLibs`, `common` (holds
`MemLeakDetection.h` — easy to miss), and the vendored `nlohmann` inc.

## Carried edits (fork `carry/wasm`)

The five small edits needed to compile the engine under Emscripten live as
commits on the fork's `carry/wasm` branch (the submodule pin), **not** as a
build-time patch. Each is triaged by how it should reach upstream — see
`patches/upstream/README.md` for the full rationale and PR bodies:

| Commit on `carry/wasm`                                                                                      | Disposition                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ExportDefinitions.h` / `OscExprExportDefs.h` / `FileResourceLocator.cpp` — `#elif __EMSCRIPTEN__` branches | **Upstream PR** ([#227](https://github.com/RA-Consulting-GmbH/openscenario.api.test/pull/227))                                                           |
| `filesystem.hpp` — map `__EMSCRIPTEN__` → `GHC_OS_LINUX` (vendored ghc)                                     | **Upstream PR** ([#230](https://github.com/RA-Consulting-GmbH/openscenario.api.test/pull/230), offered map-or-bump)                                      |
| `EvaluatorListener.cpp` — shim `FE_OVERFLOW`/`FE_UNDERFLOW` to `0`                                          | **Carry-only** ([issue #229](https://github.com/RA-Consulting-GmbH/openscenario.api.test/issues/229)) — disables overflow/underflow detection under WASM |

The two PR rows are **cherry-picked verbatim** from the `feature/*` branches the
pull requests are opened from — identical author, message and diff. What this
package compiles is therefore exactly what upstream is being asked to merge; a
carried edit cannot drift from its proposal.

Because these are commits (not a working-tree patch), a fresh submodule checkout
is build-ready with no `git apply` step, and `git -C submodules/openscenario-api
diff` is clean. When a PR merges upstream, rebase `carry/wasm` onto the new
upstream and re-pin the submodule; the merged commit drops out. When only
carry-only edits remain (or all land), point the submodule back at upstream.
Lifecycle: `docs/adr/0007-openscenario-fork-carry-branch.md`.

## Entry point

`osc_engine_embind.cpp` (this directory) is the embind surface compiled into the
module. It exposes `describe()`, `validate(mainPath)`, `roundtripExport(path)`
and `authorMinimal()` over MEMFS, plus the `FS` runtime object. The TypeScript
loader (`../src/engine.ts`) wraps it behind the `OscEngine` contract.

## Verify a rebuild

The package's own test suite is the post-build check (there is no separate smoke
script — the artifact is exercised the same way it is consumed):

```bash
pnpm --filter @ontology-search/authoring-wasm test
```

It loads the freshly built `wasm/osc-engine.mjs` and asserts describe, valid /
invalid-enum / non-numeric / malformed validation, determinism, and the
author/round-trip writer guards.
