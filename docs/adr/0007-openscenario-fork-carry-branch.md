# ADR 0007 — OpenSCENARIO engine: fork carry-branch integration (retire the build-time patch)

- **Status:** Accepted
- **Date:** 2026-07-26
- **Supersedes:** the build-time-patch mechanism of [ADR 0006](./0006-authoring-wasm-engine-ops-model.md) (the rest of 0006 — version single-source, checksum, NOTICE, graceful shutdown — stands unchanged)

## Context

ADR 0006 established the authoring WASM engine as a committed artifact built from
a **pinned upstream commit** of RA Consulting's `openscenario.api.test` plus a
**build-time portability patch** (`native/patches/0001-emscripten-portability.patch`,
applied by `build.mjs` with `git apply`).

That single patch bundles five edits with three _different_ upstream
dispositions:

1. Three `#elif defined(__EMSCRIPTEN__)` branches (`ExportDefinitions.h`,
   `OscExprExportDefs.h`, `FileResourceLocator.cpp`) — clean, general, **want
   upstream** (opened as [PR #227](https://github.com/RA-Consulting-GmbH/openscenario.api.test/pull/227)).
2. A one-line `__EMSCRIPTEN__ → GHC_OS_LINUX` map in the **vendored** `ghc::filesystem`
   header — offerable upstream, but the maintainer may prefer bumping the vendored
   library instead.
3. An `FE_OVERFLOW`/`FE_UNDERFLOW` → `0` shim in `EvaluatorListener.cpp` — a
   correctness trade-off (it disables overflow detection under WASM), filed as an
   **issue, not a PR**; upstream may never take it, yet we must build with it.

A flat build-time patch is the wrong shape for this: it rots against upstream
movement, it cannot distinguish "will be upstreamed" from "carried forever," and
it gives no mechanical path to **shrink as PRs land**. And because at least one
edit (the FP shim) will not be upstreamed as-is, we need a durable home for
carries regardless.

## Decision

Carry the edits as **commits on a branch of the ASCS-eV fork**, and pin the
submodule to that branch.

### Fork branch layout (`ASCS-eV/openscenario.api.test`)

- **`master`** — mirrors upstream.
- **`feature/<pr>`** — one branch per upstream PR, based on the pinned upstream
  base. PR sources only:
  - `feature/emscripten-portability` → PR #227 (the three portability branches).
  - `feature/ghc-filesystem-emscripten` → PR #230 (the ghc map, offered as
    one-line-map-or-version-bump).
  - `feature/import-loader-injected-parameters` → PR #231 (the import loader
    forwards injected parameters). Not a portability edit: it is carried because
    this repo's `validate` resolves catalogs through that loader and exposes
    `parameters`, which the defect would render inert.
  - `feature/orientation-type-default-v1_3` → PR #232. **Not** on `carry/wasm`:
    nothing here reads `Orientation`, so there is no reason to carry it.
- **`carry/wasm`** — the **integration/build branch**: upstream base + every
  not-yet-merged `feature/*` + the carry-only edits (the FP shim). **This repo's
  submodule pins `carry/wasm` by SHA.**

`carry/wasm` takes each `feature/*` commit by **cherry-pick**, never by
re-authoring the same edit: same author, message and diff, only a different
parent. This is what makes "we tested the PR" a true statement rather than "we
tested something that resembles the PR" — the artifact this repo ships is built
from the exact commits upstream is asked to merge. It also makes the shrink
mechanical: a rebase drops a merged cherry-pick by content, with no judgement
call about whether a local variant is now redundant.

### This repo

- `.gitmodules` points `submodules/openscenario-api` at the fork, `branch = carry/wasm`.
- `build.mjs` has **no patch step** — the checkout is build-ready.
- `native/patches/0001-*.patch` is **deleted**; `native/patches/upstream/`
  (per-PR bodies + the upstream-issue triage) is kept as the record of intent.
- The committed `wasm/osc-engine.{mjs,wasm}` and its `.sha256` are **unchanged**:
  `carry/wasm`'s tree is byte-identical to the previous _(base + patch)_ source,
  so the existing artifact remains a valid build of the new pin.
