# Generic Ontology-Agnostic Design

## Design Principle

The system is **ontology-agnostic**: it works with any set of OWL + SHACL ontologies loaded into the schema graph. There are no hardcoded domain names, predicates, class IRIs, or property enumerations in production code. Everything is discovered at runtime from the schema.

::: tip Portability Example
Replace the ENVITED-X automotive simulation ontologies with a retail product ontology (`outdoor-shoes`, `winter-jackets`) — the same pipeline handles queries like "waterproof hiking boots under €100" without any code changes.
:::

## Graph-Driven Discovery

Instead of hardcoding knowledge about the ontology structure, every component queries the SHACL schema graph dynamically:

```mermaid
graph LR
    SCHEMA["Schema Graph<br/>‹urn:graph:schema›<br/>(OWL + SHACL)"]

    SCHEMA --> PD["Property Path Discovery<br/>(asset → leaf predicate chains)"]
    SCHEMA --> DR["Domain Registry<br/>(rdfs:subClassOf → asset classes)"]
    SCHEMA --> SQ["Schema Queries<br/>(shape groups, references, ranges)"]
    SCHEMA --> IT["Investigation Tools<br/>(LLM runtime exploration)"]

    PD --> COMP["Compiler"]
    DR --> COMP
    SQ --> COMP
    IT --> LLM["LLM Agent"]

    style SCHEMA fill:#dbeafe,stroke:#3b82f6
    style COMP fill:#dcfce7,stroke:#22c55e
    style LLM fill:#848ab7,stroke:#5a6f9f,color:#fff
```

### What Is Discovered (not hardcoded)

| What                  | How                                                                          | Example                                                       |
| --------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Asset domains**     | `rdfs:subClassOf` + `sh:targetClass`                                         | `hdmap`, `scenario`, `ositrace`                               |
| **Property paths**    | Walk `sh:property` / `sh:node` chains                                        | `Asset → hasDomainSpec → hasContent → roadTypes`              |
| **Allowed values**    | `sh:in` RDF lists                                                            | `["motorway", "rural", "urban"]`                              |
| **Shape groups**      | `sh:property` → `sh:node` structure                                          | `Content`, `Format`, `Quality`, `Quantity`                    |
| **Cross-domain refs** | `sh:class` pointing to another domain's target class                         | `scenario → hdmap`, `scenario → ositrace`                     |
| **Location chain**    | Property paths ending in `country`, `city`, etc.                             | `DomainSpec → hasGeoreference → hasProjectLocation → country` |
| **Range properties**  | `sh:datatype xsd:integer/float`, directly or as every datatype of an `sh:or` | `laneCount`, `length`, `speedLimit`                           |

## Property Path Discovery

The compiler needs to know the predicate chain from an asset to each leaf property. Instead of hardcoding paths like `hasDomainSpecification → hasContent → roadTypes`, the system walks SHACL shapes:

```mermaid
graph TD
    subgraph "SHACL Declaration"
      NS["NodeShape<br/>sh:targetClass hdmap:HdMap"]
      PS1["PropertyShape<br/>sh:path hdmap:hasDomainSpecification"]
      N1["sh:node → DomainSpec shape"]
      PS2["PropertyShape<br/>sh:path hdmap:hasContent"]
      N2["sh:node → Content shape"]
      PS3["PropertyShape<br/>sh:path hdmap:roadTypes<br/>sh:in (motorway rural urban ...)"]
    end

    NS --> PS1 --> N1 --> PS2 --> N2 --> PS3

    subgraph "Discovered Path"
      S0["Step 0: hdmap:hasDomainSpecification"]
      S1["Step 1: hdmap:hasContent"]
      S2["Step 2: hdmap:roadTypes (leaf)"]
    end

    PS1 -.-> S0
    PS2 -.-> S1
    PS3 -.-> S2
```

The `buildPropertyPaths()` function produces one `PropertyPath` per (asset-class, leaf-property) pair. The compiler uses these paths to emit SPARQL triples without any ontology-specific knowledge.

Two SHACL rules widen what counts as a leaf:

- **Inheritance below the asset.** A class-based target covers every instance of the class, subclasses included (SHACL §2.1.3.2). When the walk reaches a node of class `C`, the shapes targeting `C`'s `rdfs:subClassOf` ancestors apply to it too. This is how an HD map's content item typed as an OpenLABEL `OddScenery` gets the ODD properties that OpenLABEL declares on its `Odd` superclass, such as the lane count.
- **Disjunctive leaves.** A property shape whose `sh:or` has a member with an `sh:datatype` admits literal values (SHACL §4.6.3), so it is a leaf even when another member points at a sub-resource, as in "a number, or a range node". It is a range property when every datatype among its members is numeric.

