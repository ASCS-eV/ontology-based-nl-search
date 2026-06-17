<!--
  ⚠ THIRD-PARTY SPECIFICATION — NOT AN ORIGINAL WORK OF THIS PROJECT.
  Title:     Shapes Constraint Language (SHACL)
  Source:    https://www.w3.org/TR/shacl/
  Publisher: W3C
  License:   W3C Document License 2023 (https://www.w3.org/copyright/document-license-2023/)
  Retrieved: 2026-06-16
  Reproduced verbatim for offline reference and AI-agent context. The
  publisher's original copyright and license apply. Do not hand-edit —
  refresh from source (see docs/specs/references/README.md).
-->

> **Third-party specification — reproduced for offline reference and AI-agent context.**
> **Title:** Shapes Constraint Language (SHACL)  
> **Status:** W3C Recommendation  
> **Source:** <https://www.w3.org/TR/shacl/>  
> **Publisher:** W3C  
> **License:** W3C Document License 2023 — <https://www.w3.org/copyright/document-license-2023/>  
> **Retrieved:** 2026-06-16  
> The publisher's original copyright and license apply. Do not hand-edit;
> refresh from source — see [README](./README.md).

---

Shapes Constraint Language (SHACL)   

[![W3C](https://www.w3.org/StyleSheets/TR/2016/logos/W3C)](https://www.w3.org/)

# Shapes Constraint Language (SHACL)

## W3C Recommendation 20 July 2017

This version:

[https://www.w3.org/TR/2017/REC-shacl-20170720/](https://www.w3.org/TR/2017/REC-shacl-20170720/)

Latest published version:

[https://www.w3.org/TR/shacl/](https://www.w3.org/TR/shacl/)

Latest editor's draft:

[https://w3c.github.io/data-shapes/shacl/](https://w3c.github.io/data-shapes/shacl/)

Implementation report:

[https://w3c.github.io/data-shapes/data-shapes-test-suite/](https://w3c.github.io/data-shapes/data-shapes-test-suite/)

Previous version:

[https://www.w3.org/TR/2017/PR-shacl-20170608/](https://www.w3.org/TR/2017/PR-shacl-20170608/)

Editors:

[Holger Knublauch](http://knublauch.com/), [TopQuadrant, Inc.](http://topquadrant.com/)

[Dimitris Kontokostas](http://Kontokostas.com), [University of Leipzig](http://informatik.uni-leipzig.de/)

Repository:

[GitHub](https://github.com/w3c/data-shapes)

[Issues](https://github.com/w3c/data-shapes/issues)

Test Suite:

[SHACL Test Suite](http://w3c.github.io/data-shapes/data-shapes-test-suite/)

Please check the [**errata**](https://www.w3.org/2017/shacl/errata) for any errors or issues reported since publication.

See also [**translations**](https://www.w3.org/2003/03/Translations/byTechnology?technology=shacl).

[Copyright](https://www.w3.org/Consortium/Legal/ipr-notice#Copyright) © 2017 [W3C](https://www.w3.org/)® ([MIT](https://www.csail.mit.edu/), [ERCIM](https://www.ercim.eu/), [Keio](https://www.keio.ac.jp/), [Beihang](http://ev.buaa.edu.cn/)). W3C [liability](https://www.w3.org/Consortium/Legal/ipr-notice#Legal_Disclaimer), [trademark](https://www.w3.org/Consortium/Legal/ipr-notice#W3C_Trademarks) and [document use](https://www.w3.org/Consortium/Legal/copyright-documents) rules apply.

---

## Abstract

This document defines the SHACL Shapes Constraint Language, a language for validating RDF graphs against a set of conditions. These conditions are provided as shapes and other constructs expressed in the form of an RDF graph. RDF graphs that are used in this manner are called "shapes graphs" in SHACL and the RDF graphs that are validated against a shapes graph are called "data graphs". As SHACL shape graphs are used to validate that data graphs satisfy a set of conditions they can also be viewed as a description of the data graphs that do satisfy these conditions. Such descriptions may be used for a variety of purposes beside validation, including user interface building, code generation and data integration.

## Status of This Document

_This section describes the status of this document at the time of its publication. Other documents may supersede this document. A list of current W3C publications and the latest revision of this technical report can be found in the [W3C technical reports index](https://www.w3.org/TR/) at https://www.w3.org/TR/._

This document was published by the [RDF Data Shapes Working Group](https://www.w3.org/2014/data-shapes/) as a Recommendation. Comments regarding this document are welcome. Please send them to [public-rdf-shapes@w3.org](mailto:public-rdf-shapes@w3.org) ([subscribe](mailto:public-rdf-shapes-request@w3.org?subject=subscribe), [archives](https://lists.w3.org/Archives/Public/public-rdf-shapes/)).

Please see the Working Group's [implementation report](https://w3c.github.io/data-shapes/data-shapes-test-suite/).

This document has been reviewed by W3C Members, by software developers, and by other W3C groups and interested parties, and is endorsed by the Director as a W3C Recommendation. It is a stable document and may be used as reference material or cited from another document. W3C's role in making the Recommendation is to draw attention to the specification and to promote its widespread deployment. This enhances the functionality and interoperability of the Web.

This document was produced by a group operating under the [5 February 2004 W3C Patent Policy](https://www.w3.org/Consortium/Patent-Policy-20040205/). W3C maintains a [public list of any patent disclosures](https://www.w3.org/2004/01/pp-impl/73865/status) made in connection with the deliverables of the group; that page also includes instructions for disclosing a patent. An individual who has actual knowledge of a patent which the individual believes contains [Essential Claim(s)](https://www.w3.org/Consortium/Patent-Policy-20040205/#def-essential) must disclose the information in accordance with [section 6 of the W3C Patent Policy](https://www.w3.org/Consortium/Patent-Policy-20040205/#sec-Disclosure).

This document is governed by the [1 March 2017 W3C Process Document](https://www.w3.org/2017/Process-20170301/).

## Table of Contents

1.  [1\. Introduction](#introduction)
    1.  [1.1 Terminology](#terminology)
    2.  [1.2 Document Conventions](#conventions)
    3.  [1.3 Conformance](#conformance)
    4.  [1.4 SHACL Example](#shacl-example)
    5.  [1.5 Relationship between SHACL and RDFS inferencing](#shacl-rdfs)
    6.  [1.6 Relationship between SHACL and SPARQL](#shacl-sparql)
2.  [2\. Shapes and Constraints](#constraints-section)
    1.  [2.1 Shapes](#shapes)
        1.  [2.1.1 Constraints, Parameters and Constraint Components](#constraints)
        2.  [2.1.2 Focus Nodes](#focusNodes)
        3.  [2.1.3 Targets](#targets)
            1.  [2.1.3.1 Node targets (sh:targetNode)](#targetNode)
            2.  [2.1.3.2 Class-based Targets (sh:targetClass)](#targetClass)
            3.  [2.1.3.3 Implicit Class Targets](#implicit-targetClass)
            4.  [2.1.3.4 Subjects-of targets (sh:targetSubjectsOf)](#targetSubjectsOf)
            5.  [2.1.3.5 Objects-of targets (sh:targetObjectsOf)](#targetObjectsOf)
        4.  [2.1.4 Declaring the Severity of a Shape](#severity)
        5.  [2.1.5 Declaring Messages for a Shape](#message)
        6.  [2.1.6 Deactivating a Shape](#deactivated)
    2.  [2.2 Node Shapes](#node-shapes)
    3.  [2.3 Property Shapes](#property-shapes)
        1.  [2.3.1 SHACL Property Paths](#property-paths)
            1.  [2.3.1.1 Predicate Paths](#property-path-predicate)
            2.  [2.3.1.2 Sequence Paths](#property-path-sequence)
            3.  [2.3.1.3 Alternative Paths](#property-path-alternative)
            4.  [2.3.1.4 Inverse Paths](#property-path-inverse)
            5.  [2.3.1.5 Zero-Or-More Paths](#property-path-zero-or-more)
            6.  [2.3.1.6 One-Or-More Paths](#property-path-one-or-more)
            7.  [2.3.1.7 Zero-Or-One Paths](#property-path-zero-or-one)
        2.  [2.3.2 Non-Validating Property Shape Characteristics](#nonValidation)
            1.  [2.3.2.1 sh:name and sh:description](#name)
            2.  [2.3.2.2 sh:order](#order)
            3.  [2.3.2.3 sh:group](#group)
            4.  [2.3.2.4 sh:defaultValue](#defaultValue)
3.  [3\. Validation and Graphs](#validation)
    1.  [3.1 Shapes Graph](#shapes-graph)
    2.  [3.2 Data Graph](#data-graph)
    3.  [3.3 Linking to shapes graphs (sh:shapesGraph)](#sh-shapes-graph)
    4.  [3.4 Validation](#validation-definition)
        1.  [3.4.1 Failures](#failures)
        2.  [3.4.2 Handling of Ill-formed Shapes Graphs](#ill-formed-shape-graphs)
        3.  [3.4.3 Handling of Recursive Shapes](#shapes-recursion)
    5.  [3.5 Conformance Checking](#conformance-definition)
    6.  [3.6 Validation Report](#validation-report)
        1.  [3.6.1 Validation Report (sh:ValidationReport)](#results-validation-report)
            1.  [3.6.1.1 Conforms (sh:conforms)](#conforms)
            2.  [3.6.1.2 Result (sh:result)](#result)
            3.  [3.6.1.3 Syntax Checking of Shapes Graph (sh:shapesGraphWellFormed)](#shapesGraphWellFormed)
        2.  [3.6.2 Validation Result (sh:ValidationResult)](#results-validation-result)
            1.  [3.6.2.1 Focus node (sh:focusNode)](#results-focus-node)
            2.  [3.6.2.2 Path (sh:resultPath)](#results-path)
            3.  [3.6.2.3 Value (sh:value)](#results-value)
            4.  [3.6.2.4 Source (sh:sourceShape)](#results-source-shape)
            5.  [3.6.2.5 Constraint Component (sh:sourceConstraintComponent)](#results-source-constraint-component)
            6.  [3.6.2.6 Details (sh:detail)](#results-detail)
            7.  [3.6.2.7 Message (sh:resultMessage)](#results-message)
            8.  [3.6.2.8 Severity (sh:resultSeverity)](#results-severity)
    7.  [3.7 Value Nodes](#value-nodes)
4.  [4\. Core Constraint Components](#core-components)
    1.  [4.1 Value Type Constraint Components](#core-components-value-type)
        1.  [4.1.1 sh:class](#ClassConstraintComponent)
        2.  [4.1.2 sh:datatype](#DatatypeConstraintComponent)
        3.  [4.1.3 sh:nodeKind](#NodeKindConstraintComponent)
    2.  [4.2 Cardinality Constraint Components](#core-components-count)
        1.  [4.2.1 sh:minCount](#MinCountConstraintComponent)
        2.  [4.2.2 sh:maxCount](#MaxCountConstraintComponent)
    3.  [4.3 Value Range Constraint Components](#core-components-range)
        1.  [4.3.1 sh:minExclusive](#MinExclusiveConstraintComponent)
        2.  [4.3.2 sh:minInclusive](#MinInclusiveConstraintComponent)
        3.  [4.3.3 sh:maxExclusive](#MaxExclusiveConstraintComponent)
        4.  [4.3.4 sh:maxInclusive](#MaxInclusiveConstraintComponent)
    4.  [4.4 String-based Constraint Components](#core-components-string)
        1.  [4.4.1 sh:minLength](#MinLengthConstraintComponent)
        2.  [4.4.2 sh:maxLength](#MaxLengthConstraintComponent)
        3.  [4.4.3 sh:pattern](#PatternConstraintComponent)
        4.  [4.4.4 sh:languageIn](#LanguageInConstraintComponent)
        5.  [4.4.5 sh:uniqueLang](#UniqueLangConstraintComponent)
    5.  [4.5 Property Pair Constraint Components](#core-components-property-pairs)
        1.  [4.5.1 sh:equals](#EqualsConstraintComponent)
        2.  [4.5.2 sh:disjoint](#DisjointConstraintComponent)
        3.  [4.5.3 sh:lessThan](#LessThanConstraintComponent)
        4.  [4.5.4 sh:lessThanOrEquals](#LessThanOrEqualsConstraintComponent)
    6.  [4.6 Logical Constraint Components](#core-components-logical)
        1.  [4.6.1 sh:not](#NotConstraintComponent)
        2.  [4.6.2 sh:and](#AndConstraintComponent)
        3.  [4.6.3 sh:or](#OrConstraintComponent)
        4.  [4.6.4 sh:xone](#XoneConstraintComponent)
    7.  [4.7 Shape-based Constraint Components](#core-components-shape)
        1.  [4.7.1 sh:node](#NodeConstraintComponent)
        2.  [4.7.2 sh:property](#PropertyConstraintComponent)
        3.  [4.7.3 sh:qualifiedValueShape, sh:qualifiedMinCount, sh:qualifiedMaxCount](#QualifiedValueShapeConstraintComponent)
    8.  [4.8 Other Constraint Components](#core-components-others)
        1.  [4.8.1 sh:closed, sh:ignoredProperties](#ClosedConstraintComponent)
        2.  [4.8.2 sh:hasValue](#HasValueConstraintComponent)
        3.  [4.8.3 sh:in](#InConstraintComponent)
5.  [5\. SPARQL-based Constraints](#sparql-constraints)
    1.  [5.1 An Example SPARQL-based Constraint](#sparql-constraints-example)
    2.  [5.2 Syntax of SPARQL-based Constraints](#sparql-constraints-syntax)
        1.  [5.2.1 Prefix Declarations for SPARQL Queries](#sparql-prefixes)
    3.  [5.3 Validation with SPARQL-based Constraints](#sparql-constraints-validation)
        1.  [5.3.1 Pre-bound Variables in SPARQL Constraints ($this, $shapesGraph, $currentShape)](#sparql-constraints-prebound)
        2.  [5.3.2 Mapping of Solution Bindings to Result Properties](#sparql-constraints-variables)
6.  [6\. SPARQL-based Constraint Components](#sparql-constraint-components)
    1.  [6.1 An Example SPARQL-based Constraint Component](#an-example-sparql-based-constraint-component)
    2.  [6.2 Syntax of SPARQL-based Constraint Components](#constraint-components-syntax)
        1.  [6.2.1 Parameter Declarations (sh:parameter)](#constraint-components-parameters)
        2.  [6.2.2 Label Templates (sh:labelTemplate)](#labelTemplate)
        3.  [6.2.3 Validators](#constraint-components-validators)
            1.  [6.2.3.1 SELECT-based Validators](#SPARQLSelectValidator)
            2.  [6.2.3.2 ASK-based Validators](#SPARQLAskValidator)
    3.  [6.3 Validation with SPARQL-based Constraint Components](#constraint-components-validation)
7.  [A. Pre-binding of Variables in SPARQL Queries](#pre-binding)
8.  [B. Summary of SHACL Syntax Rules](#syntax-rules)
9.  [C. SHACL Shapes to Validate Shapes Graphs](#shacl-shacl)
10.  [D. Summary of SHACL Core Validators](#core-validators)
11.  [E. Security and Privacy Considerations](#security)
12.  [F. Acknowledgements](#ack)
13.  [G. Revision History](#revision-history)
14.  [H. References](#references)
     1.  [H.1 Normative references](#normative-references)
     2.  [H.2 Informative references](#informative-references)

## Document Outline

The introduction includes a [Terminology](#terminology) section.

The sections 2 - 4 cover the [SHACL Core](#dfn-shacl-core) language and may be read independently from the later sections.

The sections 5 and 6 are about the features that [SHACL-SPARQL](#dfn-shacl-sparql) has in addition to the Core language. These advanced features are SPARQL-based constraints and constraint components.

The syntax of SHACL is RDF. The examples in this document use Turtle \[[turtle](#bib-turtle)\] and (in one instance) JSON-LD \[[json-ld](#bib-json-ld)\]. Other RDF serializations such as RDF/XML may be used in practice. The reader should be familiar with basic RDF concepts \[[rdf11-concepts](#bib-rdf11-concepts)\] such as triples and, for the advanced concepts of SHACL, with SPARQL \[[sparql11-query](#bib-sparql11-query)\].

## 1\. Introduction

This document specifies SHACL (Shapes Constraint Language), a language for describing and validating RDF graphs. This section introduces SHACL with an overview of the key terminology and an example to illustrate basic concepts.

### 1.1 Terminology

Throughout this document, the following terminology is used.

Terminology that is linked to portions of RDF 1.1 Concepts and Abstract Syntax is used in SHACL as defined there. Terminology that is linked to portions of SPARQL 1.1 Query Language is used in SHACL as defined there. A single linkage is sufficient to provide a definition for all occurences of a particular term in this document.

Definitions are complete within this document, i.e., if there is no rule to make some situation true in this document then the situation is false.

Basic RDF Terminology

This document uses the terms [RDF graph](https://www.w3.org/TR/rdf11-concepts/#dfn-rdf-graph), [RDF triple](https://www.w3.org/TR/rdf11-concepts/#dfn-rdf-triple), [IRI](https://www.w3.org/TR/rdf11-concepts/#dfn-iri), [literal](https://www.w3.org/TR/rdf11-concepts/#dfn-literal), [blank node](https://www.w3.org/TR/rdf11-concepts/#dfn-blank-node), [node](https://www.w3.org/TR/rdf11-concepts/#dfn-node) of an RDF graph, [RDF term](https://www.w3.org/TR/rdf11-concepts/#dfn-rdf-term), and [subject](https://www.w3.org/TR/rdf11-concepts/#dfn-subject), [predicate](https://www.w3.org/TR/rdf11-concepts/#dfn-predicate), and [object](https://www.w3.org/TR/rdf11-concepts/#dfn-object) of RDF triples, and [datatype](https://www.w3.org/TR/rdf11-concepts/#dfn-datatype) as defined in RDF 1.1 Concepts and Abstract Syntax \[[rdf11-concepts](#bib-rdf11-concepts)\]. Language tags are defined as in \[[BCP47](#bib-BCP47)\].

Property Value and Path

A property is an [IRI](#dfn-iri). An [RDF term](#dfn-rdf-term) `n` has a value `v` for property `p` in an [RDF graph](#dfn-rdf-graph) if there is an [RDF triple](#dfn-rdf-triple) in the graph with [subject](#dfn-subject) `n`, [predicate](#dfn-predicate) `p`, and [object](#dfn-object) `v`. The phrase "Every value of P in graph G ..." means "Every object of a triple in G with predicate P ...". (In this document, the verbs _specify_ or _declare_ are sometimes used to express the fact that an RDF term has values for a given predicate in a graph.)  
SPARQL property paths are defined as in [SPARQL 1.1](https://www.w3.org/TR/sparql11-query/#pp-language). An RDF term `n` has value `v` for [SPARQL property path](#dfn-sparql-property-paths) expression `p` in an RDF graph `G` if there is a solution mapping in the result of the SPARQL query `SELECT ?s ?o WHERE { ?s p' ?o }` on `G` that binds `?s` to `n` and `?o` to `v`, where `p'` is SPARQL surface syntax for `p`.

SHACL Lists

A SHACL list in an RDF graph `G` is an [IRI](#dfn-iri) or a [blank node](#dfn-blank-node) that is either `rdf:nil` (provided that `rdf:nil` has no [value](#dfn-value) for either `rdf:first` or `rdf:rest`), or has exactly one [value](#dfn-value) for the property `rdf:first` in `G` and exactly one [value](#dfn-value) for the property `rdf:rest` in `G` that is also a SHACL list in `G`, and the list does not have itself as a value of the property path `rdf:rest+` in `G`.  
The members of any SHACL list except `rdf:nil` in an RDF graph `G` consist of its value for `rdf:first` in `G` followed by the members in `G` of its value for `rdf:rest` in `G`. The SHACL list `rdf:nil` has no members in any RDF graph.

Binding, Solution

A binding is a pair ([variable](https://www.w3.org/TR/sparql11-query/#defn_QueryVariable), [RDF term](#dfn-rdf-term)), consistent with the term's use in [SPARQL](https://www.w3.org/TR/sparql11-query/). A solution is a set of bindings, informally often understood as one row in the body of the result table of a SPARQL query. Variables are not required to be bound in a solution.

SHACL Subclass, SHACL superclass

A [node](#dfn-node) `Sub` in an [RDF graph](#dfn-rdf-graph) is a SHACL subclass of another [node](#dfn-node) `Super` in the [graph](#dfn-rdf-graph) if there is a sequence of [triples](#dfn-rdf-triple) in the [graph](#dfn-rdf-graph) each with predicate `rdfs:subClassOf` such that the [subject](#dfn-subject) of the first [triple](#dfn-rdf-triple) is `Sub`, the [object](#dfn-object) of the last triple is `Super`, and the [object](#dfn-object) of each [triple](#dfn-rdf-triple) except the last is the [subject](#dfn-subject) of the next. If `Sub` is a [SHACL subclass](#dfn-shacl-subclass) of `Super` in an [RDF graph](#dfn-rdf-graph) then `Super` is a SHACL superclass of `Sub` in the [graph](#dfn-rdf-graph).

SHACL Type

The SHACL types of an [RDF term](#dfn-rdf-term) in an [RDF graph](#dfn-rdf-graph) is the set of its [values](#dfn-value) for `rdf:type` in the [graph](#dfn-rdf-graph) as well as the [SHACL superclasses](#dfn-shacl-superclass) of these [values](#dfn-value) in the [graph](#dfn-rdf-graph).

SHACL Class

[Nodes](#dfn-node) in an [RDF graph](#dfn-rdf-graph) that are subclasses, superclasses, or types of [nodes](#dfn-node) in the [graph](#dfn-rdf-graph) are referred to as SHACL class.

SHACL Class Instance

A [node](#dfn-node) `n` in an [RDF graph](#dfn-rdf-graph) `G` is a SHACL instance of a [SHACL class](#dfn-shacl-class) `C` in `G` if one of the [SHACL types](#dfn-shacl-types) of `n` in `G` is `C`.

SHACL Core and SHACL-SPARQL

The SHACL specification is divided into SHACL Core and SHACL-SPARQL. SHACL Core consists of frequently needed features for the representation of shapes, constraints and targets. All SHACL implementations _MUST_ at least implement SHACL Core. SHACL-SPARQL consists of all features of SHACL Core plus the advanced features of SPARQL-based constraints and an extension mechanism to declare new constraint components.

### 1.2 Document Conventions

Within this document, the following namespace prefix bindings are used:

| Prefix | Namespace |
| --- | --- |
| `rdf:` | `http://www.w3.org/1999/02/22-rdf-syntax-ns#` |
| `rdfs:` | `http://www.w3.org/2000/01/rdf-schema#` |
| `sh:` | `[http://www.w3.org/ns/shacl#](https://www.w3.org/ns/shacl)` |
| `xsd:` | `http://www.w3.org/2001/XMLSchema#` |
| `ex:` | `http://example.com/ns#` |

Note that the URI of the graph defining the SHACL vocabulary itself is equivalent to the namespace above, i.e. it includes the `#`. References to the SHACL vocabulary, e.g. via `owl:imports` should include the `#`.

Throughout the document, color-coded boxes containing RDF graphs in Turtle will appear. These fragments of Turtle documents use the prefix bindings given above.

\# This box represents an input shapes graph

# Triples that can be omitted are marked as grey e.g.
<s> <p> <o> .

\# This box represents an input data graph.
# When highlighting is used in the examples:

# Elements highlighted in blue are [focus nodes](#dfn-focus-node)
ex:Bob a ex:Person .

# Elements highlighted in red are focus nodes that fail [validation](#validation)
ex:Alice a ex:Person .

\# This box represents an output results graph

SHACL Definitions appear in blue boxes:

SPARQL or TEXTUAL DEFINITIONS

\# This box contains SPARQL or textual definitions. 

Grey boxes such as this include syntax rules that apply to the [shapes graph](#dfn-shapes-graph).

`true` denotes the RDF term `"true"^^xsd:boolean`. `false` denotes the RDF term `"false"^^xsd:boolean`.

### 1.3 Conformance

As well as sections marked as non-normative, all authoring guidelines, diagrams, examples, and notes in this specification are non-normative. Everything else in this specification is normative.

The key words _MAY_, _MUST_, _MUST NOT_, and _SHOULD_ are to be interpreted as described in \[[RFC2119](#bib-RFC2119)\].

This document defines the **SHACL Core** language, also referred to as just **SHACL**, as described in Part A, and the **SHACL-SPARQL** language that extends SHACL Core with constructs described in Part B. This specification describes conformance criteria for:

-   **SHACL Core processors** as processors that support validation with the SHACL Core Language
-   **SHACL-SPARQL processors** as processors that support validation with the SHACL-SPARQL Language

This document includes syntactic rules that shapes and other nodes need to fulfill in the [shapes graph](#dfn-shapes-graph). These rules are typically of the form _A shape must have..._ or _The values of X are literals_ or _All objects of triples with predicate P must be IRIs_. The complete list of these rules can be found in the [appendix](#syntax-rules). Nodes that violate any of these rules are called ill-formed. Nodes that violate none of these rules are called well-formed. A [shapes graph](#dfn-shapes-graph) is ill-formed if it contains at least one ill-formed node.

_The remainder of this section is informative._

SHACL Core processors that do not also support SHACL-SPARQL ignore any SHACL-SPARQL constructs such as `sh:sparql` [triples](#dfn-rdf-triple).

### 1.4 SHACL Example

_This section is non-normative._

The following example [data graph](#dfn-data-graph) contains three [SHACL instances](#dfn-shacl-instance) of the [class](#dfn-shacl-class) `ex:Person`.

ex:Alice
	a ex:Person ;
	ex:ssn "987-65-432A" .
  
ex:Bob
	a ex:Person ;
	ex:ssn "123-45-6789" ;
	ex:ssn "124-35-6789" .
  
ex:Calvin
	a ex:Person ;
	ex:birthDate "1971-07-07"^^xsd:date ;
	ex:worksFor ex:UntypedCompany .

The following conditions are shown in the example:

-   A [SHACL instance](#dfn-shacl-instance) of `ex:Person` can have at most one [value](#dfn-value) for the property `ex:ssn`, and this [value](#dfn-value) is a [literal](#dfn-literal) with the datatype `xsd:string` that matches a specified regular expression.
-   A [SHACL instance](#dfn-shacl-instance) of `ex:Person` can have unlimited [values](#dfn-value) for the property `ex:worksFor`, and these [values](#dfn-value) are [IRIs](#dfn-iri) and [SHACL instances](#dfn-shacl-instance) of `ex:Company`.
-   A [SHACL instance](#dfn-shacl-instance) of `ex:Person` cannot have [values](#dfn-value) for any other property apart from `ex:ssn`, `ex:worksFor` and `rdf:type`.

The aforementioned conditions can be represented as [shapes](#dfn-shape) and [constraints](#dfn-constraint) in the following [shapes graph](#dfn-shapes-graph):

ex:PersonShape
	a sh:NodeShape ;
	sh:targetClass ex:Person ;    # Applies to all persons
	sh:property \[                 # \_:b1
		sh:path ex:ssn ;           # constrains the values of ex:ssn
		sh:maxCount 1 ;
		sh:datatype xsd:string ;
		sh:pattern "^\\\\d{3}-\\\\d{2}-\\\\d{4}$" ;
	\] ;
	sh:property \[                 # \_:b2
		sh:path ex:worksFor ;
		sh:class ex:Company ;
		sh:nodeKind sh:IRI ;
	\] ;
	sh:closed true ;
	sh:ignoredProperties ( rdf:type ) .

The example below shows the same shape definition as a possible JSON-LD \[[json-ld](#bib-json-ld)\] fragment. Note that we have left out a `@context` declaration, and depending on the `@context` the rendering may look quite different. Therefore this example should be understood as an illustration only.

{
	"@id" : "ex:PersonShape",
	"@type" : "NodeShape",
	"targetClass" : "ex:Person",
	"property" : \[
		{
			"path" : "ex:ssn",
			"maxCount" : 1,
			"datatype" : "xsd:string" ,
			"pattern" : "^\\\\d{3}-\\\\d{2}-\\\\d{4}$"
		},
		{
			"path" : "ex:worksFor",
			"class" : "ex:Company",
			"nodeKind" : "sh:IRI"
		}
	\],
	"closed" : true,
	"ignoredProperties" : \[ "rdf:type" \]
}

We can use the shape declaration above to illustrate some of the key terminology used by SHACL. The [target](#dfn-target) for the [shape](#dfn-shape) `ex:PersonShape` is the set of all [SHACL instances](#dfn-shacl-instance) of the [class](#dfn-shacl-class) `ex:Person`. This is specified using the property `sh:targetClass`. During the validation, these target nodes become [focus nodes](#dfn-focus-node) for the shape. The [shape](#dfn-shape) `ex:PersonShape` is a [node shape](#dfn-node-shape), which means that it applies to the focus nodes. It declares [constraints](#dfn-constraint) on the [focus nodes](#dfn-focus-node), for example using the [parameters](#dfn-parameters) `sh:closed` and `sh:ignoredProperties`. The [node shape](#dfn-node-shape) also declares two other constraints with the property `sh:property`, and each of these is backed by a [property shape](#dfn-property-shape). These [property shapes](#dfn-property-shape) declare additional [constraints](#dfn-constraint) using [parameters](#dfn-parameters) such as `sh:datatype` and `sh:maxCount`.

Some of the [property shapes](#dfn-property-shape) specify parameters from multiple [constraint components](#dfn-constraint-component) in order to restrict multiple aspects of the [property values](#dfn-value). For example, in the [property shape](#dfn-property-shape) for `ex:ssn`, parameters from three [constraint components](#dfn-constraint-component) are used. The [parameters](#dfn-parameters) of these [constraint components](#dfn-constraint-component) are `sh:datatype`, `sh:pattern` and `sh:maxCount`. For each [focus node](#dfn-focus-node) the [property values](#dfn-value) of `ex:ssn` will be validated against all three components.

SHACL [validation](#dfn-validation) based on the provided [data graph](#dfn-data-graph) and [shapes graph](#dfn-shapes-graph) would produce the following [validation report](#dfn-validation-report). See the section [Validation Report](#validation-report) for details on the format.

\[	a sh:ValidationReport ;
	sh:conforms false ;
	sh:result
	\[	a sh:ValidationResult ;
		sh:resultSeverity sh:Violation ;
		sh:focusNode ex:Alice ;
		sh:resultPath ex:ssn ;
		sh:value "987-65-432A" ;
		sh:sourceConstraintComponent sh:RegexConstraintComponent ;
		sh:sourceShape ... blank node \_:b1 on ex:ssn above ... ;
	\] ,
	\[	a sh:ValidationResult ;
		sh:resultSeverity sh:Violation ;
		sh:focusNode ex:Bob ;
		sh:resultPath ex:ssn ;
		sh:sourceConstraintComponent sh:MaxCountConstraintComponent ;
		sh:sourceShape ... blank node \_:b1 on ex:ssn above ... ;
	\] ,
	\[	a sh:ValidationResult ;
		sh:resultSeverity sh:Violation ;
		sh:focusNode ex:Calvin ;
		sh:resultPath ex:worksFor ;
		sh:value ex:UntypedCompany ;
		sh:sourceConstraintComponent sh:ClassConstraintComponent ;
		sh:sourceShape ... blank node \_:b2 on ex:worksFor above ... ;
	\] ,
	\[	a sh:ValidationResult ;
		sh:resultSeverity sh:Violation ;
		sh:focusNode ex:Calvin ;
		sh:resultPath ex:birthDate ;
		sh:value "1971-07-07"^^xsd:date ;
		sh:sourceConstraintComponent sh:ClosedConstraintComponent ;
		sh:sourceShape sh:PersonShape ;
	\] 
\] .

The [validation results](#dfn-validation-results) are enclosed in a [validation report](#dfn-validation-report). The first [validation result](#dfn-validation-results) is produced because `ex:Alice` has a [value](#dfn-value) for `ex:ssn` that does not match the regular expression specified by the property `sh:regex`. The second [validation result](#dfn-validation-results) is produced because `ex:Bob` has more than the permitted number of [values](#dfn-value) for the property `ex:ssn` as specified by the `sh:maxCount` of 1. The third [validation result](#dfn-validation-results) is produced because `ex:Calvin` has a [value](#dfn-value) for `ex:worksFor` that does not have an `rdf:type` triple that makes it a [SHACL instance](#dfn-shacl-instance) of `ex:Company`. The forth [validation result](#dfn-validation-results) is produced because the [shape](#dfn-shape) `ex:PersonShape` has the property `sh:closed` set to `true` but `ex:Calvin` uses the property `ex:birthDate` which is neither one of the predicates from any of the [property shapes](#dfn-property-shape) of the shape, nor one of the properties listed using `sh:ignoredProperties`.

### 1.5 Relationship between SHACL and RDFS inferencing

SHACL uses the RDF and RDFS vocabularies, but full RDFS inferencing is not required.

However, SHACL processors _MAY_ operate on RDF graphs that include entailments \[[sparql11-entailment](#bib-sparql11-entailment)\] - either pre-computed before being submitted to a SHACL processor or performed on the fly as part of SHACL processing (without modifying either [data graph](#dfn-data-graph) or [shapes graph](#dfn-shapes-graph)). To support processing of entailments, SHACL includes the property `sh:entailment` to indicate what inferencing is required by a given [shapes graph](#dfn-shapes-graph).

The [values](#dfn-value) of the property `sh:entailment` are IRIs. Common values for this property are covered by \[[sparql11-entailment](#bib-sparql11-entailment)\].

SHACL implementations _MAY_, but are not required to, support entailment regimes. If a [shapes graph](#dfn-shapes-graph) contains any [triple](#dfn-rdf-triple) with the [predicate](#dfn-predicate) `sh:entailment` and [object](#dfn-object) `E` and the SHACL processor does not support `E` as an entailment regime for the given [data graph](#dfn-data-graph) then the processor _MUST_ signal a [failure](#dfn-failure). Otherwise, the SHACL processor _MUST_ provide the entailments for all of the values of `sh:entailment` in the [shapes graph](#dfn-shapes-graph), and any inferred triples _MUST_ be returned by all queries against the [data graph](#dfn-data-graph) during the [validation](#dfn-validation) process.

### 1.6 Relationship between SHACL and SPARQL

_This section is non-normative._

For [SHACL Core](#dfn-shacl-core) this specification uses parts of SPARQL 1.1 in non-normative alternative definitions of the semantics of [constraint components](#dfn-constraint-component) and [targets](#dfn-target). While these may help some implementers, SPARQL is not required for the implementation of the SHACL Core language.

[SHACL-SPARQL](#dfn-shacl-sparql) is based on SPARQL 1.1 and uses it as a mechanism to declare constraints and constraint components. Implementations that cover only the SHACL Core features are not required to implement these mechanisms.

SPARQL variables using the `$` marker represent external [bindings](#dfn-binding) that are [pre-bound](#dfn-pre-binding-of-variables) or, in the case of `$PATH`, [substituted](#dfn-substitute) in the SPARQL query before execution (as explained in [6.3 Validation with SPARQL-based Constraint Components](#constraint-components-validation)).

The definition of some [constraints](#dfn-constraint) requires or is simplified through access to the [shapes graph](#dfn-shapes-graph) during query execution. SHACL-SPARQL processors _MAY_ [pre-bind](#dfn-pre-binding-of-variables) the variable `shapesGraph` to provide access to the [shapes graph](#dfn-shapes-graph). Access to the [shapes graph](#dfn-shapes-graph) is not a requirement for supporting the SHACL Core language. The variable `shapesGraph` can also be used in [SPARQL-based constraints](#sparql-constraints) and [SPARQL-based constraint components](#sparql-constraint-components). However, such [constraints](#dfn-constraint) may not be interoperable across different SHACL-SPARQL processors or not applicable to remote RDF datasets.

Note that at the time of writing, SPARQL EXISTS has been imperfectly defined and implementations vary. While a [W3C Community Group](https://www.w3.org/community/sparql-exists/) is working on improving this situation, users of SPARQL are advised that the use of EXISTS may have inconsistent results and should be approached with care.

The button below can be used to show or hide the SPARQL definitions.

 

# Part 1: SHACL Core

## 2\. Shapes and Constraints

_The following introduction is non-normative._

The following informal diagram provides an overview of some of the key classes in the SHACL vocabulary. Each box represents a class. The content of the boxes under the class name lists some of the properties that instances of these classes may have, together with their value types. The arrows indicate `rdfs:subClassOf` triples.

[sh:Shape](#shapes)

[sh:targetClass](#targetClass) : rdfs:Class

[sh:targetNode](#targetNode) : any IRI or literal

[sh:targetObjectsOf](#targetObjectsOf) : rdf:Property

[sh:targetSubjectsOf](#targetSubjectsOf) : rdf:Property

[sh:deactivated](#deactivated) : xsd:boolean

[sh:message](#message) : xsd:string or rdf:langString

[sh:severity](#severity) : sh:Severity

![Class Diagram Arrows](images/Class-Diagram-Arrows.png)

[sh:NodeShape](#node-shapes)

**[Constraint parameters](#constraints)**, for example:

[sh:closed](#ClosedConstraintComponent) : xsd:boolean

[sh:or](#OrConstraintComponent) : rdf:List

[sh:not](#NotConstraintComponent) : sh:Shape

[sh:property](#PropertyConstraintComponent) : sh:PropertyShape

[sh:PropertyShape](#property-shapes)

**[Constraint parameters](#constraints)**, for example:

[sh:minCount](#MinCountConstraintComponent), [sh:maxCount](#MaxCountConstraintComponent) : xsd:integer

[sh:class](#ClassConstraintComponent) or [sh:datatype](#DatatypeConstraintComponent) : rdfs:Resource

[sh:node](#NodeConstraintComponent) : sh:NodeShape

[sh:name](#name) : xsd:string or rdf:langString

[sh:description](#description) : xsd:string or rdf:langString

[sh:defaultValue](#defaultValue) : any

[sh:group](#group) : sh:PropertyGroup

[sh:path](#property-shapes) : rdfs:Resource

The [Turtle serialization of the SHACL vocabulary](https://www.w3.org/ns/shacl.ttl) contains the complete SHACL vocabulary.

### 2.1 Shapes

A shape is an [IRI](#dfn-iri) or [blank node](#dfn-blank-node) `s` that fulfills at least one of the following conditions in the [shapes graph](#dfn-shapes-graph):

-   `s` is a [SHACL instance](#dfn-shacl-instance) of `sh:NodeShape` or `sh:PropertyShape`.
-   `s` is [subject](#dfn-subject) of a triple that has `sh:targetClass`, `sh:targetNode`, `sh:targetObjectsOf` or `sh:targetSubjectsOf` as [predicate](#dfn-predicate).
-   `s` is [subject](#dfn-subject) of a triple that has a [parameter](#dfn-parameters) as [predicate](#dfn-predicate).
-   `s` is a [value](#dfn-value) of a [shape-expecting](#dfn-shape-expecting-constraint-parameters), non-[list-taking](#dfn-list-taking-constraint-parameters) [parameter](#dfn-parameters) such as `sh:node`, or a [member](#dfn-members) of a [SHACL list](#dfn-shacl-list) that is a [value](#dfn-value) of a [shape-expecting](#dfn-shape-expecting-constraint-parameters) and [list-taking](#dfn-list-taking-constraint-parameters) parameter such as `sh:or`.

Note that the definition above does not include all of the syntax rules of [well-formed](#dfn-well-formed) shapes. Those are found throughout the document and summarized in Appendix [B. Summary of SHACL Syntax Rules](#syntax-rules). For example, shapes that have [literals](#dfn-literal) as values for `sh:targetClass` are [ill-formed](#dfn-ill-formed).

Informally, a shape determines how to validate a [focus node](#dfn-focus-node) based on the [values](#dfn-value) of properties and other characteristics of the focus node. For example, shapes can declare the condition that a focus node be an IRI or that a focus node has a particular value for a property and also a minimum number of values for the property.

The SHACL Core language defines two types of shapes:

-   shapes about the [focus node](#dfn-focus-node) itself, called [node shapes](#dfn-node-shape)
-   shapes about the [values](#dfn-value) of a particular property or path for the focus node, called [property shapes](#dfn-property-shape)

`sh:Shape` is the [SHACL superclass](#dfn-shacl-superclass) of those two shape types in the SHACL vocabulary. Its subclasses `sh:NodeShape` and `sh:PropertyShape` can be used as SHACL type of node and property shapes, respectively.

#### 2.1.1 Constraints, Parameters and Constraint Components

Shapes can declare [constraints](#dfn-constraint) using the [parameters](#dfn-parameters) of [constraint components](#dfn-constraint-component).

A constraint component is an [IRI](#dfn-iri). Each constraint component has one or more mandatory parameters, each of which is a property. Each constraint component has zero or more optional parameters, each of which is a property. The parameters of a constraint component are its mandatory parameters plus its optional parameters.

For example, the [component](#dfn-constraint-component) `sh:MinCountConstraintComponent` declares the [parameter](#dfn-parameters) `sh:minCount` to represent the restriction that a [node](#dfn-node) has at least a minimum number of [values](#dfn-value) for a particular property.

For a [constraint component](#dfn-constraint-component) `C` with [mandatory parameters](#dfn-mandatory-parameters) `p1`, ... `pn`, a [shape](#dfn-shape) `s` in a [shapes graph](#dfn-shapes-graph) `SG` _declares_ a constraint that has kind `C` with [mandatory parameter](#dfn-mandatory-parameters) [values](#dfn-value) `<p1,v1>`, ... `<pn,vn>` in `SG` when `s` has `vi` as a [value](#dfn-value) for `pi` in `SG`. For constraint components with [optional parameters](#dfn-optional-parameters), the constraint declaration consists of the [values](#dfn-value) that the shape has for all mandatory and optional parameters of that component.

Some constraint components declare only a single parameter. For example [`sh:ClassConstraintComponent`](#ClassConstraintComponent) has the single parameter `sh:class`. These parameters may be used multiple times in the same shape, and each [value](#dfn-value) of such a parameter declares an individual [constraint](#dfn-constraint). The interpretation of such declarations is conjunction, i.e. all constraints apply. The following example specifies that the values of `ex:customer` have to be [SHACL instances](#dfn-shacl-instance) of both `ex:Customer` and `ex:Person`.

ex:InvoiceShape
	a sh:NodeShape ;
	sh:property \[
		sh:path ex:customer ;
		sh:class ex:Customer ;
		sh:class ex:Person ;
	\] .

Some constraint components such as [`sh:PatternConstraintComponent`](#PatternConstraintComponent) declare more than one parameter. Shapes that have more than one value for any of the parameters of such components are [ill-formed](#dfn-ill-formed).

One way to bypass this syntax rule is to spread the constraints across multiple (property) shapes, as illustrated in the following example.

ex:MultiplePatternsShape
	a sh:NodeShape ;
	sh:property \[
		sh:path ex:name ;
		sh:pattern "^Start" ;
		sh:flags "i" ;
	\] ;
	sh:property \[
		sh:path ex:name ;
		sh:pattern "End$" ;
	\] .

Constraint components are associated with validators, which provide instructions (for example expressed via SPARQL queries) on how the parameters are used to validate data. Validating an [RDF term](#dfn-rdf-term) against a [shape](#dfn-shape) involves validating the term against each [constraint](#dfn-constraint) where the shape has [values](#dfn-value) for all [mandatory parameters](#dfn-mandatory-parameters) of the [component](#dfn-constraint-component) of the [constraint](#dfn-constraint), using the validators associated with the respective component.

The list of constraint components included in SHACL Core is described in [section 4](#constraints). SHACL-SPARQL can be used to declare additional [constraint components based on SPARQL](#sparql-constraint-components).

#### 2.1.2 Focus Nodes

An [RDF term](#dfn-rdf-term) that is [validated](#dfn-validation) against a [shape](#dfn-shape) using the triples from a [data graph](#dfn-data-graph) is called a focus node.

_The remainder of this section is informative._

The set of [focus nodes](#dfn-focus-node) for a [shape](#dfn-shape) may be identified as follows:

-   specified in a [shape](#dfn-shape) using [target declarations](#dfn-target-declarations)
-   specified in any [constraint](#dfn-constraint) that references a [shape](#dfn-shape) in parameters of [shape-expecting constraint parameters](#dfn-shape-expecting-constraint-parameters) (e.g. `sh:node`)
-   specified as explicit input to the SHACL processor for validating a specific RDF term against a shape

#### 2.1.3 Targets

Target declarations of a [shape](#dfn-shape) in a [shapes graph](#dfn-shapes-graph) are [triples](#dfn-rdf-triple) with the [shape](#dfn-shape) as the [subject](#dfn-subject) and certain properties described in this document (e.g., `sh:targetClass`) as [predicates](#dfn-predicate). Target declarations can be used to produce [focus nodes](#dfn-focus-node) for a [shape](#dfn-shape). The target of a [target declaration](#dfn-target-declarations) is the set of RDF terms produced by applying the rules described in the remainder of this section to the [data graph](#dfn-data-graph). The target of a shape is the union of all RDF terms produced by the individual [targets](#dfn-target) that are declared by the [shape](#dfn-shape) in the [shapes graph](#dfn-shapes-graph).

SHACL Core includes the following kinds of targets: [node targets](#targetNode), [class-based targets](#targetClass) (including [implicit class-based targets](#implicit-targetClass)), [subjects-of targets](#targetSubjectsOf), and [objects-of targets](#targetObjectsOf).

_The remainder of this introduction is informative._

RDF terms produced by targets are not required to exist as nodes in the [data graph](#dfn-data-graph). Targets of a shape are ignored whenever a focus node is provided directly as input to the validation process for that shape. This includes the cases where the shape is a value of one of the [shape-expecting constraint parameters](#dfn-shape-expecting-constraint-parameters) (such as `sh:node`) and a focus node is determined during the validation of the corresponding constraint component (such as `sh:NodeConstraintComponent`). In such cases, the provided focus node does not need to be in the [target of the shape](#dfn-target-of-a-shape).

##### 2.1.3.1 Node targets (sh:targetNode)

A node target is specified using the `sh:targetNode` predicate. Each [value](#dfn-value) of `sh:targetNode` in a shape is either an [IRI](#dfn-iri) or a [literal](#dfn-literal).

TEXTUAL DEFINITION

If `s` is a [shape](#dfn-shape) in a [shapes graph](#dfn-shapes-graph) `SG` and `s` has [value](#dfn-value) `t` for `sh:targetNode` in `SG` then `{ t }` is a [target](#dfn-target) from any data graph for `s` in `SG`.

_The remainder of this section is informative._

With the example data below, only `ex:Alice` is the target of the provided shape:

ex:PersonShape
	a sh:NodeShape ;
	sh:targetNode ex:Alice .

ex:Alice a ex:Person .
ex:Bob a ex:Person .

The following query expresses a potential definition of node targets in SPARQL. The variable `targetNode` will be [pre-bound](#pre-binding) to the given value of `sh:targetNode`. All [bindings](#dfn-binding) of the variable `this` from the [solution](#dfn-solution) become focus nodes.

POTENTIAL DEFINITION IN SPARQL

SELECT DISTINCT ?this    \# ?this is the focus node
WHERE {
	BIND ($targetNode AS ?this)    \# $targetNode is [pre-bound](#pre-binding) to ex:Alice
}

##### 2.1.3.2 Class-based Targets (sh:targetClass)

A class target is specified with the `sh:targetClass` predicate. Each value of `sh:targetClass` in a shape is an [IRI](#dfn-iri).

TEXTUAL DEFINITION

If `s` is a shape in a shapes graph `SG` and `s` has [value](#dfn-value) `c` for `sh:targetClass` in `SG` then the set of [SHACL instances](#dfn-shacl-instance) of `c` in a data graph `DG` is a [target](#dfn-target) from `DG` for `s` in `SG`.

_The remainder of this section is informative._

ex:PersonShape
	a sh:NodeShape ;
	sh:targetClass ex:Person .

ex:Alice a ex:Person .
ex:Bob a ex:Person .
ex:NewYork a ex:Place .

In this example, only `ex:Alice` and `ex:Bob` are focus nodes. Note that, according to the [SHACL instance](#dfn-shacl-instance) definition, all the `rdfs:subClassOf` declarations needed to walk the class hierarchy need to exist in the [data graph](#dfn-data-graph). However, the `ex:Person a rdfs:Class` triple is not required to exist in either graphs.

In the following example, the selected focus node is only `ex:Who`.

ex:Doctor rdfs:subClassOf ex:Person .
ex:Who a ex:Doctor .
ex:House a ex:Nephrologist .

The following query expresses a potential definition of class targets in SPARQL. The variable `targetClass` will be [pre-bound](#pre-binding) to the given value of `sh:targetClass`. All [bindings](#dfn-binding) of the variable `this` from the [solutions](#dfn-solution) become focus nodes.

POTENTIAL DEFINITION IN SPARQL

SELECT DISTINCT ?this    \# ?this is the focus node
WHERE {
	?this rdf:type/rdfs:subClassOf\* $targetClass .    \# $targetClass is [pre-bound](#pre-binding) to ex:Person
}

##### 2.1.3.3 Implicit Class Targets

Informally, if a [shape](#dfn-shape) is also declared to be a [class](#dfn-shacl-class) in the [shapes graph](#dfn-shapes-graph) then all [SHACL instances](#dfn-shacl-instance) of this class are a target for the shape.

If `s` is a [SHACL instance](#dfn-shacl-instance) of `sh:NodeShape` or `sh:PropertyShape` in an RDF graph `G` and `s` is also a [SHACL instance](#dfn-shacl-instance) of `rdfs:Class` in `G` and `s` is not an [IRI](#dfn-iri) then `s` is an [ill-formed](#dfn-ill-formed) shape in `G`.

TEXTUAL DEFINITION

If `s` is a [SHACL instance](#dfn-shacl-instance) of `sh:NodeShape` or `sh:PropertyShape` in a [shapes graph](#dfn-shapes-graph) `SG` and `s` is also a [SHACL instance](#dfn-shacl-instance) of `rdfs:Class` in `SG` then the set of [SHACL instances](#dfn-shacl-instance) of `s` in a data graph `DG` is a [target](#dfn-target) from `DG` for `s` in `SG`.

_The remainder of this section is informative._

In the following example, `ex:Alice` is a focus node, because it is a [SHACL instance](#dfn-shacl-instance) of `ex:Person` which is both a class and a shape in the [shapes graph](#dfn-shapes-graph).

ex:Person
	**a rdfs:Class**, sh:NodeShape .

ex:Alice a ex:Person .
ex:NewYork a ex:Place .

##### 2.1.3.4 Subjects-of targets (sh:targetSubjectsOf)

A subjects-of target is specified with the predicate `sh:targetSubjectsOf`. The [values](#dfn-value) of `sh:targetSubjectsOf` in a shape are [IRIs](#dfn-iri).

TEXTUAL DEFINITION

If `s` is a shape in a shapes graph `SG` and `s` has [value](#dfn-value) `p` for `sh:targetSubjectsOf` in `SG` then the set of nodes in a data graph `DG` that are [subjects](#dfn-subject) of triples in `DG` with [predicate](#dfn-predicate) `p` is a [target](#dfn-target) from `DG` for `s` in `SG`.

_The remainder of this section is informative._

ex:TargetSubjectsOfExampleShape
	a sh:NodeShape ;
	sh:targetSubjectsOf ex:knows .

ex:Alice ex:knows ex:Bob .
ex:Bob ex:livesIn ex:NewYork .

In the example above, only `ex:Alice` is validated against the given shape, because it is the [subject](#dfn-subject) of a [triple](#dfn-rdf-triple) that has `ex:knows` as its [predicate](#dfn-predicate).

The following query expresses a potential definition of subjects-of targets in SPARQL. The variable `targetSubjectsOf` will be [pre-bound](#pre-binding) to the given value of `sh:targetSubjectsOf`. All [bindings](#dfn-binding) of the variable `this` from the [solutions](#dfn-solution) become focus nodes.

POTENTIAL DEFINITION IN SPARQL

SELECT DISTINCT ?this    \# ?this is the focus node
WHERE {
	?this $targetSubjectsOf ?any .    \# $targetSubjectsOf is [pre-bound](#pre-binding) to ex:knows
}

##### 2.1.3.5 Objects-of targets (sh:targetObjectsOf)

An objects-of target is specified with the predicate `sh:targetObjectsOf`. The [values](#dfn-value) of `sh:targetObjectsOf` in a shape are [IRIs](#dfn-iri).

TEXTUAL DEFINITION

If `s` is a shape in a shapes graph `SG` and `s` has [value](#dfn-value) `p` for `sh:targetObjectsOf` in `SG` then the set of nodes in a data graph `DG` that are [objects](#dfn-object) of triples in `DG` with [predicate](#dfn-predicate) `p` is a [target](#dfn-target) from `DG` for `s` in `SG`.

_The remainder of this section is informative._

ex:TargetObjectsOfExampleShape
	a sh:NodeShape ;
	sh:targetObjectsOf ex:knows .

ex:Alice ex:knows ex:Bob .
ex:Bob ex:livesIn ex:NewYork .

In the example above, only `ex:Bob` is validated against the given shape, because it is the [object](#dfn-object) of a [triple](#dfn-rdf-triple) that has `ex:knows` as its [predicate](#dfn-predicate).

The following query expresses a potential definition of objects-of targets in SPARQL. The variable `targetObjectsOf` will be [pre-bound](#pre-binding) to the given value of `sh:targetObjectsOf`. All [bindings](#dfn-binding) of the variable `this` from the [solutions](#dfn-solution) become focus nodes.

POTENTIAL DEFINITION IN SPARQL

SELECT DISTINCT ?this    \# ?this is the focus node
WHERE {
	?any $targetObjectsOf ?this .    \# $targetObjectsOf is [pre-bound](#pre-binding) to ex:knows
}

#### 2.1.4 Declaring the Severity of a Shape

Shapes can specify one [value](#dfn-value) for the property `sh:severity` in the [shapes graph](#dfn-shapes-graph). Each value of `sh:severity` in a shape is an [IRI](#dfn-iri).

The values of `sh:severity` are called severities. SHACL includes the three IRIs listed in the table below to represent [severities](#dfn-severities). These are declared in the SHACL vocabulary as SHACL instances of `sh:Severity`.

| Severity | Description |
| --- | --- |
| `sh:Info` | A non-critical constraint violation indicating an informative message. |
| `sh:Warning` | A non-critical constraint violation indicating a warning. |
| `sh:Violation` | A constraint violation. |

_The remainder of this section is informative._

The specific values of `sh:severity` have no impact on the validation, but _MAY_ be used by user interface tools to categorize validation results. The values of `sh:severity` are used by SHACL processors to populate the `sh:resultSeverity` field of validation results, see [section on severity in validation results](#results-severity). Any IRI can be used as a severity.

For every shape, `sh:Violation` is the default if `sh:severity` is unspecified. The following example illustrates this.

ex:MyShape
	a sh:NodeShape ;
	sh:targetNode ex:MyInstance ;
	sh:property \[    # \_:b1
		# Violations of sh:minCount and sh:datatype are produced as warnings
		sh:path ex:myProperty ;
		sh:minCount 1 ;
		sh:datatype xsd:string ;
		sh:severity sh:Warning ;
	\] ;
	sh:property \[    # \_:b2
		# The default severity here is sh:Violation
		sh:path ex:myProperty ;
		sh:maxLength 10 ;
		sh:message "Too many characters"@en ;
		sh:message "Zu viele Zeichen"@de ;
	\] .

ex:MyInstance
	ex:myProperty "http://toomanycharacters"^^xsd:anyURI .

\[	a sh:ValidationReport ;
	sh:conforms false ;
	sh:result
	\[	a sh:ValidationResult ;
		sh:resultSeverity sh:Warning ;
		sh:focusNode ex:MyInstance ;
		sh:resultPath ex:myProperty ;
		sh:value "http://toomanycharacters"^^xsd:anyURI ;
		sh:sourceConstraintComponent sh:DatatypeConstraintComponent ;
		sh:sourceShape \_:b1 ;
	\] ,
	\[	a sh:ValidationResult ;
		sh:resultSeverity sh:Violation ;
		sh:focusNode ex:MyInstance ;
		sh:resultPath ex:myProperty ;
		sh:value "http://toomanycharacters"^^xsd:anyURI ;
		sh:resultMessage "Too many characters"@en ;
		sh:resultMessage "Zu viele Zeichen"@de ;
		sh:sourceConstraintComponent sh:MaxLengthConstraintComponent ;
		sh:sourceShape \_:b2 ;
	\]
\] .

#### 2.1.5 Declaring Messages for a Shape

Shapes can have values for the property `sh:message`. The values of `sh:message` in a shape are either `xsd:string` literals or literals with a language tag. A shape should not have more than one value for `sh:message` with the same language tag.

If a shape has at least one value for `sh:message` in the shapes graph, then all [validation results](#dfn-validation-results) produced as a result of the shape will have exactly these messages as their value of `sh:resultMessage`, i.e. the values will be copied from the shapes graph into the results graph. (Note that in SHACL-SPARQL, [SPARQL-based constraints](#dfn-sparql-based-constraints) and [SPARQL-based constraint components](#sparql-constraint-components) provide additional means to declare such messages.)

_The remainder of this section is informative._

The example from the previous section uses this mechanism to supply the second validation result with two messages. See the [section on `sh:resultMessage` in the validation results](#results-message) on further details on how the values of `sh:resultMessage` are populated.

#### 2.1.6 Deactivating a Shape

Shapes can have at most one value for the property `sh:deactivated`. The value of `sh:deactivated` in a shape must be either `true` or `false`.

A shape that has the [value](#dfn-value) `true` for the property `sh:deactivated` is called deactivated. All RDF terms [conform](#dfn-conforms) to a deactivated shape.

_The remainder of this section is informative._

Use cases of this feature include shape reuse and debugging. In scenarios where shapes from other graphs or files are imported into a given [shapes graph](#dfn-shapes-graph), `sh:deactivated` can be set to `true` in the local shapes graph for imported shapes to exclude shapes that do not apply in the current application context. This makes it possible to reuse SHACL graphs developed by others even if you disagree with certain assumptions made by the original authors. If a shape author anticipates that a shape may need to be disabled or modified by others, it is a good practice to use [IRIs](#dfn-iri) instead of [blank nodes](#dfn-blank-node) for the actual shapes. For example, a [property shape](#dfn-property-shape) for the property `ex:name` at the shape `ex:PersonShape` may have the IRI `ex:PersonShape-name`. Another typical use case of `sh:deactivated` is during the development and testing of shapes, to (temporarily) disable certain shapes.

The following example illustrates the use of `sh:deactivated` to deactivate a shape. In cases where shapes are imported from other graphs, the `sh:deactivated true` triple would be in the importing graph.

ex:PersonShape
	a sh:NodeShape ;
	sh:targetClass ex:Person ;
	sh:property ex:PersonShape-name .

ex:PersonShape-name
	a sh:PropertyShape ;
	sh:path ex:name ;
	sh:minCount 1 ;
	sh:deactivated true .

With the following data, no constraint violation will be reported even though the instance does not have any value for `ex:name`.

ex:JohnDoe a ex:Person .

### 2.2 Node Shapes

A node shape is a [shape](#dfn-shape) in the [shapes graph](#dfn-shapes-graph) that is not the [subject](#dfn-subject) of a [triple](#dfn-rdf-triple) with `sh:path` as its [predicate](#dfn-predicate). It is recommended, but not required, for a [node shape](#dfn-node-shape) to be declared as a [SHACL instance](#dfn-shacl-instance) of `sh:NodeShape`. [SHACL instances](#dfn-shacl-instance) of `sh:NodeShape` cannot have a [value](#dfn-value) for the property `sh:path`.

Informally, node shapes specify constraints that need to be met with respect to [focus nodes](#dfn-focus-node). In contrast to [property shapes](#dfn-property-shape) they primarily apply to the focus node itself, not to its property values.

### 2.3 Property Shapes

A property shape is a [shape](#dfn-shape) in the [shapes graph](#dfn-shapes-graph) that is the [subject](#dfn-subject) of a [triple](#dfn-rdf-triple) that has `sh:path` as its [predicate](#dfn-predicate). A shape has at most one [value](#dfn-value) for `sh:path`. Each [value](#dfn-value) of `sh:path` in a shape must be a [well-formed](#dfn-well-formed) [SHACL property path](#dfn-shacl-property-path). It is recommended, but not required, for a [property shape](#dfn-property-shape) to be declared as a [SHACL instance](#dfn-shacl-instance) of `sh:PropertyShape`. [SHACL instances](#dfn-shacl-instance) of `sh:PropertyShape` have one [value](#dfn-value) for the property `sh:path`.

Informally, property shapes specify constraints that need to be met with respect to [nodes](#dfn-node) that can be reached from the [focus node](#dfn-focus-node) either by directly following a given property (specified as an [IRI](#dfn-iri)) or any other [SHACL property path](#dfn-shacl-property-path), specified using `sh:path`.

Note that the definitions of [well-formed](#dfn-well-formed) [property shapes](#dfn-property-shape) and [node shapes](#dfn-node-shape) make these two sets of nodes disjoint.

The following example illustrates some syntax variations of property shapes.

ex:ExampleNodeShapeWithPropertyShapes
	a sh:NodeShape ;
	sh:property \[
		sh:path ex:email ;
		sh:name "e-mail" ;
		sh:description "We need at least one email value" ;
		sh:minCount 1 ;
	\] ;
	sh:property \[
		sh:path (ex:knows ex:email) ;
		sh:name "Friend's e-mail" ;
		sh:description "We need at least one email for everyone you know" ;
		sh:minCount 1 ;
	\] .
	
ex:ExamplePropertyShape
	a sh:PropertyShape ;
	sh:path ex:email ;
	sh:description "We need at least one email value" ;
	sh:minCount 1 .

#### 2.3.1 SHACL Property Paths

SHACL includes RDF terms to represent the following subset of [SPARQL property paths](#dfn-sparql-property-paths): `PredicatePath`, `InversePath`, `SequencePath`, `AlternativePath`, `ZeroOrMorePath`, `OneOrMorePath` and `ZeroOrOnePath`.

The following sub-sections provide syntax rules of [well-formed](#dfn-well-formed) [SHACL property paths](#dfn-shacl-property-path) together with mapping rules to [SPARQL 1.1 property paths](https://www.w3.org/TR/sparql11-query/#pp-language). These rules define the path mapping `path(p,G)` in an RDF graph `G` of an RDF term `p` that is a SHACL property path in `G`. Two SHACL property paths are considered equivalent paths when they map to the exact same SPARQL property paths.

A node in an RDF graph is a [well-formed](#dfn-well-formed) SHACL property path `p` if it satisfies exactly one of the syntax rules in the following sub-sections. A node `p` is not a [well-formed](#dfn-well-formed) SHACL property path if `p` is a blank node and any path mappings of `p` directly or transitively reference `p`.

The following example illustrates some valid SHACL property paths, together with their SPARQL 1.1 equivalents.

SPARQL Property path: ex:parent
SHACL Property path: ex:parent

SPARQL Property path: ^ex:parent
SHACL Property path: \[ sh:inversePath ex:parent \]

SPARQL Property path: ex:parent/ex:firstName
SHACL Property path: ( ex:parent ex:firstName )

SPARQL Property path: rdf:type/rdfs:subClassOf\*
SHACL Property path: ( rdf:type \[ sh:zeroOrMorePath rdfs:subClassOf \] )

SPARQL Property path: ex:father|ex:mother
SHACL Property path: \[ sh:alternativePath ( ex:father ex:mother  ) \]

##### 2.3.1.1 Predicate Paths

A predicate path is an [IRI](#dfn-iri).

If `p` is a [predicate path](#dfn-predicate-path) then `path(p,G)` is a SPARQL `PredicatePath` with `p` as `iri`.

##### 2.3.1.2 Sequence Paths

A sequence path is a [blank node](#dfn-blank-node) that is a [SHACL list](#dfn-shacl-list) with at least two [members](#dfn-members) and each member is a [well-formed](#dfn-well-formed) SHACL property path.

If `p` is a [sequence path](#dfn-sequence-path) in `G` with list [members](#dfn-members) `v1`, `v2`, ..., `vn` then `path(p,G)` is a SPARQL `SequencePath` of `path(v1,G)` as `elt1`, and the results of the [path mapping](#dfn-path-mapping) of the list node of `v2` as `elt2`.

Informal note: the [nodes](#dfn-node) in such a [SHACL list](#dfn-shacl-list) should not have [values](#dfn-value) for other properties beside `rdf:first` and `rdf:rest`.

##### 2.3.1.3 Alternative Paths

An alternative path is a [blank node](#dfn-blank-node) that is the subject of exactly one triple in `G`. This triple has `sh:alternativePath` as predicate, `L` as object, and `L` is a [SHACL list](#dfn-shacl-list) with at least two [members](#dfn-members) and each member of `L` is a [well-formed](#dfn-well-formed) SHACL property path.

If `p` is an [alternative path](#dfn-alternative-path) in `G` then, for the members of its SHACL list `L`: `v1`, `v2`, ..., `vn`, `path(p,G)` is a SPARQL `AlternativePath` with `path(v1,G)` as `elt1` followed by an `AlternativePath` for `v2` as `elt2`, ..., up to `path(vn,G)`.

##### 2.3.1.4 Inverse Paths

An inverse path is a [blank node](#dfn-blank-node) that is the [subject](#dfn-subject) of exactly one [triple](#dfn-rdf-triple) in `G`. This triple has `sh:inversePath` as predicate, and the [object](#dfn-object) `v` is a [well-formed](#dfn-well-formed) SHACL property path.

If `p` is an [inverse path](#dfn-inverse-path) in `G` then `path(p,G)` is a SPARQL `InversePath` with `path(v,G)` as its `elt`.

##### 2.3.1.5 Zero-Or-More Paths

A zero-or-more path is a [blank node](#dfn-blank-node) that is the [subject](#dfn-subject) of exactly one [triple](#dfn-rdf-triple) in `G`. This triple has `sh:zeroOrMorePath` as [predicate](#dfn-predicate), and the [object](#dfn-object) `v` is a [well-formed](#dfn-well-formed) SHACL property path.

If `p` is a [zero-or-more path](#dfn-zero-or-more-path) in `G` then `path(p,G)` is a SPARQL `ZeroOrMorePath` with `path(v,G)` as its `elt`.

##### 2.3.1.6 One-Or-More Paths

A one-or-more path is a [blank node](#dfn-blank-node) that is the [subject](#dfn-subject) of exactly one [triple](#dfn-rdf-triple) in `G`. This triple has `sh:oneOrMorePath` as [predicate](#dfn-predicate), and the [object](#dfn-object) `v` is a [well-formed](#dfn-well-formed) SHACL property path.

If `p` is a [one-or-more path](#dfn-one-or-more-path) in `G` then `path(p,G)` is a SPARQL `OneOrMorePath` with `path(v,G)` as its `elt`.

##### 2.3.1.7 Zero-Or-One Paths

A zero-or-one path is a [blank node](#dfn-blank-node) that is the [subject](#dfn-subject) of exactly one [triple](#dfn-rdf-triple) in `G`. This triple has `sh:zeroOrOnePath` as [predicate](#dfn-predicate), and the [object](#dfn-object) `v` is a [well-formed](#dfn-well-formed) SHACL property path.

If `p` is a [zero-or-one path](#dfn-zero-or-one-path) in `G` then `path(p,G)` is a SPARQL `ZeroOrOnePath` with `path(v,G)` as its `elt`.

#### 2.3.2 Non-Validating Property Shape Characteristics

_This section is non-normative._

While the previous sections introduced properties that represent validation conditions, this section covers properties that are ignored by SHACL processors. The use of these so-called non-validating properties is entirely optional and not subject to formal interpretation contracts. They _MAY_ be used for purposes such as form building or predictable printing of RDF files.

##### 2.3.2.1 sh:name and sh:description

Property shapes may have one or more [values](#dfn-value) for `sh:name` to provide human-readable labels for the property in the target where it appears. If present, tools _SHOULD_ prefer those locally specified labels over globally specified labels at the `rdf:Property` itself. For example, if a form displays a node that is in the target of a given property shape with an `sh:name`, then the tool _SHOULD_ use the provided name. Similarly, property shape may have values for `sh:description` to provide descriptions of the property in the given context. Both `sh:name` and `sh:description` may have multiple [values](#dfn-value), but should only have one [value](#dfn-value) per language tag.

##### 2.3.2.2 sh:order

Property shapes may have one [value](#dfn-value) for the property `sh:order` to indicate the relative order of the property shape for purposes such as form building. The values of `sh:order` are decimals. `sh:order` is not used for validation purposes and may be used with any type of subjects. If present at property shapes, the recommended use of `sh:order` is to sort the property shapes in an ascending order, for example so that properties with smaller order are placed above (or to the left) of properties with larger order.

##### 2.3.2.3 sh:group

Property shapes may link to an [SHACL instance](#dfn-shacl-instance) of the class `sh:PropertyGroup` using the property `sh:group` to indicate that the shape belongs to a group of related property shapes. Each group may have additional triples that serve application purposes, such as an `rdfs:label` for form building. Groups may also have an `sh:order` property to indicate the relative ordering of groups within the same form.

##### 2.3.2.4 sh:defaultValue

Property shapes may have a single value for `sh:defaultValue`. The default value does not have fixed semantics in SHACL, but _MAY_ be used by user interface tools to pre-populate input widgets. The value type of the `sh:defaultValue` should align with the specified `sh:datatype` or `sh:class` of the same shape.

The following example illustrates the use of these various features together.

ex:PersonFormShape
	a sh:NodeShape ;
	sh:property \[
		sh:path ex:firstName ;
		sh:name "first name" ;
		sh:description "The person's given name(s)" ;
		sh:order 0 ;
		sh:group ex:NameGroup ;
	\] ;
	sh:property \[
		sh:path ex:lastName ;
		sh:name "last name" ;
		sh:description "The person's last name" ;
		sh:order 1 ;
		sh:group ex:NameGroup ;
	\] ;
	sh:property \[
		sh:path ex:streetAddress ;
		sh:name "street address" ;
		sh:description "The street address including number" ;
		sh:order 11 ;
		sh:group ex:AddressGroup ;
	\] ;
	sh:property \[
		sh:path ex:locality ;
		sh:name "locality" ;
		sh:description "The suburb, city or town of the address" ;
		sh:order 12 ;
		sh:group ex:AddressGroup ;
	\] ;
	sh:property \[
		sh:path ex:postalCode ;
		sh:name "postal code" ;
		sh:name "zip code"@en-US ;
		sh:description "The postal code of the locality" ;
		sh:order 13 ;
		sh:group ex:AddressGroup ;
	\] .

ex:NameGroup
	a sh:PropertyGroup ;
	sh:order 0 ;
	rdfs:label "Name" .

ex:AddressGroup
	a sh:PropertyGroup ;
	sh:order 1 ;
	rdfs:label "Address" .

A form building application _MAY_ use the information above to display information as follows:

**Name**

<table><tbody><tr><td style="text-align: right; width: 160px"><b>first name:</b></td><td>John</td></tr><tr><td style="text-align: right"><b>last name:</b></td><td>Doe</td></tr></tbody></table>

**Address**

<table><tbody><tr><td style="text-align: right; width: 160px"><b>street address:</b></td><td>123 Silverado Ave</td></tr><tr><td style="text-align: right"><b>locality:</b></td><td>Cupertino</td></tr><tr><td style="text-align: right"><b>zip code:</b></td><td>54321</td></tr></tbody></table>

## 3\. Validation and Graphs

[Validation](#dfn-validation) takes a [data graph](#dfn-data-graph) and a [shapes graph](#dfn-shapes-graph) as input and produces a [validation report](#dfn-validation-report) containing the results of the validation. [Conformance checking](#dfn-conformance-checking) is a simplified version of validation, producing a boolean result. A system that is capable of performing validation is called a processor, and the verb processing is sometimes used to refer to the validation process.

SHACL defines an RDF [Validation Report Vocabulary](#dfn-validation-report-vocabulary) that can be used by processors that produce validation reports as RDF results graphs. This specification uses the SHACL results vocabulary for the normative definitions of the [validators](#dfn-validators) associated with the [constraint components](#dfn-constraint-component). Only SHACL implementations that can produce all of the mandatory properties of the [Validation Report Vocabulary](#dfn-validation-report-vocabulary) are standards-compliant.

### 3.1 Shapes Graph

A shapes graph is an RDF graph containing zero or more shapes that is passed into a SHACL [validation](#dfn-validation) process so that a [data graph](#dfn-data-graph) can be validated against the shapes.

_The remainder of this section is informative._

Shapes graphs can be reusable validation modules that can be cross-referenced with the predicate [`owl:imports`](https://www.w3.org/TR/owl2-syntax/#Imports). As a pre-validation step, SHACL processors _SHOULD_ extend the originally provided [shapes graph](#dfn-shapes-graph) by transitively following and importing all referenced [shapes graphs](#dfn-shapes-graph) through the [`owl:imports`](https://www.w3.org/TR/owl2-syntax/#Imports) predicate. The resulting graph forms the input [shapes graph](#dfn-shapes-graph) for validation and _MUST NOT_ be further modified during the validation process.

In addition to shape declarations, the shapes graph may contain additional information for the SHACL processor such as `sh:entailment` statements.

### 3.2 Data Graph

Any RDF graph can be a data graph.

_The remainder of this section is informative._

A data graph is one of the inputs to the SHACL processor for [validation](#dfn-validation). SHACL processors treat it as a general RDF graph and makes no assumption about its nature. For example, it can be an in-memory graph or a named graph from an RDF dataset or a SPARQL endpoint.

SHACL can be used with RDF graphs that are obtained by any means, e.g. from the file system, HTTP requests, or [RDF datasets](https://www.w3.org/TR/rdf11-concepts/#section-dataset). SHACL makes no assumptions about whether a graph contains triples that are entailed from the graph under any RDF entailment regime.

The data graph is expected to include all the ontology axioms related to the data and especially all the `rdfs:subClassOf` triples in order for SHACL to correctly identify class targets and validate Core SHACL constraints.

### 3.3 Linking to shapes graphs (sh:shapesGraph)

A [data graph](#dfn-data-graph) can include triples used to suggest one or more graphs to a SHACL processor with the predicate `sh:shapesGraph`. Every [value](#dfn-value) of `sh:shapesGraph` is an [IRI](#dfn-iri) representing a graph that _SHOULD_ be included into the [shapes graph](#dfn-shapes-graph) used to validate the [data graph](#dfn-data-graph).

In the following example, a SHACL processor _SHOULD_ use the union of `ex:graph-shapes1` and `ex:graph-shapes2` graphs (and their `owl:imports`) as the [shapes graph](#dfn-shapes-graph) when validating the given graph.

<http://example.com/myDataGraph>
	sh:shapesGraph ex:graph-shapes1 ;
	sh:shapesGraph ex:graph-shapes2 .

### 3.4 Validation

Validation is a mapping from some input to [validation results](#dfn-validation-results), as defined in the following paragraphs.

Validation of a data graph against a shapes graph: Given a [data graph](#dfn-data-graph) and a [shapes graph](#dfn-shapes-graph), the [validation results](#dfn-validation-results) are the union of results of the [validation](#dfn-validation) of the [data graph](#dfn-data-graph) against all [shapes](#dfn-shape) in the [shapes graph](#dfn-shapes-graph).

Validation of a data graph against a shape: Given a [data graph](#dfn-data-graph) and a [shape](#dfn-shape) in the [shapes graph](#dfn-shapes-graph), the [validation results](#dfn-validation-results) are the union of the results of the [validation](#dfn-validation) of all [focus nodes](#dfn-focus-node) that are in the [target](#dfn-target) of the [shape](#dfn-shape) in the [data graph](#dfn-data-graph).

Validation of a focus node against a shape: Given a [focus node](#dfn-focus-node) in the [data graph](#dfn-data-graph) and a [shape](#dfn-shape) in the [shapes graph](#dfn-shapes-graph), the [validation results](#dfn-validation-results) are the union of the results of the [validation](#dfn-validation) of the [focus node](#dfn-focus-node) against all [constraints](#dfn-constraint) declared by the [shape](#dfn-shape), unless the [shape](#dfn-shape) has been [deactivated](#dfn-deactivated), in which case the [validation results](#dfn-validation-results) are empty.

Validation of a focus node against a constraint: Given a [focus node](#dfn-focus-node) in the [data graph](#dfn-data-graph) and a [constraint](#dfn-constraint) of [kind](#dfn-kind) `C` in the [shapes graph](#dfn-shapes-graph), the [validation results](#dfn-validation-results) are defined by the [validators](#dfn-validators) of the [constraint component](#dfn-constraint-component) `C`. These [validators](#dfn-validators) typically take as input the [focus node](#dfn-focus-node), the specific [values](#dfn-value) of the [parameters](#dfn-parameters) of `C` of the [constraint](#dfn-constraint) in the [shapes graph](#dfn-shapes-graph), and the [value nodes](#dfn-value-nodes) of the [shape](#dfn-shape) that declares the constraint.

During validation, the [data graph](#dfn-data-graph) and the [shapes graph](#dfn-shapes-graph) _MUST_ remain immutable, i.e. both graphs at the end of the validation _MUST_ be identical to the graph at the beginning of validation. SHACL processors _MUST NOT_ change the graphs that they use to construct the shapes graph or the data graph, even if these graphs are part of an RDF store that allows changes to its stored graphs. SHACL processors _MAY_ store the graphs that they create, such as a graph containing validation results, and this operation _MAY_ change existing graphs in an RDF store, but not any of the graphs that were used to construct the shapes graph or the data graph. SHACL processing is thus idempotent.

#### 3.4.1 Failures

[Validation](#dfn-validation) and [conformance checking](#dfn-conformance-checking) can result in a failure. For example, a particular SHACL processor might allow recursive shapes but report a failure if it detects a loop within the data. Failures can also be reported due to resource exhaustion. Failures are signalled through implementation-specific channels.

#### 3.4.2 Handling of Ill-formed Shapes Graphs

If the [shapes graph](#dfn-shapes-graph) contains [ill-formed](#dfn-ill-formed) nodes, then the result of the validation process is _undefined_. A SHACL processor _SHOULD_ produce a [failure](#dfn-failure) in this case. See also [3.6.1.3 Syntax Checking of Shapes Graph (sh:shapesGraphWellFormed)](#shapesGraphWellFormed).

#### 3.4.3 Handling of Recursive Shapes

The following properties are the so-called shape-expecting constraint parameters in SHACL Core:

-   [sh:and](#AndConstraintComponent)
-   [sh:not](#NotConstraintComponent)
-   [sh:or](#OrConstraintComponent)
-   [sh:property](#PropertyConstraintComponent)
-   [sh:qualifiedValueShape](#QualifiedValueShapeConstraintComponent)
-   [sh:node](#NodeConstraintComponent)
-   [sh:xone](#XoneConstraintComponent)

The following properties are the so-called list-taking constraint parameters in SHACL Core:

-   [sh:and](#AndConstraintComponent)
-   [sh:in](#InConstraintComponent)
-   [sh:languageIn](#LanguageInConstraintComponent)
-   [sh:or](#OrConstraintComponent)
-   [sh:xone](#XoneConstraintComponent)

A shape `s1` in an RDF graph `G` refers to shape `s2` in `G` if it has `s2` as [value](#dfn-value) for some non-list-taking, shape-expecting parameter of some constraint component or `s2` as a [member](#dfn-members) of the [value](#dfn-value) for some list-taking, shape-expecting parameter of some constraint component. A shape in an RDF graph `G` is a recursive shape in `G` if it is related to itself by the transitive closure of the [refers](#dfn-refers) relationship in `G`.

The [validation](#dfn-validation) with [recursive](#dfn-recursive-shape) shapes is not defined in SHACL and is left to SHACL processor implementations. For example, SHACL processors may support recursion scenarios or produce a failure when they detect recursion.

_The remainder of this section is informative._

The recursion policy above has been selected to support a large variety of implementation strategies. By leaving recursion undefined, implementations may chose to not support recursion so that they can issue a static set of SPARQL queries (against SPARQL end points) without having to support cycles. The Working Group is aware that other implementations may support recursion and that some shapes graphs may rely on these specific characteristics. The expectation is that future work, for example in W3C Community Groups, will lead to the definition of specific dialects of SHACL where recursion is well-defined.

### 3.5 Conformance Checking

A [focus node](#dfn-focus-node) conforms to a [shape](#dfn-shape) if and only if the set of result of the [validation](#dfn-validation) of the [focus node](#dfn-focus-node) against the [shape](#dfn-shape) is empty and no [failure](#dfn-failure) has been reported by it.

Conformance checking produces `true` if and only if a given [focus node](#dfn-focus-node) [conforms](#dfn-conforms) to a given [shape](#dfn-shape), and `false` otherwise.

Note that some [constraint components](#dfn-constraint-component) of SHACL Core (e.g., those of `sh:not`, `sh:or` and `sh:node`) rely on conformance checking. In these cases, the [validation results](#dfn-validation-results) used to determine the outcome of conformance checking are separated from those of the surrounding validation process and typically do not end up in the same validation report (except perhaps as values of [`sh:detail`](#results-detail)).

### 3.6 Validation Report

The validation report is the result of the [validation](#dfn-validation) process that reports the [conformance](#dfn-conforms) and the set of all validation results. The validation report is described with the SHACL Validation Report Vocabulary as defined in this section. This vocabulary defines the RDF properties to represent structural information that may provide guidance on how to identify or fix violations in the data graph.

SHACL-compliant processors _MUST_ be capable of returning a validation report with all required [validation results](#dfn-validation-results) described in this specification. SHACL-compliant processors _MAY_ support optional arguments that make it possible to limit the number of returned results. This flexibility is for example needed in some large-scale dataset validation use cases.

The following graph represents an example of a validation report for the validation of a data graph that conforms to a shapes graph.

\[ 	a sh:ValidationReport ;
	sh:conforms true ;
\] .

The following graph represents an example of a validation report for the validation of a data graph that does not conform to a shapes graph. Note that the specific value of `sh:resultMessage` is not mandated by SHACL and considered implementation-specific.

\[	a sh:ValidationReport ;
	sh:conforms false ;
	sh:result \[
		a sh:ValidationResult ;
		sh:resultSeverity sh:Violation ;
		sh:focusNode ex:Bob ;
		sh:resultPath ex:age ;
		sh:value "twenty two" ;
		sh:resultMessage "ex:age expects a literal of datatype xsd:integer." ;
		sh:sourceConstraintComponent sh:DatatypeConstraintComponent ;
		sh:sourceShape ex:PersonShape-age ;
	\]
\] .

#### 3.6.1 Validation Report (sh:ValidationReport)

The result of a [validation](#dfn-validation) process is an RDF graph with exactly one [SHACL instance](#dfn-shacl-instance) of `sh:ValidationReport`. The RDF graph _MAY_ contain additional information such as provenance metadata.

##### 3.6.1.1 Conforms (sh:conforms)

Each SHACL instance of `sh:ValidationReport` in the results graph has exactly one value for the property `sh:conforms` and the value is of datatype `xsd:boolean`. It represents the outcome of the [conformance checking](#dfn-conformance-checking). The value of `sh:conforms` is `true` if and only if the [validation](#dfn-validation) did not produce any [validation results](#dfn-validation-results), and `false` otherwise.

##### 3.6.1.2 Result (sh:result)

For every validation result that is produced by a [validation](#dfn-validation) process (except those mentioned in the context of [conformance checking](#conformance-nested)), the SHACL instance of `sh:ValidationReport` in the results graph has a value for the property `sh:result`. Each value of `sh:result` is a [SHACL instance](#dfn-shacl-instance) of the class `sh:ValidationResult`.

##### 3.6.1.3 Syntax Checking of Shapes Graph (sh:shapesGraphWellFormed)

SHACL validation engines are not strictly required to check whether the [shapes graph](#dfn-shapes-graph) is [well-formed](#dfn-well-formed). Implementations that do perform such checks (e.g., when the shapes graph is installed in the system, or before or during the validation) _SHOULD_ use the property `sh:shapesGraphWellFormed` to inform the consumer of the validation report about this fact. If a SHACL instance of `sh:ValidationReport` in the results graph has `true` as the [value](#dfn-value) for `sh:shapesGraphWellFormed` then the [processor](#dfn-processor) was certain that the [shapes graph](#dfn-shapes-graph) that was used for the [validation](#dfn-validation) process has passed all SHACL syntax rules (as summarized in [B. Summary of SHACL Syntax Rules](#syntax-rules)) during the validation process.

#### 3.6.2 Validation Result (sh:ValidationResult)

SHACL defines `sh:ValidationResult` as a subclass of `sh:AbstractResult` to report individual SHACL [validation results](#dfn-validation-results). SHACL implementations may use other [SHACL subclasses](#dfn-shacl-subclass) of `sh:AbstractResult`, for example, to report successfully completed constraint checks or accumulated results.

All the properties described in the remaining sub-sections of this section can be specified in a `sh:ValidationResult`. The properties `sh:focusNode`, `sh:resultSeverity` and `sh:sourceConstraintComponent` are the only properties that are mandatory for all validation results.

##### 3.6.2.1 Focus node (sh:focusNode)

Each validation result has exactly one value for the property `sh:focusNode` that is equal to the [focus node](#dfn-focus-node) that has caused the result. This is the [focus node](#dfn-focus-node) that was validated when the validation result was produced.

##### 3.6.2.2 Path (sh:resultPath)

Validation results may have a value for the property `sh:resultPath` pointing at a [well-formed](#dfn-well-formed) [SHACL property path](#dfn-shacl-property-path). For results produced by a [property shape](#dfn-property-shape), this [SHACL property path](#dfn-shacl-property-path) is equivalent to the [value](#dfn-value) of `sh:path` of the shape, unless stated otherwise.

##### 3.6.2.3 Value (sh:value)

Validation results may include, as a [value](#dfn-value) of the property `sh:value`, at most one RDF term that has caused the result. The textual definitions of the validators of the SHACL Core components specify how this value is constructed - often they are the [value nodes](#dfn-value-nodes) that have violated a constraint.

##### 3.6.2.4 Source (sh:sourceShape)

Validation results may include, as the only [value](#dfn-value) of the property `sh:sourceShape`, the [shape](#dfn-shape) that the given `sh:focusNode` was validated against.

##### 3.6.2.5 Constraint Component (sh:sourceConstraintComponent)

Validation results have exactly one value for the property `sh:sourceConstraintComponent` and this value is the [IRI](#dfn-iri) of the [constraint component](#dfn-constraint-component) that caused the result. For example, results produced due to a violation of a constraint based on a value of `sh:minCount` would have the source constraint component `sh:MinCountConstraintComponent`.

##### 3.6.2.6 Details (sh:detail)

The property `sh:detail` may link a (parent) result with one or more SHACL instances of `sh:AbstractResult` that can provide further details about the cause of the (parent) result. Depending on the capabilities of the SHACL processor, this may for example include violations of constraints that have been evaluated as part of conformance checking via `sh:node`.

##### 3.6.2.7 Message (sh:resultMessage)

Validation results may have values for the property `sh:resultMessage`, for example to communicate additional textual details to humans. While `sh:resultMessage` may have multiple values, there should not be two values with the same language tag. These values are produced by a validation engine based on the values of `sh:message` of the constraints in the shapes graph, see [Declaring Messages for a Shape](#message). In cases where a constraint does not have any values for `sh:message` in the shapes graph the SHACL processor _MAY_ automatically generate other values for `sh:resultMessage`.

##### 3.6.2.8 Severity (sh:resultSeverity)

Each validation result has exactly one [value](#dfn-value) for the property `sh:resultSeverity`, and this value is an [IRI](#dfn-iri). The value is equal to the [value](#dfn-value) of [`sh:severity`](#severity) of the [shape](#dfn-shape) in the [shapes graph](#dfn-shapes-graph) that caused the result, defaulting to `sh:Violation` if no `sh:severity` has been specified for the shape.

### 3.7 Value Nodes

The [validators](#dfn-validators) of most constraint components use the concept of value nodes, which is defined as follows:

-   For [node shapes](#dfn-node-shape) the [value nodes](#dfn-value-nodes) are the individual [focus nodes](#dfn-focus-node), forming a set with exactly one member.
-   For [property shapes](#dfn-property-shape) with a [value](#dfn-value) for `sh:path` `p` the [value nodes](#dfn-value-nodes) are the set of [nodes](#dfn-node) in the [data graph](#dfn-data-graph) that can be reached from the [focus node](#dfn-focus-node) with the [path mapping](#dfn-path-mapping) of `p`. Unless stated otherwise, the value of `sh:resultPath` of each validation result is a [SHACL property path](#dfn-shacl-property-path) that [represents](#property-paths) an [equivalent path](#dfn-equivalent-paths) to the one provided in the shape.

## 4\. Core Constraint Components

This section defines the built-in SHACL Core [constraint components](#dfn-constraint-component) that _MUST_ be supported by all SHACL Core processors. The definition of each constraint component contains its IRI as well as a table of its [parameters](#dfn-parameters). Unless stated otherwise, all these parameters are [mandatory parameters](#dfn-mandatory-parameters). Shapes that violate any of the syntax rules enumerated in those parameter tables are [ill-formed](#dfn-ill-formed).

Each constraint component also includes a textual definition, which describes the [validator](#dfn-validators) associated with the component. These textual definitions refer to the values of the parameters in the constraint by variables of the form `$paramName` where `paramName` is the part of the parameter's [IRI](#dfn-iri) after the `sh:` namespace. For example, the textual definition of `sh:ClassConstraintComponent` refers to the value of `sh:class` using the variable `$class`. Note that these validators define the _only_ validation results that are being produced by the component. Furthermore, the validators always produce _new_ result nodes, i.e. when the textual definition states that "...there is a validation result..." then this refers to a distinct new node in a results graph.

_The remainder of this section is informative._

The choice of constraint components that were included into the SHACL Core was made based on the requirements collected by the \[[shacl-ucr](#bib-shacl-ucr)\] document. Special attention was paid to the balance between trying to cover as many common use cases as possible and keeping the size of the Core language manageable. Not all use cases can be expressed by the Core language alone. Instead, SHACL-SPARQL provides an extension mechanism, described in the second part of this specification. It is expected that additional reusable libraries of [constraint components](#dfn-constraint-component) will be maintained by third parties.

Unless stated otherwise, the Core constraint components can be used both in [property shapes](#dfn-property-shape) and [node shapes](#dfn-node-shape). Some constraint parameters have syntax rules attached to them that would make [node shapes](#dfn-node-shape) that use these parameters [ill-formed](#dfn-ill-formed). Examples of this include `sh:minCount` which is only supported for [property shapes](#dfn-property-shape).

The SPARQL definitions in this section represent potential [validators](#constraint-components-validators). They are included for illustration purposes only and have no formal status otherwise. Many constraint components are written as SPARQL ASK queries. These queries are interpreted against each [value node](#dfn-value-nodes), bound to the variable `value`. If an ASK query does not evaluate to `true` for a [value node](#dfn-value-nodes), then there is a [validation result](#dfn-validation-results) based on the rules outlined in the [section on ASK-based validators](#SPARQLAskValidator). Constraint components that are described using a SELECT query are interpreted based on the rules outlined in the [section on SELECT-based validators](#SPARQLSelectValidator). In particular, for [property shapes](#dfn-property-shape), the variable `PATH` is [substituted](#dfn-substitute) with a path expression based on the value of `sh:path` in the shape. All SPARQL queries also require the variable bindings and result variable mapping rules detailed in the [section on SPARQL-based Constraints](#sparql-constraints). The variable `this` represents the currently validated [focus node](#dfn-focus-node). Based on the parameter IRIs on the tables, [pre-bound](#dfn-pre-binding-of-variables) variables are derived using the syntax rules for [parameter names](#dfn-parameter-name).

### 4.1 Value Type Constraint Components

The constraint components in this section have in common that they can be used to restrict the type of value nodes. Note that it is possible to represent multiple value type alternatives using [sh:or](#OrConstraintComponent).

#### 4.1.1 sh:class

The condition specified by `sh:class` is that each [value node](#dfn-value-nodes) is a [SHACL instance](#dfn-shacl-instance) of a given type.

Constraint Component IRI: `sh:ClassConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:class` | The type of all value nodes. The values of `sh:class` in a shape are IRIs. |

TEXTUAL DEFINITION

For each [value node](#dfn-value-nodes) that is either a [literal](#dfn-literal), or a non-literal that is not a [SHACL instance](#dfn-shacl-instance) of `$class` in the [data graph](#dfn-data-graph), there is a [validation result](#dfn-validation-results) with the [value node](#dfn-value-nodes) as `sh:value`.

_The remainder of this section is informative._

Note that multiple values for `sh:class` are interpreted as a conjunction, i.e. the values need to be SHACL instances of all of them.

POTENTIAL DEFINITION IN SPARQL (Must evaluate to true for each value node $value)

ASK {
	$value rdf:type/rdfs:subClassOf\* $class .
}

ex:ClassExampleShape
	a sh:NodeShape ;
	sh:targetNode ex:Bob, ex:Alice, ex:Carol ;
	sh:property \[
		sh:path ex:address ;
		sh:class ex:PostalAddress ;
	\] .

ex:Alice a ex:Person .
ex:Bob ex:address \[ a ex:PostalAddress ; ex:city ex:Berlin \] .
ex:Carol ex:address \[ ex:city ex:Cairo \] .

#### 4.1.2 sh:datatype

`sh:datatype` specifies a condition to be satisfied with regards to the datatype of each [value node](#dfn-value-nodes).

Constraint Component IRI: `sh:DatatypeConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:datatype` | The datatype of all value nodes (e.g., `xsd:integer`). The values of `sh:datatype` in a shape are [IRIs](#dfn-iri). A shape has at most one value for `sh:datatype`. |

TEXTUAL DEFINITION

For each [value node](#dfn-value-nodes) that is not a [literal](#dfn-literal), or is a [literal](#dfn-literal) with a datatype that does not match `$datatype`, there is a [validation result](#dfn-validation-results) with the [value node](#dfn-value-nodes) as `sh:value`. The datatype of a literal is determined following the [datatype](https://www.w3.org/TR/sparql11-query/#func-datatype) function of SPARQL 1.1. A [literal](#dfn-literal) matches a datatype if the [literal](#dfn-literal)'s datatype has the same [IRI](#dfn-iri) and, for the datatypes supported by SPARQL 1.1, is not an [ill-typed](https://www.w3.org/TR/rdf11-concepts#section-Graph-Literal) literal.

_The remainder of this section is informative._

The values of `sh:datatype` are typically [datatypes](#dfn-datatype), such as `xsd:string`. Note that using `rdf:langString` as value of `sh:datatype` can be used to test if value nodes have a language tag.

ex:DatatypeExampleShape
	a sh:NodeShape ;
	sh:targetNode ex:Alice, ex:Bob, ex:Carol ;
	sh:property \[
		sh:path ex:age ;
		sh:datatype xsd:integer ;
	\] .

ex:Alice ex:age "23"^^xsd:integer .
ex:Bob ex:age "twenty two" .
ex:Carol ex:age "23"^^xsd:int .

#### 4.1.3 sh:nodeKind

`sh:nodeKind` specifies a condition to be satisfied by the RDF node kind of each [value node](#dfn-value-nodes).

Constraint Component IRI: `sh:NodeKindConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:nodeKind` | The node kind (IRI, blank node, literal or combinations of these) of all value nodes. The values of `sh:nodeKind` in a shape are one of the following six instances of the class `sh:NodeKind`: `sh:BlankNode`, `sh:IRI`, `sh:Literal` `sh:BlankNodeOrIRI`, `sh:BlankNodeOrLiteral` and `sh:IRIOrLiteral`. A shape has at most one value for `sh:nodeKind`. |

TEXTUAL DEFINITION

For each [value node](#dfn-value-nodes) that does not match `$nodeKind`, there is a [validation result](#dfn-validation-results) with the [value node](#dfn-value-nodes) as `sh:value`. Any [IRI](#dfn-iri) matches only `sh:IRI`, `sh:BlankNodeOrIRI` and `sh:IRIOrLiteral`. Any [blank node](#dfn-blank-node) matches only `sh:BlankNode`, `sh:BlankNodeOrIRI` and `sh:BlankNodeOrLiteral`. Any [literal](#dfn-literal) matches only `sh:Literal`, `sh:BlankNodeOrLiteral` and `sh:IRIOrLiteral`.

_The remainder of this section is informative._

POTENTIAL DEFINITION IN SPARQL (Must evaluate to true for each value node $value)

ASK {
	FILTER ((isIRI($value) && $nodeKind IN ( sh:IRI, sh:BlankNodeOrIRI, sh:IRIOrLiteral ) ) ||
		(isLiteral($value) && $nodeKind IN ( sh:Literal, sh:BlankNodeOrLiteral, sh:IRIOrLiteral ) ) ||
		(isBlank($value)   && $nodeKind IN ( sh:BlankNode, sh:BlankNodeOrIRI, sh:BlankNodeOrLiteral ) )) .
}

The following example states that all values of `ex:knows` need to be IRIs, at any subject.

ex:NodeKindExampleShape
	a sh:NodeShape ;
	sh:targetObjectsOf ex:knows ;
	sh:nodeKind sh:IRI .

ex:Bob ex:knows ex:Alice .
	ex:Alice ex:knows "Bob" .

### 4.2 Cardinality Constraint Components

The following [constraint components](#dfn-constraint-component) represent restrictions on the number of [value nodes](#dfn-value-nodes) for the given [focus node](#dfn-focus-node).

#### 4.2.1 sh:minCount

`sh:minCount` specifies the minimum number of [value nodes](#dfn-value-nodes) that satisfy the condition. If the minimum cardinality value is 0 then this constraint is always satisfied and so may be omitted.

Constraint Component IRI: `sh:MinCountConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:minCount` | The minimum cardinality. [Node shapes](#dfn-node-shape) cannot have any value for `sh:minCount`. A [property shape](#dfn-property-shape) has at most one value for `sh:minCount`. The values of `sh:minCount` in a property shape are literals with datatype `xsd:integer`. |

TEXTUAL DEFINITION

If the number of [value nodes](#dfn-value-nodes) is less than `$minCount`, there is a [validation result](#dfn-validation-results).

_The remainder of this section is informative._

ex:MinCountExampleShape
	a sh:PropertyShape ;
	sh:targetNode ex:Alice, ex:Bob ;
	sh:path ex:name ;
	sh:minCount 1 .

ex:Alice ex:name "Alice" .
ex:Bob ex:givenName "Bob"@en .

#### 4.2.2 sh:maxCount

`sh:maxCount` specifies the maximum number of [value nodes](#dfn-value-nodes) that satisfy the condition.

Constraint Component IRI: `sh:MaxCountConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:maxCount` | The maximum cardinality. [Node shapes](#dfn-node-shape) cannot have any value for `sh:maxCount`. A [property shape](#dfn-property-shape) has at most one value for `sh:maxCount`. The values of `sh:maxCount` in a property shape are literals with datatype `xsd:integer`. |

TEXTUAL DEFINITION

If the number of [value nodes](#dfn-value-nodes) is greater than `$maxCount`, there is a [validation result](#dfn-validation-results).

_The remainder of this section is informative._

ex:MaxCountExampleShape
	a sh:NodeShape ;
	sh:targetNode ex:Bob ;
	sh:property \[
		sh:path ex:birthDate ;
		sh:maxCount 1 ;
	\] .

ex:Bob ex:birthDate "May 5th 1990" .

### 4.3 Value Range Constraint Components

The following constraint components specify value range conditions to be satisfied by value nodes that are comparable via operators such as `<`, `<=`, `>` and `>=`. The following example illustrates a typical use case of these constraint components.

ex:NumericRangeExampleShape
	a sh:NodeShape ;
	sh:targetNode ex:Bob, ex:Alice, ex:Ted ;
	sh:property \[
		sh:path ex:age ;
		sh:minInclusive 0 ;
		sh:maxInclusive 150 ;
	\] .

ex:Bob ex:age 23 .
ex:Alice ex:age 220 .
ex:Ted ex:age "twenty one" .

#### 4.3.1 sh:minExclusive

Constraint Component IRI: `sh:MinExclusiveConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:minExclusive` | The minimum exclusive value. The values of `sh:minExclusive` in a shape are [literals](#dfn-literal). A shape has at most one value for `sh:minExclusive`. |

TEXTUAL DEFINITION

For each [value node](#dfn-value-nodes) `v` where the SPARQL expression `$minExclusive < v` does not return `true`, there is a [validation result](#dfn-validation-results) with `v` as `sh:value`.

_The remainder of this section is informative._

The SPARQL expression produces an error if the value node cannot be compared to the specified range, for example when someone compares a string with an integer. If the comparison cannot be performed, then there is a validation result. This is different from, say, a plain SPARQL query, in which such errors would silently not lead to any results.

POTENTIAL DEFINITION IN SPARQL (Must evaluate to true for each value node $value)

ASK {
	FILTER ($minExclusive < $value)
}

#### 4.3.2 sh:minInclusive

Constraint Component IRI: `sh:MinInclusiveConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:minInclusive` | The minimum inclusive value. The values of `sh:minInclusive` in a shape are [literals](#dfn-literal). A shape has at most one value for `sh:minInclusive`. |

TEXTUAL DEFINITION

For each [value node](#dfn-value-nodes) `v` where the SPARQL expression `$minInclusive <= v` does not return `true`, there is a [validation result](#dfn-validation-results) with `v` as `sh:value`.

_The remainder of this section is informative._

POTENTIAL DEFINITION IN SPARQL (Must evaluate to true for each value node $value)

ASK {
	FILTER ($minInclusive <= $value)
}

#### 4.3.3 sh:maxExclusive

Constraint Component IRI: `sh:MaxExclusiveConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:maxExclusive` | The maximum exclusive value. The values of `sh:maxExclusive` in a shape are [literals](#dfn-literal). A shape has at most one value for `sh:maxExclusive`. |

TEXTUAL DEFINITION

For each [value node](#dfn-value-nodes) `v` where the SPARQL expression `$maxExclusive > v` does not return `true`, there is a [validation result](#dfn-validation-results) with `v` as `sh:value`.

_The remainder of this section is informative._

POTENTIAL DEFINITION IN SPARQL (Must evaluate to true for each value node $value)

ASK {
	FILTER ($maxExclusive > $value)
}

#### 4.3.4 sh:maxInclusive

Constraint Component IRI: `sh:MaxInclusiveConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:maxInclusive` | The maximum inclusive value. The values of `sh:maxInclusive` in a shape are [literals](#dfn-literal). A shape has at most one value for `sh:maxInclusive`. |

TEXTUAL DEFINITION

For each [value node](#dfn-value-nodes) `v` where the SPARQL expression `$maxInclusive >= v` does not return `true`, there is a [validation result](#dfn-validation-results) with `v` as `sh:value`.

_The remainder of this section is informative._

POTENTIAL DEFINITION IN SPARQL (Must evaluate to true for each value node $value)

ASK {
	FILTER ($maxInclusive >= $value)
}

### 4.4 String-based Constraint Components

The constraint components in this section have in common that they specify conditions on the string representation of [value nodes](#dfn-value-nodes).

#### 4.4.1 sh:minLength

`sh:minLength` specifies the minimum string length of each [value node](#dfn-value-nodes) that satisfies the condition. This can be applied to any [literals](#dfn-literal) and [IRIs](#dfn-iri), but not to [blank nodes](#dfn-blank-node).

Constraint Component IRI: `sh:MinLengthConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:minLength` | The minimum length. The values of `sh:minLength` in a shape are literals with datatype `xsd:integer`. A shape has at most one value for `sh:minLength`. |

TEXTUAL DEFINITION

For each [value node](#dfn-value-nodes) `v` where the length (as defined by the [SPARQL STRLEN function](https://www.w3.org/TR/sparql11-query/#func-strlen)) of the string representation of `v` (as defined by the [SPARQL str function](https://www.w3.org/TR/sparql11-query/#func-str)) is less than `$minLength`, or where `v` is a [blank node](#dfn-blank-node), there is a [validation result](#dfn-validation-results) with `v` as `sh:value`.

_The remainder of this section is informative._

Note that if the value of `sh:minLength` is 0 then there is no restriction on the string length but the constraint is still violated if the value node is a blank node.

POTENTIAL DEFINITION IN SPARQL (Must evaluate to true for each value node $value)

ASK {
	FILTER (STRLEN(str($value)) >= $minLength) .
}

#### 4.4.2 sh:maxLength

`sh:maxLength` specifies the maximum string length of each [value node](#dfn-value-nodes) that satisfies the condition. This can be applied to any [literals](#dfn-literal) and [IRIs](#dfn-iri), but not to [blank nodes](#dfn-blank-node).

Constraint Component IRI: `sh:MaxLengthConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:maxLength` | The maximum length. The values of `sh:maxLength` in a shape are literals with datatype `xsd:integer`. A shape has at most one value for `sh:maxLength`. |

TEXTUAL DEFINITION

For each [value node](#dfn-value-nodes) `v` where the length (as defined by the [SPARQL STRLEN function](https://www.w3.org/TR/sparql11-query/#func-strlen)) of the string representation of `v` (as defined by the [SPARQL str function](https://www.w3.org/TR/sparql11-query/#func-str)) is greater than `$maxLength`, or where `v` is a [blank node](#dfn-blank-node), there is a [validation result](#dfn-validation-results) with `v` as `sh:value`.

_The remainder of this section is informative._

POTENTIAL DEFINITION IN SPARQL (Must evaluate to true for each value node $value)

ASK {
	FILTER (STRLEN(str($value)) <= $maxLength) .
}

ex:PasswordExampleShape
	a sh:NodeShape ;
	sh:targetNode ex:Bob, ex:Alice ;
	sh:property \[
		sh:path ex:password ;
		sh:minLength 8 ;
		sh:maxLength 10 ;
	\] .

ex:Bob ex:password "123456789" .
ex:Alice ex:password "1234567890ABC" .

#### 4.4.3 sh:pattern

`sh:pattern` specifies a regular expression that each [value node](#dfn-value-nodes) matches to satisfy the condition.

Constraint Component IRI: `sh:PatternConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:pattern` | A regular expression that all value nodes need to match. The values of `sh:pattern` in a shape are literals with datatype `xsd:string`. The values of `sh:pattern` in a shape are valid pattern arguments for the [SPARQL REGEX function](https://www.w3.org/TR/sparql11-query/#func-regex). |
| `sh:flags` | An optional string of flags, interpreted as in [SPARQL 1.1 REGEX](https://www.w3.org/TR/sparql11-query/#func-regex). The values of `sh:flags` in a shape are literals with datatype `xsd:string`. |

TEXTUAL DEFINITION

For each [value node](#dfn-value-nodes) that is a blank node or where the string representation (as defined by the [SPARQL str function](https://www.w3.org/TR/sparql11-query/#func-str)) does not match the regular expression `$pattern` (as defined by the [SPARQL REGEX function](https://www.w3.org/TR/sparql11-query/#func-regex)), there is a [validation result](#dfn-validation-results) with the [value node](#dfn-value-nodes) as `sh:value`. If `$flags` has a value then the matching _MUST_ follow the definition of the 3-argument variant of the SPARQL REGEX function, using `$flags` as third argument.

_The remainder of this section is informative._

POTENTIAL DEFINITION IN SPARQL (Must evaluate to true for each value node $value)

ASK {
	FILTER (!isBlank($value) && IF(bound($flags), regex(str($value), $pattern, $flags), regex(str($value), $pattern)))
}

ex:PatternExampleShape
	a sh:NodeShape ;
	sh:targetNode ex:Bob, ex:Alice, ex:Carol ;
	sh:property \[
		sh:path ex:bCode ;
		sh:pattern "^B" ;    # starts with 'B'
		sh:flags "i" ;       # Ignore case
	\] .

ex:Bob ex:bCode "b101" .
ex:Alice ex:bCode "B102" .
ex:Carol ex:bCode "C103" .

#### 4.4.4 sh:languageIn

The condition specified by `sh:languageIn` is that the allowed language tags for each [value node](#dfn-value-nodes) are limited by a given list of language tags.

Constraint Component IRI: `sh:LanguageInConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:languageIn` | A list of basic language ranges as per \[[BCP47](#bib-BCP47)\]. Each value of `sh:languageIn` in a shape is a [SHACL list](#dfn-shacl-list). Each [member](#dfn-members) of such a list is a literal with datatype `xsd:string`. A shape has at most one value for `sh:languageIn`. |

TEXTUAL DEFINITION

For each [value node](#dfn-value-nodes) that is either not a [literal](#dfn-literal) or that does not have a language tag matching any of the basic language ranges that are the [members](#dfn-members) of `$languageIn` following the filtering schema defined by the [SPARQL langMatches](https://www.w3.org/TR/sparql11-query/#func-langMatches) function, there is a [validation result](#dfn-validation-results) with the [value node](#dfn-value-nodes) as `sh:value`.

_The remainder of this section is informative._

The following example shape states that all values of `ex:prefLabel` can be either in English or Māori.

ex:NewZealandLanguagesShape
	a sh:NodeShape ;
	sh:targetNode ex:Mountain, ex:Berg ;
	sh:property \[
		sh:path ex:prefLabel ;
		sh:languageIn ( "en" "mi" ) ;
	\] .

From the example instances, `ex:Berg` will lead to constraint violations for all of its labels.

ex:Mountain
	ex:prefLabel "Mountain"@en ;
	ex:prefLabel "Hill"@en-NZ ;
	ex:prefLabel "Maunga"@mi .

ex:Berg
	ex:prefLabel "Berg" ;
	ex:prefLabel "Berg"@de ;
	ex:prefLabel ex:BergLabel .

#### 4.4.5 sh:uniqueLang

The property `sh:uniqueLang` can be set to `true` to specify that no pair of [value nodes](#dfn-value-nodes) may use the same language tag.

Constraint Component IRI: `sh:UniqueLangConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:uniqueLang` | `true` to activate this constraint. The values of `sh:uniqueLang` in a shape are literals with datatype `xsd:boolean`. A property shape has at most one value for `sh:uniqueLang`. [Node shapes](#dfn-node-shape) cannot have any value for `sh:uniqueLang`. |

TEXTUAL DEFINITION

If `$uniqueLang` is `true` then for each non-empty language tag that is used by at least two [value nodes](#dfn-value-nodes), there is a [validation result](#dfn-validation-results).

_The remainder of this section is informative._

ex:UniqueLangExampleShape
	a sh:NodeShape ;
	sh:targetNode ex:Alice, ex:Bob ;
	sh:property \[
		sh:path ex:label ;
		sh:uniqueLang true ;
	\] .

ex:Alice
	ex:label "Alice" ;
	ex:label "Alice"@en ;
	ex:label "Alice"@fr .

ex:Bob
	ex:label "Bob"@en ;
	ex:label "Bobby"@en .

### 4.5 Property Pair Constraint Components

The constraint components in this section specify conditions on the sets of [value nodes](#dfn-value-nodes) in relation to other properties. These constraint components can only be used by [property shapes](#dfn-property-shape).

#### 4.5.1 sh:equals

`sh:equals` specifies the condition that the set of all [value nodes](#dfn-value-nodes) is equal to the set of [objects](#dfn-object) of the [triples](#dfn-rdf-triple) that have the [focus node](#dfn-focus-node) as [subject](#dfn-subject) and the [value](#dfn-value) of `sh:equals` as [predicate](#dfn-predicate).

Constraint Component IRI: `sh:EqualsConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:equals` | The property to compare with. The values of `sh:equals` in a shape are [IRIs](#dfn-iri). |

TEXTUAL DEFINITION

For each [value node](#dfn-value-nodes) that does not exist as a [value](#dfn-value) of the property `$equals` at the [focus node](#dfn-focus-node), there is a [validation result](#dfn-validation-results) with the [value node](#dfn-value-nodes) as `sh:value`. For each [value](#dfn-value) of the property `$equals` at the [focus node](#dfn-focus-node) that is not one of the [value nodes](#dfn-value-nodes), there is a [validation result](#dfn-validation-results) with the [value](#dfn-value) as `sh:value`.

_The remainder of this section is informative._

The following example illustrates the use of `sh:equals` in a shape to specify that certain focus nodes need to have the same set of values for `ex:firstName` and `ex:givenName`.

ex:EqualExampleShape
	a sh:NodeShape ;
	sh:targetNode ex:Bob ;
	sh:property \[
		sh:path ex:firstName ;
		sh:equals ex:givenName ;
	\] .

ex:Bob
	ex:firstName "Bob" ;
	ex:givenName "Bob" .

#### 4.5.2 sh:disjoint

`sh:disjoint` specifies the condition that the set of [value nodes](#dfn-value-nodes) is disjoint with the set of [objects](#dfn-object) of the [triples](#dfn-rdf-triple) that have the [focus node](#dfn-focus-node) as [subject](#dfn-subject) and the [value](#dfn-value) of `sh:disjoint` as [predicate](#dfn-predicate).

Constraint Component IRI: `sh:DisjointConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:disjoint` | The property to compare the values with. The values of `sh:disjoint` in a shape are [IRIs](#dfn-iri). |

TEXTUAL DEFINITION

For each [value node](#dfn-value-nodes) that also exists as a [value](#dfn-value) of the property `$disjoint` at the [focus node](#dfn-focus-node), there is a [validation result](#dfn-validation-results) with the [value node](#dfn-value-nodes) as `sh:value`.

_The remainder of this section is informative._

POTENTIAL DEFINITION IN SPARQL (Must return no results for the given $PATH)

SELECT DISTINCT $this ?value
WHERE {
	$this $PATH ?value .
	$this $disjoint ?value .
}

The following example illustrates the use of `sh:disjoint` in a shape to specify that certain focus nodes cannot share any values for `ex:prefLabel` and `ex:altLabel`.

ex:DisjointExampleShape
	a sh:NodeShape ;
	sh:targetNode ex:USA, ex:Germany ;
	sh:property \[
		sh:path ex:prefLabel ;
		sh:disjoint ex:altLabel ;
	\] .

ex:USA
	ex:prefLabel "USA" ;
	ex:altLabel "United States" .

ex:Germany
	ex:prefLabel "Germany" ;
	ex:altLabel "Germany" .

#### 4.5.3 sh:lessThan

`sh:lessThan` specifies the condition that each [value node](#dfn-value-nodes) is smaller than all the [objects](#dfn-object) of the [triples](#dfn-rdf-triple) that have the [focus node](#dfn-focus-node) as [subject](#dfn-subject) and the [value](#dfn-value) of `sh:lessThan` as [predicate](#dfn-predicate).

Constraint Component IRI: `sh:LessThanConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:lessThan` | The property to compare the values with. The values of `sh:lessThan` in a shape are [IRIs](#dfn-iri). [Node shapes](#dfn-node-shape) cannot have any value for `sh:lessThan`. |

TEXTUAL DEFINITION

For each pair of [value nodes](#dfn-value-nodes) and the values of the property `$lessThan` at the given [focus node](#dfn-focus-node) where the first [value](#dfn-value) is not less than the second [value](#dfn-value) (based on SPARQL's `<` operator) or where the two values cannot be compared, there is a [validation result](#dfn-validation-results) with the [value node](#dfn-value-nodes) as `sh:value`.

_The remainder of this section is informative._

POTENTIAL DEFINITION IN SPARQL (Must return no results for the given $PATH)

SELECT $this ?value
WHERE {
	$this $PATH ?value .
	$this $lessThan ?otherValue .
	BIND (?value < ?otherValue AS ?result) .
	FILTER (!bound(?result) || !(?result)) .
}

The following example illustrates the use of `sh:lessThan` in a shape to specify that all values of `ex:startDate` are "before" the values of `ex:endDate`.

ex:LessThanExampleShape
	a sh:NodeShape ;
	sh:property \[
		sh:path ex:startDate ;
		sh:lessThan ex:endDate ;
	\] .

#### 4.5.4 sh:lessThanOrEquals

`sh:lessThanOrEquals` specifies the condition that each [value node](#dfn-value-nodes) is smaller than or equal to all the [objects](#dfn-object) of the [triples](#dfn-rdf-triple) that have the [focus node](#dfn-focus-node) as [subject](#dfn-subject) and the [value](#dfn-value) of `sh:lessThanOrEquals` as [predicate](#dfn-predicate).

Constraint Component IRI: `sh:LessThanOrEqualsConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:lessThanOrEquals` | The property to compare the values with. The values of `sh:lessThanOrEquals` in a shape are [IRIs](#dfn-iri). [Node shapes](#dfn-node-shape) cannot have any value for `sh:lessThanOrEquals`. |

TEXTUAL DEFINITION

For each pair of [value nodes](#dfn-value-nodes) and the values of the property `$lessThanOrEquals` at the given [focus node](#dfn-focus-node) where the first [value](#dfn-value) is not less than or equal to the second [value](#dfn-value) (based on SPARQL's `<=` operator) or where the two values cannot be compared, there is a [validation result](#dfn-validation-results) with the [value node](#dfn-value-nodes) as `sh:value`.

_The remainder of this section is informative._

POTENTIAL DEFINITION IN SPARQL (Must return no results for the given $PATH)

SELECT $this ?value
WHERE {
	$this $PATH ?value .
	$this $lessThan ?otherValue .
	BIND (?value <= ?otherValue AS ?result) .
	FILTER (!bound(?result) || !(?result)) .
}

### 4.6 Logical Constraint Components

The constraint components in this section implement the common logical operators _and_, _or_ and _not_, as well as a variation of _exclusive or_.

#### 4.6.1 sh:not

`sh:not` specifies the condition that each [value node](#dfn-value-nodes) cannot [conform](#dfn-conforms) to a given [shape](#dfn-shape). This is comparable to negation and the logical "not" operator.

Constraint Component IRI: `sh:NotConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:not` | The shape to negate. The values of `sh:not` in a shape must be [well-formed](#dfn-well-formed) [shapes](#dfn-shape). |

TEXTUAL DEFINITION

For each [value node](#dfn-value-nodes) `v`: A [failure](#dfn-failure) _MUST_ be reported if the [conformance checking](#dfn-conformance-checking) of `v` against the shape `$not` produces a [failure](#dfn-failure). Otherwise, if `v` [conforms](#dfn-conforms) to the shape `$not`, there is [validation result](#dfn-validation-results) with `v` as `sh:value`.

_The remainder of this section is informative._

The following example illustrates the use of `sh:not` in a shape to specify the condition that certain focus nodes cannot have any value of `ex:property`.

ex:NotExampleShape
	a sh:NodeShape ;
	sh:targetNode ex:InvalidInstance1 ;
	sh:not \[
		a sh:PropertyShape ;
		sh:path ex:property ;
		sh:minCount 1 ;
	\] .

ex:InvalidInstance1 ex:property "Some value" .

#### 4.6.2 sh:and

`sh:and` specifies the condition that each [value node](#dfn-value-nodes) conforms to all provided shapes. This is comparable to conjunction and the logical "and" operator.

Constraint Component IRI: `sh:AndConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:and` | A [SHACL list](#dfn-shacl-list) of shapes to validate the value nodes against. Each value of `sh:and` in a shape is a [SHACL list](#dfn-shacl-list). Each [member](#dfn-members) of such list must be a [well-formed](#dfn-well-formed) [shape](#dfn-shape). |

TEXTUAL DEFINITION

For each [value node](#dfn-value-nodes) `v`: A [failure](#dfn-failure) _MUST_ be produced if the [conformance checking](#dfn-conformance-checking) of `v` against any of the [members](#dfn-members) of `$and` produces a [failure](#dfn-failure). Otherwise, if `v` does not [conform](#dfn-conforms) to each [member](#dfn-members) of `$and`, there is a [validation result](#dfn-validation-results) with `v` as `sh:value`.

_The remainder of this section is informative._

Note that although `sh:and` has a [SHACL list](#dfn-shacl-list) of shapes as its value, the order of those shapes does not impact the validation results.

The following example illustrates the use of `sh:and` in a shape to specify the condition that certain focus nodes have exactly one value of `ex:property`. This is achieved via the conjunction of a separate named shape (`ex:SuperShape`) which specifies the minimum count, and a blank node shape that additionally specifies the maximum count. As shown here, `sh:and` can be used to implement a specialization mechanism between shapes.

ex:SuperShape
	a sh:NodeShape ;
	sh:property \[
		sh:path ex:property ;
		sh:minCount 1 ;
	\] .

ex:ExampleAndShape
	a sh:NodeShape ;
	sh:targetNode ex:ValidInstance, ex:InvalidInstance ;
	sh:and (
		ex:SuperShape
		\[
			sh:path ex:property ;
			sh:maxCount 1 ;
		\]
	) .

ex:ValidInstance
	ex:property "One" .

# Invalid: more than one property
ex:InvalidInstance
	ex:property "One" ;
	ex:property "Two" .

#### 4.6.3 sh:or

`sh:or` specifies the condition that each [value node](#dfn-value-nodes) conforms to at least one of the provided shapes. This is comparable to disjunction and the logical "or" operator.

Constraint Component IRI: `sh:OrConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:or` | A [SHACL list](#dfn-shacl-list) of shapes to validate the value nodes against. Each value of `sh:or` in a shape is a [SHACL list](#dfn-shacl-list). Each [member](#dfn-members) of such list must be a [well-formed](#dfn-well-formed) [shape](#dfn-shape). |

TEXTUAL DEFINITION

For each [value node](#dfn-value-nodes) `v`: A [failure](#dfn-failure) _MUST_ be produced if the [conformance checking](#dfn-conformance-checking) of `v` against any of the [members](#dfn-members) produces a [failure](#dfn-failure). Otherwise, if `v` [conforms](#dfn-conforms) to none of the [members](#dfn-members) of `$or` there is a [validation result](#dfn-validation-results) with `v` as `sh:value`.

_The remainder of this section is informative._

Note that although `sh:or` has a [SHACL list](#dfn-shacl-list) of shapes as its value, the order of those shapes does not impact the validation results.

The following example illustrates the use of `sh:or` in a shape to specify the condition that certain focus nodes have at least one value of `ex:firstName` or at least one value of `ex:givenName`.

ex:OrConstraintExampleShape
	a sh:NodeShape ;
	sh:targetNode ex:Bob ;
	sh:or (
		\[
			sh:path ex:firstName ;
			sh:minCount 1 ;
		\]
		\[
			sh:path ex:givenName ;
			sh:minCount 1 ;
		\]
	) .

ex:Bob ex:firstName "Robert" .

The next example shows how `sh:or` can be used in a [property shape](#dfn-property-shape) to state that the values of the given property `ex:address` may be either literals with datatype `xsd:string` or [SHACL instances](#dfn-shacl-instance) of the class `ex:Address`.

ex:PersonAddressShape
	a sh:NodeShape ;
	sh:targetClass ex:Person ;
	sh:property \[
		sh:path ex:address ;
		sh:or (
			\[
				sh:datatype xsd:string ;
			\]
			\[
				sh:class ex:Address ;
			\]
		)
	\] .

ex:Bob ex:address "123 Prinzengasse, Vaduz, Liechtenstein" .

#### 4.6.4 sh:xone

`sh:xone` specifies the condition that each [value node](#dfn-value-nodes) conforms to _exactly one_ of the provided shapes.

Constraint Component IRI: `sh:XoneConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:xone` | A [SHACL list](#dfn-shacl-list) of shapes to validate the value nodes against. Each value of `sh:xone` in a shape is a [SHACL list](#dfn-shacl-list). Each [member](#dfn-members) of such list must be a [well-formed](#dfn-well-formed) [shape](#dfn-shape). |

TEXTUAL DEFINITION

For each [value node](#dfn-value-nodes) `v` let `N` be the number of the [shapes](#dfn-shape) that are [members](#dfn-members) of `$xone` where `v` [conforms](#dfn-conforms) to the shape. A [failure](#dfn-failure) _MUST_ be produced if the [conformance checking](#dfn-conformance-checking) of `v` against any of the [members](#dfn-members) produces a [failure](#dfn-failure). Otherwise, if `N` is not exactly `1`, there is a [validation result](#dfn-validation-results) with `v` as `sh:value`.

_The remainder of this section is informative._

Note that although `sh:xone` has a [SHACL list](#dfn-shacl-list) of shapes as its value, the order of those shapes does not impact the validation results.

The following example illustrates the use of `sh:xone` in a shape to specify the condition that certain focus nodes must either have a value for `ex:fullName` or values for `ex:firstName` and `ex:lastName`, but not both.

ex:XoneConstraintExampleShape
	a sh:NodeShape ;
	sh:targetClass ex:Person ;
	sh:xone (
		\[
			sh:property \[
				sh:path ex:fullName ;
				sh:minCount 1 ;
			\]
		\]
		\[
			sh:property \[
				sh:path ex:firstName ;
				sh:minCount 1 ;
			\] ;
			sh:property \[
				sh:path ex:lastName ;
				sh:minCount 1 ;
			\]
		\]
	) .

ex:Bob a ex:Person ;
	ex:firstName "Robert" ; 
	ex:lastName "Coin" .

ex:Carla a ex:Person ;
	ex:fullName "Carla Miller" .
	
ex:Dory a ex:Person ;
	ex:firstName "Dory" ;
	ex:lastName "Dunce" ;
	ex:fullName "Dory Dunce" .

### 4.7 Shape-based Constraint Components

The constraint components in this section can be used to specify complex conditions by validating the value nodes against certain shapes.

#### 4.7.1 sh:node

`sh:node` specifies the condition that each [value node](#dfn-value-nodes) conforms to the given [node shape](#dfn-node-shape).

Constraint Component IRI: `sh:NodeConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:node` | The [node shape](#dfn-node-shape) that all value nodes need to conform to. The values of `sh:node` in a shape must be [well-formed](#dfn-well-formed) [node shapes](#dfn-node-shape). |

TEXTUAL DEFINITION

For each [value node](#dfn-value-nodes) `v`: A [failure](#dfn-failure) _MUST_ be produced if the [conformance checking](#dfn-conformance-checking) of `v` against `$node` produces a [failure](#dfn-failure). Otherwise, if `v` does not [conform](#dfn-conforms) to `$node`, there is a [validation result](#dfn-validation-results) with `v` as `sh:value`.

_The remainder of this section is informative._

In the following example, all values of the property `ex:address` must fulfill the constraints expressed by the [shape](#dfn-shape) `ex:AddressShape`.

ex:AddressShape
	a sh:NodeShape ;
	sh:property \[
		sh:path ex:postalCode ;
		sh:datatype xsd:string ;
		sh:maxCount 1 ;
	\] .

ex:PersonShape
	a sh:NodeShape ;
	sh:targetClass ex:Person ;
	sh:property \[   # \_:b1
		sh:path ex:address ;
		sh:minCount 1 ;
		sh:node ex:AddressShape ;
	\] .

ex:Bob a ex:Person ;
	ex:address ex:BobsAddress .
	
ex:BobsAddress
	ex:postalCode "1234" .

ex:Reto a ex:Person ;
	ex:address ex:RetosAddress .

ex:RetosAddress
	ex:postalCode 5678 .

\[	a sh:ValidationReport ;
	sh:conforms false ;
	sh:result \[
		a sh:ValidationResult ;
		sh:resultSeverity sh:Violation ;
		sh:focusNode ex:Reto ;
		sh:resultPath ex:address ;
		sh:value ex:RetosAddress ;
		sh:resultMessage "Value does not conform to shape ex:AddressShape." ;
		sh:sourceConstraintComponent sh:NodeConstraintComponent ;
		sh:sourceShape \_:b1 ;
	\]
\] .

#### 4.7.2 sh:property

`sh:property` can be used to specify that each [value node](#dfn-value-nodes) has a given [property shape](#dfn-property-shape).

Constraint Component IRI: `sh:PropertyShapeComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:property` | A [property shape](#dfn-property-shape) that all value nodes need to have. Each value of `sh:property` in a shape must be a [well-formed](#dfn-well-formed) [property shape](#dfn-property-shape). |

TEXTUAL DEFINITION

For each [value node](#dfn-value-nodes) `v`: A [failure](#dfn-failure) _MUST_ be produced if the validation of `v` as [focus node](#dfn-focus-node) against the property shape `$property` produces a [failure](#dfn-failure). Otherwise, the validation results are the results of [validating](#dfn-validation) `v` as [focus node](#dfn-focus-node) against the property shape `$property`.

_The remainder of this section is informative._

Note that there is an important difference between `sh:property` and `sh:node`: If a value node is violating the constraint, then there is only a single validation result for `sh:node` for this value node, with `sh:NodeConstraintComponent` as its `sh:sourceConstraintComponent`. On the other hand side, there may be any number of validation results for `sh:property`, and these will have the individual constraint components of the [constraints](#dfn-constraint) in the [property shape](#dfn-property-shape) as their values of `sh:sourceConstraintComponent`.

Like with all other validation results, each time a [property shape](#dfn-property-shape) is reached via `sh:property`, a validation engine _MUST_ produce _fresh_ validation result nodes. This includes cases where the same [focus node](#dfn-focus-node) is validated against the same [property shape](#dfn-property-shape) although it is reached via different paths in the [shapes graph](#dfn-shapes-graph).

#### 4.7.3 sh:qualifiedValueShape, sh:qualifiedMinCount, sh:qualifiedMaxCount

`sh:qualifiedValueShape` specifies the condition that a specified number of [value nodes](#dfn-value-nodes) conforms to the given shape. Each `sh:qualifiedValueShape` can have: one value for `sh:qualifiedMinCount`, one value for `sh:qualifiedMaxCount` or, one value for each, at the same [subject](#dfn-subject).

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:qualifiedValueShape` | The shape that the specified number of value nodes needs to conform to. The values of `sh:qualifiedValueShape` in a shape must be [well-formed](#dfn-well-formed) [shapes](#dfn-shape). [Node shapes](#dfn-node-shape) cannot have any value for `sh:qualifiedValueShape`. This is a [mandatory parameter](#dfn-mandatory-parameters) of `sh:QualifiedMinCountConstraintComponent` and `sh:QualifiedMaxCountConstraintComponent`. |
| `sh:qualifiedValueShapesDisjoint` | This is an [optional parameter](#dfn-optional-parameters) of `sh:QualifiedMinCountConstraintComponent` and `sh:QualifiedMaxCountConstraintComponent`. If set to `true` then (for the counting) the value nodes must not conform to any of the [sibling shapes](#dfn-sibling-shapes). The values of `sh:qualifiedValueShapesDisjoint` in a shape are literals with datatype `xsd:boolean`. |
| `sh:qualifiedMinCount` | The minimum number of value nodes that conform to the shape. The values of `sh:qualifiedMinCount` in a shape are literals with datatype `xsd:integer`. This is a [mandatory parameter](#dfn-mandatory-parameters) of `sh:QualifiedMinCountConstraintComponent`. |
| `sh:qualifiedMaxCount` | The maximum number of value nodes that can conform to the shape. The values of `sh:qualifiedMaxCount` in a shape are literals with datatype `xsd:integer`. This is a [mandatory parameter](#dfn-mandatory-parameters) of `sh:QualifiedMaxCountConstraintComponent`. |

TEXTUAL DEFINITION of Sibling Shapes

Let `Q` be a [shape](#dfn-shape) in [shapes graph](#dfn-shapes-graph) `G` that declares a qualified cardinality constraint (by having values for `sh:qualifiedValueShape` and at least one of `sh:qualifiedMinCount` or `sh:qualifiedMaxCount`). Let `ps` be the set of [shapes](#dfn-shape) in `G` that have `Q` as a [value](#dfn-value) of `sh:property`. If `Q` has `true` as a [value](#dfn-value) for `sh:qualifiedValueShapesDisjoint` then the set of sibling shapes for `Q` is defined as the set of all [values](#dfn-value) of the [SPARQL property path](#dfn-sparql-property-paths) `sh:property/sh:qualifiedValueShape` for any [shape](#dfn-shape) in `ps` minus the [value](#dfn-value) of `sh:qualifiedValueShape` of `Q` itself. The set of sibling shapes is empty otherwise.

TEXTUAL DEFINITION of sh:qualifiedMinCount

Let `C` be the number of [value nodes](#dfn-value-nodes) `v` where `v` [conforms](#dfn-conforms) to `$qualifiedValueShape` and where `v` does not [conform](#dfn-conforms) to any of the [sibling shapes](#dfn-sibling-shapes) for the _current_ shape, i.e. the shape that `v` is validated against and which has `$qualifiedValueShape` as its value for `sh:qualifiedValueShape`. A [failure](#dfn-failure) _MUST_ be produced if any of the said conformance checks produces a [failure](#dfn-failure). Otherwise, there is a [validation result](#dfn-validation-results) if `C` is less than `$qualifiedMinCount`. The [constraint component](#dfn-constraint-component) for `sh:qualifiedMinCount` is `sh:QualifiedMinCountConstraintComponent`.

TEXTUAL DEFINITION of sh:qualifiedMaxCount

Let `C` be as defined for `sh:qualifiedMinCount` above. A [failure](#dfn-failure) _MUST_ be produced if any of the said conformance checks produces a [failure](#dfn-failure). Otherwise, there is a [validation result](#dfn-validation-results) if `C` is greater than `$qualifiedMaxCount`. The [constraint component](#dfn-constraint-component) for `sh:qualifiedMaxCount` is `sh:QualifiedMaxCountConstraintComponent`.

_The remainder of this section is informative._

In the following example shape can be used to specify the condition that the property `ex:parent` has exactly two values, and at least one of them is female.

ex:QualifiedValueShapeExampleShape
	a sh:NodeShape ;
	sh:targetNode ex:QualifiedValueShapeExampleValidResource ;
	sh:property \[
		sh:path ex:parent ;
		sh:minCount 2 ;
		sh:maxCount 2 ;
		sh:qualifiedValueShape \[
			sh:path ex:gender ;
			sh:hasValue ex:female ;
		\] ;
		sh:qualifiedMinCount 1 ;
	\] .

ex:QualifiedValueShapeExampleValidResource
	ex:parent ex:John ;
	ex:parent ex:Jane .

ex:John
	ex:gender ex:male .

ex:Jane
	ex:gender ex:female .

The following example illustrates the use of `sh:qualifiedValueShapesDisjoint` to express that a hand must have at most 5 values of `ex:property` (expressed using `sh:maxCount`), and exactly one of them must be an instance of `ex:Thumb` while exactly 4 of them must be an instance of `ex:Finger` but thumbs and fingers must be disjoint. In other words, on a hand, none of the fingers can also be counted as the thumb.

ex:HandShape
	a sh:NodeShape ;
	sh:targetClass ex:Hand ;
	sh:property \[
		sh:path ex:digit ;
		sh:maxCount 5 ;
	\] ;
	sh:property \[
		sh:path ex:digit ;
		sh:qualifiedValueShape \[ sh:class ex:Thumb \] ;
		sh:qualifiedValueShapesDisjoint true ;
		sh:qualifiedMinCount 1 ;
		sh:qualifiedMaxCount 1 ;
	\] ;
	sh:property \[
		sh:path ex:digit ;
		sh:qualifiedValueShape \[ sh:class ex:Finger \] ;
		sh:qualifiedValueShapesDisjoint true ;
		sh:qualifiedMinCount 4 ;
		sh:qualifiedMaxCount 4 ;
	\] .

### 4.8 Other Constraint Components

This section enumerates Core constraint components that do not fit into the other categories.

#### 4.8.1 sh:closed, sh:ignoredProperties

The RDF data model offers a huge amount of flexibility. Any node can in principle have values for any property. However, in some cases it makes sense to specify conditions on which properties can be applied to nodes. The SHACL Core language includes a property called `sh:closed` that can be used to specify the condition that each value node has [values](#dfn-value) only for those properties that have been explicitly enumerated via the [property shapes](#dfn-property-shape) specified for the shape via `sh:property`.

Constraint Component IRI: `sh:ClosedConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:closed` | Set to `true` to close the shape. The values of `sh:closed` in a shape are literals with datatype `xsd:boolean`. |
| `sh:ignoredProperties` | Optional [SHACL list](#dfn-shacl-list) of properties that are also permitted in addition to those explicitly enumerated via `sh:property`. The values of `sh:ignoredProperties` in a shape must be [SHACL lists](#dfn-shacl-list). Each [member](#dfn-members) of such a list must be a [IRI](#dfn-iri). |

TEXTUAL DEFINITION

If `$closed` is `true` then there is a [validation result](#dfn-validation-results) for each [triple](#dfn-rdf-triple) that has a [value node](#dfn-value-nodes) as its [subject](#dfn-subject) and a [predicate](#dfn-predicate) that is not explicitly enumerated as a [value](#dfn-value) of `sh:path` in any of the [property shapes](#dfn-property-shape) declared via `sh:property` at the current shape. If `$ignoredProperties` has a value then the properties enumerated as [members](#dfn-members) of this [SHACL list](#dfn-shacl-list) are also permitted for the [value node](#dfn-value-nodes). The [validation result](#dfn-validation-results) _MUST_ have the [predicate](#dfn-predicate) of the triple as its `sh:resultPath`, and the [object](#dfn-object) of the triple as its `sh:value`.

_The remainder of this section is informative._

The following example illustrates the use of `sh:closed` in a shape to specify the condition that certain focus nodes only have values for `ex:firstName` and `ex:lastName`. The "ignored" property `rdf:type` would also be allowed.

ex:ClosedShapeExampleShape
	a sh:NodeShape ;
	sh:targetNode ex:Alice, ex:Bob ;
	sh:closed true ;
	sh:ignoredProperties (rdf:type) ;
	sh:property \[
		sh:path ex:firstName ;
	\] ;
	sh:property \[
		sh:path ex:lastName ;
	\] .

ex:Alice
	ex:firstName "Alice" .

ex:Bob
	ex:firstName "Bob" ;
	ex:middleInitial "J" .

#### 4.8.2 sh:hasValue

`sh:hasValue` specifies the condition that at least one [value node](#dfn-value-nodes) is equal to the given RDF term.

Constraint Component IRI: `sh:HasValueConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:hasValue` | A specific required value. |

TEXTUAL DEFINITION

If the RDF term `$hasValue` is not among the [value nodes](#dfn-value-nodes), there is a [validation result](#dfn-validation-results).

_The remainder of this section is informative._

ex:StanfordGraduate
	a sh:NodeShape ;
	sh:targetNode ex:Alice ;
	sh:property \[
		sh:path ex:alumniOf ;
		sh:hasValue ex:Stanford ;
	\] .

ex:Alice
	ex:alumniOf ex:Harvard ;
	ex:alumniOf ex:Stanford .

#### 4.8.3 sh:in

`sh:in` specifies the condition that each [value node](#dfn-value-nodes) is a [member](#dfn-members) of a provided [SHACL list](#dfn-shacl-list).

Constraint Component IRI: `sh:InConstraintComponent`

Parameters:

| Property | Summary and Syntax Rules |
| --- | --- |
| `sh:in` | A [SHACL list](#dfn-shacl-list) that has the allowed values as [members](#dfn-members). Each value of `sh:in` in a shape is a [SHACL list](#dfn-shacl-list). A shape has at most one value for `sh:in`. |

TEXTUAL DEFINITION

For each [value node](#dfn-value-nodes) that is not a [member](#dfn-members) of `$in`, there is a [validation result](#dfn-validation-results) with the [value node](#dfn-value-nodes) as `sh:value`.

_The remainder of this section is informative._

Note that matching of literals needs to be exact, e.g. `"04"^^xsd:byte` does not match `"4"^^xsd:integer`.

POTENTIAL DEFINITION IN SPARQL (Must evaluate to true for each value node $value)

ASK {
	GRAPH $shapesGraph {
		$in (rdf:rest\*)/rdf:first $value .
	}
}

ex:InExampleShape
	a sh:NodeShape ;
	sh:targetNode ex:RainbowPony ;
	sh:property \[
		sh:path ex:color ;
		sh:in ( ex:Pink ex:Purple ) ;
	\] .

ex:RainbowPony ex:color ex:Pink .

# Part 2: SHACL-SPARQL

Part 1 of this specification introduced features that are built into the Core of SHACL. The goal of this Core is to provide a high-level vocabulary for common use cases to describe shapes. However, SHACL also provides mechanisms to go beyond the Core vocabulary and represent constraints with greater flexibility. These mechanisms, called [SHACL-SPARQL](#dfn-shacl-sparql), are described in the following sections.

## 5\. SPARQL-based Constraints

SHACL-SPARQL supports a [constraint component](#dfn-constraint-component) that can be used to express restrictions based on a SPARQL SELECT query.

Constraint Component IRI: `sh:SPARQLConstraintComponent`

Parameters:

| Property | Summary |
| --- | --- |
| `sh:sparql` | A [SPARQL-based constraint](#dfn-sparql-based-constraints) declaring the SPARQL query to evaluate. |

The [syntax rules](#sparql-constraints-syntax) and [validation process](#sparql-constraints-validation) for SPARQL-based constraints are defined in the rest of this section.

### 5.1 An Example SPARQL-based Constraint

_This section is non-normative._

The following example illustrates the syntax of a [SPARQL-based constraint](#dfn-sparql-based-constraints).

ex:ValidCountry a ex:Country ;
	ex:germanLabel "Spanien"@de .
  
ex:InvalidCountry a ex:Country ;
	ex:germanLabel "Spain"@en .

ex:LanguageExampleShape
	a sh:NodeShape ;
	sh:targetClass ex:Country ;
	sh:sparql \[
		a sh:SPARQLConstraint ;   # This triple is optional
		sh:message "Values are literals with German language tag." ;
		sh:prefixes ex: ;
		sh:select """
			SELECT $this (ex:germanLabel AS ?path) ?value
			WHERE {
				$this ex:germanLabel ?value .
				FILTER (!isLiteral(?value) || !langMatches(lang(?value), "de"))
			}
			""" ;
	\] .

The target of the shape above includes all [SHACL instances](#dfn-shacl-instance) of `ex:Country`. For those nodes (represented by the variable `this`), the SPARQL query walks through the values of `ex:germanLabel` and verifies that they are literals with a German language code. The validation results for the aforementioned data graph is shown below:

\[	a sh:ValidationReport ;
	sh:conforms false ;
	sh:result \[
		a sh:ValidationResult ;
		sh:resultSeverity sh:Violation ;
		sh:focusNode ex:InvalidCountry ;
		sh:resultPath ex:germanLabel ;
		sh:value "Spain"@en ;
		sh:sourceConstraintComponent sh:SPARQLConstraintComponent ;
		sh:sourceShape ex:LanguageExampleShape ;
		# ...
	\]
\] .

The SPARQL query returns result set [solutions](#dfn-solution) for all bindings of the variable `value` that violate the constraint. There is a validation result for each [solution](#dfn-solution) in that result set, applying the [mapping rules](#sparql-constraints-validation) explained later. In this example, each validation result will have the [binding](#dfn-binding) for the variable `this` as the `sh:focusNode`, `ex:germanLabel` as `sh:resultPath` and the violating value as `sh:value`.

The following example illustrates a similar scenario as above, but with a [property shape](#dfn-property-shape).

ex:LanguageExamplePropertyShape
	a sh:PropertyShape ;
	sh:targetClass ex:Country ;
	sh:path ex:germanLabel ;
	sh:sparql \[
		a sh:SPARQLConstraint ;   # This triple is optional
		sh:message "Values are literals with German language tag." ;
		sh:prefixes ex: ;
		sh:select """
			SELECT $this ?value
			WHERE {
				$this $PATH ?value .
				FILTER (!isLiteral(?value) || !langMatches(lang(?value), "de"))
			}
			""" ;
	\] .

### 5.2 Syntax of SPARQL-based Constraints

Shapes may have values for the property `sh:sparql`, and these values are either [IRIs](#dfn-iri) or [blank nodes](#dfn-blank-node). These values are called SPARQL-based constraints.

[SPARQL-based constraints](#dfn-sparql-based-constraints) have exactly one [value](#dfn-value) for the property `sh:select`. The value of `sh:select` is a [literal](#dfn-literal) of datatype `xsd:string`. The class `sh:SPARQLConstraint` is defined in the SHACL vocabulary and may be used as the [type](#dfn-shacl-types) of these constraints (although no type is required). Using the [prefix handling rules](#sparql-prefixes), the value of `sh:select` is a valid SPARQL 1.1 SELECT query. The SPARQL query derived from the value of `sh:select` [projects](https://www.w3.org/TR/sparql11-query/#selectproject) the variable `this` in the SELECT clause.

The following two properties are similar to their use in [shapes](#dfn-shape):

[SPARQL-based constraints](#dfn-sparql-based-constraints) may have values for the property `sh:message` and these are either `xsd:string` literals or literals with a language tag. [SPARQL-based constraints](#dfn-sparql-based-constraints) may have at most one value for the property `sh:deactivated` and this value is either `true` or `false`.

SELECT queries used in the context of [property shapes](#dfn-property-shape) use a special variable named `PATH` as a placeholder for the path used by the shape.

The only legal use of the variable `PATH` in the SPARQL queries of [SPARQL-based constraints](#dfn-sparql-based-constraints) and [SELECT-based validators](#dfn-select-based-validators) is in the [predicate](#dfn-predicate) position of a [triple pattern](https://www.w3.org/TR/sparql11-query/#QSynTriples). A query that uses the variable `PATH` in any other position is [ill-formed](#dfn-ill-formed).

#### 5.2.1 Prefix Declarations for SPARQL Queries

A [shapes graph](#dfn-shapes-graph) may include declarations of namespace prefixes so that these prefixes can be used to abbreviate the SPARQL queries derived from the same shapes graph. The syntax of such prefix declarations is illustrated by the following example.

ex:
	a owl:Ontology ;
	owl:imports sh: ;
	sh:declare \[
		sh:prefix "ex" ;
		sh:namespace "http://example.com/ns#"^^xsd:anyURI ;
	\] ;
	sh:declare \[
		sh:prefix "schema" ;
		sh:namespace "http://schema.org/"^^xsd:anyURI ;
	\] .

The [values](#dfn-value) of the property `sh:declare` are [IRIs](#dfn-iri) or [blank nodes](#dfn-blank-node), and these values are called prefix declarations. The SHACL vocabulary includes the class `sh:PrefixDeclaration` as type for such [prefix declarations](#dfn-prefix-declarations) although no `rdf:type` triple is required for them. [Prefix declarations](#dfn-prefix-declarations) have exactly one value for the property `sh:prefix`. The values of `sh:prefix` are [literals](#dfn-literal) of datatype `xsd:string`. [Prefix declarations](#dfn-prefix-declarations) have exactly one value for the property `sh:namespace`. The values of `sh:namespace` are [literals](#dfn-literal) of datatype `xsd:anyURI`. Such a pair of values specifies a single mapping of a prefix to a namespace.

The recommended [subject](#dfn-subject) for values of `sh:declare` is the IRI of the named graph containing the shapes that use the prefixes. These IRIs are often declared as an instance of `owl:Ontology`, but this is not required.

[Prefix declarations](#dfn-prefix-declarations) can be used by [SPARQL-based constraints](#dfn-sparql-based-constraints), the [validators](#dfn-validators) of [SPARQL-based constraint components](#sparql-constraint-components), and by similar features defined by SHACL extensions. These nodes can use the property `sh:prefixes` to specify a set of prefix mappings. An example use of the `sh:prefixes` property can be found in the [example](#sparql-constraints-example) above.

The values of `sh:prefixes` are either [IRIs](#dfn-iri) or [blank nodes](#dfn-blank-node). A SHACL processor collects a set of prefix mappings as the union of all individual prefix mappings that are [values](#dfn-value) of the [SPARQL property path](#dfn-sparql-property-paths) `sh:prefixes/owl:imports*/sh:declare` of the [SPARQL-based constraint](#dfn-sparql-based-constraints) or [validator](#dfn-validators). If such a collection of prefix declarations contains multiple namespaces for the same [value](#dfn-value) of `sh:prefix`, then the [shapes graph](#dfn-shapes-graph) is [ill-formed](#dfn-ill-formed). (Note that SHACL processors _MAY_ ignore prefix declarations that are never reached).

A SHACL processor transforms the values of `sh:select` (and similar properties such as `sh:ask`) into SPARQL by prepending [`PREFIX`](https://www.w3.org/TR/sparql11-query/#rPrefixDecl) declarations for all prefix mappings. Each value of `sh:prefix` is turned into the `PNAME_NS`, while each value of `sh:namespace` is turned into the `IRIREF` in the `PREFIX` declaration. For the example shapes graph above, a SHACL-SPARQL processor would produce lines such as `PREFIX ex: <http://example.com/ns#>`. The SHACL-SPARQL processor _MUST_ produce a [failure](#dfn-failure) if the resulting query string cannot be parsed into a valid SPARQL 1.1 query.

In the rest of this document, the `sh:prefixes` statements may have been omitted for brevity.

### 5.3 Validation with SPARQL-based Constraints

This section explains the [validator](#dfn-validators) of `sh:SPARQLConstraintComponent`. Note that this validator only explains one possible implementation strategy, and SHACL processors may choose alternative approaches as long as the outcome is equivalent.

TEXTUAL DEFINITION

There are no validation results if the [SPARQL-based constraint](#dfn-sparql-based-constraints) has `true` as a [value](#dfn-value) for the property `sh:deactivated`. Otherwise, execute the SPARQL query specified by the [SPARQL-based constraint](#dfn-sparql-based-constraints) `$sparql` [pre-binding](#dfn-pre-binding-of-variables) the variables `this` and, if supported, `shapesGraph` and `currentShape` as described in [5.3.1 Pre-bound Variables in SPARQL Constraints ($this, $shapesGraph, $currentShape)](#sparql-constraints-prebound). If the [shape](#dfn-shape) is a [property shape](#dfn-property-shape), then prior to execution substitute the variable `PATH` where it appears in the [predicate](#dfn-predicate) position of a [triple pattern](https://www.w3.org/TR/sparql11-query/#QSynTriples) with a valid SPARQL surface syntax string of the [SHACL property path](#dfn-shacl-property-path) specified via `sh:path` at the [property shape](#dfn-property-shape). There is one validation result for each [solution](#dfn-solution) that does not have `true` as the [binding](#dfn-binding) for the variable `failure`. These validation results _MUST_ have the property values explained in [5.3.2 Mapping of Solution Bindings to Result Properties](#sparql-constraints-variables). A [failure](#dfn-failure) _MUST_ be produced if and only if one of the [solutions](#dfn-solution) has `true` as the [binding](#dfn-binding) for `failure`.

#### 5.3.1 Pre-bound Variables in SPARQL Constraints ($this, $shapesGraph, $currentShape)

When the SPARQL queries of [SPARQL-based constraints](#dfn-sparql-based-constraints) and the [validators](#dfn-validators) of [SPARQL-based constraint components](#dfn-sparql-based-constraint-component) are [processed](#validation-definition), the SHACL-SPARQL processor [pre-binds](#dfn-pre-binding-of-variables) values for the variables in the following table.

| Variable | Interpretation |
| --- | --- |
| `this` | The [focus node](#dfn-focus-node). |
| `shapesGraph` (Optional) | Can be used to query the shapes graph as in `GRAPH $shapesGraph { ... }`. If the shapes graph is a named graph in the same dataset as the data graph then it is the [IRI](#dfn-iri) of the shapes graph in the dataset. Not all SHACL-SPARQL processors need to support this variable. Processors that do not support the variable `shapesGraph` _MUST_ report a [failure](#dfn-failure) if they encounter a query that references this variable. Use of `GRAPH $shapesGraph { ... }` should be handled with extreme caution. It may result in constraints that are not interoperable across different SHACL-SPARQL processors and that may not run on remote RDF datasets. |
| `currentShape` (Optional) | The current [shape](#dfn-shape). Typically used in conjunction with the variable `shapesGraph`. The same support policies as for `shapesGraph` apply for this variable. |

#### 5.3.2 Mapping of Solution Bindings to Result Properties

The property [values](#dfn-value) of the validation result nodes are derived by the following rules, through a combination of result solutions and the values of the constraint itself. The rules are meant to be executed from top to bottom, so that the first bound value will be used.

| Property | Production Rules |
| --- | --- |
| `sh:focusNode` | 
1.  The binding for the variable `this`

 |
| `sh:resultPath` | 

1.  The binding for the variable `path`, if that is a [IRI](#dfn-iri)
2.  For results produced by a [property shape](#dfn-property-shape), a [SHACL property path](#dfn-shacl-property-path) that is equivalent to the [value](#dfn-value) of `sh:path` of the shape

 |
| `sh:value` | 

1.  The binding for the variable `value`
2.  The [value node](#dfn-value-nodes)

 |
| `sh:resultMessage` | 

1.  The binding for the variable `message`
2.  For SPARQL-based constraints: The values of `sh:message` of the [SPARQL-based constraint](#dfn-sparql-based-constraints). For SPARQL-based constraint components: The values of `sh:message` of the [validator](#dfn-validators) of the [SPARQL-based constraint component](#dfn-sparql-based-constraint-component).
3.  For SPARQL-based constraint components: The values of `sh:message` of the [SPARQL-based constraint component](#dfn-sparql-based-constraint-component).

These message literals may include the names of any SELECT result variables via `{?varName}` or `{$varName}`. If the constraint is based on a [SPARQL-based constraint component](#sparql-constraint-components), then the component's [parameter names](#dfn-parameter-name) can also be used. These `{?varName}` and `{$varName}` blocks _SHOULD_ be replaced with suitable string representations of the values of said variables.

 |
| `sh:sourceConstraint` | 

1.  The [SPARQL-based constraint](#dfn-sparql-based-constraints), i.e. the value of `sh:sparql`

 |

## 6\. SPARQL-based Constraint Components

[SPARQL-based constraints](#dfn-sparql-based-constraints) provide a lot of flexibility but may be hard to understand for some people or lead to repetition. This section introduces [SPARQL-based constraint components](#dfn-sparql-based-constraint-component) as a way to abstract the complexity of SPARQL and to declare high-level reusable components similar to the [Core constraint components](#core-components). Such constraint components can be declared using the SHACL RDF vocabulary and thus shared and reused.

### 6.1 An Example SPARQL-based Constraint Component

_This section is non-normative._

The following example demonstrates how SPARQL can be used to specify new constraint components using the SHACL-SPARQL language. The example implements [`sh:pattern` and `sh:flags`](#PatternConstraintComponent) using a [SPARQL ASK](#SPARQLAskValidator) query to validate that each [value node](#dfn-value-nodes) matches a given regular expression. Note that this is only an example implementation and should not be considered normative.

sh:PatternConstraintComponent
	a sh:ConstraintComponent ;
	sh:parameter \[
		sh:path sh:pattern ;
	\] ;
	sh:parameter \[
		sh:path sh:flags ;
		sh:optional true ;
	\] ;
	sh:validator shimpl:hasPattern .

shimpl:hasPattern
	a sh:SPARQLAskValidator ;
	sh:message "Value does not match pattern {$pattern}" ;
	sh:ask """
		ASK { 
			FILTER (!isBlank($value) && 
				IF(bound($flags), regex(str($value), $pattern, $flags), regex(str($value), $pattern)))
		}""" .

Constraint components provide instructions to validation engines on how to identify and validate [constraints](#dfn-constraint) within a [shape](#dfn-shape). In general, if a [shape](#dfn-shape) `S` has a [value](#dfn-value) for a property `p`, and there is a [constraint component](#dfn-constraint-component) `C` that specifies `p` as a parameter, and `S` has values for all [mandatory parameters](#dfn-mandatory-parameters) of `C`, then the set of these parameter values (including the [optional parameters](#dfn-optional-parameters)) declare a [constraint](#dfn-constraint) and the validation engine uses a suitable [validator](#dfn-validators) from `C` to perform the validation of this constraint. In the example above, `sh:PatternConstraintComponent` declares the mandatory parameter `sh:pattern`, the optional parameter `sh:flags`, and a [validator](#dfn-validators) that can be used to perform validation against either [node shapes](#dfn-node-shape) or [property shapes](#dfn-property-shape).

### 6.2 Syntax of SPARQL-based Constraint Components

A SPARQL-based constraint component is an [IRI](#dfn-iri) that has [SHACL type](#dfn-shacl-types) `sh:ConstraintComponent` in the [shapes graph](#dfn-shapes-graph).

The mechanism to declare new [constraint components](#dfn-constraint-component) in this document is limited to those based on SPARQL. However, then general syntax of declaring parameters and validators has been designed to also work for other extension languages such as JavaScript.

#### 6.2.1 Parameter Declarations (sh:parameter)

The [parameters](#dfn-parameters) of a [constraint component](#dfn-constraint-component) are declared via the property `sh:parameter`. The values of `sh:parameter` are called parameter declarations. The class `sh:Parameter` may be used as [type](#dfn-shacl-types) of [parameter declarations](#dfn-parameter-declarations) but no such triple is required. Each [parameter declaration](#dfn-parameter-declarations) has exactly one value for the property `sh:path`. At [parameter declarations](#dfn-parameter-declarations), the [value](#dfn-value) of `sh:path` is an [IRI](#dfn-iri).

The local name of an [IRI](#dfn-iri) is defined as the longest [NCNAME](https://www.w3.org/TR/REC-xml-names/#NT-NCName) at the end of the [IRI](#dfn-iri), not immediately preceded by the first colon in the [IRI](#dfn-iri). The parameter name of a [parameter declaration](#dfn-parameter-declarations) is defined as the [local name](#dfn-local-name) of the [value](#dfn-value) of `sh:path`. To ensure that a correct mapping from parameters into SPARQL variables is possible, the following syntax rules apply:

Every [parameter name](#dfn-parameter-name) is a valid [SPARQL VARNAME](https://www.w3.org/TR/sparql11-query/#rVARNAME). [Parameter names](#dfn-parameter-name) must not be one of the following: `this`, `shapesGraph`, `currentShape`, `path`, `PATH`, `value`. A constraint component where two or more [parameter declarations](#dfn-parameter-declarations) use the same [parameter names](#dfn-parameter-name) is [ill-formed](#dfn-ill-formed).

The values of `sh:optional` must be literals with datatype `xsd:boolean`. A [parameter declaration](#dfn-parameter-declarations) can have at most one value for the property `sh:optional`. If set to `true` then the parameter declaration declares an [optional parameter](#dfn-optional-parameters). Every [constraint component](#dfn-constraint-component) has at least one non-optional parameter.

The class `sh:Parameter` is defined as a [SHACL subclass](#dfn-shacl-subclass) of `sh:PropertyShape`, and all properties that are applicable to property shapes may also be used for parameters. This includes descriptive properties such as `sh:name` and `sh:description` but also constraint parameters such as `sh:class`. Shapes that do not [conform](#dfn-conforms) with the constraints declared for the parameters are [ill-formed](#dfn-ill-formed). Some implementations _MAY_ use these constraint parameters to prevent the execution of constraint components with invalid parameter values.

#### 6.2.2 Label Templates (sh:labelTemplate)

The property `sh:labelTemplate` can be used at any [constraint component](#dfn-constraint-component) to suggest how [constraints](#dfn-constraint) could be rendered to humans. The values of `sh:labelTemplate` are strings (possibly with language tag) and are called label templates.

_The remainder of this section is informative._

[Label templates](#dfn-label-templates) can include the names of the parameters that are declared for the constraint component using the syntaxes `{?varName}` or `{$varName}`, where `varName` is the name of the [parameter name](#dfn-parameter-name). At display time, these `{?varName}` and `{$varName}` blocks _SHOULD_ be replaced with the actual parameter values. There may be multiple label templates for the same subject, but they should not have the same language tags.

#### 6.2.3 Validators

For every supported shape type (i.e., [property shape](#dfn-property-shape) or [node shape](#dfn-node-shape)) the constraint component declares a suitable [validator](#dfn-validators). For a given constraint, a validator is selected from the constraint component using the following rules, in order:

1.  For [node shapes](#dfn-node-shape), use one of the values of `sh:nodeValidator`, if present.
2.  For [property shapes](#dfn-property-shape), use one of the values of `sh:propertyValidator`, if present.
3.  Otherwise, use one of the values of `sh:validator`.

If no suitable validator can be found, a SHACL-SPARQL processor ignores the constraint.

SHACL-SPARQL includes two types of validators, based on [SPARQL SELECT](#SPARQLSelectValidator) (for `sh:nodeValidator` and `sh:propertyValidator`) or [SPARQL ASK](#SPARQLAskValidator) queries (for `sh:validator`).

##### 6.2.3.1 SELECT-based Validators

[Validators](#dfn-validators) with [SHACL type](#dfn-shacl-types) `sh:SPARQLSelectValidator` are called SELECT-based validators. The values of `sh:nodeValidator` must be [SELECT-based validators](#dfn-select-based-validators). The values of `sh:propertyValidator` must be [SELECT-based validators](#dfn-select-based-validators). [SELECT-based validators](#dfn-select-based-validators) have exactly one [value](#dfn-value) for the property `sh:select`. The value of `sh:select` is a valid SPARQL SELECT query using the aforementioned [prefix handling rules](#sparql-prefixes). The SPARQL query derived from the value of `sh:select` [projects](https://www.w3.org/TR/sparql11-query/#selectproject) the variable `this` in its SELECT clause.

_The remainder of this section is informative._

The following example illustrates the declaration of a constraint component based on a SPARQL SELECT query. It is a generalized variation of the example from [5.1 An Example SPARQL-based Constraint](#sparql-constraints-example). That SPARQL query included two constants: the specific property `ex:germanLabel` and the language tag `de`. Constraint components make it possible to generalize such scenarios, so that constants get [pre-bound](#dfn-pre-binding-of-variables) with [parameters](#dfn-parameters). This allows the query logic to be reused in multiple places, without having to write any new SPARQL.

ex:LanguageConstraintComponentUsingSELECT
	a sh:ConstraintComponent ;
	rdfs:label "Language constraint component" ;
	sh:parameter \[
		sh:path ex:lang ;
		sh:datatype xsd:string ;
		sh:minLength 2 ;
		sh:name "language" ;
		sh:description "The language tag, e.g. \\"de\\"." ;
	\] ;
	sh:labelTemplate "Values are literals with language \\"{$lang}\\"" ;
	sh:propertyValidator \[
		a sh:SPARQLSelectValidator ;
		sh:message "Values are literals with language \\"{?lang}\\"" ;
		sh:select """
			SELECT DISTINCT $this ?value
			WHERE {
				$this $PATH ?value .
				FILTER (!isLiteral(?value) || !langMatches(lang(?value), $lang))
			}
			"""
	\] .

Once a constraint component has been declared (in a [shapes graph](#dfn-shapes-graph)), its parameters can be used as illustrated in the following example.

ex:LanguageExampleShape
	a sh:NodeShape ;
	sh:targetClass ex:Country ;
	sh:property \[
		sh:path ex:germanLabel ;
		ex:lang "de" ;
	\] ;
	sh:property \[
		sh:path ex:englishLabel ;
		ex:lang "en" ;
	\] .

The example shape above specifies the condition that all values of `ex:germanLabel` carry the language tag `de` while all values of `ex:englishLabel` have `en` as their language. These details are specified via two property shapes that have values for the `ex:lang` parameter required by the constraint component.

##### 6.2.3.2 ASK-based Validators

Many constraint components are of the form in which all [value nodes](#dfn-value-nodes) are tested individually against some boolean condition. Writing SELECT queries for these becomes burdensome, especially if a constraint component can be used for both [property shapes](#dfn-property-shape) and [node shapes](#dfn-node-shape). SHACL-SPARQL provides an alternative, more compact syntax for validators based on ASK queries.

[Validators](#dfn-validators) with [SHACL type](#dfn-shacl-types) `sh:SPARQLAskValidator` are called ASK-based validators. The values of `sh:validator` must be [ASK-based validators](#dfn-ask-based-validators). [ASK-based validators](#dfn-ask-based-validators) have exactly one value for the property `sh:ask`. The value of `sh:ask` must be a literal with datatype `xsd:string`. The value of `sh:ask` must be a valid SPARQL ASK query using the aforementioned [prefix handling rules](#sparql-prefixes).

_The remainder of this section is informative._

The ASK queries return `true` if and only if a given [value node](#dfn-value-nodes) (represented by the pre-bound variable `value`) conforms to the constraint.

The following example declares a constraint component using an ASK query.

ex:LanguageConstraintComponentUsingASK
	a sh:ConstraintComponent ;
	rdfs:label "Language constraint component" ;
	sh:parameter \[
		sh:path ex:lang ;
		sh:datatype xsd:string ;
		sh:minLength 2 ;
		sh:name "language" ;
		sh:description "The language tag, e.g. \\"de\\"." ;
	\] ;
	sh:labelTemplate "Values are literals with language \\"{$lang}\\"" ;
	sh:validator ex:hasLang .
	
ex:hasLang
	a sh:SPARQLAskValidator ;
	sh:message "Values are literals with language \\"{$lang}\\"" ;
	sh:ask """
		ASK {
			FILTER (isLiteral($value) && langMatches(lang($value), $lang))
		}
		""" .

Note that the validation condition implemented by an ASK query is "in the inverse direction" from its SELECT counterpart: ASK queries return `true` for value nodes that conform to the constraint, while SELECT queries return those value nodes that do not conform.

### 6.3 Validation with SPARQL-based Constraint Components

This section defines the [validator](#dfn-validators) of [SPARQL-based constraint components](#dfn-sparql-based-constraint-component). Note that this validator only explains one possible implementation strategy, and SHACL processors may choose alternative approaches as long as the outcome is equivalent.

As the first step, a [validator](#dfn-validators) _MUST_ be selected based on the rules outlined in [6.2.3 Validators](#constraint-components-validators). Then the following rules apply, producing a set of [solutions](#dfn-solution) of SPARQL queries:

-   For [ASK-based validators](#dfn-ask-based-validators): For each [value node](#dfn-value-nodes) `v` where the SPARQL ASK query returns `false` with `v` [pre-bound](#dfn-pre-binding-of-variables) to the variable `value`, create one [solution](#dfn-solution) consisting of the bindings (`$this`, [focus node](#dfn-focus-node)) and (`$value`, `v`). Let `QS` be a list of these [solutions](#dfn-solution).
-   For [SELECT-based validators](#dfn-select-based-validators): If the [shape](#dfn-shape) is a [property shape](#dfn-property-shape), then prior to execution [substitute](#dfn-substitute) the variable `PATH` where it appears in the [predicate](#dfn-predicate) position of a [triple pattern](https://www.w3.org/TR/sparql11-query/#QSynTriples) with a valid SPARQL surface syntax string of the [SHACL property path](#dfn-shacl-property-path) specified via `sh:path` at the [property shape](#dfn-property-shape). Let `QS` be the [solutions](#dfn-solution) produced by executing the SPARQL query.

The SPARQL query executions above _MUST_ [pre-bind](#dfn-pre-binding-of-variables) the variables `this` and, if supported, `shapesGraph` and `currentShape` as described in [5.3.1 Pre-bound Variables in SPARQL Constraints ($this, $shapesGraph, $currentShape)](#sparql-constraints-prebound). In addition, each [value](#dfn-value) of a [parameter](#dfn-parameters) of the [constraint component](#dfn-constraint-component) in the [constraint](#dfn-constraint) _MUST_ be [pre-bound](#dfn-pre-binding-of-variables) as a variable that has the [parameter name](#dfn-parameter-name) as its name.

The production rules for the validation results are identical to those for [SPARQL-based constraints](#sparql-constraints-validation-rule), using the [solutions](#dfn-solution) `QS` as produced above.

# Appendix

## A. Pre-binding of Variables in SPARQL Queries

Some features of SHACL-SPARQL rely on the concept of [pre-binding of variables](#dfn-pre-binding-of-variables) as defined in this section.

The definition of pre-binding used by SHACL requires the following restrictions on SPARQL queries. SHACL-SPARQL processors _MUST_ report a [failure](#dfn-failure) when it is operating on a [shapes graph](#dfn-shapes-graph) that contains SHACL-SPARQL queries (via `sh:select` and `sh:ask`) that violate any of these restrictions. Note that the term _potentially pre-bound variables_ includes the variables `this`, `shapesGraph`, `currentShape`, `value` (for ASK queries), and any variables that represent the [parameters](#dfn-parameters) of the [constraint component](#dfn-constraint-component) that uses the query.

-   SPARQL queries must not contain a `MINUS` clause
-   SPARQL queries must not contain a federated query (`SERVICE`)
-   SPARQL queries must not contain a `VALUES` clause
-   SPARQL queries must not use the syntax form ​​`AS ?var` for any potentially pre-bound variable
-   [Subqueries](https://www.w3.org/TR/sparql11-query/#subqueries) must return all potentially pre-bound variables, except `shapesGraph` and `currentShape` which are optional as already mentioned in [5.3.1 Pre-bound Variables in SPARQL Constraints ($this, $shapesGraph, $currentShape)](#sparql-constraints-prebound)

DEFINITION: Values Insertion

For solution mapping `μ`, define `Table(μ)` to be the multiset formed from `μ`.

   `Table(μ) = { μ }`  
    `Card[μ] = 1`

Define the _Values Insertion_ function `Replace(X, μ)` to replace each occurence `Y` of a [Basic Graph Pattern](https://www.w3.org/TR/sparql11-query/#sparqlTranslateBasicGraphPatterns), [Property Path Expression](https://www.w3.org/TR/sparql11-query/#sparqlTranslatePathExpressions), [`Graph(Var, pattern)`](https://www.w3.org/TR/sparql11-query/#sparqlTranslateGraphPatterns) in `X` with `join(Y, Table(μ))`.

DEFINITION: Pre-binding of variables

The evaluation of the [SPARQL Query](https://www.w3.org/TR/sparql11-query/#idp2427544) `Q = (E, DS, QF)` with _pre-bound_ variables `μ` is defined as the evaluation of SPARQL query `Q' = (Replace(E, μ), DS, QF)`.

## B. Summary of SHACL Syntax Rules

This section enumerates all normative syntax rules of SHACL. This section is automatically generated from other parts of this spec and hyperlinks are provided back into the prose if the context of the rule in unclear. Nodes that violate these rules in a [shapes graph](#dfn-shapes-graph) are [ill-formed](#dfn-ill-formed).

| Syntax Rule Id | Syntax Rule Text |
| --- | --- |
| [SHACL-list](#syntax-rule-SHACL-list) | A [SHACL list](#dfn-shacl-list) in an RDF graph `G` is an [IRI](#dfn-iri) or a [blank node](#dfn-blank-node) that is either `rdf:nil` (provided that `rdf:nil` has no [value](#dfn-value) for either `rdf:first` or `rdf:rest`), or has exactly one [value](#dfn-value) for the property `rdf:first` in `G` and exactly one [value](#dfn-value) for the property `rdf:rest` in `G` that is also a SHACL list in `G`, and the list does not have itself as a value of the property path `rdf:rest+` in `G`. |
| [entailment-nodeKind](#syntax-rule-entailment-nodeKind) | The [values](#dfn-value) of the property `sh:entailment` are IRIs. |
| [shape](#syntax-rule-shape) | A [shape](#dfn-shape) is an [IRI](#dfn-iri) or [blank node](#dfn-blank-node) `s` that fulfills at least one of the following conditions in the [shapes graph](#dfn-shapes-graph):
-   `s` is a [SHACL instance](#dfn-shacl-instance) of `sh:NodeShape` or `sh:PropertyShape`.
-   `s` is [subject](#dfn-subject) of a triple that has `sh:targetClass`, `sh:targetNode`, `sh:targetObjectsOf` or `sh:targetSubjectsOf` as [predicate](#dfn-predicate).
-   `s` is [subject](#dfn-subject) of a triple that has a [parameter](#dfn-parameters) as [predicate](#dfn-predicate).
-   `s` is a [value](#dfn-value) of a [shape-expecting](#dfn-shape-expecting-constraint-parameters), non- [list-taking](#dfn-list-taking-constraint-parameters) [parameter](#dfn-parameters) such as `sh:node`, or a [member](#dfn-members) of a [SHACL list](#dfn-shacl-list) that is a [value](#dfn-value) of a [shape-expecting](#dfn-shape-expecting-constraint-parameters) and [list-taking](#dfn-list-taking-constraint-parameters) parameter such as `sh:or`.

 |
| [multiple-parameters](#syntax-rule-multiple-parameters) | Some constraint components such as [`sh:PatternConstraintComponent`](#PatternConstraintComponent) declare more than one parameter. Shapes that have more than one value for any of the parameters of such components are [ill-formed](#dfn-ill-formed). |
| [targetNode-nodeKind](#syntax-rule-targetNode-nodeKind) | Each [value](#dfn-value) of `sh:targetNode` in a shape is either an [IRI](#dfn-iri) or a [literal](#dfn-literal). |
| [targetClass-nodeKind](#syntax-rule-targetClass-nodeKind) | Each value of `sh:targetClass` in a shape is an [IRI](#dfn-iri). |
| [implicit-targetClass-nodeKind](#syntax-rule-implicit-targetClass-nodeKind) | If `s` is a [SHACL instance](#dfn-shacl-instance) of `sh:NodeShape` or `sh:PropertyShape` in an RDF graph `G` and `s` is also a [SHACL instance](#dfn-shacl-instance) of `rdfs:Class` in `G` and `s` is not an [IRI](#dfn-iri) then `s` is an [ill-formed](#dfn-ill-formed) shape in `G`. |
| [targetSubjectsOf-nodeKind](#syntax-rule-targetSubjectsOf-nodeKind) | The [values](#dfn-value) of `sh:targetSubjectsOf` in a shape are [IRIs](#dfn-iri). |
| [targetObjectsOf-nodeKind](#syntax-rule-targetObjectsOf-nodeKind) | The [values](#dfn-value) of `sh:targetObjectsOf` in a shape are [IRIs](#dfn-iri). |
| [severity-maxCount](#syntax-rule-severity-maxCount) | Shapes can specify one [value](#dfn-value) for the property `sh:severity` in the [shapes graph](#dfn-shapes-graph). |
| [severity-nodeKind](#syntax-rule-severity-nodeKind) | Each value of `sh:severity` in a shape is an [IRI](#dfn-iri). |
| [message-datatype](#syntax-rule-message-datatype) | The values of `sh:message` in a shape are either `xsd:string` literals or literals with a language tag. |
| [deactivated-maxCount](#syntax-rule-deactivated-maxCount) | Shapes can have at most one value for the property `sh:deactivated`. |
| [deactivated-datatype](#syntax-rule-deactivated-datatype) | The value of `sh:deactivated` in a shape must be either `true` or `false`. |
| [NodeShape-path-maxCount](#syntax-rule-NodeShape-path-maxCount) | [SHACL instances](#dfn-shacl-instance) of `sh:NodeShape` cannot have a [value](#dfn-value) for the property `sh:path`. |
| [PropertyShape](#syntax-rule-PropertyShape) | A [property shape](#dfn-property-shape) is a [shape](#dfn-shape) in the [shapes graph](#dfn-shapes-graph) that is the [subject](#dfn-subject) of a [triple](#dfn-rdf-triple) that has `sh:path` as its [predicate](#dfn-predicate). |
| [path-maxCount](#syntax-rule-path-maxCount) | A shape has at most one [value](#dfn-value) for `sh:path`. |
| [path-node](#syntax-rule-path-node) | Each [value](#dfn-value) of `sh:path` in a shape must be a [well-formed](#dfn-well-formed) [SHACL property path](#dfn-shacl-property-path). |
| [PropertyShape-path-minCount](#syntax-rule-PropertyShape-path-minCount) | [SHACL instances](#dfn-shacl-instance) of `sh:PropertyShape` have one [value](#dfn-value) for the property `sh:path`. |
| [path-metarule](#syntax-rule-path-metarule) | A node in an RDF graph is a [well-formed](#dfn-well-formed) [SHACL property path](#dfn-shacl-property-path) `p` if it satisfies exactly one of the syntax rules in the following sub-sections. |
| [path-non-recursive](#syntax-rule-path-non-recursive) | A node `p` is not a [well-formed](#dfn-well-formed) SHACL property path if `p` is a blank node and any path mappings of `p` directly or transitively reference `p`. |
| [path-sequence](#syntax-rule-path-sequence) | A [sequence path](#dfn-sequence-path) is a [blank node](#dfn-blank-node) that is a [SHACL list](#dfn-shacl-list) with at least two [members](#dfn-members) and each member is a [well-formed](#dfn-well-formed) SHACL property path. |
| [path-alternative](#syntax-rule-path-alternative) | An [alternative path](#dfn-alternative-path) is a [blank node](#dfn-blank-node) that is the subject of exactly one triple in `G`. This triple has `sh:alternativePath` as predicate, `L` as object, and `L` is a [SHACL list](#dfn-shacl-list) with at least two [members](#dfn-members) and each member of `L` is a [well-formed](#dfn-well-formed) SHACL property path. |
| [path-inverse](#syntax-rule-path-inverse) | An [inverse path](#dfn-inverse-path) is a [blank node](#dfn-blank-node) that is the [subject](#dfn-subject) of exactly one [triple](#dfn-rdf-triple) in `G`. This triple has `sh:inversePath` as predicate, and the [object](#dfn-object) `v` is a [well-formed](#dfn-well-formed) SHACL property path. |
| [path-zero-or-more](#syntax-rule-path-zero-or-more) | A [zero-or-more path](#dfn-zero-or-more-path) is a [blank node](#dfn-blank-node) that is the [subject](#dfn-subject) of exactly one [triple](#dfn-rdf-triple) in `G`. This triple has `sh:zeroOrMorePath` as [predicate](#dfn-predicate), and the [object](#dfn-object) `v` is a [well-formed](#dfn-well-formed) SHACL property path. |
| [path-one-or-more](#syntax-rule-path-one-or-more) | A [one-or-more path](#dfn-one-or-more-path) is a [blank node](#dfn-blank-node) that is the [subject](#dfn-subject) of exactly one [triple](#dfn-rdf-triple) in `G`. This triple has `sh:oneOrMorePath` as [predicate](#dfn-predicate), and the [object](#dfn-object) `v` is a [well-formed](#dfn-well-formed) SHACL property path. |
| [path-zero-or-one](#syntax-rule-path-zero-or-one) | A [zero-or-one path](#dfn-zero-or-one-path) is a [blank node](#dfn-blank-node) that is the [subject](#dfn-subject) of exactly one [triple](#dfn-rdf-triple) in `G`. This triple has `sh:zeroOrOnePath` as [predicate](#dfn-predicate), and the [object](#dfn-object) `v` is a [well-formed](#dfn-well-formed) SHACL property path. |
| [shapesGraph-nodeKind](#syntax-rule-shapesGraph-nodeKind) | Every [value](#dfn-value) of `sh:shapesGraph` is an [IRI](#dfn-iri) |
| [class-nodeKind](#syntax-rule-class-nodeKind) | The values of `sh:class` in a shape are IRIs. |
| [datatype-nodeKind](#syntax-rule-datatype-nodeKind) | The values of `sh:datatype` in a shape are [IRIs](#dfn-iri). |
| [datatype-maxCount](#syntax-rule-datatype-maxCount) | A shape has at most one value for `sh:datatype`. |
| [nodeKind-in](#syntax-rule-nodeKind-in) | The values of `sh:nodeKind` in a shape are one of the following six instances of the class `sh:NodeKind`: `sh:BlankNode`, `sh:IRI`, `sh:Literal` `sh:BlankNodeOrIRI`, `sh:BlankNodeOrLiteral` and `sh:IRIOrLiteral`. |
| [nodeKind-maxCount](#syntax-rule-nodeKind-maxCount) | A shape has at most one value for `sh:nodeKind`. |
| [minCount-scope](#syntax-rule-minCount-scope) | [Node shapes](#dfn-node-shape) cannot have any value for `sh:minCount`. |
| [minCount-maxCount](#syntax-rule-minCount-maxCount) | A [property shape](#dfn-property-shape) has at most one value for `sh:minCount`. |
| [minCount-datatype](#syntax-rule-minCount-datatype) | The values of `sh:minCount` in a property shape are literals with datatype `xsd:integer`. |
| [maxCount-scope](#syntax-rule-maxCount-scope) | [Node shapes](#dfn-node-shape) cannot have any value for `sh:maxCount`. |
| [maxCount-maxCount](#syntax-rule-maxCount-maxCount) | A [property shape](#dfn-property-shape) has at most one value for `sh:maxCount`. |
| [maxCount-datatype](#syntax-rule-maxCount-datatype) | The values of `sh:maxCount` in a property shape are literals with datatype `xsd:integer`. |
| [minExclusive-nodeKind](#syntax-rule-minExclusive-nodeKind) | The values of `sh:minExclusive` in a shape are [literals](#dfn-literal). |
| [minExclusive-maxCount](#syntax-rule-minExclusive-maxCount) | A shape has at most one value for `sh:minExclusive`. |
| [minInclusive-nodeKind](#syntax-rule-minInclusive-nodeKind) | The values of `sh:minInclusive` in a shape are [literals](#dfn-literal). |
| [minInclusive-maxCount](#syntax-rule-minInclusive-maxCount) | A shape has at most one value for `sh:minInclusive`. |
| [maxExclusive-nodeKind](#syntax-rule-maxExclusive-nodeKind) | The values of `sh:maxExclusive` in a shape are [literals](#dfn-literal). |
| [maxExclusive-maxCount](#syntax-rule-maxExclusive-maxCount) | A shape has at most one value for `sh:maxExclusive`. |
| [maxInclusive-nodeKind](#syntax-rule-maxInclusive-nodeKind) | The values of `sh:maxInclusive` in a shape are [literals](#dfn-literal). |
| [maxInclusive-maxCount](#syntax-rule-maxInclusive-maxCount) | A shape has at most one value for `sh:maxInclusive`. |
| [minLength-datatype](#syntax-rule-minLength-datatype) | The values of `sh:minLength` in a shape are literals with datatype `xsd:integer`. |
| [minLength-maxCount](#syntax-rule-minLength-maxCount) | A shape has at most one value for `sh:minLength`. |
| [maxLength-datatype](#syntax-rule-maxLength-datatype) | The values of `sh:maxLength` in a shape are literals with datatype `xsd:integer`. |
| [maxLength-maxCount](#syntax-rule-maxLength-maxCount) | A shape has at most one value for `sh:maxLength`. |
| [pattern-datatype](#syntax-rule-pattern-datatype) | The values of `sh:pattern` in a shape are literals with datatype `xsd:string`. |
| [pattern-regex](#syntax-rule-pattern-regex) | The values of `sh:pattern` in a shape are valid pattern arguments for the [SPARQL REGEX function](https://www.w3.org/TR/sparql11-query/#func-regex). |
| [flags-datatype](#syntax-rule-flags-datatype) | The values of `sh:flags` in a shape are literals with datatype `xsd:string`. |
| [languageIn-node](#syntax-rule-languageIn-node) | Each value of `sh:languageIn` in a shape is a [SHACL list](#dfn-shacl-list). |
| [languageIn-members-datatype](#syntax-rule-languageIn-members-datatype) | Each [member](#dfn-members) of such a list is a literal with datatype `xsd:string`. |
| [languageIn-maxCount](#syntax-rule-languageIn-maxCount) | A shape has at most one value for `sh:languageIn`. |
| [uniqueLang-datatype](#syntax-rule-uniqueLang-datatype) | The values of `sh:uniqueLang` in a shape are literals with datatype `xsd:boolean`. |
| [uniqueLang-maxCount](#syntax-rule-uniqueLang-maxCount) | A property shape has at most one value for `sh:uniqueLang`. |
| [uniqueLang-scope](#syntax-rule-uniqueLang-scope) | [Node shapes](#dfn-node-shape) cannot have any value for `sh:uniqueLang`. |
| [equals-nodeKind](#syntax-rule-equals-nodeKind) | The values of `sh:equals` in a shape are [IRIs](#dfn-iri). |
| [disjoint-nodeKind](#syntax-rule-disjoint-nodeKind) | The values of `sh:disjoint` in a shape are [IRIs](#dfn-iri). |
| [lessThan-nodeKind](#syntax-rule-lessThan-nodeKind) | The values of `sh:lessThan` in a shape are [IRIs](#dfn-iri). |
| [lessThan-scope](#syntax-rule-lessThan-scope) | [Node shapes](#dfn-node-shape) cannot have any value for `sh:lessThan`. |
| [lessThanOrEquals-nodeKind](#syntax-rule-lessThanOrEquals-nodeKind) | The values of `sh:lessThanOrEquals` in a shape are [IRIs](#dfn-iri). |
| [lessThanOrEquals-scope](#syntax-rule-lessThanOrEquals-scope) | [Node shapes](#dfn-node-shape) cannot have any value for `sh:lessThanOrEquals`. |
| [not-node](#syntax-rule-not-node) | The values of `sh:not` in a shape must be [well-formed](#dfn-well-formed) [shapes](#dfn-shape). |
| [and-node](#syntax-rule-and-node) | Each value of `sh:and` in a shape is a [SHACL list](#dfn-shacl-list). |
| [and-members-node](#syntax-rule-and-members-node) | Each [member](#dfn-members) of such list must be a [well-formed](#dfn-well-formed) [shape](#dfn-shape). |
| [or-node](#syntax-rule-or-node) | Each value of `sh:or` in a shape is a [SHACL list](#dfn-shacl-list). |
| [or-members-node](#syntax-rule-or-members-node) | Each [member](#dfn-members) of such list must be a [well-formed](#dfn-well-formed) [shape](#dfn-shape). |
| [xone-node](#syntax-rule-xone-node) | Each value of `sh:xone` in a shape is a [SHACL list](#dfn-shacl-list). |
| [xone-members-node](#syntax-rule-xone-members-node) | Each [member](#dfn-members) of such list must be a [well-formed](#dfn-well-formed) [shape](#dfn-shape). |
| [node-node](#syntax-rule-node-node) | The values of `sh:node` in a shape must be [well-formed](#dfn-well-formed) [node shapes](#dfn-node-shape). |
| [property-node](#syntax-rule-property-node) | Each value of `sh:property` in a shape must be a [well-formed](#dfn-well-formed) [property shape](#dfn-property-shape). |
| [qualifiedValueShape-node](#syntax-rule-qualifiedValueShape-node) | The values of `sh:qualifiedValueShape` in a shape must be [well-formed](#dfn-well-formed) [shapes](#dfn-shape). |
| [qualifiedValueShape-scope](#syntax-rule-qualifiedValueShape-scope) | [Node shapes](#dfn-node-shape) cannot have any value for `sh:qualifiedValueShape`. |
| [qualifiedValueShapesDisjoint-datatype](#syntax-rule-qualifiedValueShapesDisjoint-datatype) | The values of `sh:qualifiedValueShapesDisjoint` in a shape are literals with datatype `xsd:boolean`. |
| [qualifiedMinCount-datatype](#syntax-rule-qualifiedMinCount-datatype) | The values of `sh:qualifiedMinCount` in a shape are literals with datatype `xsd:integer`. |
| [qualifiedMaxCount-datatype](#syntax-rule-qualifiedMaxCount-datatype) | The values of `sh:qualifiedMaxCount` in a shape are literals with datatype `xsd:integer`. |
| [closed-datatype](#syntax-rule-closed-datatype) | The values of `sh:closed` in a shape are literals with datatype `xsd:boolean`. |
| [ignoredProperties-node](#syntax-rule-ignoredProperties-node) | The values of `sh:ignoredProperties` in a shape must be [SHACL lists](#dfn-shacl-list). |
| [ignoredProperties-members-nodeKind](#syntax-rule-ignoredProperties-members-nodeKind) | Each [member](#dfn-members) of such a list must be a [IRI](#dfn-iri). |
| [in-node](#syntax-rule-in-node) | Each value of `sh:in` in a shape is a [SHACL list](#dfn-shacl-list). |
| [in-maxCount](#syntax-rule-in-maxCount) | A shape has at most one value for `sh:in`. |
| [sparql-nodeKind](#syntax-rule-sparql-nodeKind) | Shapes may have values for the property `sh:sparql`, and these values are either [IRIs](#dfn-iri) or [blank nodes](#dfn-blank-node). |
| [SPARQLConstraint-select-count](#syntax-rule-SPARQLConstraint-select-count) | [SPARQL-based constraints](#dfn-sparql-based-constraints) have exactly one [value](#dfn-value) for the property `sh:select` |
| [SPARQLConstraint-select-datatype](#syntax-rule-SPARQLConstraint-select-datatype) | The value of `sh:select` is a [literal](#dfn-literal) of datatype `xsd:string`. |
| [select-query-valid](#syntax-rule-select-query-valid) | Using the [prefix handling rules](#sparql-prefixes), the value of `sh:select` is a valid SPARQL 1.1 SELECT query. |
| [select-query-this](#syntax-rule-select-query-this) | The SPARQL query derived from the value of `sh:select` [projects](https://www.w3.org/TR/sparql11-query/#selectproject) the variable `this` in the SELECT clause. |
| [SPARQLConstraint-message-datatype](#syntax-rule-SPARQLConstraint-message-datatype) | [SPARQL-based constraints](#dfn-sparql-based-constraints) may have values for the property `sh:message` and these are either `xsd:string` literals or literals with a language tag. |
| [SPARQLConstraint-deactivated-maxCount](#syntax-rule-SPARQLConstraint-deactivated-maxCount) | [SPARQL-based constraints](#dfn-sparql-based-constraints) may have at most one value for the property `sh:deactivated` |
| [PATH-position](#syntax-rule-PATH-position) | The only legal use of the variable `PATH` in the SPARQL queries of [SPARQL-based constraints](#dfn-sparql-based-constraints) and [SELECT-based validators](#dfn-select-based-validators) is in the [predicate](#dfn-predicate) position of a [triple pattern](https://www.w3.org/TR/sparql11-query/#QSynTriples). |
| [declare-nodeKind](#syntax-rule-declare-nodeKind) | The [values](#dfn-value) of the property `sh:declare` are [IRIs](#dfn-iri) or [blank nodes](#dfn-blank-node) |
| [prefix-count](#syntax-rule-prefix-count) | [Prefix declarations](#dfn-prefix-declarations) have exactly one value for the property `sh:prefix` |
| [prefix-datatype](#syntax-rule-prefix-datatype) | The values of `sh:prefix` are [literals](#dfn-literal) of datatype `xsd:string`. |
| [namespace-count](#syntax-rule-namespace-count) | [Prefix declarations](#dfn-prefix-declarations) have exactly one value for the property `sh:namespace`. |
| [namespace-datatype](#syntax-rule-namespace-datatype) | The values of `sh:namespace` are [literals](#dfn-literal) of datatype `xsd:anyURI`. |
| [prefixes-nodeKind](#syntax-rule-prefixes-nodeKind) | The values of `sh:prefixes` are either [IRIs](#dfn-iri) or [blank nodes](#dfn-blank-node). |
| [prefixes-duplicates](#syntax-rule-prefixes-duplicates) | A SHACL processor collects a set of prefix mappings as the union of all individual prefix mappings that are [values](#dfn-value) of the [SPARQL property path](#dfn-sparql-property-paths) `sh:prefixes/owl:imports*/sh:declare` of the [SPARQL-based constraint](#dfn-sparql-based-constraints) or [validator](#dfn-validators). If such a collection of prefix declarations contains multiple namespaces for the same [value](#dfn-value) of `sh:prefix`, then the [shapes graph](#dfn-shapes-graph) is [ill-formed](#dfn-ill-formed). |
| [ConstraintComponent](#syntax-rule-ConstraintComponent) | A [SPARQL-based constraint component](#dfn-sparql-based-constraint-component) is an [IRI](#dfn-iri) that has [SHACL type](#dfn-shacl-types) `sh:ConstraintComponent` in the [shapes graph](#dfn-shapes-graph). |
| [Parameter-predicate-count](#syntax-rule-Parameter-predicate-count) | Each [parameter declaration](#dfn-parameter-declarations) has exactly one value for the property `sh:path` |
| [Parameter](#syntax-rule-Parameter) | At [parameter declarations](#dfn-parameter-declarations), the [value](#dfn-value) of `sh:path` is an [IRI](#dfn-iri). |
| [parameter-name-VARNAME](#syntax-rule-parameter-name-VARNAME) | Every [parameter name](#dfn-parameter-name) is a valid [SPARQL VARNAME](https://www.w3.org/TR/sparql11-query/#rVARNAME). |
| [parameter-name-not-in](#syntax-rule-parameter-name-not-in) | [Parameter names](#dfn-parameter-name) must not be one of the following: `this`, `shapesGraph`, `currentShape`, `path`, `PATH`, `value`. |
| [parameter-name-unique](#syntax-rule-parameter-name-unique) | A constraint component where two or more [parameter declarations](#dfn-parameter-declarations) use the same [parameter names](#dfn-parameter-name) is [ill-formed](#dfn-ill-formed). |
| [optional-datatype](#syntax-rule-optional-datatype) | The values of `sh:optional` must be literals with datatype `xsd:boolean`. |
| [optional-maxCount](#syntax-rule-optional-maxCount) | A [parameter declaration](#dfn-parameter-declarations) can have at most one value for the property `sh:optional`. |
| [ConstraintComponent-parameter](#syntax-rule-ConstraintComponent-parameter) | Every [constraint component](#dfn-constraint-component) has at least one non-optional parameter. |
| [Parameter-conformance](#syntax-rule-Parameter-conformance) | Shapes that do not [conform](#dfn-conforms) with the constraints declared for the parameters are [ill-formed](#dfn-ill-formed). |
| [labelTemplate-datatype](#syntax-rule-labelTemplate-datatype) | The values of `sh:labelTemplate` are strings (possibly with language tag) |
| [nodeValidator-class](#syntax-rule-nodeValidator-class) | The values of `sh:nodeValidator` must be [SELECT-based validators](#dfn-select-based-validators). |
| [propertyValidator-class](#syntax-rule-propertyValidator-class) | The values of `sh:propertyValidator` must be [SELECT-based validators](#dfn-select-based-validators). |
| [SPARQLSelectValidator-select-count](#syntax-rule-SPARQLSelectValidator-select-count) | [SELECT-based validators](#dfn-select-based-validators) have exactly one [value](#dfn-value) for the property `sh:select`. |
| [validator-class](#syntax-rule-validator-class) | The values of `sh:validator` must be [ASK-based validators](#dfn-ask-based-validators). |
| [ask-count](#syntax-rule-ask-count) | [ASK-based validators](#dfn-ask-based-validators) have exactly one value for the property `sh:ask` |
| [ask-datatype](#syntax-rule-ask-datatype) | The value of `sh:ask` must be a literal with datatype `xsd:string`. |
| [ask-sparql](#syntax-rule-ask-sparql) | The value of `sh:ask` must be a valid SPARQL ASK query using the aforementioned [prefix handling rules](#sparql-prefixes). |
| [pre-binding-limitations](#syntax-rule-pre-binding-limitations) | 

The definition of pre-binding used by SHACL requires the following restrictions on SPARQL queries. SHACL-SPARQL processors _MUST_ report a [failure](#dfn-failure) when it is operating on a [shapes graph](#dfn-shapes-graph) that contains SHACL-SPARQL queries (via `sh:select` and `sh:ask`) that violate any of these restrictions. Note that the term _potentially pre-bound variables_ includes the variables `this`, `shapesGraph`, `currentShape`, `value` (for ASK queries), and any variables that represent the [parameters](#dfn-parameters) of the [constraint component](#dfn-constraint-component) that uses the query.

-   SPARQL queries must not contain a `MINUS` clause
-   SPARQL queries must not contain a federated query (`SERVICE`)
-   SPARQL queries must not contain a `VALUES` clause
-   SPARQL queries must not use the syntax form ​​`AS ?var` for any potentially pre-bound variable
-   [Subqueries](https://www.w3.org/TR/sparql11-query/#subqueries) must return all potentially pre-bound variables, except `shapesGraph` and `currentShape` which are optional as already mentioned in [5.3.1 Pre-bound Variables in SPARQL Constraints ($this, $shapesGraph, $currentShape)](#sparql-constraints-prebound)

 |

## C. SHACL Shapes to Validate Shapes Graphs

The following shapes graph is intended to enforce many of the syntactic constraints related to SHACL Core in this specification. As such, it can be understood as a machine-readable version of a subset of those constraints, and should be understood as normative. If differences are found between the constraints expressed here and elsewhere in this specification, that indicates an error in the following shapes graph. Please see the [Errata Page](https://www.w3.org/2017/shacl/errata) for an enumeration and analysis of possible errors that have been reported. This shapes graph is available at [http://www.w3.org/ns/shacl-shacl](https://www.w3.org/ns/shacl-shacl). That version may be more up-to-date than this specification as errata are noted against this specification.

@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

@prefix shsh: <http://www.w3.org/ns/shacl-shacl#> .

shsh:
	rdfs:label "SHACL for SHACL"@en ;
	rdfs:comment "This shapes graph can be used to validate SHACL shapes graphs against a subset of the SHACL syntax rules."@en ;
	sh:declare \[
		sh:prefix "shsh" ;
		sh:namespace "http://www.w3.org/ns/shacl-shacl#" ;
	\] .

	
shsh:ListShape
	a sh:NodeShape ;
	rdfs:label "List shape"@en ;
	rdfs:comment "A shape describing well-formed RDF lists. Currently does not check for non-recursion. This could be expressed using SHACL-SPARQL."@en ;
	rdfs:seeAlso <https://www.w3.org/TR/shacl/#syntax-rule-SHACL-list> ;
	sh:property \[
		sh:path \[ sh:zeroOrMorePath rdf:rest \] ;
		rdfs:comment "Each list member (including this node) must be have the shape shsh:ListNodeShape."@en ;
		sh:hasValue rdf:nil ;
		sh:node shsh:ListNodeShape ;
	\] .

shsh:ListNodeShape
	a sh:NodeShape ;
	rdfs:label "List node shape"@en ;
	rdfs:comment "Defines constraints on what it means for a node to be a node within a well-formed RDF list. Note that this does not check whether the rdf:rest items are also well-formed lists as this would lead to unsupported recursion."@en ;
	sh:or ( \[
				sh:hasValue rdf:nil ;
        		sh:property \[
					sh:path rdf:first ;
					sh:maxCount 0 ;
				\] ;
				sh:property \[
					sh:path rdf:rest ;
					sh:maxCount 0 ;
				\] ;
			\]
			\[
				sh:not \[ sh:hasValue rdf:nil \] ;
				sh:property \[
					sh:path rdf:first ;
					sh:maxCount 1 ;
					sh:minCount 1 ;
				\] ;
				sh:property \[
					sh:path rdf:rest ;
					sh:maxCount 1 ;
					sh:minCount 1 ;
				\] ;
			\] ) .

shsh:ShapeShape
	a sh:NodeShape ;
	rdfs:label "Shape shape"@en ;
	rdfs:comment "A shape that can be used to validate syntax rules for other shapes."@en ;
	
	# See https://www.w3.org/TR/shacl/#shapes for what counts as a shape
	sh:targetClass sh:NodeShape ;
	sh:targetClass sh:PropertyShape ;
	sh:targetSubjectsOf sh:targetClass, sh:targetNode, sh:targetObjectsOf, sh:targetSubjectsOf ;
	sh:targetSubjectsOf sh:and, sh:class, sh:closed, sh:datatype, sh:disjoint, sh:equals, sh:flags, sh:hasValue,
		sh:ignoredProperties, sh:in, sh:languageIn, sh:lessThan, sh:lessThanOrEquals, sh:maxCount, sh:maxExclusive,
		sh:maxInclusive, sh:maxLength, sh:minCount, sh:minExclusive, sh:minInclusive, sh:minLength, sh:node, sh:nodeKind,
		sh:not, sh:or, sh:pattern, sh:property, sh:qualifiedMaxCount, sh:qualifiedMinCount, sh:qualifiedValueShape,
		sh:qualifiedValueShape, sh:qualifiedValueShapesDisjoint, sh:qualifiedValueShapesDisjoint, sh:uniqueLang, sh:xone ;

	sh:targetObjectsOf sh:node ;        [\# node-node](#syntax-rule-node-node)
	sh:targetObjectsOf sh:not ;         [\# not-node](#syntax-rule-not-node)
	sh:targetObjectsOf sh:property ;    [\# property-node](#syntax-rule-property-node)
	sh:targetObjectsOf sh:qualifiedValueShape ; [\# qualifiedValueShape-node](#syntax-rule-qualifiedValueShape-node)

	# Shapes are either node shapes or property shapes
	sh:xone ( shsh:NodeShapeShape shsh:PropertyShapeShape ) ;

	sh:property \[
		sh:path sh:targetNode ;
		sh:nodeKind	sh:IRIOrLiteral ;   [\# targetNode-nodeKind](#syntax-rule-targetNode-nodeKind)
	\] ; 
	sh:property \[
		sh:path sh:targetClass ;
		sh:nodeKind sh:IRI ;            [\# targetClass-nodeKind](#syntax-rule-targetClass-nodeKind)
	\] ;
	sh:property \[
		sh:path sh:targetSubjectsOf ;
		sh:nodeKind sh:IRI ;            [\# targetSubjectsOf-nodeKind](#syntax-rule-targetSubjectsOf-nodeKind)
	\] ;
	sh:property \[
		sh:path sh:targetObjectsOf ;
		sh:nodeKind sh:IRI ;            [\# targetObjectsOf-nodeKind](#syntax-rule-targetObjectsOf-nodeKind)
	\] ;
	sh:or ( \[ sh:not \[ 
				sh:class rdfs:Class ; 
				sh:or ( \[ sh:class sh:NodeShape \] \[ sh:class sh:PropertyShape \] )
			\] \]
			\[ sh:nodeKind sh:IRI \]
		  ) ;                           [\# implicit-targetClass-nodeKind](#syntax-rule-implicit-targetClass-nodeKind)
	
	sh:property \[
		sh:path sh:severity ;
		sh:maxCount 1 ;                 [\# severity-maxCount](#syntax-rule-severity-maxCount)
		sh:nodeKind sh:IRI ;            [\# severity-nodeKind](#syntax-rule-severity-nodeKind)
	\] ;
	sh:property \[
		sh:path sh:message ;
		sh:or ( \[ sh:datatype xsd:string \] \[ sh:datatype rdf:langString \] ) ;   [\# message-datatype](#syntax-rule-message-datatype)
	\] ;
	sh:property \[
		sh:path sh:deactivated ;
		sh:maxCount 1 ;                 [\# deactivated-maxCount](#syntax-rule-deactivated-maxCount)
		sh:in ( true false ) ;          [\# deactivated-datatype](#syntax-rule-deactivated-datatype)
	\] ;

	sh:property \[
		sh:path sh:and ;
		sh:node shsh:ListShape ;        [\# and-node](#syntax-rule-and-node)
	\] ;
	sh:property \[
		sh:path sh:class ;
		sh:nodeKind sh:IRI ;            [\# class-nodeKind](#syntax-rule-class-nodeKind)
	\] ;
	sh:property \[
		sh:path sh:closed ;
		sh:datatype xsd:boolean ;       [\# closed-datatype](#syntax-rule-closed-datatype)
		sh:maxCount 1 ;                 [\# multiple-parameters](#syntax-rule-multiple-parameters)
	\] ;
	sh:property \[
		sh:path sh:ignoredProperties ;
		sh:node shsh:ListShape ;        [\# ignoredProperties-node](#syntax-rule-ignoredProperties-node)
		sh:maxCount 1 ;                 [\# multiple-parameters](#syntax-rule-multiple-parameters)
	\] ;
	sh:property \[
		sh:path ( sh:ignoredProperties \[ sh:zeroOrMorePath rdf:rest \] rdf:first ) ;
		sh:nodeKind sh:IRI ;            [\# ignoredProperties-members-nodeKind](#syntax-rule-ignoredProperties-members-nodeKind)
	\] ;
	sh:property \[
		sh:path sh:datatype ;
		sh:nodeKind sh:IRI ;            [\# datatype-nodeKind](#syntax-rule-datatype-nodeKind)
		sh:maxCount 1 ;                 [\# datatype-maxCount](#syntax-rule-datatype-maxCount)
	\] ;
	sh:property \[
		sh:path sh:disjoint ;
		sh:nodeKind sh:IRI ;            [\# disjoint-nodeKind](#syntax-rule-disjoint-nodeKind)
	\] ;
	sh:property \[
		sh:path sh:equals ;
		sh:nodeKind sh:IRI ;            [\# equals-nodeKind](#syntax-rule-equals-nodeKind)
	\] ;
	sh:property \[
		sh:path sh:in ;
		sh:maxCount 1 ;                 [\# in-maxCount](#syntax-rule-in-maxCount)		
		sh:node shsh:ListShape ;        [\# in-node](#syntax-rule-in-node)
	\] ;
	sh:property \[
		sh:path sh:languageIn ;
		sh:maxCount 1 ;                 [\# languageIn-maxCount](#syntax-rule-languageIn-maxCount)
		sh:node shsh:ListShape ;        [\# languageIn-node](#syntax-rule-languageIn-node)
	\] ;
	sh:property \[
		sh:path ( sh:languageIn \[ sh:zeroOrMorePath rdf:rest \] rdf:first ) ;
		sh:datatype xsd:string ;        [\# languageIn-members-datatype](#syntax-rule-languageIn-members-datatype)
	\] ;
	sh:property \[
		sh:path sh:lessThan ;
		sh:nodeKind sh:IRI ;            [\# lessThan-nodeKind](#syntax-rule-lessThan-nodeKind)
	\] ;
	sh:property \[
		sh:path sh:lessThanOrEquals ;
		sh:nodeKind sh:IRI ;            [\# lessThanOrEquals-nodeKind](#syntax-rule-lessThanOrEquals-nodeKind)
	\] ;
	sh:property \[
		sh:path sh:maxCount ;
		sh:datatype xsd:integer ;       [\# maxCount-datatype](#syntax-rule-maxCount-datatype)
		sh:maxCount 1 ;                 [\# maxCount-maxCount](#syntax-rule-maxCount-maxCount)
	\] ;
	sh:property \[
		sh:path sh:maxExclusive ;
		sh:maxCount 1 ;                 [\# maxExclusive-maxCount](#syntax-rule-maxExclusive-maxCount)
		sh:nodeKind sh:Literal ;        [\# maxExclusive-nodeKind](#syntax-rule-maxExclusive-nodeKind)
	\] ;
	sh:property \[
		sh:path sh:maxInclusive ;
		sh:maxCount 1 ;                 [\# maxInclusive-maxCount](#syntax-rule-maxInclusive-maxCount)
		sh:nodeKind sh:Literal ;        [\# maxInclusive-nodeKind](#syntax-rule-maxInclusive-nodeKind)
	\] ;
	sh:property \[
		sh:path sh:maxLength ;
		sh:datatype xsd:integer ;       [\# maxLength-datatype](#syntax-rule-maxLength-datatype)
		sh:maxCount 1 ;                 [\# maxLength-maxCount](#syntax-rule-maxLength-maxCount)
	\] ;
	sh:property \[
		sh:path sh:minCount ;
		sh:datatype xsd:integer ;       [\# minCount-datatype](#syntax-rule-minCount-datatype)
		sh:maxCount 1 ;                 [\# minCount-maxCount](#syntax-rule-minCount-maxCount)
	\] ;
	sh:property \[
		sh:path sh:minExclusive ;
		sh:maxCount 1 ;                 [\# minExclusive-maxCount](#syntax-rule-minExclusive-maxCount)
		sh:nodeKind sh:Literal ;        [\# minExclusive-nodeKind](#syntax-rule-minExclusive-nodeKind)
	\] ;
	sh:property \[
		sh:path sh:minInclusive ;
		sh:maxCount 1 ;                 [\# minInclusive-maxCount](#syntax-rule-minInclusive-maxCount)
		sh:nodeKind sh:Literal ;        [\# minInclusive-nodeKind](#syntax-rule-minInclusive-nodeKind)
	\] ;
	sh:property \[
		sh:path sh:minLength ;
		sh:datatype xsd:integer ;       [\# minLength-datatype](#syntax-rule-minLength-datatype)
		sh:maxCount 1 ;                 [\# minLength-maxCount](#syntax-rule-minLength-maxCount)
	\] ;
	sh:property \[
		sh:path sh:nodeKind ;
		sh:in ( sh:BlankNode sh:IRI sh:Literal sh:BlankNodeOrIRI sh:BlankNodeOrLiteral sh:IRIOrLiteral ) ;	[\# nodeKind-in](#syntax-rule-nodeKind-in)
		sh:maxCount 1 ;                 [\# nodeKind-maxCount](#syntax-rule-nodeKind-maxCount)
	\] ;
	sh:property \[
		sh:path sh:or ;
		sh:node shsh:ListShape ;        [\# or-node](#syntax-rule-or-node)
	\] ;
	sh:property \[
		sh:path sh:pattern ;
		sh:datatype xsd:string ;        [\# pattern-datatype](#syntax-rule-pattern-datatype)
		sh:maxCount 1 ;                 [\# multiple-parameters](#syntax-rule-multiple-parameters)
		# Not implemented: syntax rule pattern-regex
	\] ;
	sh:property \[
		sh:path sh:flags ;
		sh:datatype xsd:string ;        [\# flags-datatype](#syntax-rule-flags-datatype)
		sh:maxCount 1 ;                 [\# multiple-parameters](#syntax-rule-multiple-parameters)
	\] ;
	sh:property \[
		sh:path sh:qualifiedMaxCount ;
		sh:datatype xsd:integer ;       [\# qualifiedMaxCount-datatype](#syntax-rule-qualifiedMaxCount-datatype)
		sh:maxCount 1 ;                 [\# multiple-parameters](#syntax-rule-multiple-parameters)
	\] ;
	sh:property \[
		sh:path sh:qualifiedMinCount ;
		sh:datatype xsd:integer ;       [\# qualifiedMinCount-datatype](#syntax-rule-qualifiedMinCount-datatype)
		sh:maxCount 1 ;                 [\# multiple-parameters](#syntax-rule-multiple-parameters)
	\] ;
	sh:property \[
		sh:path sh:qualifiedValueShape ;
		sh:maxCount 1 ;                 [\# multiple-parameters](#syntax-rule-multiple-parameters)
	\] ;
	sh:property \[
		sh:path sh:qualifiedValueShapesDisjoint ;
		sh:datatype xsd:boolean ;       [\# qualifiedValueShapesDisjoint-datatype](#syntax-rule-qualifiedValueShapesDisjoint-datatype)
		sh:maxCount 1 ;                 [\# multiple-parameters](#syntax-rule-multiple-parameters)
	\] ;
	sh:property \[
		sh:path sh:uniqueLang ;
		sh:datatype xsd:boolean ;       [\# uniqueLang-datatype](#syntax-rule-uniqueLang-datatype)
		sh:maxCount 1 ;                 [\# uniqueLang-maxCount](#syntax-rule-uniqueLang-maxCount)
	\] ;
	sh:property \[
		sh:path sh:xone ;
		sh:node shsh:ListShape ;        [\# xone-node](#syntax-rule-xone-node)
	\] .
	
shsh:NodeShapeShape
	a sh:NodeShape ;
	sh:targetObjectsOf sh:node ;        [\# node-node](#syntax-rule-node-node)
	sh:property \[
		sh:path sh:path ;
		sh:maxCount 0 ;                 [\# NodeShape-path-maxCount](#syntax-rule-NodeShape-path-maxCount)
	\] ;
	sh:property \[
		sh:path sh:lessThan ;
		sh:maxCount 0 ;                 [\# lessThan-scope](#syntax-rule-lessThan-scope)
	\] ;
	sh:property \[
		sh:path sh:lessThanOrEquals ;
		sh:maxCount 0 ;                 [\# lessThanOrEquals-scope](#syntax-rule-lessThanOrEquals-scope)
	\] ;
	sh:property \[
		sh:path sh:maxCount ;
		sh:maxCount 0 ;                 [\# maxCount-scope](#syntax-rule-maxCount-scope)
	\] ;
	sh:property \[
		sh:path sh:minCount ;
		sh:maxCount 0 ;                 [\# minCount-scope](#syntax-rule-minCount-scope)
	\] ;
	sh:property \[
		sh:path sh:qualifiedValueShape ;
		sh:maxCount 0 ;                 [\# qualifiedValueShape-scope](#syntax-rule-qualifiedValueShape-scope)
	\] ;
	sh:property \[
		sh:path sh:uniqueLang ;
		sh:maxCount 0 ;                 [\# uniqueLang-scope](#syntax-rule-uniqueLang-scope)
	\] .

shsh:PropertyShapeShape
	a sh:NodeShape ;
	sh:targetObjectsOf sh:property ;    [\# property-node](#syntax-rule-property-node)
	sh:property \[
		sh:path sh:path ;
		sh:maxCount 1 ;                 [\# path-maxCount](#syntax-rule-path-maxCount)
		sh:minCount 1 ;                 [\# PropertyShape](#syntax-rule-PropertyShape)\-path-minCount
		sh:node shsh:PathShape ;        [\# path-node](#syntax-rule-path-node)
	\] .

# Values of sh:and, sh:or and sh:xone must be lists of shapes
shsh:ShapesListShape
	a sh:NodeShape ;
	sh:targetObjectsOf sh:and ;         [\# and-members-node](#syntax-rule-and-members-node)
	sh:targetObjectsOf sh:or ;          [\# or-members-node](#syntax-rule-or-members-node)
	sh:targetObjectsOf sh:xone ;        [\# xone-members-node](#syntax-rule-xone-members-node)
	sh:property \[
		sh:path ( \[ sh:zeroOrMorePath rdf:rest \] rdf:first ) ;
		sh:node shsh:ShapeShape ;
	\] .


# A path of blank node path syntax, used to simulate recursion
\_:PathPath
	sh:alternativePath (
		( \[ sh:zeroOrMorePath rdf:rest \] rdf:first )
		( sh:alternativePath \[ sh:zeroOrMorePath rdf:rest \] rdf:first )
		sh:inversePath
		sh:zeroOrMorePath
		sh:oneOrMorePath
		sh:zeroOrOnePath 
	) .

shsh:PathShape
	a sh:NodeShape ;
	rdfs:label "Path shape"@en ;
	rdfs:comment "A shape that can be used to validate the syntax rules of well-formed SHACL paths."@en ;
	rdfs:seeAlso <https://www.w3.org/TR/shacl/#property-paths> ;
	sh:property \[
		sh:path \[ sh:zeroOrMorePath \_:PathPath \] ;
		sh:node shsh:PathNodeShape ;
	\] .

shsh:PathNodeShape
	sh:xone (                           [\# path-metarule](#syntax-rule-path-metarule)
			\[ sh:nodeKind sh:IRI \]          # 2.3.1.1: Predicate path
			\[ sh:nodeKind sh:BlankNode ;    # 2.3.1.2: Sequence path
			  sh:node shsh:PathListWithAtLeast2Members ;
			\]
			\[ sh:nodeKind sh:BlankNode ;    # 2.3.1.3: Alternative path
			  sh:closed true ;
			  sh:property \[
			    sh:path sh:alternativePath ;
			    sh:node shsh:PathListWithAtLeast2Members ;
			    sh:minCount 1 ;
			    sh:maxCount 1 ;
			  \]
			\]
			\[ sh:nodeKind sh:BlankNode ;    # 2.3.1.4: Inverse path
			  sh:closed true ;
			  sh:property \[
			    sh:path sh:inversePath ;
			    sh:minCount 1 ;
			    sh:maxCount 1 ;
			  \] 
			\]
			\[ sh:nodeKind sh:BlankNode ;    # 2.3.1.5: Zero-or-more path
			  sh:closed true ;
			  sh:property \[
			    sh:path sh:zeroOrMorePath ;
			    sh:minCount 1 ;
			    sh:maxCount 1 ;
			  \] 
			\]
			\[ sh:nodeKind sh:BlankNode ;    # 2.3.1.6: One-or-more path
			  sh:closed true ;
			  sh:property \[
			    sh:path sh:oneOrMorePath ;
			    sh:minCount 1 ;
			    sh:maxCount 1 ;
			  \] 
			\]
			\[ sh:nodeKind sh:BlankNode ;    # 2.3.1.7: Zero-or-one path
			  sh:closed true ;
			  sh:property \[
			    sh:path sh:zeroOrOnePath ;
			    sh:minCount 1 ;
			    sh:maxCount 1 ;
			  \] 
			\]
		) .

shsh:PathListWithAtLeast2Members
	a sh:NodeShape ;
	sh:node shsh:ListShape ;
	sh:property \[
		sh:path \[ sh:oneOrMorePath rdf:rest \] ;
		sh:minCount 2 ;    # 1 other list node plus rdf:nil
	\] .

shsh:ShapesGraphShape
	a sh:NodeShape ;
	sh:targetObjectsOf sh:shapesGraph ;
	sh:nodeKind sh:IRI .                [\# shapesGraph-nodeKind](#syntax-rule-shapesGraph-nodeKind)

shsh:EntailmentShape
	a sh:NodeShape ;
	sh:targetObjectsOf sh:entailment ;
	sh:nodeKind sh:IRI .                [\# entailment-nodeKind](#syntax-rule-entailment-nodeKind)

## D. Summary of SHACL Core Validators

This section enumerates all normative [validators](#dfn-validators) of SHACL Core. This section is automatically generated from other parts of this spec and hyperlinks are provided back into the prose if the context of the validator in unclear.

| Validators by Constraint Component |
| --- |
| [sh:ClassConstraintComponent](#validator-ClassConstraintComponent): For each [value node](#dfn-value-nodes) that is either a [literal](#dfn-literal), or a non-literal that is not a [SHACL instance](#dfn-shacl-instance) of `$class` in the [data graph](#dfn-data-graph), there is a [validation result](#dfn-validation-results) with the [value node](#dfn-value-nodes) as `sh:value`. |
| [sh:DatatypeConstraintComponent](#validator-DatatypeConstraintComponent): For each [value node](#dfn-value-nodes) that is not a [literal](#dfn-literal), or is a [literal](#dfn-literal) with a datatype that does not match `$datatype`, there is a [validation result](#dfn-validation-results) with the [value node](#dfn-value-nodes) as `sh:value`. The datatype of a literal is determined following the [datatype](https://www.w3.org/TR/sparql11-query/#func-datatype) function of SPARQL 1.1. A [literal](#dfn-literal) matches a datatype if the [literal](#dfn-literal)'s datatype has the same [IRI](#dfn-iri) and, for the datatypes supported by SPARQL 1.1, is not an [ill-typed](https://www.w3.org/TR/rdf11-concepts#section-Graph-Literal) literal. |
| [sh:NodeKindConstraintComponent](#validator-NodeKindConstraintComponent): For each [value node](#dfn-value-nodes) that does not match `$nodeKind`, there is a [validation result](#dfn-validation-results) with the [value node](#dfn-value-nodes) as `sh:value`. Any [IRI](#dfn-iri) matches only `sh:IRI`, `sh:BlankNodeOrIRI` and `sh:IRIOrLiteral`. Any [blank node](#dfn-blank-node) matches only `sh:BlankNode`, `sh:BlankNodeOrIRI` and `sh:BlankNodeOrLiteral`. Any [literal](#dfn-literal) matches only `sh:Literal`, `sh:BlankNodeOrLiteral` and `sh:IRIOrLiteral`. |
| [sh:MinCountConstraintComponent](#validator-MinCountConstraintComponent): If the number of [value nodes](#dfn-value-nodes) is less than `$minCount`, there is a [validation result](#dfn-validation-results). |
| [sh:MaxCountConstraintComponent](#validator-MaxCountConstraintComponent): If the number of [value nodes](#dfn-value-nodes) is greater than `$maxCount`, there is a [validation result](#dfn-validation-results). |
| [sh:MinExclusiveConstraintComponent](#validator-MinExclusiveConstraintComponent): For each [value node](#dfn-value-nodes) `v` where the SPARQL expression `$minExclusive < v` does not return `true`, there is a [validation result](#dfn-validation-results) with `v` as `sh:value`. |
| [sh:MinInclusiveConstraintComponent](#validator-MinInclusiveConstraintComponent): For each [value node](#dfn-value-nodes) `v` where the SPARQL expression `$minInclusive <= v` does not return `true`, there is a [validation result](#dfn-validation-results) with `v` as `sh:value`. |
| [sh:MaxExclusiveConstraintComponent](#validator-MaxExclusiveConstraintComponent): For each [value node](#dfn-value-nodes) `v` where the SPARQL expression `$maxExclusive > v` does not return `true`, there is a [validation result](#dfn-validation-results) with `v` as `sh:value`. |
| [sh:MaxInclusiveConstraintComponent](#validator-MaxInclusiveConstraintComponent): For each [value node](#dfn-value-nodes) `v` where the SPARQL expression `$maxInclusive >= v` does not return `true`, there is a [validation result](#dfn-validation-results) with `v` as `sh:value`. |
| [sh:MinLengthConstraintComponent](#validator-MinLengthConstraintComponent): For each [value node](#dfn-value-nodes) `v` where the length (as defined by the [SPARQL STRLEN function](https://www.w3.org/TR/sparql11-query/#func-strlen)) of the string representation of `v` (as defined by the [SPARQL str function](https://www.w3.org/TR/sparql11-query/#func-str)) is less than `$minLength`, or where `v` is a [blank node](#dfn-blank-node), there is a [validation result](#dfn-validation-results) with `v` as `sh:value`. |
| [sh:MaxLengthConstraintComponent](#validator-MaxLengthConstraintComponent): For each [value node](#dfn-value-nodes) `v` where the length (as defined by the [SPARQL STRLEN function](https://www.w3.org/TR/sparql11-query/#func-strlen)) of the string representation of `v` (as defined by the [SPARQL str function](https://www.w3.org/TR/sparql11-query/#func-str)) is greater than `$maxLength`, or where `v` is a [blank node](#dfn-blank-node), there is a [validation result](#dfn-validation-results) with `v` as `sh:value`. |
| [sh:PatternConstraintComponent](#validator-PatternConstraintComponent): For each [value node](#dfn-value-nodes) that is a blank node or where the string representation (as defined by the [SPARQL str function](https://www.w3.org/TR/sparql11-query/#func-str)) does not match the regular expression `$pattern` (as defined by the [SPARQL REGEX function](https://www.w3.org/TR/sparql11-query/#func-regex)), there is a [validation result](#dfn-validation-results) with the [value node](#dfn-value-nodes) as `sh:value`. If `$flags` has a value then the matching _MUST_ follow the definition of the 3-argument variant of the SPARQL REGEX function, using `$flags` as third argument. |
| [sh:LanguageInConstraintComponent](#validator-LanguageInConstraintComponent): For each [value node](#dfn-value-nodes) that is either not a [literal](#dfn-literal) or that does not have a language tag matching any of the basic language ranges that are the [members](#dfn-members) of `$languageIn` following the filtering schema defined by the [SPARQL langMatches](https://www.w3.org/TR/sparql11-query/#func-langMatches) function, there is a [validation result](#dfn-validation-results) with the [value node](#dfn-value-nodes) as `sh:value`. |
| [sh:UniqueLangConstraintComponent](#validator-UniqueLangConstraintComponent): If `$uniqueLang` is `true` then for each non-empty language tag that is used by at least two [value nodes](#dfn-value-nodes), there is a [validation result](#dfn-validation-results). |
| [sh:EqualsConstraintComponent](#validator-EqualsConstraintComponent): For each [value node](#dfn-value-nodes) that does not exist as a [value](#dfn-value) of the property `$equals` at the [focus node](#dfn-focus-node), there is a [validation result](#dfn-validation-results) with the [value node](#dfn-value-nodes) as `sh:value`. For each [value](#dfn-value) of the property `$equals` at the [focus node](#dfn-focus-node) that is not one of the [value nodes](#dfn-value-nodes), there is a [validation result](#dfn-validation-results) with the [value](#dfn-value) as `sh:value`. |
| [sh:DisjointConstraintComponent](#validator-DisjointConstraintComponent): For each [value node](#dfn-value-nodes) that also exists as a [value](#dfn-value) of the property `$disjoint` at the [focus node](#dfn-focus-node), there is a [validation result](#dfn-validation-results) with the [value node](#dfn-value-nodes) as `sh:value`. |
| [sh:LessThanConstraintComponent](#validator-LessThanConstraintComponent): For each pair of [value nodes](#dfn-value-nodes) and the values of the property `$lessThan` at the given [focus node](#dfn-focus-node) where the first [value](#dfn-value) is not less than the second [value](#dfn-value) (based on SPARQL's `<` operator) or where the two values cannot be compared, there is a [validation result](#dfn-validation-results) with the [value node](#dfn-value-nodes) as `sh:value`. |
| [sh:LessThanOrEqualsConstraintComponent](#validator-LessThanOrEqualsConstraintComponent): For each pair of [value nodes](#dfn-value-nodes) and the values of the property `$lessThanOrEquals` at the given [focus node](#dfn-focus-node) where the first [value](#dfn-value) is not less than or equal to the second [value](#dfn-value) (based on SPARQL's `<=` operator) or where the two values cannot be compared, there is a [validation result](#dfn-validation-results) with the [value node](#dfn-value-nodes) as `sh:value`. |
| [sh:NotConstraintComponent](#validator-NotConstraintComponent): For each [value node](#dfn-value-nodes) `v`: A [failure](#dfn-failure) _MUST_ be reported if the [conformance checking](#dfn-conformance-checking) of `v` against the shape `$not` produces a [failure](#dfn-failure). Otherwise, if `v` [conforms](#dfn-conforms) to the shape `$not`, there is [validation result](#dfn-validation-results) with `v` as `sh:value`. |
| [sh:AndConstraintComponent](#validator-AndConstraintComponent): For each [value node](#dfn-value-nodes) `v`: A [failure](#dfn-failure) _MUST_ be produced if the [conformance checking](#dfn-conformance-checking) of `v` against any of the [members](#dfn-members) of `$and` produces a [failure](#dfn-failure). Otherwise, if `v` does not [conform](#dfn-conforms) to each [member](#dfn-members) of `$and`, there is a [validation result](#dfn-validation-results) with `v` as `sh:value`. |
| [sh:OrConstraintComponent](#validator-OrConstraintComponent): For each [value node](#dfn-value-nodes) `v`: A [failure](#dfn-failure) _MUST_ be produced if the [conformance checking](#dfn-conformance-checking) of `v` against any of the [members](#dfn-members) produces a [failure](#dfn-failure). Otherwise, if `v` [conforms](#dfn-conforms) to none of the [members](#dfn-members) of `$or` there is a [validation result](#dfn-validation-results) with `v` as `sh:value`. |
| [sh:XoneConstraintComponent](#validator-XoneConstraintComponent): For each [value node](#dfn-value-nodes) `v` let `N` be the number of the [shapes](#dfn-shape) that are [members](#dfn-members) of `$xone` where `v` [conforms](#dfn-conforms) to the shape. A [failure](#dfn-failure) _MUST_ be produced if the [conformance checking](#dfn-conformance-checking) of `v` against any of the [members](#dfn-members) produces a [failure](#dfn-failure). Otherwise, if `N` is not exactly `1`, there is a [validation result](#dfn-validation-results) with `v` as `sh:value`. |
| [sh:NodeConstraintComponent](#validator-NodeConstraintComponent): For each [value node](#dfn-value-nodes) `v`: A [failure](#dfn-failure) _MUST_ be produced if the [conformance checking](#dfn-conformance-checking) of `v` against `$node` produces a [failure](#dfn-failure). Otherwise, if `v` does not [conform](#dfn-conforms) to `$node`, there is a [validation result](#dfn-validation-results) with `v` as `sh:value`. |
| [sh:PropertyConstraintComponent](#validator-PropertyConstraintComponent): For each [value node](#dfn-value-nodes) `v`: A [failure](#dfn-failure) _MUST_ be produced if the validation of `v` as [focus node](#dfn-focus-node) against the property shape `$property` produces a [failure](#dfn-failure). Otherwise, the validation results are the results of [validating](#dfn-validation) `v` as [focus node](#dfn-focus-node) against the property shape `$property`. |
| [sh:QualifiedMinCountConstraintComponent](#validator-QualifiedMinCountConstraintComponent): Let `C` be the number of [value nodes](#dfn-value-nodes) `v` where `v` [conforms](#dfn-conforms) to `$qualifiedValueShape` and where `v` does not [conform](#dfn-conforms) to any of the [sibling shapes](#dfn-sibling-shapes) for the _current_ shape, i.e. the shape that `v` is validated against and which has `$qualifiedValueShape` as its value for `sh:qualifiedValueShape`. A [failure](#dfn-failure) _MUST_ be produced if any of the said conformance checks produces a [failure](#dfn-failure). Otherwise, there is a [validation result](#dfn-validation-results) if `C` is less than `$qualifiedMinCount`. The [constraint component](#dfn-constraint-component) for `sh:qualifiedMinCount` is `sh:QualifiedMinCountConstraintComponent`. |
| [sh:QualifiedMaxCountConstraintComponent](#validator-QualifiedMaxCountConstraintComponent): Let `C` be as defined for `sh:qualifiedMinCount` above. A [failure](#dfn-failure) _MUST_ be produced if any of the said conformance checks produces a [failure](#dfn-failure). Otherwise, there is a [validation result](#dfn-validation-results) if `C` is greater than `$qualifiedMaxCount`. The [constraint component](#dfn-constraint-component) for `sh:qualifiedMaxCount` is `sh:QualifiedMaxCountConstraintComponent`. |
| [sh:ClosedConstraintComponent](#validator-ClosedConstraintComponent): If `$closed` is `true` then there is a [validation result](#dfn-validation-results) for each [triple](#dfn-rdf-triple) that has a [value node](#dfn-value-nodes) as its [subject](#dfn-subject) and a [predicate](#dfn-predicate) that is not explicitly enumerated as a [value](#dfn-value) of `sh:path` in any of the [property shapes](#dfn-property-shape) declared via `sh:property` at the current shape. If `$ignoredProperties` has a value then the properties enumerated as [members](#dfn-members) of this [SHACL list](#dfn-shacl-list) are also permitted for the [value node](#dfn-value-nodes). The [validation result](#dfn-validation-results) _MUST_ have the [predicate](#dfn-predicate) of the triple as its `sh:resultPath`, and the [object](#dfn-object) of the triple as its `sh:value`. |
| [sh:HasValueConstraintComponent](#validator-HasValueConstraintComponent): If the RDF term `$hasValue` is not among the [value nodes](#dfn-value-nodes), there is a [validation result](#dfn-validation-results). |
| [sh:InConstraintComponent](#validator-InConstraintComponent): For each [value node](#dfn-value-nodes) that is not a [member](#dfn-members) of `$in`, there is a [validation result](#dfn-validation-results) with the [value node](#dfn-value-nodes) as `sh:value`. |

## E. Security and Privacy Considerations

_This section is non-normative._

Like most RDF-based technologies, SHACL processors may operate on graphs that are combined from various sources. Some applications may have an open "linked data" architecture and dynamically assemble RDF triples from sources that are outside of an organization's network of trust. Since RDF allows anyone to add statements about any resource, triples may modify the originally intended semantics of shape definitions or nodes in a data graph and thus lead to misleading results. Protection against this (and the following) scenario can be achieved by only using trusted and verified RDF sources and eliminating the possibility that graphs are dynamically added via `owl:imports` and `sh:shapesGraph`.

SHACL-SPARQL includes all the [security issues of SPARQL](https://www.w3.org/TR/sparql11-query/#security).

## F. Acknowledgements

_This section is non-normative._

Many people contributed to this specification, including members of the RDF Data Shapes Working Group. We especially thank the following:

Arnaud Le Hors (chair until end of 2016), Dean Allemang, Jim Amsden, Iovka Boneva, Olivier Corby, Karen Coyle, Richard Cyganiak, Michel Dumontier, Sandro Hawke, Holger Knublauch, Dimitris Kontokostas, Jose Labra, Pano Maria, Peter Patel-Schneider, Irene Polikoff, Eric Prud'hommeaux, Arthur Ryman (who also served as a co-editor until Feb 2016), Andy Seaborne, Harold Solbrig, Simon Steyskal, Ted Thibodeau, Bart van Leeuwen, Nicky van Oorschot

## G. Revision History

_This section is non-normative._

The detailed list of changes and their diffs can be found in the [Git repository](https://github.com/w3c/data-shapes/commits/gh-pages/shacl/index.html).

Summary of changes to this document since the [Proposed Recommendation of 8 June 2017](https://www.w3.org/TR/2017/PR-shacl-20170608/#revision-history):

-   Revision history was removed

## H. References

### H.1 Normative references

\[BCP47\]

[Tags for Identifying Languages](https://tools.ietf.org/html/bcp47). A. Phillips; M. Davis. IETF. September 2009. IETF Best Current Practice. URL: [https://tools.ietf.org/html/bcp47](https://tools.ietf.org/html/bcp47)

\[RFC2119\]

[Key words for use in RFCs to Indicate Requirement Levels](https://tools.ietf.org/html/rfc2119). S. Bradner. IETF. March 1997. Best Current Practice. URL: [https://tools.ietf.org/html/rfc2119](https://tools.ietf.org/html/rfc2119)

\[rdf11-concepts\]

[RDF 1.1 Concepts and Abstract Syntax](https://www.w3.org/TR/rdf11-concepts/). Richard Cyganiak; David Wood; Markus Lanthaler. W3C. 25 February 2014. W3C Recommendation. URL: [https://www.w3.org/TR/rdf11-concepts/](https://www.w3.org/TR/rdf11-concepts/)

\[sparql11-entailment\]

[SPARQL 1.1 Entailment Regimes](https://www.w3.org/TR/sparql11-entailment/). Birte Glimm; Chimezie Ogbuji. W3C. 21 March 2013. W3C Recommendation. URL: [https://www.w3.org/TR/sparql11-entailment/](https://www.w3.org/TR/sparql11-entailment/)

\[sparql11-query\]

[SPARQL 1.1 Query Language](https://www.w3.org/TR/sparql11-query/). Steven Harris; Andy Seaborne. W3C. 21 March 2013. W3C Recommendation. URL: [https://www.w3.org/TR/sparql11-query/](https://www.w3.org/TR/sparql11-query/)

\[turtle\]

[RDF 1.1 Turtle](https://www.w3.org/TR/turtle/). Eric Prud'hommeaux; Gavin Carothers. W3C. 25 February 2014. W3C Recommendation. URL: [https://www.w3.org/TR/turtle/](https://www.w3.org/TR/turtle/)

### H.2 Informative references

\[json-ld\]

[JSON-LD 1.0](https://www.w3.org/TR/json-ld/). Manu Sporny; Gregg Kellogg; Markus Lanthaler. W3C. 16 January 2014. W3C Recommendation. URL: [https://www.w3.org/TR/json-ld/](https://www.w3.org/TR/json-ld/)

\[shacl-ucr\]

[SHACL Use Cases and Requirements](https://www.w3.org/TR/shacl-ucr/). Simon Steyskal; Karen Coyle. W3C. 22 January 2016. W3C Working Draft. URL: [https://www.w3.org/TR/shacl-ucr/](https://www.w3.org/TR/shacl-ucr/)

[↑](#toc)
