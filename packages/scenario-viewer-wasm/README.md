# @ontology-search/scenario-viewer-wasm

A leak-free TypeScript facade over a prebuilt WebAssembly build of the
[**esmini**](https://github.com/esmini/esmini) OpenSCENARIO player. It steps an
authored `.xosc` **in the browser** and exposes the road geometry and per-frame
entity poses a viewer needs — the data side of the "play the authored scenario in
an endless loop below the result" feature.

This package is a **preview**, not a validator. Authoritative correctness stays
with the deterministic authoring gates + the ASAM qc-framework + the XSD schema
check. The viewer renders exactly what esmini computes from the **same `.xodr`
bytes** the gates validated (single-source principle: what you validate is what
you see).

## Why a WASM package (and why committed)

esmini publishes no npm package or prebuilt WASM, but it maintains its own
Emscripten target (`esminiJS`, MPL-2.0). We vendor esmini as a pinned submodule
and commit the built `wasm/esmini.js`, exactly like `packages/sparql` (Oxigraph)
and `packages/authoring-wasm` (the OpenSCENARIO engine). CI never builds WASM;
`native/verify-checksum.mjs` guards the committed blob. See `native/BUILD.md` for
the reproducible recipe and the one small upstreamed build patch.

## API

```ts
import {
  loadScenario,
  type EsminiFactory,
  type ScenarioFrame,
} from '@ontology-search/scenario-viewer-wasm'
// The compiled module (browser only):
import esmini from '@ontology-search/scenario-viewer-wasm/esmini.js'

const scenario = await loadScenario(esmini as EsminiFactory, {
  xosc: xoscText,
  files: { 'german_highway_short.xodr': xodrText }, // keyed by the name the .xosc references
})

const road = scenario.roadGeometry() // parsed once, cached, plain JS
function tick(dtSeconds: number): ScenarioFrame {
  return scenario.advance(dtSeconds) // endless loop: auto-resets when the scenario ends
}

// On teardown — mandatory, frees the native ScenarioEngine:
scenario.dispose()
```

### Memory safety (the crux)

Every embind `std::vector` returned across the WASM boundary owns heap memory and
must be `.delete()`d, or a 20 Hz loop leaks without bound. `extract.ts` is the
single place that crosses the boundary: it copies each vector out to plain JS and
frees the handle in a `finally` (even nested polylines). `EsminiScenario` owns the
`OpenScenario` handle and frees it exactly once in `dispose()`; any use after that
throws `ScenarioDisposedError`. These invariants are unit-tested against a faithful
mock module that makes every un-freed handle observable.

## Scripts

| Script                 | Purpose                                             |
| ---------------------- | --------------------------------------------------- |
| `pnpm test`            | Unit tests (facade + extraction, mock-module based) |
| `pnpm build`           | `tsc --build`                                       |
| `pnpm build:wasm`      | Rebuild `wasm/esmini.js` from the pinned submodule  |
| `pnpm verify:checksum` | Verify the committed artifact against its manifest  |