Paths found only through these rules never displace anything the compiler already resolves: they are added only for property names that have no path yet and belong to no shape group, and they are not used for cross-reference chains. A query over properties that already resolved compiles to the same SPARQL as before.

## Filter Routing

Filters are key-value pairs keyed by SHACL leaf local name — `country`, `region`, `license`, `roadTypes`, `formatType`, and so on. There is no privileged `location` or `license` slot: country, state, region, city, and license all flow through the same map. The compiler resolves each filter against the discovered property-path graph:

1. For each `(filterKey, value)` pair, find every domain whose property paths end in a leaf named `filterKey`.
2. If the primary domain owns the path → emit the triple pattern on the primary.
3. If not → JOIN through the first referenced domain that owns it.
4. Referenced domains without any active filter are **not** joined (avoids over-constraint).

```mermaid
flowchart TD
    F["Filter: country=DE<br/>(any SHACL leaf, not a privileged slot)"]
    OWNED{"Primary domain<br/>owns the leaf path?"}
    F --> OWNED
    OWNED -->|Yes| AP["Emit on primary"]
    OWNED -->|No| SCAN["Scan referenced domains"]
    SCAN --> FIRST{"First ref domain<br/>owning the leaf?"}
    FIRST -->|Found| DELEGATE["JOIN through that domain"]
    FIRST -->|None| DROP["Honest gap (no domain has this property)"]

    style AP fill:#dcfce7,stroke:#22c55e
    style DELEGATE fill:#fef3c7,stroke:#f59e0b
    style DROP fill:#fef2f2,stroke:#ef4444
```

## Single-Tool Forced Choice

The agent exposes only `submit_slots` with forced tool choice. The LLM receives the full SHACL vocabulary in its system prompt and commits to structured output in a single round-trip:

```mermaid
sequenceDiagram
    participant U as User
    participant L as LLM
    participant SS as submit_slots (forced)

    U->>L: "French motorways"
    Note over L: Prompt has full SHACL shapes

    alt Simple query (usual case)
        L->>SS: submit_slots(domains:[hdmap],<br/>filters:{roadTypes:[motorway], country:[FR]})
    else Cross-domain (references list, AND-combined)
        L->>SS: submit_slots(domains:[scenario], filters:{country:[FR]},<br/>references:[{domain:hdmap}])
    else Chained / nested reference
        L->>SS: submit_slots(domains:[scenario],<br/>references:[{domain:ositrace, references:[{domain:hdmap}]}])
    end
```

The two cross-domain branches are distinct claims: flat siblings `[{ositrace}, {hdmap}]` mean the scenario references a trace **and** (independently) a map; the nested form `[{ositrace, references:[{hdmap}]}]` means scenario → trace → map (the map belongs to the trace). Both compile deterministically from discovered SHACL paths.

The key insight: **the system prompt embeds the full SHACL ontology** — the LLM has complete knowledge of domains, properties, allowed values, and cross-domain relationships without needing runtime exploration tools.

## Multi-Domain Query Architecture

When the LLM selects multiple domains, the compiler applies intelligent constraint routing:

```mermaid
flowchart TD
    SLOTS["SearchSlots<br/>domains: [hdmap, ositrace]<br/>filters: {roadTypes: [motorway], country: [FR]}"]

    SLOTS --> PRIMARY["Primary domain: hdmap<br/>(owns both roadTypes and country leaves)"]
    SLOTS --> REF["Referenced: ositrace<br/>(no filters → SKIP)"]

    PRIMARY --> QUERY["Generated SPARQL queries<br/>only hdmap with both filters"]

    style PRIMARY fill:#dcfce7,stroke:#22c55e
    style REF fill:#f3f4f6,stroke:#d1d5db
    style QUERY fill:#dbeafe,stroke:#3b82f6
```

**Rules:**

1. Filters apply only to the domain that owns the SHACL leaf path
2. Country / region / city / license route by leaf ownership too — no privileged location slot
3. Referenced domains without any constraints are **skipped** — no empty mandatory JOINs
4. This prevents the "over-constraint" problem where multi-domain selection returns zero results

## Ontology Budget Rule

The codebase enforces a **monotonically decreasing ontology-name budget**: every change must reduce (never increase) the number of ontology-specific identifiers in production source files. Tests may reference specific properties to assert behavior, but production code paths must not.

This ensures the generic design improves over time rather than accumulating domain-specific debt.
