# Building `wasm/esmini.js`

`wasm/esmini.js` is a prebuilt WebAssembly build of the **esmini** OpenSCENARIO
player, produced from esmini's own `esminiJS` Emscripten target. It is committed
to the repo — like the Oxigraph WASM in `packages/sparql` and the OpenSCENARIO
engine WASM in `packages/authoring-wasm` — so **CI never needs a C++ toolchain**.
This document is the exact, reproducible recipe; `native/build.mjs` automates it.

## What ships

- `wasm/esmini.js` — the Emscripten output. The build uses `SINGLE_FILE=1`, so
  the `.wasm` is inlined as base64 and there is **no separate `.wasm` file**.
- `wasm/esmini.js.sha256` — integrity manifest, verified by
  `native/verify-checksum.mjs` in CI on every PR.

## Pin (single source of truth: `versions.json`)

| Field      | Value                                      |
| ---------- | ------------------------------------------ |
| engine     | esmini                                     |
| repo       | https://github.com/esmini/esmini           |
| commit     | `77028d83e6d402de52f7187e5384d1b1c02b7d1f` |
| branch     | master                                     |
| target     | `EnvironmentSimulator/Libraries/esminiJS`  |
| Emscripten | 6.0.3                                      |

The submodule `submodules/esmini` is pinned at that commit and stays **pristine**
— the build applies its patch to a working tree at build time only.

## Prerequisites (not installed by this repo)

- **Emscripten SDK 6.0.3** — `emcmake`, `em++` on `PATH` (activate emsdk).
- **CMake ≥ 3.5** and **Ninja** on `PATH` (the generator esmini's build uses).
- **git** — to fetch esmini's nested `externals/fmt` submodule on demand.

## Recipe (what `native/build.mjs` does)

1. **Fetch fmt** — esmini's `externals/fmt` is a nested submodule; init it if the
   headers are absent:
   ```
   git -C submodules/esmini submodule update --init externals/fmt
   ```
2. **Apply the version.cmake patch** (`patches/0001-esminijs-version-cmake.patch`)
   to the submodule, idempotently. Rationale below.
3. **Prepare patched fmt** — mirror esmini's `build.sh`: copy
   `externals/fmt/include` to `.build/patched-fmt/include` and apply the vendored
   `scripts/patches/fmt-11.2.0-emscripten-cstdlib.patch` (adds `<cstdlib>` for
   `std::malloc`/`std::free` under Emscripten). The pinned submodule is untouched.
4. **Configure** esmini's Emscripten target:
   ```
   emcmake cmake -G Ninja -DCMAKE_BUILD_TYPE=Release \
     -DFMT_OVERRIDE_INCLUDE_DIR=<.build/patched-fmt/include> \
     -S submodules/esmini/EnvironmentSimulator/Libraries/esminiJS \
     -B packages/scenario-viewer-wasm/.build/cmake
   ```
   The target links with `-s ENVIRONMENT=web -s MODULARIZE=1 -s EXPORT_NAME=esmini
-s SINGLE_FILE=1 -s FORCE_FILESYSTEM=1 -s ALLOW_MEMORY_GROWTH=1` (see the
   target's `CMakeLists.txt`).
5. **Build** with `cmake --build … --parallel`.
6. **Publish** — copy `esmini.js` to `wasm/` and regenerate `wasm/esmini.js.sha256`.

## The one patch we apply: `0001-esminijs-version-cmake.patch`

The standalone esminiJS target compiles but fails to **link**: `CommonMini.cpp`
references `ESMINI_GIT_REV`, `ESMINI_GIT_TAG`, `ESMINI_GIT_BRANCH` and
`ESMINI_BUILD_VERSION`, which are _defined_ in a generated `version.cpp`
(produced from `version.cpp.in` by `CommonMini/version.cmake`). The full esmini
build generates it via `CommonMini/CMakeLists.txt`; the standalone esminiJS
`CMakeLists.txt` never invokes it, so the four symbols are undefined at link time.

The patch invokes `version.cmake` during configure (its existing
`COMMONMINI_SOURCES` glob then picks up the generated `version.cpp`). Under a
shallow clone the values resolve to `"N/A"`, which is harmless for a viewer.

This is a clean, self-contained upstream fix — it is offered to esmini
(issue #357, "WebAssembly build Support"). Once merged upstream we can drop the
patch and bump the pin.

## Reproducibility

`versions.json` + this recipe reproduce `wasm/esmini.js` functionally from the
pin. Byte-for-byte cross-host reproducibility is **not** guaranteed (Emscripten
embeds toolchain paths/ordering); the committed `sha256` guards the specific
committed blob, and the browser Playwright e2e (apps/web) exercises the real
module end-to-end. This mirrors the position taken for `packages/authoring-wasm`.
