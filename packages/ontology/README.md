# @ontology-search/ontology

Ontology source resolution and graph-driven schema discovery. Resolves the
OWL + SHACL source files (via `ontology-sources.json`), discovers the asset
domains and their class hierarchy generically from the loaded SHACL/RDFS
(using the `n3` parser for robust `rdfs:subClassOf` extraction), and exposes
a SHACL validator.

**Ontology-agnostic by design:** no domain names, prefixes, or class IRIs are
hardcoded — everything is discovered at runtime.

**Layer:** depends only on `@ontology-search/core`.

## Exports

| Subpath             | Purpose                                                       |
| ------------------- | ------------------------------------------------------------- |
| `.`                 | Barrel re-export of the primary surface                       |
| `./domain-registry` | `buildDomainRegistry`, `DomainDescriptor`, `getPrimaryDomain` |
| `./sources`         | Ontology source-file resolution                               |
| `./shacl-validator` | SHACL validation (`rdf-validate-shacl`)                       |

See [Generic Design](../../apps/docs/generic-design.md) for the agnostic-architecture rationale.
