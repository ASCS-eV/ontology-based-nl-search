# RDF Schema (RDFS) Reference

**W3C Recommendation:** https://www.w3.org/TR/rdf-schema/

## Purpose

RDFS provides vocabulary for describing RDF data structure. Foundation for class hierarchies and property relationships.

## Key Classes

### rdfs:Class

The class of all classes. Every class is an instance of rdfs:Class.

### rdfs:Resource

Universal class. Everything in RDF is an rdfs:Resource.

### rdf:Property

The class of all properties.

## Critical Properties

### rdfs:domain

**Declares which class the SUBJECT of a triple must belong to:**

```turtle
ex:author rdfs:domain ex:Document .

# If: <book1> ex:author "Alice"
# Then inferred: <book1> rdf:type ex:Document
```

**Multiple domains each independently infer a type** (RDFS only _infers_, never _constrains_ — the subject is entailed to be an instance of every declared domain class):

```turtle
ex:property rdfs:domain ex:ClassA .
ex:property rdfs:domain ex:ClassB .
<node> ex:property "value" .
# Inferred: <node> rdf:type ex:ClassA AND ex:ClassB
```

### rdfs:range

**Declares which class the OBJECT of a triple must belong to:**

```turtle
ex:author rdfs:range ex:Person .

# If: <book1> ex:author <alice>
# Then inferred: <alice> rdf:type ex:Person
```

### rdfs:subClassOf

**Class hierarchy:**

```turtle
ex:HDMap rdfs:subClassOf ex:SimulationAsset .
ex:SimulationAsset rdfs:subClassOf rdfs:Resource .

# Transitive: If A subClassOf B and B subClassOf C, then A subClassOf C
```

### rdf:type

**Instance-of relationship:**

```turtle
<asset123> rdf:type ex:HDMap .
<asset123> rdf:type ex:SimulationAsset .
```

## RDFS vs SHACL

| Feature              | RDFS                                | SHACL                                  |
| -------------------- | ----------------------------------- | -------------------------------------- |
| **Purpose**          | Inference                           | Validation                             |
| **Property → Class** | `rdfs:domain` causes type inference | No inference                           |
| **Class → Property** | -                                   | `sh:targetClass` + `sh:path` validates |
| **Direction**        | Property defines its domain         | Class defines its properties           |
| **Standard**         | RDF 1.1 Core                        | Separate W3C spec                      |

### Critical Difference

**RDFS says:** "If property P has domain C, ANY use of P means subject IS C"  
**SHACL says:** "If node is C, then it SHOULD have property P (validation)"

**Direction is opposite!**

## Why We Use SHACL, Not RDFS Domain

### If we had RDFS domains:

```turtle
ex:roadTypes rdfs:domain ex:HDMap .
<asset> ex:roadTypes "motorway" .
# Would infer: <asset> rdf:type ex:HDMap ✅
```

### But our ontology uses SHACL:

```turtle
ex:HDMapShape sh:targetClass ex:HDMap ;
  sh:property [ sh:path ex:roadTypes ; ... ] .
```

**SHACL shapes DON'T create RDFS domain assertions.** They're validation constraints, not inference rules!

## Query Class Hierarchies

### Find All Subclasses (Transitive)

```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?subclass WHERE {
  ?subclass rdfs:subClassOf+ ex:SimulationAsset .
}
```

**Property path** `rdfs:subClassOf+` = one or more steps

### Find Direct Subclasses Only

```sparql
SELECT ?subclass WHERE {
  ?subclass rdfs:subClassOf ex:SimulationAsset .
  FILTER NOT EXISTS {
    ?subclass rdfs:subClassOf ?intermediate .
    ?intermediate rdfs:subClassOf ex:SimulationAsset .
    FILTER(?intermediate != ex:SimulationAsset)
  }
}
```

### Find All Asset Domains

```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?domain WHERE {
  ?assetClass rdfs:subClassOf ex:SimulationAsset .
  BIND(replace(str(?assetClass), ".*/([^/]+)/v[0-9]+/.*", "$1") AS ?domain)
}
```

**Result:**

```
domain
--------------
hdmap
scenario
ositrace
environment-model
...
```

## Combining RDFS + SHACL

### Use RDFS for:

- ✅ Class hierarchies (`ex:SimulationAsset` → `ex:HDMap`)
- ✅ Finding all asset types
- ✅ Type assertions on assets

### Use SHACL for:

- ✅ Property-domain associations (`sh:targetClass` + `sh:path`)
- ✅ Value constraints (`sh:in`, `sh:pattern`)
- ✅ Cardinality constraints

### Hybrid Query

```sparql
# Find asset domains via RDFS
SELECT DISTINCT ?domain WHERE {
  ?assetClass rdfs:subClassOf ex:SimulationAsset .
  BIND(replace(str(?assetClass), ".*/([^/]+)/v[0-9]+/.*", "$1") AS ?domain)
}

# Find properties per domain via SHACL
SELECT ?domain ?property WHERE {
  ?shape sh:targetClass ?assetClass .
  ?shape sh:property [ sh:path ?property ] .
  ?assetClass rdfs:subClassOf ex:SimulationAsset .
  BIND(replace(str(?assetClass), ".*/([^/]+)/v[0-9]+/.*", "$1") AS ?domain)
}
```

## Key Insight

**RDFS = REASONING. SHACL = VALIDATION.**

For our architecture:

- **Query RDFS:** Class hierarchies (asset type discovery)
- **Query SHACL:** Property-domain mappings (sh:targetClass + sh:path)

Don't expect SHACL shapes to create RDFS domains!

## References

- Full Spec: https://www.w3.org/TR/rdf-schema/
- RDF 1.1 Concepts: https://www.w3.org/TR/rdf11-concepts/
- RDF 1.1 Semantics: https://www.w3.org/TR/rdf11-mt/
