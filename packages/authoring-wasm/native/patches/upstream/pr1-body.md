# PR 1 body — fix(build): support Emscripten as a target platform

Open at:
https://github.com/RA-Consulting-GmbH/openscenario.api.test/compare/master...ASCS-eV:openscenario.api.test:feature/emscripten-portability

Branch `feature/emscripten-portability` is pushed to `ASCS-eV/openscenario.api.test`,
based on `292d0be` — which is also upstream `master` HEAD, so no rebase is needed.

---

Relates to #215 (Support for Cross-Compilation).

## Problem

Emscripten defines `__unix__` but **not** `__linux__`, and is matched by none of the existing platform branches. Three files therefore fall through to their `#error` fallback, so the library cannot be compiled to WebAssembly at all:

- `cpp/openScenarioLib/src/common/ExportDefinitions.h` — `#error "OPENSCENARIOLIB: Operating system not supported."`
- `cpp/expressionsLib/inc/OscExprExportDefs.h` — same
- `cpp/openScenarioLib/src/loader/FileResourceLocator.cpp` — `#error "Operating system not supported."`

## Change

Three guard additions, five lines total:

- An `__EMSCRIPTEN__` branch in the two symbol-visibility chains. No visibility attribute is needed, so these mirror the existing `__APPLE__` branch exactly.
- `__EMSCRIPTEN__` accepted in the POSIX branch of `FileResourceLocator`, which already treats Linux and macOS identically and needs no change beyond the guard.

No behaviour change on any existing platform — the additions sit after the Windows, Linux and macOS branches, so those are reached exactly as before.

## Verification

| Case                                      | Before   | After    |
| ----------------------------------------- | -------- | -------- |
| `ExportDefinitions.h`, `-D__EMSCRIPTEN__` | `#error` | compiles |
| `OscExprExportDefs.h`, `-D__EMSCRIPTEN__` | `#error` | compiles |
| `ExportDefinitions.h`, native Linux       | compiles | compiles |

Beyond the preprocessor check, this patch is what we use in practice: we build `openScenarioLib` + `expressionsLib` (v1_3, `SUPPORT_OSC_1_3`) with Emscripten 6.0.3 into a WebAssembly module and run the parser, parameter resolution, expression evaluation and the cardinality/variable/deprecation checkers against real `.xosc` files in CI.

## Not included, deliberately

Two further changes are needed for a complete Emscripten build. Both are separable and carry decisions that are yours to make, so they are not bundled here:

1. **`cpp/externalLibs/Filesystem/filesystem.hpp`** — the vendored `gulrak/filesystem` copy predates Emscripten support and needs `__EMSCRIPTEN__` mapped to `GHC_OS_LINUX`. This can be either a one-line map or a bump of the vendored library (upstream ghc supports Emscripten natively now, which would remove the need entirely). Happy to send whichever you prefer as a follow-up.
2. **`FE_OVERFLOW` / `FE_UNDERFLOW` in `cpp/expressionsLib/src/EvaluatorListener.cpp`** — Emscripten's `<cfenv>` does not provide these. Defining them to `0` compiles, but silently turns `feclearexcept`/`fetestexcept` into no-ops, disabling overflow/underflow detection in the expression evaluator. That is a correctness trade-off rather than a build fix, so it warrants a decision on the intended contract. I will open a separate issue for it rather than slip it into a build PR.
