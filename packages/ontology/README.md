# @ontology-search/ontology

> Ontology source resolution and graph-driven, ontology-agnostic schema discovery (domains, class hierarchy, SHACL validation).

**Layer:** sits just above `core` (`core ← sparql, ontology ← search ← llm ← apps`). Depends only on `@ontology-search/core`.

## Purpose

Resolves the OWL + SHACL source files (via `ontology-sources.json`) and discovers the asset domains and their class hierarchy generically from the loaded SHACL/RDFS — using the `n3` parser for robust `rdfs:subClassOf` and `sh:targetClass` extraction — and exposes a SHACL validator. **Ontology-agnostic by design:** no domain names, prefixes, or class IRIs are hardcoded; everything (target classes, namespaces, shape groups, prefix declarations) is discovered at runtime from the loaded graph.

## Public interface

| Subpath             | Purpose                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `.`                 | Barrel re-export of the primary surface (`buildDomainRegistry`, `DomainDescriptor`, `DomainRegistry`)               |
| `./domain-registry` | `buildDomainRegistry` — auto-discovers domain metadata from SHACL shapes; `DomainDescriptor`/`DomainRegistry` types |
| `./shacl-validator` | SHACL validation backed by `rdf-validate-shacl`                                                                     |
| `./sources`         | Ontology source-file resolution (`getArtifactRoots`, `ontology-sources.json` handling)                              |

## Requirements & invariants

- **No hardcoded ontology identifiers.** Domain names, prefixes, target classes, and shape groups are discovered from the loaded SHACL/RDFS at runtime — this upholds the repo's monotonically-decreasing ontology-name budget.
- `buildDomainRegistry` derives metadata from `sh:targetClass`, `owl:imports`, and declared `@prefix` lines, producing target classes, namespaces, and the SPARQL prefix declarations the rest of the pipeline registers.
- Expects ontology source files to be present (populated via the nested git submodule chain — `git submodule update --init --recursive`); raises `OntologySourcesError` from `core` when sources are missing.
- Depends only on `@ontology-search/core`.

## How to interface

```ts
import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'

const registry = buildDomainRegistry()
for (const domain of registry.domains) {
  console.warn(domain.name, domain.targetClass, domain.namespace)
}
```

## See also

- [Root README](../../README.md) — schema loading and the overall search pipeline.
- [`@ontology-search/core`](../core/README.md) — config, errors, and `RDF_PREFIXES` it builds on.
- Generic-design / agnostic-architecture rationale under `apps/docs/`.
