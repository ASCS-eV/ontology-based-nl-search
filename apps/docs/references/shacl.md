# SHACL - Shapes Constraint Language Reference

**W3C Recommendation:** https://www.w3.org/TR/shacl/

## Purpose

SHACL validates RDF graphs against constraints. **Key insight for us:** SHACL shapes encode ontology structure that we can QUERY for metadata.

## Shapes vs Data

- **Shapes Graph**: Defines constraints (our ontology)
- **Data Graph**: Actual data to validate
- **Shapes are RDF**: Query them like any RDF graph!

## Node Shapes

Constraints on nodes themselves:

```turtle
hdmap:HDMapShape
  a sh:NodeShape ;
  sh:targetClass hdmap:HDMap ;
  sh:property [ sh:path hdmap:roadTypes ; sh:in ("motorway" "town") ] .
```

## Target Declarations (Critical!)

**sh:targetClass** - Which class this shape applies to:

```turtle
hdmap:HDMapShape sh:targetClass hdmap:HDMap .
```

**This tells us:** hdmap domain defines properties in this shape!

## Property Shapes

```turtle
sh:property [
  sh:path hdmap:roadTypes ;        # Which property
  sh:in ("motorway" "town" "rural") ;  # Allowed values
  sh:minCount 1 ;                  # Required
  sh:datatype xsd:string ;         # Type
]
```

## Constraint Components

### sh:in - Enumeration

```turtle
sh:property [
  sh:path hdmap:roadTypes ;
  sh:in ("motorway" "town" "rural" "other") ;
]
```

**Query this:** Extract allowed values from sh:in lists

### sh:pattern - Regular Expression

```turtle
sh:property [
  sh:path georeference:country ;
  sh:pattern "^[A-Z]{2}$" ;  # ISO 3166-1 alpha-2
]
```

### sh:datatype - Type Constraint

```turtle
sh:property [
  sh:path hdmap:length ;
  sh:datatype xsd:float ;
  sh:minInclusive 0.0 ;
]
```

### sh:minCount / sh:maxCount - Cardinality

```turtle
sh:property [
  sh:path hdmap:roadTypes ;
  sh:minCount 1 ;  # Required
  sh:maxCount 1 ;  # Single-valued
]
```

### sh:class - Object Type

```turtle
sh:property [
  sh:path manifest:hasReferencedArtifacts ;
  sh:class hdmap:HDMap ;  # Referenced asset must be HDMap
]
```

## Querying SHACL for Metadata

### Query 1: Property-Domain Mappings

```sparql
PREFIX sh: <http://www.w3.org/ns/shacl#>

SELECT ?localName ?domain ?iri WHERE {
  ?shape sh:targetClass ?domainClass .
  ?shape sh:property [ sh:path ?iri ] .
  BIND(localname(?iri) AS ?localName)
  BIND(localname(?domainClass) AS ?domain)
}
```

**Returns:**

```
localName   | domain    | iri
------------|-----------|------------------
roadTypes   | hdmap     | hdmap:roadTypes
roadTypes   | ositrace  | ositrace:roadTypes  # Multi-domain property!
```

### Query 2: Extract sh:in Allowed Values

```sparql
PREFIX sh: <http://www.w3.org/ns/shacl#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?property ?value WHERE {
  ?propShape sh:path ?property .
  ?propShape sh:in ?list .
  ?list rdf:rest*/rdf:first ?value .
}
```

**Property path** `rdf:rest*/rdf:first` traverses RDF list:

```turtle
sh:in ( "motorway" "town" "rural" )
# Becomes:
sh:in [ rdf:first "motorway" ; rdf:rest [ rdf:first "town" ; rdf:rest [ rdf:first "rural" ; rdf:rest rdf:nil ]]]
```

### Query 3: Find Domain References

```sparql
PREFIX sh: <http://www.w3.org/ns/shacl#>
PREFIX manifest: <https://w3id.org/ascs-ev/envited-x/manifest/v5/>

SELECT ?parentDomain ?childDomain WHERE {
  ?shape sh:targetClass ?parentClass .
  ?shape sh:property [
    sh:path manifest:hasReferencedArtifacts ;
    sh:class ?childClass
  ] .
  BIND(localname(?parentClass) AS ?parentDomain)
  BIND(localname(?childClass) AS ?childDomain)
}
```

