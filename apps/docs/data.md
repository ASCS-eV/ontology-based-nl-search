# Data Model

## RDF Graph Structure

Simulation assets are described as RDF resources with ontology-defined properties:

```turtle
ex:dataset-001 a envited:HDMap ;
  envited:roadTypes "motorway" ;
  envited:laneCount 3 ;
  envited:country "DE" ;
  envited:formatType "OpenDRIVE" ;
  envited:qualityScore 0.95 .
```

## Dataset Sources

Data is loaded from TTL (Turtle) files defined in `ontology-sources.json`:

```json
{
  "sources": [
    { "path": "submodules/ontology-management-base/data/hdmap.ttl" },
    { "path": "submodules/ontology-management-base/data/scenario.ttl" }
  ]
}
```

## Query Results

SPARQL SELECT queries return bindings as key-value pairs:

```json
[
  { "dataset": "ex:dataset-001", "roadTypes": "motorway", "country": "DE" },
  { "dataset": "ex:dataset-002", "roadTypes": "urban", "country": "US" }
]
```

## Caching

The SPARQL store implements query-level caching:

- LRU eviction with configurable TTL
- Cache invalidation on data reload
- Separate cache per domain
