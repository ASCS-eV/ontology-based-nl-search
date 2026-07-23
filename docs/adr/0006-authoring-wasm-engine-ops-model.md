# ADR 0006 — Authoring WASM engine: version single-source, reproducible build & ops model

- **Status:** Accepted
- **Date:** 2026-07-23

## Context

The NL → OpenSCENARIO `.xosc` authoring capability runs RA Consulting's
`openscenario.api.test` C++ engine (Apache-2.0) compiled to WebAssembly and
loaded **in-process**, exactly like the Oxigraph WASM store in
`packages/sparql`. The engine — `packages/authoring-wasm` — ships a **prebuilt
committed artifact** (`wasm/osc-engine.{mjs,wasm}`, ~5.7 MB `-Oz`); CI never
builds WASM on the hot path, the same way Oxigraph is consumed prebuilt.

A committed binary blob raises three operational questions the search stack
never had to answer, because everything else in this repo is readable source:

1. **Version drift.** The engine reports which OpenSCENARIO / XSD / upstream
   commit it was built for (`describe()`), and `packages/authoring`'s startup
   probe asserts that against an expectation. If the reported versions, the
   probe's expectation, and (eventually, task 01) the OWL/SHACL derivation are
   three independently-edited constants, they _will_ drift — "ontology derived
   from v1.3, engine emits v1.2" is a silent-wrong-answer class of bug.
2. **Provenance & reproducibility.** A checked-in binary is opaque. Where did it
   come from, and can anyone reproduce it from pinned inputs, or is it a magic
   blob only one machine can regenerate?
3. **Redistribution & lifecycle.** Apache-2.0 §4 requires a `NOTICE` when we
   redistribute the engine (and its statically-linked libraries) in binary form;
   and an in-process native module must be released on shutdown, next to the
   Oxigraph worker, or the process hangs on SIGTERM.

## Decision

Adopt one operating model for the WASM engine, mirroring the repo's
single-source-of-truth discipline:

### 1. Version single-source — `versions.json`

`packages/authoring-wasm/versions.json` is the **one** human-edited pin (engine
name, full commit SHA, `git describe` tag, OSC versions, XSD version, Emscripten
version). It is consumed by:

- **the C++ build** — `native/build.mjs` generates `osc_versions_generated.h`
  from it, and `describe()` returns that generated payload. The reported
  versions therefore **cannot drift from the pin**: they are generated, not
  hand-written in C++. A drift test asserts `describe()` deep-equals the
  `versions.json`-derived object.
- **the TS side** — `ENGINE_VERSIONS` (exported from `authoring-wasm`) is a
  typed view of `versions.json`; `packages/authoring`'s `EXPECTED_ENGINE`
  derives from it, so the capability probe's expectation is the same source as
  the artifact it guards. A version bump is a single, safe edit in one file.

> Task 01 (OWL/SHACL from the ASAM model) will add the third consumer — the
> ontology derivation reading the same `versions.json` — closing the last drift
> gap. It is intentionally not wired yet because that derivation does not exist.

### 2. Reproducible build — pinned inputs + integrity manifest

`native/build.mjs` deterministically rebuilds the artifact from the **pinned
Emscripten SDK** (`versions.json.emscripten`) and the **pinned RAC submodule**
commit, applying only the small, upstreamable portability patch
(`native/patches/0001-*.patch`) at build time. Every build also writes a
`sha256sum`-compatible integrity manifest, `wasm/osc-engine.wasm.sha256`, so the
one file a reviewer cannot read in a diff is tamper/corruption-evident. CI
verifies the committed artifact against its manifest on every PR
(`verify-checksum.mjs`), and — path-filtered to the engine's build inputs —
rebuilds the WASM on a clean Linux runner from the pinned SDK and runs the
golden-conformance suite against the freshly-built binary.

### 3. NOTICE & graceful shutdown

`packages/authoring-wasm/NOTICE` aggregates Apache-2.0 (RAC) plus the
statically-linked third-party licenses (ANTLR4 BSD-3-Clause, TinyXML2 zlib,
UtfCpp BSL-1.0, ghc::filesystem MIT), satisfying Apache-2.0 §4 for binary
redistribution. The API's SIGINT/SIGTERM handler disposes the engine via
`closeAuthoringBackend()` immediately after `closeSparqlStore()`, so the drain
order is server → SPARQL store → authoring engine → exit.

## Scope & honest deviation: functional vs. byte-for-byte reproducibility

The plan's acceptance names a CI job that reproduces `osc-engine.wasm`
**bit-for-bit**. Byte-for-byte parity requires a **pinned build container** so
the canonical artifact and the CI rebuild share an identical host (toolchain
paths and any `__FILE__`/debug metadata that can leak into the binary differ
across OSes even with an identical Emscripten version). The canonical artifact
in this increment was produced on Windows; the CI runner is Linux. We therefore
ship, and gate on, **functional reproducibility** — a clean-runner rebuild from
pinned inputs that must pass the golden-conformance suite — plus the committed
**checksum integrity** gate. True bit-for-bit reproducibility (a pinned-container
canonical build whose digest CI re-derives and diffs) is a deliberate follow-up,
recorded here so the weaker-but-honest guarantee is not mistaken for the stronger
one.

## Consequences

- A version bump is one edit to `versions.json`; the build regenerates
  `describe()` and the checksum, and the probe/tests fail loudly on any
  divergence — drift is caught at startup and in CI, not by users.
- The committed binary is reproducible from pinned inputs and integrity-checked;
  it is no longer an opaque blob.
- Redistribution is license-correct, and the process shuts down cleanly.
- The residual gap (cross-host byte parity) is bounded, documented, and blocked
  only on a pinned-container build — not on any design change here.

## Alternatives considered

- **Three hand-maintained version constants** (C++, TS probe, ontology).
  Rejected: exactly the multi-source drift the rest of the architecture is built
  to prevent.
- **Build the WASM in the hot CI path / on install.** Rejected: the emsdk +
  239-object build is minutes-long and needs a JDK and Emscripten; consuming a
  committed prebuilt artifact (as Oxigraph does) keeps `install`/`build`/`test`
  fast, with a path-filtered reproducibility job as the safety net.
- **No integrity manifest.** Rejected: a committed binary with no digest is
  unreviewable and silently corruptible.

## Related

- [ADR 0003](./0003-decompose-search-package.md) — the in-process WASM store
  pattern (Oxigraph) this engine mirrors.
- `packages/authoring-wasm/native/BUILD.md` — the reproducible build recipe and
  the Emscripten/submodule pins.
- `packages/authoring-wasm/NOTICE` — the aggregated redistribution notice.
