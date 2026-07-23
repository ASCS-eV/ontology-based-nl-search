# Building `osc-engine.{mjs,wasm}`

The files under `../wasm/` are a **prebuilt, committed artifact** — the repo does
not build WASM in CI (exactly as [`@ontology-search/sparql`](../../sparql) ships
Oxigraph as a prebuilt dependency). This document is the authoritative,
reproducible recipe; `build.mjs` automates it. Rebuild only when the engine
source (submodule pin), the embind wrapper, or the portability patch changes.

## Provenance

| Item          | Value                                                       |
| ------------- | ----------------------------------------------------------- |
| Engine        | RA Consulting `openscenario.api.test`                       |
| License       | Apache-2.0 (see `../NOTICE`)                                |
| Source        | `submodules/openscenario-api` (git submodule)               |
| Upstream      | https://github.com/RA-Consulting-GmbH/openscenario.api.test |
| Pinned commit | `292d0be84530145f7a09ae5a2a7f9bd63db7e3f3`                  |
| OpenSCENARIO  | 1.3 (`SUPPORT_OSC_1_3`)                                     |
| ANTLR         | 4.8 (vendored jar + runtime zip, in the submodule)          |

The engine is loaded **in-process** as an ES module and drives author +
serialize + validate over a MEMFS working directory — the same seam the repo
uses for Oxigraph.

## Prerequisites (not installed by this repo)

- **Emscripten SDK** — provides `em++`. Pin/activate a known version (see
  `10-reproducible-build-and-lifecycle` in the plan).
- **JDK 11+** — `java`, to run the vendored ANTLR 4.8 jar for grammar codegen.
- **CMake** — used only as a cross-platform archive extractor (`cmake -E tar`).

## Reproduce

```bash
git submodule update --init submodules/openscenario-api
pnpm --filter @ontology-search/authoring-wasm build:wasm
```

`build.mjs` performs, deterministically:

1. **Apply the portability patch** (`patches/0001-emscripten-portability.patch`)
   to the submodule, idempotently (re-runs are a no-op). See _Patch_ below.
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

## Patch

`patches/0001-emscripten-portability.patch` carries five small,
upstream-intended changes (the seed for the `11-upstream-alignment` PR).
Emscripten defines `__unix__` but **not** `__linux__`, and has no FP-exception
environment:

- `cpp/common/ExportDefinitions.h`, `cpp/expressionsLib/inc/OscExprExportDefs.h`
  — add an `#elif defined(__EMSCRIPTEN__)` visibility branch.
- `cpp/loader/FileResourceLocator.cpp` — add `|| defined(__EMSCRIPTEN__)` to the
  `__linux__` OS branch.
- `cpp/externalLibs/Filesystem/filesystem.hpp` — map `__EMSCRIPTEN__` →
  `GHC_OS_LINUX` (vendored ghc predates Emscripten support; a version bump would
  drop this).
- `cpp/expressionsLib/src/EvaluatorListener.cpp` — shim `FE_OVERFLOW`/`FE_UNDERFLOW`
  to `0` (WASM has no `<cfenv>` FP-exception flags; overflow/underflow detection
  is disabled under WASM — a real upstream concern to flag in the PR).

The patch is applied to the submodule working tree at build time and is **not**
committed into the submodule (the submodule stays pinned to the pristine
upstream commit). `git -C submodules/openscenario-api diff` after a build shows
exactly these edits.

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