- `versions.json.engineCommit` continues to name the **upstream base**
  (`292d0be…`) — the carries are build-portability only, so the OSC/XSD/checker
  version identity the engine implements is unchanged.

### Lifecycle (how the carries shrink)

When an upstream PR merges: sync the fork's `master`, rebase `carry/wasm` onto it
(the merged commit drops out), re-pin the submodule SHA, **rebuild the WASM and
bump `.sha256`**. Repeat per PR. When only carry-only edits remain (or all land),
point the submodule straight back at upstream and retire `carry/wasm`.

## Consequences

- Upstreaming is cherry-pick-clean, and each carried edit has an explicit
  disposition (PR vs. carry) instead of hiding in one flat diff.
- The "delete the patch as PRs land" goal is now mechanical (a rebase + re-pin),
  not a hand-edit of a fuzzing patch.
- The permanent carry (FP shim) has a durable, documented home.
- **Cost:** we keep `carry/wasm` rebased against upstream (strictly safer than
  flat-patch fuzz), and "what we changed to upstream source" is now a fork commit
  range rather than an in-repo diff — mitigated by keeping `patches/upstream/`.
- ADR 0006's guarantees are otherwise intact: a source/pin change still requires a
  WASM rebuild + checksum bump, still gated by the reproducible-build + checksum CI
  jobs.

## Honest note on this cutover

The cutover itself did **not** rebuild the artifact — `carry/wasm`'s tree is
byte-identical to the prior _(base + `0001` patch)_ source (verified: the diff
between `carry/wasm` and a fresh `base`+patch apply is empty), so the committed
`.wasm` remained a valid functional build of the new pin, and `verify-checksum`
(blob vs. its own manifest) was unaffected.

**Since verified by an actual rebuild.** When `carry/wasm` was re-created from
the two upstream PR commits by cherry-pick, the engine was rebuilt from that pin
with the pinned Emscripten SDK (6.0.3) and the fresh artifact passes the
golden-conformance suite plus `verify-checksum`. Three facts were checked rather
than assumed:

- the re-created branch's tree hash equals the previous pin's — the cherry-picks
  changed provenance, not content;
- applying the two reviewable patches in `patches/upstream/` to the pristine
  base yields the same tree as the two cherry-picks, so patch, PR branch and
  build pin cannot disagree;
- the freshly built engine validates the golden scenarios identically.

The committed bytes are **unchanged**: the rebuild differs from the committed
blob only in host-dependent ways (5 826 632 vs 5 825 292 bytes from a different
build host), and byte-for-byte cross-host parity is explicitly out of scope
(ADR 0006, and the `authoring-wasm` workflow, which checksums the build it just
produced rather than the committed one). Shipping a functionally identical blob
purely to change its hash would be churn. The **next** engine change (wiring the
range/union/version checkers already compiled into the artifact) is what will
land a genuinely different artifact.

## Alternatives considered

- **Keep the flat build-time patch.** Rejected: rots against upstream, no
  per-edit disposition, no mechanical shrink path, and no clean home for the
  permanent carry.
- **Vendor a full copy of the engine in-repo.** Rejected: loses the upstream
  provenance and the submodule pin that ADR 0006 relies on.
- **Wait, upstream everything, then just bump the pin.** Rejected: at least the
  FP-exception shim will not be upstreamed as-is, so a carry is unavoidable —
  which is exactly what `carry/wasm` provides.

## Related

- [ADR 0006](./0006-authoring-wasm-engine-ops-model.md) — the version
  single-source, reproducible build, checksum, and shutdown model this extends.
- `packages/authoring-wasm/native/patches/upstream/README.md` — per-PR bodies +
  the upstream-issue triage.
- `packages/authoring-wasm/native/BUILD.md` — the build recipe (now patch-free).
- Upstream PR #227; fork branches `carry/wasm`, `feature/emscripten-portability`,
  `feature/ghc-filesystem-emscripten`.
