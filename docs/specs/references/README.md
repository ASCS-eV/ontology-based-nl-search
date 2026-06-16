# Normative Specification References

This directory contains **verbatim copies of external specifications** for
offline reference and AI-agent context. They are the normative standards that
the interfaces of this project are built on and **must be verified against**
when any of those interfaces change (see
[`CONTRIBUTING.md` → Standards compliance](../../../CONTRIBUTING.md) and the
agent instructions).

## ⚠️ Important Notice

**These files are NOT original works of this project.** They are copies of
specifications published by their respective standards organizations. The
original copyright, terms, and license of each specification apply. Each file
carries an attribution header recording its source, publisher, license, and
retrieval date. **Do not hand-edit** — refresh from source (see
[Refreshing](#refreshing) below).

## Why these are stored in full (not summarized)

A summary cannot be _verified against_. To make a real compliance claim — "this
interface conforms to §X of spec Y" — the normative text has to be present and
quotable. These are the full documents, retained so both humans and AI agents
can check the exact normative language offline.

## Files

| File | Specification | Publisher | License | Used in this codebase |
| --- | --- | --- | --- | --- |
| `json-schema-core.md` | JSON Schema Core 2020-12 | JSON Schema Org / IETF I-D | AFL-3.0 / BSD-3 | **Slot wire schema** — `slot-wire-schema.ts`, `agent/tools.ts` (Zod → JSON Schema for LLM tool calling). The slot IR's normative contract. |
| `json-schema-validation.md` | JSON Schema Validation 2020-12 | JSON Schema Org / IETF I-D | AFL-3.0 / BSD-3 | Slot/filter validation keywords (`enum`, `type`, `minimum`, …). |
| `graphql.md` | GraphQL Specification (Draft) | GraphQL Foundation (Linux F.) | OWFa 1.0 | `graphql-serializer.ts`, `graphql-parser.ts` (alternate query serialization). |
| `sparql11-query.md` | SPARQL 1.1 Query Language | W3C | W3C Document License | `compiler.ts` output; `@ontology-search/sparql` execution. |
| `shacl.md` | Shapes Constraint Language (SHACL) | W3C | W3C Document License | `schema-loader.ts`, `prompt-builder.ts`, `slot-validator.ts`, `schema-queries.ts`, property-path discovery. |
| `owl2-overview.md` | OWL 2 — Document Overview | W3C | W3C Document License | Ontology (`*.owl.ttl`); `domain-registry.ts` class hierarchy. |
| `owl2-syntax.md` | OWL 2 — Structural Specification | W3C | W3C Document License | OWL constructs consumed during schema load. |
| `rdf11-concepts.md` | RDF 1.1 Concepts & Abstract Syntax | W3C | W3C Document License | Data model underlying all assets, triples, named graphs. |
| `rdf-schema.md` | RDF Schema 1.1 | W3C | W3C Document License | `rdfs:label`, `rdfs:subClassOf` in compiler/registry. |
| `turtle.md` | RDF 1.1 Turtle | W3C | W3C Document License | `*.ttl` ontology + sample data; `FALLBACK_TURTLE`. |
| `json-ld11.md` | JSON-LD 1.1 | W3C | W3C Document License | `data-loader.ts` (`loadJsonLd`, `@context` resolution); `*.context.jsonld`. |
| `skos-reference.md` | SKOS Reference | W3C | W3C Document License | `concept-expansion.ts`, `scripts/generate-skos.ts` (synonyms/concepts). |
| `did-core.md` | Decentralized Identifiers (DIDs) v1.0 | W3C | W3C Document License | Asset identifiers (`did:web:…`) across the instance data. |
| `eventsource.md` | Server-Sent Events | W3C | W3C Document License | `apps/api` `/search/stream` SSE protocol (`SSE_EVENT`). |
| `rfc8259-json.md` | RFC 8259 — JSON | IETF | IETF Trust (BCP 78) | All JSON payloads on the HTTP boundary (`@ontology-search/api-types`). |
| `rfc9110-http.md` | RFC 9110 — HTTP Semantics | IETF | IETF Trust (BCP 78) | Hono HTTP API surface (methods, status, content negotiation). |

## The "slots mechanism" is not a standard

The structured-slots intermediate representation (`SearchSlots` /
`ReferenceFilter`) is **not** a W3C/IETF standard and there is no single spec
for it. It descends from frame semantics (Fillmore / FrameNet) and the
NLU "intent + slot-filling" pattern. Its **only normative on-the-wire
grounding is JSON Schema** (`json-schema-core.md` / `json-schema-validation.md`),
because the LLM tool call that fills the slots is a JSON-Schema-typed function
call. That is the standard the slot interface is held to. See the
[architecture audit](../../../apps/docs/standards-audit.md) for the full
reasoning, including why LinkML was intentionally **not** adopted.

## Retrieval

All files retrieved **2026-06-16**.

## Refreshing

The repository is behind an HTTP proxy that allows `www.w3.org`, `www.ietf.org`,
`spec.graphql.org`, and `raw.githubusercontent.com` (but not
`www.rfc-editor.org`). To refresh, re-download the raw sources with a
proxy-aware client and re-run the HTML→Markdown conversion. Example
(PowerShell):

```powershell
Invoke-WebRequest "https://www.w3.org/TR/shacl/" -OutFile raw/shacl.html
# …repeat per source in the table above…
# then convert HTML→Markdown (turndown) and prepend the attribution header.
```

Source URLs are recorded in the attribution header at the top of each file.
