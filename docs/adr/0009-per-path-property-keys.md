# ADR 0009 — One slot key per property path

- **Status:** Accepted
- **Date:** 2026-10-21

## Context

`SearchSlots.filters` / `ranges` are keyed by the local name of a SHACL leaf
property, and every layer resolved a key with that assumption: the compiler's
path index (`<domain>:<localName>` → one `PropertyPath`), the shape-group
emitter (which built the leaf predicate from the key), the vocabulary and term
cards (one per property IRI), the slot validator (allowed values merged per
local name), and the GraphQL enum types (one per name).

A property shape is identified by the node shape that declares it and its
`sh:path` ([SHACL] §2.3), not by the local name of the path's IRI. Two property
shapes reached through different predicate chains are different properties,
with their own `sh:in` ([SHACL] §4.8.3) and their own meaning, even when their
leaf IRI is the same. Two patterns produce such chains:

- **Value objects.** `colour → ColourValue → value` and `size → SizeValue → value`
  share the leaf `value`. Generated ontologies (LinkML) use this pattern
  heavily; the pinned demo ontology has it too (`formats/dimensions/value`,
  `formats/dataRate/value`, `attributes/value` in one domain).
- **One concept in two places.** `hasContent/country` and
  `hasGeoreference/hasProjectLocation/country` in the same domain.

Measured on the pinned ontology: 7 asset-domain keys map to more than one
predicate chain. Each compiled to whichever path the index wrote last, in SPARQL
result order. For those keys the "same slots, same query" guarantee held only
for one store and one result order, and every other chain of the key could
neither be searched nor be told apart by the model.

## Decision

**A slot key names one predicate chain.** Keys are assigned per domain from the
discovered paths, deterministically:

1. Paths are grouped by leaf local name. Paths whose predicate chains are equal
   are one property (they emit the same SPARQL), so they share one key.
2. A leaf name with one chain keeps the name as its key. Nothing changes for
   such a property.
3. A leaf name with several chains gives each chain a **qualified key**: the
   shortest suffix of the chain's predicate local names that no other chain of
   that name shares, joined with `__`, leaf last (`dataRate__value`,
   `hasProjectLocation__country`).
4. A chain that no suffix tells apart, because it is one step long or the tail
   of another chain, is led by the local name of its owning class: the node
   shape that declares the property shape, which is what identifies a property
   shape in SHACL; of several declaring shapes, the first in IRI order
   (`Asset__description` and `GaiaXEntity__description` for
   a `tzip21:description` and a `schema:description` on different classes).
   Chains that still coincide get an ordinal in IRI-chain order (`…__2`).
5. No qualified key ever equals the bare name, which keeps its own meaning
   (below).

`__` keeps a key a valid GraphQL Name ([GraphQL] §2.1.8, as long as it does not
start with `__`) and a valid SPARQL variable name ([SPARQL11] §19.8, rule 166),
and it cannot collide with a leaf name, which a key never mistakes for a
predicate: every emitted predicate comes from the path's steps.

**A bare name that several chains share stays a valid key and means "any of
its chains".** It is what a user says when they do not distinguish the chains
("scenarios in Germany"). The compiler resolves it to the chains that can hold
the value: those whose own `sh:in` contains the value, plus those that declare
no `sh:in`. If no chain qualifies, all chains are used, so a value the slot
validator lets through is never dropped silently. One remaining chain compiles
like a unique key; several compile to one `UNION` group ([SPARQL11] §7), each
branch walking its whole chain from the asset with its own intermediates and its
own value filter, all branches binding the key's variable. Ranges use every
chain of the name.

**Everything the model and the validators see is per key.** A term card,
`enumProperties` entry and numeric property describes one key: its chain's own
`sh:in` (falling back to the values merged per IRI when the chain's shape
declares none), and labels that include the qualifying steps, so "data rate"
finds `dataRate__value`. A qualified key's chain is shown instead of the bare
name. The validator accepts the bare name with the union of its chains' values.
The SHACL gate checks a qualified value against the property shape of the
chain's owning class — every declaring shape when several declare it — and the
validator's in-process checks use that class's constraints only. The editor and
refine GraphQL contract has a field per key and one per bare name over its
qualified keys (an enum over their values when all are enumerated); a field is
an enum only where its own domain enumerates the key, and the serializer emits
enum literals per domain from that same contract.

## Consequences

- The compiler is deterministic by construction for every key: no result order
  decides which path a key compiles to.
- Every chain is searchable and addressable, and value objects work without any
  knowledge of the pattern.
- A bare ambiguous name is broader than before. It used to compile to one
  arbitrary chain; it now matches any chain that can hold the value. For the 7
  affected demo keys this returns the assets the old query missed.
- `UNION` branches do not share intermediate nodes with the query's other
  filters. A bare ambiguous name therefore does not require its value to sit on
  the same node as a sibling filter's. A qualified key keeps the existing node
  sharing.
- The key spelling is an interface: the slot IR, the prompt, GraphQL and the
  `/vocabulary` route all carry it. Adding a chain to an ontology can turn a
  unique name into a qualified one. The bare name keeps matching, now across
  every chain.
