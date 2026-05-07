# Ontology Model

## SKOS Vocabularies

The system uses SKOS (Simple Knowledge Organization System) to define domain vocabularies:

- **Concepts** — Controlled values for properties (e.g., road types, lane types)
- **Labels** — `skos:prefLabel` and `skos:altLabel` for matching user terms
- **Hierarchies** — `skos:broader` / `skos:narrower` for concept relationships

## SHACL Shapes

SHACL defines the expected data structure:

- **Property shapes** — Which properties exist and their types
- **Value constraints** — `sh:in` for allowed values, `sh:datatype` for ranges
- **Cardinality** — Required vs optional properties

## Domain Registry

Each domain (HD map, scenario, etc.) registers:

- Its SHACL shape files
- Its SKOS vocabulary files
- Its glossary definitions
- Its count query template

## Multi-Domain Support

The system is designed for multiple asset domains:

- HD maps (road networks, lane configurations)
- Scenarios (traffic situations, weather conditions)
- Environment models (3D assets, terrain)
- Vehicle models (sensor configurations)

Each domain has its own vocabulary and shapes, loaded on demand.
