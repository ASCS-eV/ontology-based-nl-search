# SPARQL 1.1 Query Language - Key Concepts

**W3C Recommendation:** https://www.w3.org/TR/sparql11-query/

This reference extracts the most relevant concepts for ontology-driven query generation.

## 1. Graph Pattern Matching

SPARQL matches **triple patterns** against RDF graphs. Variables (`?var`) bind to RDF terms.

```sparql
SELECT ?title WHERE {
  <http://example.org/book1> dc:title ?title .
}
# Result: ?title = "SPARQL Tutorial"
```

## 2. Property Paths (Critical for SHACL Queries)

Navigate arbitrary-length paths in graphs:

| Syntax       | Meaning      | Example                                 |
| ------------ | ------------ | --------------------------------------- |
| `pred+`      | One or more  | `?x rdfs:subClassOf+ ?parent`           |
| `pred*`      | Zero or more | `?list rdf:rest*/rdf:first ?member`     |
| `pred/pred`  | Sequence     | `?x ex:parent/ex:name ?grandparentName` |
| `pred\|pred` | Alternative  | `?x foaf:phone\|foaf:email ?contact`    |
| `^pred`      | Inverse      | `?child ^ex:parent ?x`                  |

**Example: Traverse RDF List**

```sparql
?list rdf:rest*/rdf:first ?value
# Matches all elements in a list structure
```

## 3. FILTER Constraints

Restrict solutions with expressions:

```sparql
# Numeric
FILTER (?price < 30.5)

# String matching
FILTER regex(?title, "^SPARQL", "i")

# String containment
FILTER (CONTAINS(LCASE(?country), "de"))

# Bound variables
FILTER (BOUND(?optionalVar))
```

## 4. Built-in Functions

### String Functions

- `CONCAT(?a, " ", ?b)` - Concatenate
- `CONTAINS(?str, "sub")` - Test substring
- `LCASE(?str)`, `UCASE(?str)` - Case conversion
- `STR(?term)` - Get lexical form
- `STRLEN(?str)` - String length

### Term Testing

- `isIRI(?term)`, `isLiteral(?term)`, `isBlank(?term)`
- `LANG(?literal)` - Language tag
- `DATATYPE(?literal)` - Datatype IRI

### Value Construction

- `BIND(expression AS ?var)` - Assign computed value
- `COALESCE(?a, ?b, "default")` - First non-error value

### IRI Manipulation

- `localname(?iri)` - Extract local name from IRI
  ```sparql
  BIND(localname(<https://w3id.org/ascs-ev/envited-x/hdmap/v6/roadTypes>) AS ?name)
  # Result: "roadTypes"
  ```

## 5. Named Graphs

Query specific graphs with `FROM` or `GRAPH`:

```sparql
# Query specific graph
SELECT * FROM <urn:graph:schema> WHERE { ... }

# Or use GRAPH clause
SELECT * WHERE {
  GRAPH <urn:graph:schema> {
    ?shape sh:targetClass ?class .
  }
}
```

## 6. Aggregation

Group and aggregate results:

```sparql
SELECT ?domain (COUNT(?property) AS ?count)
WHERE {
  ?shape sh:targetClass ?domain .
  ?shape sh:property [ sh:path ?property ] .
}
GROUP BY ?domain
HAVING (COUNT(?property) > 5)
ORDER BY DESC(?count)
```

**Aggregate Functions:**

- `COUNT(?var)`, `COUNT(*)`, `COUNT(DISTINCT ?var)`
- `SUM(?num)`, `AVG(?num)`, `MIN(?var)`, `MAX(?var)`
- `GROUP_CONCAT(?var; separator=", ")`

## 7. Subqueries

Nest queries for complex operations:

```sparql
SELECT ?domain ?propCount WHERE {
  {
    SELECT ?domain (COUNT(?prop) AS ?propCount) WHERE {
      ?shape sh:targetClass ?domain .
      ?shape sh:property [ sh:path ?prop ] .
    }
    GROUP BY ?domain
  }
  FILTER (?propCount > 10)
}
```

## 8. Solution Modifiers

- `DISTINCT` - Remove duplicate solutions
- `LIMIT n` - Return first n results
- `OFFSET n` - Skip first n results
- `ORDER BY ?var` - Sort (add `DESC(?var)` for descending)

## Critical SPARQL Queries for Our System

### Query 1: Get All Property-Domain Mappings

```sparql
PREFIX sh: <http://www.w3.org/ns/shacl#>

SELECT ?localName ?domain ?iri WHERE {
  ?shape sh:targetClass ?domainClass .
  ?shape sh:property [ sh:path ?iri ] .
  BIND(localname(?iri) AS ?localName)
  BIND(replace(str(?domainClass), ".*/([^/]+)/v[0-9]+/.*", "$1") AS ?domain)
}
ORDER BY ?localName ?domain
```

**Result:**

```
localName   | domain    | iri
------------|-----------|------------------
roadTypes   | hdmap     | hdmap:roadTypes
roadTypes   | ositrace  | ositrace:roadTypes
formatType  | hdmap     | hdmap:formatType
```

### Query 2: Extract sh:in Allowed Values

```sparql
PREFIX sh: <http://www.w3.org/ns/shacl#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?property ?allowedValue WHERE {
  ?propShape sh:path ?property .
  ?propShape sh:in ?list .
  ?list rdf:rest*/rdf:first ?allowedValue .
}
```

**Uses:** `rdf:rest*/rdf:first` property path to traverse RDF list

### Query 3: Find Asset Domains via rdfs:subClassOf

```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX envited-x: <https://w3id.org/ascs-ev/envited-x/envited-x/v5/>

SELECT DISTINCT ?domain ?assetClass WHERE {
  ?assetClass rdfs:subClassOf envited-x:SimulationAsset .
  BIND(replace(str(?assetClass), ".*/([^/]+)/v[0-9]+/.*", "$1") AS ?domain)
}
```

### Query 4: Find Domain References

```sparql
PREFIX sh: <http://www.w3.org/ns/shacl#>
PREFIX manifest: <https://w3id.org/ascs-ev/envited-x/manifest/v5/>

SELECT ?parentDomain ?childDomain WHERE {
  ?shape sh:targetClass ?parentClass .
  ?shape sh:property [
    sh:path manifest:hasReferencedArtifacts ;
    sh:class ?childClass
  ] .
  BIND(replace(str(?parentClass), ".*/([^/]+)/v[0-9]+/.*", "$1") AS ?parentDomain)
  BIND(replace(str(?childClass), ".*/([^/]+)/v[0-9]+/.*", "$1") AS ?childDomain)
}
```

## Key Patterns for Implementation

1. **Property Paths for Lists:** `rdf:rest*/rdf:first`
2. **IRI Local Name:** `localname(?iri)`
3. **Domain Extraction:** `replace(str(?iri), ".*/([^/]+)/v[0-9]+/.*", "$1")`
4. **Named Graph Query:** `FROM <urn:graph:schema>`
5. **Aggregation:** `GROUP BY` + `COUNT`
6. **Filtering:** `FILTER NOT EXISTS { ... }`

## Performance Considerations

- Use `DISTINCT` only when needed (adds overhead)
- Property paths can be expensive on large graphs
- Index predicates used in frequent queries
- Limit result sets with `LIMIT`
- Use subqueries to reduce intermediate result size

## References

- Full Specification: https://www.w3.org/TR/sparql11-query/
- SPARQL 1.1 Update: https://www.w3.org/TR/sparql11-update/
- Results Format: https://www.w3.org/TR/sparql11-results-json/
- SPARQL Playground: https://sparql.dev/