**Result:**

```
parentDomain | childDomain
-------------|-------------
scenario     | hdmap
scenario     | environment-model
```

## Multi-Domain Properties

**Problem:** `roadTypes` exists in BOTH hdmap and ositrace:

```turtle
hdmap:HDMapShape sh:targetClass hdmap:HDMap ;
  sh:property [ sh:path hdmap:roadTypes ; ... ] .

ositrace:OSITraceShape sh:targetClass ositrace:OSITrace ;
  sh:property [ sh:path ositrace:roadTypes ; ... ] .
```

**Solution:** Query returns BOTH, then intersect with LLM-detected domains:

```
propertyDomains("roadTypes") = {hdmap, ositrace}
detectedDomains = ["hdmap"]
→ Use hdmap:roadTypes ✅
```

## SHACL vs RDFS

| Aspect                       | SHACL               | RDFS               |
| ---------------------------- | ------------------- | ------------------ |
| Purpose                      | Validation          | Inference          |
| `sh:targetClass` + `sh:path` | Validation rule     | -                  |
| `rdfs:domain`                | -                   | Type inference     |
| Direction                    | Class → Properties  | Property → Class   |
| Reasoning                    | No (validates only) | Yes (infers types) |

**Critical:** SHACL shapes don't create RDFS domain assertions!

```turtle
# This is NOT RDFS domain
hdmap:HDMapShape sh:targetClass hdmap:HDMap ;
  sh:property [ sh:path hdmap:roadTypes ] .

# This would be RDFS domain (but we don't have it)
hdmap:roadTypes rdfs:domain hdmap:HDMap .
```

## Shape Context (Advanced)

Properties grouped into sub-shapes:

```turtle
hdmap:HDMapShape sh:property [
  sh:path hdmap:hasDomainSpecification ;
  sh:node hdmap:DomainSpecificationShape ;
] .

hdmap:DomainSpecificationShape sh:property [
  sh:path hdmap:hasContent ;
  sh:node hdmap:ContentShape ;
] .

hdmap:ContentShape sh:property [
  sh:path hdmap:roadTypes ;
  sh:in ("motorway" "town" "rural" "other") ;
] .
```

**Query:** Find shape context hierarchy for structured SPARQL generation.

## Best Practices

### DO:

- ✅ Query `sh:targetClass` to find domains
- ✅ Use property paths for `sh:in` lists
- ✅ Extract multi-domain properties
- ✅ Combine with RDFS queries for class hierarchy

### DON'T:

- ❌ Expect SHACL to infer types (use RDFS reasoner)
- ❌ Assume `sh:targetClass` = `rdfs:domain`
- ❌ Extract metadata to separate files (query directly!)
- ❌ Hardcode property-domain mappings

## Key Queries for Implementation

```sparql
# 1. All properties per domain
SELECT ?domain (GROUP_CONCAT(?prop; separator=", ") AS ?properties)
WHERE {
  ?shape sh:targetClass ?domainClass .
  ?shape sh:property [ sh:path ?prop ] .
  BIND(localname(?domainClass) AS ?domain)
}
GROUP BY ?domain

# 2. Properties in multiple domains
SELECT ?localName (COUNT(DISTINCT ?domain) AS ?domainCount)
WHERE {
  ?shape sh:targetClass ?domainClass .
  ?shape sh:property [ sh:path ?iri ] .
  BIND(localname(?iri) AS ?localName)
  BIND(localname(?domainClass) AS ?domain)
}
GROUP BY ?localName
HAVING (COUNT(DISTINCT ?domain) > 1)

# 3. Property datatypes
SELECT ?property ?datatype WHERE {
  ?propShape sh:path ?property .
  ?propShape sh:datatype ?datatype .
}
```

## References

- Full Spec: https://www.w3.org/TR/shacl/
- SHACL Playground: https://shacl.org/playground/
- SHACL-AF (Advanced): https://www.w3.org/TR/shacl-af/
