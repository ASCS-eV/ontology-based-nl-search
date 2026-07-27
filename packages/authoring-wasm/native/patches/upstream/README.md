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

| Branch                              | Contents                                     | Upstream                 |
| ----------------------------------- | -------------------------------------------- | ------------------------ |
| `carry/wasm`                        | base + PR 1 + PR 2 + FP-shim (the build pin) | —                        |
| `feature/emscripten-portability`    | PR 1 (three portability branches)            | **PR #227 open**         |
| `feature/ghc-filesystem-emscripten` | PR 2 (ghc map, offered map-or-bump)          | **PR #230 open**         |
| _(FP-exception shim)_               | carry-only commit on `carry/wasm`            | **issue #229**, not a PR |

**`carry/wasm` is built from the PR commits themselves.** Each `feature/*` commit
is cherry-picked verbatim onto the build branch — same author, message and diff,
only a different parent — so what we build and ship is exactly what upstream is
being asked to merge, never a local variant that drifted from the proposal. When
a PR merges, the cherry-pick drops out of a rebase by content.

| `carry/wasm` commit                       | Source                                       |
| ----------------------------------------- | -------------------------------------------- |
| `Support Emscripten as a target platform` | cherry-pick of PR #227's commit              |
| `Support Emscripten in the vendored ghc…` | cherry-pick of PR #230's commit              |
| `Shim FE_OVERFLOW/FE_UNDERFLOW to 0…`     | carry-only; the subject of upstream **#229** |

The per-file patches in this directory (`pr1-*.patch`, `pr2-*.patch`) are the
reviewable form of the two PR commits. Both apply cleanly to the pristine pin
(`git apply --check`), and applying both to `292d0be` yields **the exact tree**
of the corresponding cherry-picks on `carry/wasm` — verified by tree hash, so
the patches, the PR branches and the build pin cannot silently disagree.

**Upstream status of everything raised from this port:**

| Upstream item | What it is                                                     | State                     |
| ------------- | -------------------------------------------------------------- | ------------------------- |
| PR #227       | Three `__EMSCRIPTEN__` platform branches (this repo's sources) | open, DCO green           |
| PR #230       | `__EMSCRIPTEN__` → `GHC_OS_LINUX` in vendored ghc, or a bump   | open                      |
| Issue #228    | Range checker rules are never wired by the library loaders     | open, awaiting maintainer |
| Issue #229    | `FE_OVERFLOW`/`FE_UNDERFLOW` absent from Emscripten `<cfenv>`  | open, awaiting maintainer |
| Issue #209    | Commented: cannot reproduce at `292d0be`; fixed by merged #210 | comment posted            |

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

### PR 2 — `pr2-ghc-filesystem-emscripten.patch` (upstream #230)

`cpp/externalLibs/Filesystem/filesystem.hpp` is a vendored copy of
`gulrak/filesystem` **v1.3.2** (`GHC_FILESYSTEM_VERSION 10302L`) that predates
Emscripten support. The patch maps `__EMSCRIPTEN__` to `GHC_OS_LINUX`.

The PR offers it as _either_ this one-line map _or_ a bump of the vendored
library: upstream ghc handles Emscripten natively as of v1.5.x (v1.5.16 defines
`GHC_OS_WEB` and includes `<wasi/api.h>`, which Emscripten's sysroot provides),
so a bump deletes the edit and returns the vendored copy to a pristine release.
The maintainer chooses — patching vendored third-party sources is their call,
not ours. The two are not equivalent: upstream routes Emscripten through
`GHC_OS_WEB`, this patch through the Linux branch. Either is fine for a WASM
target; the difference is who maintains the delta.

### Issue, not a PR — FP exceptions under Emscripten (upstream #229)

`EvaluatorListener.cpp` uses `FE_OVERFLOW` / `FE_UNDERFLOW`, which Emscripten's
`<cfenv>` does not provide. Our local shim defines them to `0`, which makes
`feclearexcept`/`fetestexcept` no-ops — **overflow and underflow detection in the
expression evaluator are silently disabled in that build**.

That is a correctness trade-off, not a portability fix, so it must not be
smuggled into a PR. Filed as issue #229, which describes the constraint and asks
the maintainer to decide the contract (compile error? documented limitation? a
software-side range check?).

### Issue, not a PR — range rules are never wired (upstream #228)

`RangeCheckerHelper::AddAllRangeCheckerRules` is defined but invoked nowhere in
the library or in `openScenarioReader` — only in the test app. Both
`XmlScenarioLoader` and `XmlScenarioImportLoader` wire cardinality, variable and
deprecation checkers, but not range. Verified against this pin: a scenario with
`maxSpeed="-5"`, `maxSteering="99"` and `width="-3"` validates clean.

This may well be deliberate (`IScenarioChecker` is documented as an extension
point), so issue #228 asks rather than patches: if it is intended, the README's
"Checking model constraints from the standard (Range checker rules)" bullet is
misleading for embedders and a doc note is the fix; if not, wiring the rules
into the loaders is, and we offered the PR either way. Independently of the
answer, this repo will wire the rules itself in its embind layer rather than
wait — our shipped `.wasm` contains all 60 of them and runs none.

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
