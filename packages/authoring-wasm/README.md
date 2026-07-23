# `@ontology-search/authoring-wasm`

In-process **ASAM OpenSCENARIO** engine compiled to WebAssembly. Mirrors the way
[`@ontology-search/sparql`](../sparql) embeds Oxigraph: one WASM module, loaded
in-process, that authors, serializes and **validates** `.xosc` scenarios — no
subprocess, no network, no Python.

This package is the runtime engine seam for the NL→`.xosc` authoring capability
(the mirror of the repo's NL→SPARQL search). The LLM never touches this module
directly; it fills a validated IR that is deterministically lowered to a
scenario, which this engine validates.

## API

```ts
import { loadOscEngine } from '@ontology-search/authoring-wasm'

const engine = await loadOscEngine()

engine.describe()
// → { engine, engineCommit, oscVersions: ['1.3'], xsd: '1.3.0' }

const result = engine.validate(xoscText)
// → { ok: boolean, diagnostics: Diagnostic[] }
// Diagnostics carry severity + line/column from the engine's checker.
```

`validate` accepts optional companion files (e.g. catalogs) that are written
next to the scenario in an isolated in-memory working directory before the
engine runs, then cleaned up.

## Two-tier validation

The WASM checker enforces **schema + type + enum + expression** correctness over
a single `.xosc`. Cross-file / cross-reference semantics (e.g. `.xosc ↔ .xodr`,
dangling `entityRef`) are intentionally **out of scope here** — they are the
job of the design-time SHACL gate. Keeping the tiers separate is deliberate (see
the plan's `03`/`04`).

## The WASM artifact

`wasm/osc-engine.{mjs,wasm}` is a **prebuilt, committed artifact** — CI consumes
it directly and never builds WASM (exactly as Oxigraph ships prebuilt). Rebuild
it only when the engine pin, the embind wrapper, or the portability patch
changes:

```bash
git submodule update --init submodules/openscenario-api
pnpm --filter @ontology-search/authoring-wasm build:wasm
```

The full reproducible recipe, provenance (upstream repo + pinned commit) and the
portability patch are documented in [`native/BUILD.md`](./native/BUILD.md).

## License / attribution

The bundled engine is RA Consulting's `openscenario.api.test`, **Apache-2.0**.
See [`NOTICE`](./NOTICE). This package's own TypeScript is under the repository
license.
