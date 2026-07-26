# Upstream contributions to `openscenario.api.test`

The five build-portability edits are now carried as **commits on the ASCS-eV
fork** (submodule pin), not as a build-time patch — see
[ADR 0007](../../../../../docs/adr/0007-openscenario-fork-carry-branch.md). This
directory records their upstream-shaped split and a triage of the upstream open
issues against how this repo uses the engine.

- Upstream: https://github.com/RA-Consulting-GmbH/openscenario.api.test
- Fork: https://github.com/ASCS-eV/openscenario.api.test
- Upstream base: `292d0be84530145f7a09ae5a2a7f9bd63db7e3f3` (`v1.4.1-2-g292d0be`)

**Branch status (on the fork):**

| Branch                              | Contents                                     | Upstream                                   |
| ----------------------------------- | -------------------------------------------- | ------------------------------------------ |
| `carry/wasm`                        | base + PR 1 + PR 2 + FP-shim (the build pin) | —                                          |
| `feature/emscripten-portability`    | PR 1 (three portability branches)            | **PR #227 open**                           |
| `feature/ghc-filesystem-emscripten` | PR 2 (ghc map)                               | held — offer after #227, maintainer's call |
| _(FP-exception shim)_               | carry-only commit on `carry/wasm`            | **issue** (below), not a PR                |

The per-file patches below (`pr1-*.patch`, `pr2-*.patch`) are the reviewable
form of those commits; all verified to apply cleanly to the pristine pin with
`git apply --check`.

## Why the build patch is split

`0001-emscripten-portability.patch` bundles five edits. They are not one
contribution — they differ in reviewability and in risk:

| Edit                                                               | Upstream shape                                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------- |
| `ExportDefinitions.h` — `__EMSCRIPTEN__` branch                    | **PR 1** — clean, self-contained                           |
| `OscExprExportDefs.h` — `__EMSCRIPTEN__` branch                    | **PR 1**                                                   |
| `FileResourceLocator.cpp` — `__EMSCRIPTEN__` in the POSIX branch   | **PR 1**                                                   |
| `filesystem.hpp` — map `__EMSCRIPTEN__` → `GHC_OS_LINUX`           | **PR 2** — edits a _vendored third-party_ header           |
| `EvaluatorListener.cpp` — shim `FE_OVERFLOW`/`FE_UNDERFLOW` to `0` | **Issue, not a PR** — silently disables overflow detection |

Bundling them would ask a reviewer to accept a third-party-library edit and a
silent numeric-behaviour change alongside three trivial `#elif` branches. Split,
PR 1 is mergeable on sight.

### PR 1 — `pr1-emscripten-portability.patch`

Emscripten defines `__unix__` but **not** `__linux__`, so all three files hit
their `#error "Operating system not supported."` fallback. Three `__EMSCRIPTEN__`
branches fix the build with no behaviour change on any existing platform.

Relates to upstream **#215 (Support for Cross-Compilation)** — an Emscripten
target is a cross-compilation, and these are the blocking portability defects.

### PR 2 — `pr2-ghc-filesystem-emscripten.patch`

`cpp/externalLibs/Filesystem/filesystem.hpp` is a vendored copy of
`gulrak/filesystem` that predates Emscripten support. The patch maps
`__EMSCRIPTEN__` to `GHC_OS_LINUX`.

Offer it as _either_ this one-line map _or_ a bump of the vendored library
(upstream ghc supports Emscripten natively now, which would delete the edit).
Let the maintainer choose — patching vendored third-party sources is their call,
not ours.

### Issue, not a PR — FP exceptions under Emscripten

`EvaluatorListener.cpp` uses `FE_OVERFLOW` / `FE_UNDERFLOW`, which Emscripten's
`<cfenv>` does not provide. Our local shim defines them to `0`, which makes
`feclearexcept`/`fetestexcept` no-ops — **overflow and underflow detection in the
expression evaluator are silently disabled in that build**.

That is a correctness trade-off, not a portability fix, so it must not be
smuggled into a PR. File it as an issue describing the constraint and let the
maintainer decide the contract (compile error? documented limitation? a
software-side range check?).

### Issue, not a PR — range rules are never wired

`RangeCheckerHelper::AddAllRangeCheckerRules` is defined but invoked nowhere in
the library or in `openScenarioReader` — only in the test app. Both
`XmlScenarioLoader` and `XmlScenarioImportLoader` wire cardinality, variable and
deprecation checkers, but not range. Verified against this pin: a scenario with
`maxSpeed="-5"`, `maxSteering="99"` and `width="-3"` validates clean.

This may well be deliberate (`IScenarioChecker` is documented as an extension
point). Ask before patching: if it is intended, the README's "Checking model
constraints from the standard (Range checker rules)" bullet is misleading for
embedders, and a doc note would be the fix.

## Triage of upstream open issues (as of this pin)

| #    | Title                                                                                  | Affects us             | Why                                                                                                                                                                                                      |
| ---- | -------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #215 | Support for Cross-Compilation                                                          | **Yes**                | Our Emscripten build is exactly this. PR 1 targets it.                                                                                                                                                   |
| #226 | `CustomCommandAction` XML content not imported from catalog                            | **Later**              | Catalog import is unused today; becomes live when `validate` moves to `XmlScenarioImportLoaderFactory`. We do not emit `CustomCommandAction`.                                                            |
| #205 | Examples for resolving object references                                               | Indirect               | Docs request. We have working knowledge of this path and could contribute an example.                                                                                                                    |
| #180 | Reduce the large artifact files                                                        | Minor                  | We vendor the repo as a submodule; size is a clone-time cost only.                                                                                                                                       |
| #209 | `XmlSequenceParser::ParseSubElementsInternal` does not increment `_occuredElementList` | **No (appears fixed)** | The increment is present at this pin (`XmlSequenceParser.cpp:73-81`). Issue predates the pin. Worth a "cannot reproduce at `292d0be`" comment.                                                           |
| #225 | `OrientationImpl` `type` initialized with wrong value                                  | **No**                 | `_type` defaults to `ABSOLUTE`. Our `validate` discards the parsed model and our writer never sets `Orientation`. Would matter only if we adopt the read API.                                            |
| #222 | Typo `Entitiy` → `Entity` across the codebase                                          | **No**                 | 36 occurrences in generated v1_3, but the factory/writer surface spells it correctly (`CreateEntityObjectWriter`). Our embind touches zero misspelled symbols, so an upstream rename would not break us. |
| #199 | Missing version/comment for attribute `model` in v1.1 / v1.2                           | **No**                 | We compile v1_3 only.                                                                                                                                                                                    |
| #174 | No ANTLR rebuild on debug/release switch in Visual Studio                              | **No**                 | MSVC-specific; we build with Ninja + `emcmake`.                                                                                                                                                          |
| #168 | Optimize CMake build scripts                                                           | **No**                 | We bypass their CMake entirely (`build.mjs` drives `em++` directly). Our approach is evidence for the issue, not affected by it.                                                                         |

Net: one issue affects us directly (#215), one becomes relevant after Phase 1.3
(#226), one is likely already fixed and worth a confirming comment (#209).
