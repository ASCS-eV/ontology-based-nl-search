# Standards Compliance

Every interface this project exposes or consumes — **function and parameter
definitions / schemas, APIs, and data formats** — adheres to and leverages an
existing, recognized standard, and **references that standard inline the same
way** throughout the code. This page records which standard governs each
interface, where its normative text lives, and the convention that keeps new
interfaces compliant.

The full normative text of every standard is stored verbatim under
`docs/specs/references/` (see that directory's `README.md` for licensing and
provenance). Code cites a standard with a short tag placed at the interface it
governs, e.g. `[SPARQL11] §18.2`.

## Interface inventory

| Layer         | Interface                   | Governing standard                                       |
| ------------- | --------------------------- | -------------------------------------------------------- |
| Query output  | Compiled SPARQL             | **SPARQL 1.1 Query** (W3C)                               |
| Query output  | GraphQL serialization       | **GraphQL** (GraphQL Foundation)                         |
| LLM contract  | Slot IR / tool-call schema  | **JSON Schema 2020-12** (IETF)                           |
| LLM transport | Tool / function calling     | Provider APIs, parameters typed as JSON Schema           |
| API transport | `/search/stream`            | **Server-Sent Events** (W3C / WHATWG)                    |
| API transport | JSON bodies, HTTP semantics | **RFC 8259**, **RFC 9110** (IETF)                        |
| Data          | Instance data, `@context`   | **JSON-LD 1.1**, **RDF 1.1**, **Turtle** (W3C)           |
| Ontology      | Shapes / classes            | **SHACL**, **OWL 2**, **RDFS** (W3C)                     |
| Vocabulary    | Concept expansion           | **SKOS** (W3C)                                           |
| Identity      | Asset IRIs (`did:web:`)     | **DID Core 1.0** (W3C)                                   |
| Config        | `ontology-sources.json`     | **JSON Schema 2020-12** (`ontology-sources.schema.json`) |

The ontology, query, data, and identity layers are W3C/IETF standards directly.
The one layer that is not itself a published standard is the **slot
intermediate representation**, whose wire contract is nonetheless governed by
JSON Schema (below).

## Authoring interfaces (NL → OpenSCENARIO `.xosc`)

The authoring feature is the write-path mirror of search: an LLM fills a typed
**Scene IR**, a gate validates it, a deterministic lowering emits an ASAM
OpenSCENARIO `.xosc`, and an in-process WASM engine validates it. Its interfaces
are held to the same convention.

| Layer          | Interface                         | Governing standard                                                                             |
| -------------- | --------------------------------- | ---------------------------------------------------------------------------------------------- |
| LLM contract   | Scene IR / `submit_scene` schema  | **JSON Schema 2020-12** (IETF)                                                                 |
| Ontology       | OpenSCENARIO classes/shapes       | **OWL 2 · SHACL · RDFS · Turtle** (W3C) `[OSC-XSD]`                                            |
| Data           | `openscenario.context.jsonld`     | **JSON-LD 1.1** (W3C)                                                                          |
| Data           | Generic XML→RDF lift              | **RDF 1.1** (W3C), **XML 1.0** `[XML10]`                                                       |
| Document       | `.xosc` / `.xodr` (in + emitted)  | **ASAM OpenSCENARIO 1.3.0 / OpenDRIVE** (XSD) `[OSC-XSD]`                                      |
| Validation     | Numeric value bounds              | **`RangeCheckerRulesV1_3`** (RA Consulting) `[OSC-RCR]`                                        |
| QC             | Gate rule identities              | **ASAM Quality Checker Framework** UID grammar `[QC-FW]`; bundle rules `[QC-XOSC]` `[QC-XODR]` |
| API transport  | `/author/stream`                  | **Server-Sent Events** (W3C / WHATWG)                                                          |
| API transport  | `/author/refine` JSON + HTTP      | **RFC 8259**, **RFC 9110** (IETF)                                                              |
| Integrity      | committed WASM `.sha256` manifest | **SHA-256** (FIPS 180-4)                                                                       |
| Redistribution | engine `NOTICE`                   | **Apache-2.0 §4**                                                                              |

**ASAM standards are not vendored as prose.** The W3C/IETF rows above reuse the
already-registered reference texts. The ASAM-specific tags — `[OSC-XSD]`,
`[OSC-RCR]`, `[QC-FW]`, `[QC-XOSC]`, `[QC-XODR]` — name standards whose
normative text cannot be mirrored under `docs/specs/references/` (the refresh
proxy allowlist excludes ASAM, and the ASAM license precludes verbatim copies).
Each is instead pinned as a **machine-readable artifact**: `OpenSCENARIO.xsd`
and `RangeCheckerRulesV1_3.cpp` as submodule commits, transcribed into the
derived ontology per `artifacts/openscenario/DERIVATION.md`; the two checker
bundles' rule lists as commit-pinned, SHA-256-checksummed manifests under
`packages/authoring-gate/qc-bundles/`. The `docs/specs/references/README.md`
"ASAM standards" table records each tag, its pinned source, and how to refresh
it.

**Rule identity is gated, not asserted.** A gap may cite `asam.net:…` only if
that UID appears in a pinned bundle list; rules this repo declares itself carry
its own emanating entity per the `[QC-FW]` grammar. Enforced by
`packages/authoring-gate/src/__tests__/qc-rules.test.ts`.

## The slot IR is governed by JSON Schema

The structured-slots IR (`SearchSlots`, `ReferenceFilter`) is the query
intermediate representation the LLM fills via a single tool call
(`submit_slots`); it is not itself a published standard. Its on-the-wire
contract, however, **is**: the AI SDK serializes the tool's Zod schema to
**JSON Schema 2020-12**, which is how provider tool/function calling types its
parameters (OpenAI, Anthropic, Mistral). JSON Schema is therefore the normative
contract for the slot interface, and `slot-wire-schema.ts` cites it.

Conceptually the IR follows the established **intent + slot-filling** convention
from natural-language understanding (frame semantics; FrameNet) — a design
convention, not a ratified standard — so the wire-format grounding in JSON
Schema is what the interface is held to.

Full text: `docs/specs/references/json-schema-core.md`,
`docs/specs/references/json-schema-validation.md`.

## Citing a standard in code (the convention)

When you add or change an interface — a function or parameter
definition / schema, an API surface, an SSE event, a SPARQL or GraphQL
construct, or a data / serialization format — you **must**:

1. **Identify the governing standard** and ensure its normative text is in
   `docs/specs/references/` (add it — with an attribution header and a README
   row — if missing).
2. **Make the interface conform** to the relevant normative section.
3. **Reference the standard inline, the same way everywhere**: a `[TAG] §x`
   comment at the interface. See `slot-wire-schema.ts`, `compiler.ts`,
   `core/src/sse/events.ts`, and `graphql-serializer.ts` for the pattern.
4. **Make the conformance claim checkable** — a reviewer can read the cited
   section and verify the behaviour.

This is criterion #31 in `CONTRIBUTING.md`, and the agent instructions
(`.github/copilot-instructions.md`, `CLAUDE.md`) require it too.

## Where the standards live

- Full normative text: `docs/specs/references/*.md` (+ `README.md` index).
- In-site summaries: [RDF Schema](/references/rdfs), [SHACL](/references/shacl),
  and the [SPARQL Reference](/sparql-reference/sparql-1.1-overview) section.
