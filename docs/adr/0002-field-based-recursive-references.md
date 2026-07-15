# ADR 0002 — Field-based recursive references in the editor GraphQL DSL

- **Status:** Accepted
- **Date:** 2026-06-17
- **Supersedes:** the "Open follow-up" of [ADR 0001](./0001-graphql-editor-schema-from-discovery.md)
  (reference-scoped `filters`/`ranges` as a permissive `JSON` scalar).

## Context

ADR 0001 built the editor `GraphQLSchema` from runtime discovery and fed it to
`cm6-graphql`. Top-level fields, arguments, and enum values all autocomplete and
validate. References, however, were modelled as an **input-object argument**:

```graphql
ositrace(references: [{ domain: "hdmap", filters: { … }, ranges: { … } }]) { _all }
```

A GraphQL input object cannot be typed conditionally on a sibling field's value,
so `filters`/`ranges` (whose keys are arbitrary per the chosen `domain`) could
not be modelled as typed inputs. The spike used a permissive `JSON` scalar there
and typed `domain` as `String`. The consequence, confirmed in a real browser:
autocomplete and validation went **dead inside a reference** — no help choosing
the referenced domain, no property/enum/`min`/`max` suggestions for its filters.
Everything outside references worked.

## Decision

**Model references as recursive _fields_, not an argument.** A referenced asset
is the same shape as a top-level asset — property constraints plus its own
references — so it reuses the _same_ `domain → result type` projection at every
depth:

```graphql
query {
  ositrace {
    references {
      hdmap(label: "x") {
        roadTypes(values: [motorway])   # per-domain enum + validation + autocomplete
        numberIntersections(min: 1)
        references { … }                # nests to any depth
      }
    }
  }
}
```

Schema shape (`packages/graphql-ir/src/graphql-schema.ts`; the web module is a
CodeMirror adapter):

- Every `<domain>_Result` type gains a `references: References` field (a reserved
  editor field, like `_all`).
- One shared `References` type exposes a field per discovered domain,
  `<domain>(label: String): <domain>_Result`.
- The `ReferenceInput` input object and the `JSON` scalar are **deleted**.

The slot IR (`ReferenceFilter`) and the SPARQL compiler are **unchanged** — only
the GraphQL projection changes. The serializer and parser
(`packages/graphql-ir/src/graphql-{serializer,parser}.ts`) render/parse the nested
field shape with one recursive routine shared by domains and references, so
reference filters now reuse the top-level enum-literal path (they round-trip and
autocomplete identically).

### Why "all domains referenceable" for now

Discovery exposes domains and per-domain properties, but **not** the cross-domain
relation _edges_ yet (that is the meta-model rework). Current semantics already
allow referencing any domain — the compiler discovers the SPARQL join — so the
shared `References` type lists **all** domains. When relation edges are discovered
from SHACL, this narrows to per-parent, predicate-named relation fields
(`ositrace { referencedMap { … } }`) **without changing the recursive
structure** — the editor schema becomes the natural surface for that work.

## Consequences

- The reference dead zone is gone: full typing/validation/autocomplete inside
  references at any depth, verified by a real-browser Playwright guard
  (`apps/e2e/tests/graphql-editor-autocomplete.spec.ts`) — the faithful
  environment, since vitest cannot host `graphql-language-service` (graphql@16
  has no `exports` map → dual CJS/ESM instances → `instanceof` "another realm").
- **Net code decreases**: `ReferenceInput`, the `JSON` scalar, and four
  serialize/parse helpers (`serializeRefFilters`/`serializeRefRanges`/
  `parseReferenceObject`/`parseRef*`) are replaced by one recursive block
  routine on each side.
- **Reserved field name:** `references` is reserved (like `_all`/`_empty`). A
  discovered property whose local name is literally `references` would collide;
  this is documented and can be detected if it ever arises.
- **Wire-shape change:** the serialized GraphQL DSL changed (references are
  fields, `label` is an argument, reference filter values are enum literals).
  The slot IR and HTTP slot contract did not change.

The field and argument grammar conforms to the
[GraphQL Specification, September 2025](https://spec.graphql.org/September2025/).

## Alternatives considered

- **Keep the argument; type `filters`/`ranges` as global per-name input objects.**
  Restores some autocomplete but inherits the "can't depend on sibling `domain`"
  ceiling and adds round-trip code for a shape the field model discards. Rejected
  as interim scaffolding.
- **`graphql-scalars` `GraphQLJSON`** for a faithful JSON scalar. A JSON scalar
  has no shape, so it still offers no autocomplete — does not solve the problem.
- **Strict per-domain reference scoping now.** Needs discovered relation edges;
  deferred to the meta-model rework (this ADR's structure already accommodates it).
