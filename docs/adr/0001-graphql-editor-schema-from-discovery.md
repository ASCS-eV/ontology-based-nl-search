# ADR 0001 — GraphQL editor schema from runtime discovery; LinkML for the data model only

- **Status:** Accepted
- **Date:** 2026-06-17

## Context

The GraphQL editor is the **central developer-facing tool**: developers author
queries in it; natural-language search _prefills_ it (NL → slots → GraphQL); the
compiled SPARQL is shown read-only / informational. For the editor to be a real
tool it needs a GraphQL **schema** to drive autocomplete, validation, and hover.

Today the editor already depends on `cm6-graphql` (the standard schema-aware
CodeMirror 6 GraphQL integration) but does **not** use it: autocomplete is a
hand-rolled `buildCompletionSource(vocabulary)` and validation is syntax-only
(`graphql` `parse`), because **no `GraphQLSchema` object exists anywhere**.

Two tempting-but-wrong options were raised:

1. **Generate the editor schema with LinkML `gen-graphql`.** LinkML is (rightly)
   becoming the source of truth for the **data model** and can generate
   SHACL / OWL / JSON-Schema. But its GraphQL generator emits a **data-model
   SDL** (GraphQL types from classes/slots), is alpha-stage, and has **no filter
   arguments** — it is not the **query** interface the editor needs. It would
   also only cover LinkML-native ontologies, coupling the editor to the
   migration timeline.
2. **A bespoke SHACL→GraphQL transpiler, or GraphQL-LD / Comunica for
   execution** — both rejected previously (invention; filter-capability gaps).

## Decision

1. **The editor `GraphQLSchema` is built from the runtime schema-graph
   discovery** (`schema-queries.ts` / the `/vocabulary` API), which is
   **ontology-source-agnostic**: it reads whatever SHACL is loaded, whether
   hand-authored or LinkML-generated. It therefore covers ENVITED-X **and**
   OpenLABEL-v2 uniformly, today, with **no dependency on the LinkML migration**.
2. **Feed that schema to `cm6-graphql`** for schema-aware autocomplete,
   validation (lint), and hover — **deleting** the hand-rolled
   `graphql-completion.ts`. Validate authored queries with
   `graphql.validate(schema, ast)` instead of syntax-only parsing.
3. **Keep slots + the deterministic SPARQL compiler for execution.** Flow stays
   NL → slots → GraphQL (prefill) → developer edits → validate against schema →
   slots → SPARQL.
4. **LinkML is the source of truth for the data model only** — it generates the
   SHACL/OWL/JSON-Schema the runtime consumes. It is **not** the source of the
   editor's query schema. Migrating ontologies to LinkML is encouraged and is
   orthogonal to the editor.
5. **The slot IR stays internal and JSON-Schema-grounded** (the LLM tool-call
   contract); it is not modeled in LinkML and is not partner-facing.

## Consequences

- The editor becomes a first-class tool (real validation + autocomplete) using
  OSS already in `package.json`; **net hand-written code decreases**.
- A single discovery feeds both the editor schema and the SPARQL compiler, so
  they cannot drift — guarded by a coverage test, complementing the existing
  "GraphQL ↔ SPARQL equivalence" round-trip guard and the compile-time
  exhaustiveness guard in `graphql-serializer.ts`.
- The query-schema projection (discovery → `GraphQLSchema`) is a small, custom,
  **unavoidable** piece: no off-the-shelf tool generates a query/filter GraphQL
  API from an ontology. The **data model**, by contrast, is **not** invented —
  it comes from LinkML/SHACL.
- **Open follow-up:** reference-scoped `filters`/`ranges` use arbitrary property
  keys, which strict GraphQL input objects cannot express. The spike uses a
  permissive `JSON` scalar there; a later decision can tighten this (per-domain
  input types) or adjust the DSL.

## Alternatives considered

- **LinkML `gen-graphql` for the editor schema** — rejected (data-model SDL, no
  filter arguments, alpha, migration-coupled).
- **SHACL→GraphQL transpiler** — rejected (invention).
- **GraphQL-LD / Comunica for execution** — rejected (filter-capability gaps;
  niche, partly-stale glue between GraphQL-LD and current Comunica).

## Related

- **Partner-facing contracts** (a separate, orthogonal track): publish an
  **OpenAPI** description of the Hono+Zod HTTP API, and expose the existing
  Apache Jena **Fuseki SPARQL 1.1 endpoint** for partners who need direct graph
  access. Both are standardized, well-maintained contracts that require no new
  invention.
