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

Each contract below is guarded by a named test. O1 is the genericity keystone (criterion 9b): metadata is discovered from the graph, never from a hardcoded name list. Tests run against the real workspace ontology (loaded via the submodule chain) unless they build a synthetic fixture tree in a temp workspace.

| #   | Requirement / invariant                                                                                                                                                                                                          | Guarded by                                                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | **Primary asset class is graph-driven, never a name list** — selection follows `rdfs:subClassOf` (real RDF parser, blank-node restrictions skipped), not a PascalCase match plus a sub-shape name list — the genericity keystone | `src/__tests__/domain-registry.asset-class.test.ts` ("primary-asset-class selection — graph-driven (no name list)" › "selects the asset-base subclass, not the name match or the first-declared sub-component") |
| O2  | **Domain metadata is discovered from SHACL/RDFS** — `buildDomainRegistry` derives each domain's `targetClass`, namespace, version, and shapes from `sh:targetClass` + `@prefix` + the class hierarchy                            | `src/__tests__/domain-registry.test.ts` ("discovers hdmap domain with correct metadata", "discovers scenario domain")                                                                                           |
| O3  | **Prefix alias is derived, not assumed** — when the directory name differs from the TTL `@prefix`, the resolved alias and namespace come from the declared prefix                                                                | `src/__tests__/domain-registry.test.ts` ("discovers openlabel-v2 domain with underscore prefix")                                                                                                                |
| O4  | **SPARQL PREFIX blocks are emitted from declared prefixes** — `prefixesFor`/`allPrefixes` combine standard prefixes with every domain's declared `@prefix` set, no hardcoded prefix names                                        | `src/__tests__/domain-registry.test.ts` ("generates SPARQL prefixes for a domain", "generates all prefixes")                                                                                                    |
| O5  | **`domainForIri` uses longest-prefix match** — an IRI under a more specific namespace resolves to that domain; an unknown namespace returns `undefined`                                                                          | `src/__tests__/domain-registry.test.ts` ("domainForIri (longest-prefix match)")                                                                                                                                 |
| O6  | **`getAllNamespaces` is the complete, deduplicated SPARQL-policy allowlist source** — every domain namespace + every declared-prefix namespace, as a `Set`                                                                       | `src/__tests__/domain-registry.test.ts` ("getAllNamespaces (SPARQL policy allowlist source)")                                                                                                                   |
| O7  | **Default domain is deterministic and SHACL-derived; empty registry fails loudly** — `getPrimaryDomain` returns the lexicographically first discovered domain, else throws `OntologySourcesError`                                | `src/__tests__/domain-registry.test.ts` ("returns the lexicographically first discovered domain", "throws OntologySourcesError when the registry has no domains")                                               |
| O8  | **Registry is built once and cached** — repeated `buildDomainRegistry()` returns the same reference                                                                                                                              | `src/__tests__/domain-registry.test.ts` ("caches registry on second call")                                                                                                                                      |
| O9  | **Source resolution order: manifest → `ONTOLOGY_ARTIFACTS_PATH` → default submodule chain** — `ontology-sources.json` wins, then the env override, then the canonical chain; `domains` allowlist honored                         | `src/__tests__/sources.test.ts` ("getArtifactRoots"; "DEFAULT_OMB_SUBMODULE_PATH is the canonical chain shared by all callers")                                                                                 |
| O10 | **Malformed manifest fails fast** — a missing manifest returns `null`, but unreadable/invalid-JSON/wrong-shape manifests throw `OntologySourcesError` instead of silently falling back                                           | `src/__tests__/sources.test.ts` ("loadOntologySourcesManifest")                                                                                                                                                 |
| O11 | **Missing ontology sources raise `OntologySourcesError` with actionable, data-driven remediation** — surfaces the `git submodule update --init --recursive` hint, else the config-knob hints                                     | `src/__tests__/sources.test.ts` ("assertOntologySourcesAvailable", "formatMissingSourcesError")                                                                                                                 |
| O12 | **Shape-file discovery is generic and selective-clone-friendly** — every `.shacl.ttl` tagged with its domain dir; non-existent roots skipped; `exclude`/`domains` filters applied                                                | `src/__tests__/sources.test.ts` ("discoverShapeFiles", "diagnoseOntologySources")                                                                                                                               |
| O13 | **SHACL validation is shape-driven, not coded** — constraints enforced by reading the shapes graph; a violating value reports the spec's constraint-component IRI, a valid one conforms                                          | `src/__tests__/shacl-validator.test.ts` ("rejects an out-of-pattern country code (the europe regression)", "rejects a value outside an sh:in enumeration", "accepts a valid ISO 3166-1 alpha-2 country code")   |
| O14 | **SHACL-Advanced constraints are stripped, not fatal** — a shape carrying `sh:sparql` must not abort validation of its sibling Core constraints                                                                                  | `src/__tests__/shacl-validator.test.ts` ("does not throw when validating against a shape that carries an sh:sparql constraint")                                                                                 |
| O15 | **Validation is bounded and engine-frugal** — result cache LRU-capped at `SHACL_CACHE_SIZE`; batch validation calls the engine at most once per (property, target-class); index-failing values fall through (no false negatives) | `src/__tests__/shacl-validator.test.ts` ("never retains more entries than SHACL_CACHE_SIZE"; "ShaclValidator — engine-call accounting (R2, R3, R8)")                                                            |
| O16 | **Depends only on `@ontology-search/core`** — layer 2, may import nothing higher                                                                                                                                                 | `scripts/check-layers.mjs` layer gate (`@ontology-search/ontology` ranked at layer 2)                                                                                                                           |

> The ontology-name budget (CLAUDE.md — monotonically decreasing ontology-specific identifiers) is a repo-wide review/process rule with no single automated assertion; O1 proves the keystone _behavior_ (graph-driven discovery) that makes the budget achievable.

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
