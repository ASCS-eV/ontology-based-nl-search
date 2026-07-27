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

const result = engine.validate(xoscText, {
  files: { 'Catalogs/Vehicles/VehicleCatalog.xosc': catalogText },
  parameters: { egoMaxSpeed: '30' },
})
// → { ok: boolean, diagnostics: Diagnostic[] }
// Diagnostics carry severity + line/column from the engine's checker.
```

`files` stages companion documents in an isolated in-memory working directory
before the engine runs (then cleans them up). They **participate in
validation**: the engine imports catalogs from the declared
`<CatalogLocations>`, so a `<CatalogReference>` resolves against a staged
catalog and a reference that resolves to nothing is an error.

`parameters` injects parameter overrides ahead of parameter resolution, taking
precedence over the scenario's `<ParameterDeclarations>` — the same contract as
`openScenarioReader -p`. The checkers then see the resolved values, so a
scenario can be validated as it would actually be run.

## What the checker runs

Everything the engine has, not just what its default loader wires:

| Family                                   | Source                                        |
| ---------------------------------------- | --------------------------------------------- |
| Schema / type / enum / expression        | the parser                                    |
| Cardinality, variables, deprecation      | the loader                                    |
| Catalog import + resolution              | `XmlScenarioImportLoaderFactory`              |
| **Range** (~60 rules, [OSC-RCR])         | `RangeCheckerHelper::AddAllRangeCheckerRules` |
| **Union** (`xsd:choice` exclusivity, 48) | generated wiring — see `native/BUILD.md`      |
| **Version** (`revMajor`/`revMinor`)      | `VersionCheckerRule`, from `versions.json`    |

The range and union rules are generated from the ASAM UML model and compiled
into the artifact; upstream ships them but registers neither (upstream issue
[#228](https://github.com/RA-Consulting-GmbH/openscenario.api.test/issues/228)),
so this package registers them itself.

## Two-tier validation

The WASM checker enforces **schema, type, enum, expression, range, choice,
version and catalog-resolution** correctness over one scenario and the catalog
files it imports. Semantics that span _other_ documents — `.xosc ↔ .xodr` road
resolution, dangling `entityRef` across the whole graph — are intentionally
**out of scope here**: they are the job of the design-time SHACL gate
(`packages/authoring-gate`), which resolves them over a merged RDF graph. The
tier split is by what each side can see, not by rule family.

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
