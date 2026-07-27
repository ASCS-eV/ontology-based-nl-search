# ASAM qc-framework interop

Two directions, one rule-identity contract:

| Direction  | Surface                                                   | Purpose                                                                                            |
| ---------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Out**    | `gapsToXqar(gaps, { inputFile, bundle })`                 | Render this repo's gaps as a `.xqar` result file, so the framework's report modules can read them. |
| **In**     | `runCheckerBundle(input, { command })` → `parseXqar`      | Run a real ASAM checker bundle out of process and import its findings as gaps.                     |
| **Inside** | `qc-bundle/qc_authoring_gate.json` + `qc-bundle/main.mjs` | Let the framework invoke this repo's file-scoped gate as a checker bundle of its own.              |

Everything here is defined by the framework, not by us:

- **`[QC-FW]`** — ASAM Quality Checker Framework, [`asam-ev/qc-framework`](https://github.com/asam-ev/qc-framework)
  (MPL-2.0). Element and attribute names, the `Locations` wrapper and
  `AddressedRule` come from `doc/schema/xqar_result_format.xsd`; the `level`
  severity values and the `Config`/`Param` shape from
  `doc/manual/file_formats.md`; the `exec_command` /
  `$ASAM_QC_FRAMEWORK_CONFIG_FILE` invocation contract from
  `doc/manual/manifest_file.md`.
- **`[QC-XOSC]` / `[QC-XODR]`** — the rule lists the imported UIDs belong to,
  pinned in [`qc-bundles/`](./qc-bundles).

## Out: emitting `.xqar`

One `<CheckerBundle>`, one `<Checker>` per gate that produced findings, one
`<Issue>` per gap. A gap with a source location gets a `<FileLocation
row column>`; one with only a focus node puts the focus node in the `Locations`
description, because the framework has no element-name location type and an
`XMLLocation` xpath we never computed would be a fabrication.

Severity follows what a finding means for the pipeline: semantic and structural
findings make the result invalid and are errors (`level="1"`); residual findings
describe the input road network rather than the authored scene and are warnings
(`level="2"`) — the same line `repairableGaps` draws.

Each `<Checker>` declares **every** rule its gate can emit as an
`<AddressedRule>`, read from `QC_RULES` via each rule's `gate` field, not just
the rules that happened to fire. That is what makes a clean run distinguishable
from a run where a rule was never evaluated.

## In: running a real bundle

`RESIDUAL_MODE=external` plus `RESIDUAL_EXTERNAL_COMMAND` turns the residual gate
into a caller of a real checker bundle:

```bash
RESIDUAL_MODE=external \
RESIDUAL_EXTERNAL_COMMAND='python -m qc_opendrive.main -c $ASAM_QC_FRAMEWORK_CONFIG_FILE' \
pnpm dev
```

The runner writes the road network and a framework config file into a fresh
temporary directory, invokes the command with
`$ASAM_QC_FRAMEWORK_CONFIG_FILE`/`$ASAM_QC_FRAMEWORK_WORKING_DIR` set, parses the
`.xqar` it produces, and removes the directory. Imported issues become gaps
carrying **the bundle's own rule UID**, verbatim: re-attributing a `qc-opendrive`
finding to one of this repo's rules is precisely the misattribution the
rule-identity gate exists to prevent.

This is how the published OpenDRIVE rules get covered — by running the bundle
that implements them, not by reimplementing 26 rules in TypeScript and inheriting
the obligation to keep them in step.

A bundle that exits non-zero, times out, or writes no result is reported through
`GateResult.skipped` with the `external-bundle-unavailable: ` prefix. "The
checker could not run" and "the checker found nothing" must never look alike.

## Inside: running as a checker bundle

`qc-bundle/qc_authoring_gate.json` is a framework module manifest; register it in
your `framework_manifest.json` (adjust the absolute path) and the framework will
invoke `qc-bundle/main.mjs` with a config file, which writes a `.xqar` at the
declared `resultFile`.

**Scope is one `.xodr`**, deliberately. The analytic road-geometry gate is
file-scoped, so it fits the bundle model. The semantic gate does not: it resolves
`.xosc`↔`.xodr` references over a merged RDF graph built from a validated
authoring IR, which a per-file checker cannot be handed. Exposing it as a bundle
checker would advertise coverage it cannot deliver.

## Why the gates are not a bundle reimplementation

The bundles are file-scoped, out-of-process, post-hoc Python checks. These gates
run inline in the authoring repair loop, before anything is serialized, and the
semantic gate does cross-file resolution over one merged graph. Interop adds the
bundles' coverage without giving that up — and keeps every rule identity
resolvable to whoever declared it.
