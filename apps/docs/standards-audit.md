# Standards & Architecture Audit

This page audits every **interface** the system exposes or consumes against a
recognized standard, records where each standard is documented, and defines the
**governance rule** that keeps the interfaces compliant. It exists because a
fair question was raised: _is the "slots mechanism" grounded in a standard, or
is it invented?_ The honest, sourced answer is below.

The full normative text of every standard cited here is stored verbatim under
`docs/specs/references/` (see that directory's `README.md` for license and
provenance). Citations in source use a short tag, e.g. `[SPARQL11] §18.2`.

## Executive summary

| Layer            | Interface                 | Governing standard                             | Status                       |
| ---------------- | ------------------------- | ---------------------------------------------- | ---------------------------- |
| Query output     | Compiled SPARQL           | **SPARQL 1.1 Query** (W3C)                     | ✅ standards-based           |
| Query output     | GraphQL serialization     | **GraphQL** (GraphQL Foundation)               | ✅ already cited in code     |
| **LLM contract** | **Slot IR / wire schema** | **JSON Schema 2020-12** (IETF)                 | ⚠️→✅ now documented & cited |
| LLM transport    | Tool/function calling     | Vendor APIs (JSON-Schema-typed)                | ⚠️ vendor, not ratified      |
| API transport    | `/search/stream`          | **Server-Sent Events** (W3C/WHATWG)            | ⚠️→✅ now documented         |
| API transport    | JSON bodies, HTTP verbs   | **RFC 8259**, **RFC 9110** (IETF)              | ✅ standards-based           |
| Data             | Instance data, `@context` | **JSON-LD 1.1**, **RDF 1.1**, **Turtle** (W3C) | ✅ standards-based           |
| Ontology         | Shapes / classes          | **SHACL**, **OWL 2**, **RDFS** (W3C)           | ✅ standards-based           |
| Vocabulary       | Concept expansion         | **SKOS** (W3C)                                 | ✅ standards-based           |
| Identity         | Asset IRIs (`did:web:`)   | **DID Core 1.0** (W3C)                         | ✅ standards-based           |

**Verdict:** the ontology, query, data, and identity layers are W3C/IETF
standards-based. The one bespoke layer is the **slot intermediate
representation** — and it is bespoke by nature (see below), but its **on-the-wire
contract is JSON Schema**, which is now the standard it is held to.

## 1. The "slots mechanism": provenance

The structured-slots IR (`SearchSlots`, `ReferenceFilter`) is **not** a W3C/IETF
standard, and **no single specification defines it**. Its lineage is academic,
not normative:

- **Frame semantics** (Fillmore, 1970s; FrameNet) — meaning organized as frames
  with role **slots**. This is the origin of the word "slot", and the same
  lineage from which frame-based knowledge representation — and LinkML — take
  the term.
- **Slot filling in task-oriented dialogue / NLU** — _intent + slots_ (the user
  goal plus the parameters that complete it). Implemented per-platform (Alexa,
  Dialogflow, LUIS, Rasa); there is no cross-vendor standard. Related, non-binding
  references: FrameNet, ISO 24617-9 (semantic frames), the W3C Voice Interaction
  draft (actions/parameters).

So "slot filling" is a well-established **design pattern**, not a ratified
standard. What _is_ standardized is the **wire format** the slots travel on:

> The LLM never writes SPARQL. It fills slots via a single tool call
> (`submit_slots`). The Vercel AI SDK serializes the tool's Zod schema to
> **JSON Schema 2020-12** for the provider (OpenAI, Anthropic, Mistral all type
> tool parameters as JSON Schema). Therefore **JSON Schema is the normative
> contract for the slot interface**, and `slot-wire-schema.ts` cites it.

Full text: `docs/specs/references/json-schema-core.md`,
`docs/specs/references/json-schema-validation.md`.

## 2. Design decision: why **not** LinkML

The gold-standard reference project this audit drew on
([reachhaven/harbour-credentials](https://github.com/reachhaven/harbour-credentials))
models its schema in **LinkML** and generates JSON-LD, SHACL, JSON Schema, and
code from it. LinkML was **considered and deliberately not adopted here**:

- LinkML earns its keep when **one schema must generate many serializations**
  (a Verifiable Credential is simultaneously JSON-LD, SHACL, and JSON Schema).
  The slot IR has exactly **one** serialization that matters: the JSON-Schema
  tool-call contract.
- The project's **domain source of truth is already SHACL/OWL** — the ontology
  graph. Slots are _derived_ from SHACL at runtime (`schema-queries.ts`,
  `prompt-builder.ts`), not authored independently. A second authoritative
  schema language would compete with the ontology, not complement it.
- Adopting LinkML would inject a **Python toolchain and a codegen build step**
  into a pnpm/TypeScript monorepo — cost without a multi-serialization payoff.

The crucial discipline from the gold standard is portable **without** LinkML:
(1) keep the **standards** in-repo, (2) **cite** them at each interface, and
(3) **mandate verification** against them. That is what this audit institutes.

## 3. Case study — the cross-domain anchoring bug

This audit was triggered by a real query that returned **no results**: OSI
traces referencing HD maps _in Europe with ≥1 intersection_.

- **Symptom:** zero rows. `numberIntersections` does not exist on `OSITrace`
  data at all — it is an HD-map quality metric.
- **Root cause:** `ReferenceFilter` modeled only `{ domain, label, references }`.
  A constraint describing the **referenced** asset (the map's country and
  intersection count) had nowhere to live, so it partitioned to the **top
  level** and bound to the **OSI trace** — the wrong asset. The compiler emitted
  `?domSpec hdmap:numberIntersections …` against a trace that has no such path.
- **Fix:** `ReferenceFilter` now carries reference-scoped `filters`/`ranges`
  (a JSON Schema `object`/optional-properties change), and the compiler's
  `emitReferenceNode` applies them to the **referenced** asset's variable.
  Reference-scoped values get the same fuzzy-match, SKOS expansion, and SHACL
  validation as top-level slots.
- **Verification:** a unit test asserts the constraints bind to `?refAsset_spec`;
  an integration test against the real sample data confirms the corrected query
  returns a non-empty, narrowed result set (e.g. traces referencing
  `dresden-urban-corridor-003`: DE, 7 intersections).

The lesson is the audit's thesis in miniature: the interface was **bespoke and
under-specified**, so a constraint silently bound to the wrong place. Pinning
the interface to JSON Schema and documenting the contract makes that class of
bug reviewable.

## 4. Governance — verify against the standard

When you add or change an interface (a wire field, an SSE event, a SPARQL
construct, a data serialization), you **must**:

1. **Find the governing standard** in `docs/specs/references/` (add it if
   missing, with an attribution header and a README row).
2. **Read the normative section** and keep the change conformant.
3. **Cite it inline** with a `[TAG] §x` comment at the interface
   (see `slot-wire-schema.ts`, `graphql-serializer.ts` for the pattern).
4. **Test the conformance claim** — a reviewer must be able to check the cited
   section against the behavior.

This rule is mirrored in `CONTRIBUTING.md` and the agent instructions
(`.github/copilot-instructions.md`, `CLAUDE.md`).

## Appendix — where the standards live

- Full normative text: `docs/specs/references/*.md` (+ `README.md` index).
- In-site summaries: [RDF Schema](/references/rdfs), [SHACL](/references/shacl),
  and the [SPARQL Reference](/sparql-reference/sparql-1.1-overview) section.
