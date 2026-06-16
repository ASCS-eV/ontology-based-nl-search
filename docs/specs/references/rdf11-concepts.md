<!--
  ⚠ THIRD-PARTY SPECIFICATION — NOT AN ORIGINAL WORK OF THIS PROJECT.
  Title:     RDF 1.1 Concepts and Abstract Syntax
  Source:    https://www.w3.org/TR/rdf11-concepts/
  Publisher: W3C
  License:   W3C Document License 2023 (https://www.w3.org/copyright/document-license-2023/)
  Retrieved: 2026-06-16
  Reproduced verbatim for offline reference and AI-agent context. The
  publisher's original copyright and license apply. Do not hand-edit —
  refresh from source (see docs/specs/references/README.md).
-->

> **Third-party specification — reproduced for offline reference and AI-agent context.**
> **Title:** RDF 1.1 Concepts and Abstract Syntax  
> **Status:** W3C Recommendation  
> **Source:** <https://www.w3.org/TR/rdf11-concepts/>  
> **Publisher:** W3C  
> **License:** W3C Document License 2023 — <https://www.w3.org/copyright/document-license-2023/>  
> **Retrieved:** 2026-06-16  
> The publisher's original copyright and license apply. Do not hand-edit;
> refresh from source — see [README](./README.md).

---

RDF 1.1 Concepts and Abstract Syntax  

[![W3C](https://www.w3.org/Icons/w3c_home)](https://www.w3.org/)

# RDF 1.1 Concepts and Abstract Syntax

## W3C Recommendation 25 February 2014

This version:

[http://www.w3.org/TR/2014/REC-rdf11-concepts-20140225/](https://www.w3.org/TR/2014/REC-rdf11-concepts-20140225/)

Latest published version:

[http://www.w3.org/TR/rdf11-concepts/](https://www.w3.org/TR/rdf11-concepts/)

Previous version:

[http://www.w3.org/TR/2014/PR-rdf11-concepts-20140109/](https://www.w3.org/TR/2014/PR-rdf11-concepts-20140109/)

Previous Recommendation:

[http://www.w3.org/TR/rdf10-concepts/](https://www.w3.org/TR/rdf10-concepts/)

Editors:

[Richard Cyganiak](http://richard.cyganiak.de/), [DERI, NUI Galway](http://www.deri.ie/)

[David Wood](http://about.me/david_wood), [3 Round Stones](http://3roundstones.com/)

[Markus Lanthaler](http://www.markus-lanthaler.com/), [Graz University of Technology](http://www.tugraz.at/)

Previous Editors:

Graham Klyne

Jeremy J. Carroll

Brian McBride

Please check the [**errata**](https://www.w3.org/2014/rdf1.1-errata) for any errors or issues reported since publication.

The English version of this specification is the only normative version. Non-normative [translations](https://www.w3.org/Consortium/Translation/) may also be available.

[Copyright](https://www.w3.org/Consortium/Legal/ipr-notice#Copyright) © 2004-2014 [W3C](https://www.w3.org/)® ([MIT](http://www.csail.mit.edu/), [ERCIM](http://www.ercim.eu/), [Keio](http://www.keio.ac.jp/), [Beihang](http://ev.buaa.edu.cn/)), All Rights Reserved. W3C [liability](https://www.w3.org/Consortium/Legal/ipr-notice#Legal_Disclaimer), [trademark](https://www.w3.org/Consortium/Legal/ipr-notice#W3C_Trademarks) and [document use](https://www.w3.org/Consortium/Legal/copyright-documents) rules apply.

---

## Abstract

The Resource Description Framework (RDF) is a framework for representing information in the Web. This document defines an abstract syntax (a data model) which serves to link all RDF-based languages and specifications. The abstract syntax has two key data structures: RDF graphs are sets of subject-predicate-object triples, where the elements may be IRIs, blank nodes, or datatyped literals. They are used to express descriptions of resources. RDF datasets are used to organize collections of RDF graphs, and comprise a default graph and zero or more named graphs. RDF 1.1 Concepts and Abstract Syntax also introduces key concepts and terminology, and discusses datatyping and the handling of fragment identifiers in IRIs within RDF graphs.

## Status of This Document

_This section describes the status of this document at the time of its publication. Other documents may supersede this document. A list of current W3C publications and the latest revision of this technical report can be found in the [W3C technical reports index](https://www.w3.org/TR/) at http://www.w3.org/TR/._

This document is part of the RDF 1.1 document suite. It is the central RDF 1.1 specification and defines the core RDF concepts. A new concept in RDF 1.1 is the notion of an RDF dataset to represent multiple graphs. Test suites and implementation reports of a number of RDF 1.1 specifications that build on this document are available through the [RDF 1.1 Test Cases](https://www.w3.org/TR/2014/NOTE-rdf11-testcases-20140225/) document \[[RDF11-TESTCASES](#bib-RDF11-TESTCASES)\]. There have been no changes to this document since its publication as Proposed Recommendation.

This document was published by the [RDF Working Group](https://www.w3.org/2011/rdf-wg/) as a Recommendation. If you wish to make comments regarding this document, please send them to [public-rdf-comments@w3.org](mailto:public-rdf-comments@w3.org) ([subscribe](mailto:public-rdf-comments-request@w3.org?subject=subscribe), [archives](http://lists.w3.org/Archives/Public/public-rdf-comments/)). All comments are welcome.

This document has been reviewed by W3C Members, by software developers, and by other W3C groups and interested parties, and is endorsed by the Director as a W3C Recommendation. It is a stable document and may be used as reference material or cited from another document. W3C's role in making the Recommendation is to draw attention to the specification and to promote its widespread deployment. This enhances the functionality and interoperability of the Web.

This document was produced by a group operating under the [5 February 2004 W3C Patent Policy](https://www.w3.org/Consortium/Patent-Policy-20040205/). W3C maintains a [public list of any patent disclosures](https://www.w3.org/2004/01/pp-impl/46168/status) made in connection with the deliverables of the group; that page also includes instructions for disclosing a patent. An individual who has actual knowledge of a patent which the individual believes contains [Essential Claim(s)](https://www.w3.org/Consortium/Patent-Policy-20040205/#def-essential) must disclose the information in accordance with [section 6 of the W3C Patent Policy](https://www.w3.org/Consortium/Patent-Policy-20040205/#sec-Disclosure).

## Table of Contents

-   [1\. Introduction](#section-Introduction)
    -   [1.1 Graph-based Data Model](#data-model)
    -   [1.2 Resources and Statements](#resources-and-statements)
    -   [1.3 The Referent of an IRI](#referents)
    -   [1.4 RDF Vocabularies and Namespace IRIs](#vocabularies)
    -   [1.5 RDF and Change over Time](#change-over-time)
    -   [1.6 Working with Multiple RDF Graphs](#managing-graphs)
    -   [1.7 Equivalence, Entailment and Inconsistency](#entailment)
    -   [1.8 RDF Documents and Syntaxes](#rdf-documents)
-   [2\. Conformance](#conformance)
-   [3\. RDF Graphs](#section-rdf-graph)
    -   [3.1 Triples](#section-triples)
    -   [3.2 IRIs](#section-IRIs)
    -   [3.3 Literals](#section-Graph-Literal)
    -   [3.4 Blank Nodes](#section-blank-nodes)
    -   [3.5 Replacing Blank Nodes with IRIs](#section-skolemization)
    -   [3.6 Graph Comparison](#graph-isomorphism)
-   [4\. RDF Datasets](#section-dataset)
    -   [4.1 RDF Dataset Comparison](#section-dataset-isomorphism)
    -   [4.2 Content Negotiation of RDF Datasets](#section-dataset-conneg)
-   [5\. Datatypes](#section-Datatypes)
    -   [5.1 The XML Schema Built-in Datatypes](#xsd-datatypes)
    -   [5.2 The `rdf:HTML` Datatype](#section-html)
    -   [5.3 The `rdf:XMLLiteral` Datatype](#section-XMLLiteral)
    -   [5.4 Datatype IRIs](#datatype-iris)
-   [6\. Fragment Identifiers](#section-fragID)
-   [7\. Generalized RDF Triples, Graphs, and Datasets](#section-generalized-rdf)
-   [8\. Acknowledgments](#section-Acknowledgments)
-   [A. Changes between RDF 1.0 and RDF 1.1](#changes)
-   [B. References](#references)
    -   [B.1 Normative references](#normative-references)
    -   [B.2 Informative references](#informative-references)

## 1\. Introduction

_This section is non-normative._

The _Resource Description Framework_ (RDF) is a framework for representing information in the Web.

This document defines an abstract syntax (a data model) which serves to link all RDF-based languages and specifications, including:

-   the [formal model-theoretic semantics for RDF](https://www.w3.org/TR/rdf11-mt/) \[[RDF11-MT](#bib-RDF11-MT)\];
-   serialization syntaxes for storing and exchanging RDF such as [Turtle](https://www.w3.org/TR/turtle/) \[[TURTLE](#bib-TURTLE)\] and [JSON-LD](https://www.w3.org/TR/json-ld/) \[[JSON-LD](#bib-JSON-LD)\];
-   the [SPARQL Query Language](https://www.w3.org/TR/rdf-sparql-query/) \[[SPARQL11-OVERVIEW](#bib-SPARQL11-OVERVIEW)\];
-   the [RDF Schema vocabulary](https://www.w3.org/TR/rdf-schema/) \[[RDF11-SCHEMA](#bib-RDF11-SCHEMA)\].

### 1.1 Graph-based Data Model

The core structure of the abstract syntax is a set of [triples](#dfn-rdf-triple "RDF triple"), each consisting of a [subject](#dfn-subject), a [predicate](#dfn-predicate) and an [object](#dfn-object). A set of such triples is called an [RDF graph](#dfn-rdf-graph). An RDF graph can be visualized as a node and directed-arc diagram, in which each triple is represented as a node-arc-node link.

[![An RDF graph with two nodes (Subject and Object) and a triple connecting them (Predicate)](rdf-graph.svg)](rdf-graph.svg)

Fig. 1 An RDF graph with two nodes (Subject and Object) and a triple connecting them (Predicate)

There can be three kinds of [nodes](#dfn-node "node") in an [RDF graph](#dfn-rdf-graph): [IRIs](#dfn-iri "IRI"), [literals](#dfn-literal "literal"), and [blank nodes](#dfn-blank-node "blank node").

### 1.2 Resources and Statements

Any [IRI](#dfn-iri "IRI") or [literal](#dfn-literal) denotes something in the world (the "universe of discourse"). These things are called resources. Anything can be a resource, including physical things, documents, abstract concepts, numbers and strings; the term is synonymous with "entity" as it is used in the RDF Semantics specification \[[RDF11-MT](#bib-RDF11-MT)\]. The resource denoted by an IRI is called its [referent](#dfn-referent), and the resource denoted by a literal is called its [literal value](#dfn-literal-value "literal value"). Literals have [datatypes](#dfn-datatype "datatype") that define the range of possible values, such as strings, numbers, and dates. Special kind of literals, [language-tagged strings](#dfn-language-tagged-string "language-tagged string"), denote plain-text strings in a natural language.

Asserting an [RDF triple](#dfn-rdf-triple) says that _some relationship, indicated by the [predicate](#dfn-predicate), holds between the [resources](#dfn-resource "resource") [denoted](#dfn-denote "denote") by the [subject](#dfn-subject) and [object](#dfn-object)_. This statement corresponding to an RDF triple is known as an RDF statement. The predicate itself is an [IRI](#dfn-iri "IRI") and denotes a property, that is, a [resource](#dfn-resource) that can be thought of as a binary relation. (Relations that involve more than two entities can only be [indirectly expressed in RDF](https://www.w3.org/TR/swbp-n-aryRelations/) \[[SWBP-N-ARYRELATIONS](#bib-SWBP-N-ARYRELATIONS)\].)

Unlike [IRIs](#dfn-iri "IRI") and [literals](#dfn-literal "literal"), [blank nodes](#dfn-blank-node "blank node") do not identify specific [resources](#dfn-resource "resource"). [Statements](#dfn-rdf-statement "RDF statement") involving blank nodes say that something with the given relationships exists, without explicitly naming it.

### 1.3 The Referent of an IRI

The [resource](#dfn-resource) [denoted](#dfn-denote "denote") by an [IRI](#dfn-iri "IRI") is also called its referent. For some IRIs with particular meanings, such as those identifying XSD datatypes, the referent is fixed by this specification. For all other IRIs, what exactly is denoted by any given IRI is not defined by this specification. Other specifications may fix IRI referents, or apply other constraints on what may be the referent of any IRI.

Guidelines for determining the [referent](#dfn-referent) of an [IRI](#dfn-iri "IRI") are provided in other documents, like _[Architecture of the World Wide Web, Volume One](https://www.w3.org/TR/webarch/)_ \[[WEBARCH](#bib-WEBARCH)\] and _[Cool URIs for the Semantic Web](https://www.w3.org/TR/cooluris/)_ \[[COOLURIS](#bib-COOLURIS)\]. A very brief, informal, and partial account follows:

-   By design, IRIs have global scope. Thus, two different appearances of an IRI [denote](#dfn-denote) the same [resource](#dfn-resource). Violating this principle constitutes an [IRI collision](https://www.w3.org/TR/webarch/#URI-collision) \[[WEBARCH](#bib-WEBARCH)\].
-   By social convention, the [IRI owner](https://www.w3.org/TR/webarch/#uri-ownership) \[[WEBARCH](#bib-WEBARCH)\] gets to say what the intended (or usual) referent of an [IRI](#dfn-iri "IRI") is. Applications and users need not abide by this intended denotation, but there may be a loss of interoperability with other applications and users if they do not do so.
-   The IRI owner can establish the intended [referent](#dfn-referent) by means of a specification or other document that explains what is denoted. For example, the [Organization Ontology document](https://www.w3.org/TR/vocab-org/) \[[VOCAB-ORG](#bib-VOCAB-ORG)\] specifies the intended referents of various IRIs that start with `http://www.w3.org/ns/org#`.
-   A good way of communicating the intended referent is to set up the IRI so that it [dereferences](https://www.w3.org/TR/webarch/#uri-dereference) \[[WEBARCH](#bib-WEBARCH)\] to such a document.
-   Such a document can, in fact, be an [RDF document](#dfn-rdf-document) that describes the denoted resource by means of [RDF statements](#dfn-rdf-statement "RDF statement").

Perhaps the most important characteristic of [IRIs](#dfn-iri "IRI") in web architecture is that they can be [dereferenced](https://www.w3.org/TR/webarch/#uri-dereference), and hence serve as starting points for interactions with a remote server. This specification is not concerned with such interactions. It does not define an interaction model. It only treats IRIs as globally unique identifiers in a graph data model that describes resources. However, those interactions are critical to the concept of _[Linked Data](https://www.w3.org/DesignIssues/LinkedData.html)_ \[[LINKED-DATA](#bib-LINKED-DATA)\], which makes use of the RDF data model and serialization formats.

### 1.4 RDF Vocabularies and Namespace IRIs

An RDF vocabulary is a collection of [IRIs](#dfn-iri "IRI") intended for use in [RDF graphs](#dfn-rdf-graph "RDF graph"). For example, the IRIs documented in \[[RDF11-SCHEMA](#bib-RDF11-SCHEMA)\] are the RDF Schema vocabulary. RDF Schema can itself be used to define and document additional RDF vocabularies. Some such vocabularies are mentioned in the Primer \[[RDF11-PRIMER](#bib-RDF11-PRIMER)\].

The [IRIs](#dfn-iri "IRI") in an [RDF vocabulary](#dfn-rdf-vocabulary) often begin with a common substring known as a namespace IRI. Some namespace IRIs are associated by convention with a short name known as a namespace prefix. Some examples:

<table class="simple"><caption>Some example namespace prefixes and IRIs</caption><tbody><tr><th>Namespace prefix</th><th>Namespace <abbr title="Internationalized Resource Identifier">IRI</abbr></th><th>RDF vocabulary</th></tr><tr><td>rdf</td><td><a href="https://www.w3.org/1999/02/22-rdf-syntax-ns#"><code>http://www.w3.org/1999/02/22-rdf-syntax-ns#</code></a></td><td>The RDF built-in vocabulary [<cite><a class="bibref" href="#bib-RDF11-SCHEMA">RDF11-SCHEMA</a></cite>]</td></tr><tr><td>rdfs</td><td><a href="https://www.w3.org/2000/01/rdf-schema#"><code>http://www.w3.org/2000/01/rdf-schema#</code></a></td><td>The RDF Schema vocabulary [<cite><a class="bibref" href="#bib-RDF11-SCHEMA">RDF11-SCHEMA</a></cite>]</td></tr><tr><td>xsd</td><td><a href="https://www.w3.org/2001/XMLSchema#"><code>http://www.w3.org/2001/XMLSchema#</code></a></td><td>The <a href="#dfn-rdf-compatible-xsd-types" class="internalDFN">RDF-compatible XSD types</a></td></tr></tbody></table>

In some serialization formats it is common to abbreviate [IRIs](#dfn-iri "IRI") that start with [namespace IRIs](#dfn-namespace-iri "namespace IRI") by using a [namespace prefix](#dfn-namespace-prefix) in order to assist readability. For example, the IRI `http://www.w3.org/1999/02/22-rdf-syntax-ns#XMLLiteral` would be abbreviated as `rdf:XMLLiteral`. Note however that these abbreviations are _not_ valid IRIs, and must not be used in contexts where IRIs are expected. Namespace IRIs and namespace prefixes are _not_ a formal part of the RDF data model. They are merely a syntactic convenience for abbreviating IRIs.

The term “namespace” on its own does not have a well-defined meaning in the context of RDF, but is sometimes informally used to mean “[namespace IRI](#dfn-namespace-iri)” or “[RDF vocabulary](#dfn-rdf-vocabulary)”.

### 1.5 RDF and Change over Time

The RDF data model is _atemporal_: [RDF graphs](#dfn-rdf-graph "RDF graph") are static snapshots of information.

However, [RDF graphs](#dfn-rdf-graph "RDF graph") can express information about events and about temporal aspects of other entities, given appropriate [vocabulary](#dfn-rdf-vocabulary "RDF vocabulary") terms.

Since [RDF graphs](#dfn-rdf-graph "RDF graph") are defined as mathematical sets, adding or removing [triples](#dfn-rdf-triple "RDF triple") from an RDF graph yields a different RDF graph.

We informally use the term RDF source to refer to a persistent yet mutable source or container of [RDF graphs](#dfn-rdf-graph "RDF graph"). An RDF source is a [resource](#dfn-resource) that may be said to have a state that can change over time. A snapshot of the state can be expressed as an RDF graph. For example, any web document that has an RDF-bearing representation may be considered an RDF source. Like all resources, RDF sources may be named with [IRIs](#dfn-iri "IRI") and therefore described in other RDF graphs.

Intuitively speaking, changes in the universe of discourse can be reflected in the following ways:

-   An [IRI](#dfn-iri "IRI"), once minted, should never change its intended [referent](#dfn-referent). (See [URI persistence](https://www.w3.org/TR/webarch/#URI-persistence) \[[WEBARCH](#bib-WEBARCH)\].)
-   [Literals](#dfn-literal "literal"), by design, are constants and never change their [value](#dfn-literal-value "literal value").
-   A relationship that holds between two [resources](#dfn-resource "resource") at one time may not hold at another time.
-   [RDF sources](#dfn-rdf-source "RDF source") may change their state over time. That is, they may provide different [RDF graphs](#dfn-rdf-graph "RDF graph") at different times.
-   Some [RDF sources](#dfn-rdf-source "RDF source") may, however, be immutable snapshots of another RDF source, archiving its state at some point in time.

### 1.6 Working with Multiple RDF Graphs

As RDF graphs are sets of triples, they can be combined easily, supporting the use of data from multiple sources. Nevertheless, it is sometimes desirable to work with multiple RDF graphs while keeping their contents separate. [RDF datasets](#dfn-rdf-dataset "RDF dataset") support this requirement.

An [RDF dataset](#dfn-rdf-dataset) is a collection of [RDF graphs](#dfn-rdf-graph "RDF graph"). All but one of these graphs have an associated [IRI](#dfn-iri "IRI") or blank node. They are called [named graphs](#dfn-named-graph "named graph"), and the IRI or blank node is called the [graph name](#dfn-graph-name). The remaining graph does not have an associated IRI, and is called the [default graph](#dfn-default-graph) of the RDF dataset.

There are many possible uses for [RDF datasets](#dfn-rdf-dataset "RDF dataset"). One such use is to hold snapshots of multiple [RDF sources](#dfn-rdf-source "RDF source").

### 1.7 Equivalence, Entailment and Inconsistency

An [RDF triple](#dfn-rdf-triple) encodes a [statement](#dfn-rdf-statement "RDF statement")—a simple logical expression, or claim about the world. An [RDF graph](#dfn-rdf-graph) is the conjunction (logical _AND_) of its triples. The precise details of this meaning of RDF triples and graphs are the subject of the RDF Semantics specification \[[RDF11-MT](#bib-RDF11-MT)\], which yields the following relationships between [RDF graph](#dfn-rdf-graph)s:

Entailment

An [RDF graph](#dfn-rdf-graph) _A_ entails another RDF graph _B_ if every possible arrangement of the world that makes _A_ true also makes _B_ true. When _A_ entails _B_, if the truth of _A_ is presumed or demonstrated then the truth of _B_ is established.

Equivalence

Two [RDF graphs](#dfn-rdf-graph "RDF graph") _A_ and _B_ are equivalent if they make the same claim about the world. _A_ is equivalent to _B_ if and only if _A_ [entails](#dfn-entailment "entailment") _B_ and _B_ entails _A_.

Inconsistency

An [RDF graph](#dfn-rdf-graph) is inconsistent if it contains an internal contradiction. There is no possible arrangement of the world that would make the expression true.

An entailment regime \[[RDF11-MT](#bib-RDF11-MT)\] is a specification that defines precise conditions that make these relationships hold. RDF itself recognizes only some basic cases of entailment, equivalence and inconsistency. Other specifications, such as [RDF Schema](https://www.w3.org/TR/rdf-schema/) \[[RDF11-SCHEMA](#bib-RDF11-SCHEMA)\] and [OWL 2](https://www.w3.org/TR/owl2-overview/) \[[OWL2-OVERVIEW](#bib-OWL2-OVERVIEW)\], add more powerful entailment regimes, as do some domain-specific [vocabularies](#dfn-rdf-vocabulary "RDF vocabulary").

This specification does not constrain how implementations use the logical relationships defined by [entailment regimes](#dfn-entailment-regime "entailment regime"). Implementations may or may not detect [inconsistencies](#dfn-inconsistency "inconsistency"), and may make all, some or no [entailed](#dfn-entailment "entailment") information available to users.

### 1.8 RDF Documents and Syntaxes

An RDF document is a document that encodes an [RDF graph](#dfn-rdf-graph) or [RDF dataset](#dfn-rdf-dataset) in a concrete RDF syntax, such as Turtle \[[TURTLE](#bib-TURTLE)\], RDFa \[[RDFA-PRIMER](#bib-RDFA-PRIMER)\], JSON-LD \[[JSON-LD](#bib-JSON-LD)\], or TriG \[[TRIG](#bib-TRIG)\]. RDF documents enable the exchange of RDF graphs and RDF datasets between systems.

A [concrete RDF syntax](#dfn-concrete-rdf-syntax) may offer many different ways to encode the same [RDF graph](#dfn-rdf-graph) or [RDF dataset](#dfn-rdf-dataset), for example through the use of [namespace prefixes](#dfn-namespace-prefix "namespace prefix"), relative IRIs, [blank node identifiers](#dfn-blank-node-identifier "blank node identifier"), and different ordering of statements. While these aspects can have great effect on the convenience of working with the [RDF document](#dfn-rdf-document), they are not significant for its meaning.

## 2\. Conformance

As well as sections marked as non-normative, all authoring guidelines, diagrams, examples, and notes in this specification are non-normative. Everything else in this specification is normative.

The key words _MUST_, _MUST NOT_, _REQUIRED_, _SHOULD_, _SHOULD NOT_, _RECOMMENDED_, _MAY_, and _OPTIONAL_ in this specification are to be interpreted as described in \[[RFC2119](#bib-RFC2119)\].

This specification, _RDF 1.1 Concepts and Abstract Syntax_, defines a data model and related terminology for use in other specifications, such as [concrete RDF syntaxes](#dfn-concrete-rdf-syntax "concrete RDF syntax"), API specifications, and query languages. Implementations cannot directly conform to _RDF 1.1 Concepts and Abstract Syntax_, but can conform to such other specifications that normatively reference terms defined here.

## 3\. RDF Graphs

An RDF graph is a set of [RDF triples](#dfn-rdf-triple "RDF triple").

### 3.1 Triples

An RDF triple consists of three components:

-   the subject, which is an [IRI](#dfn-iri "IRI") or a [blank node](#dfn-blank-node)
-   the predicate, which is an [IRI](#dfn-iri "IRI")
-   the object, which is an [IRI](#dfn-iri "IRI"), a [literal](#dfn-literal) or a [blank node](#dfn-blank-node)

An RDF triple is conventionally written in the order subject, predicate, object.

The set of nodes of an [RDF graph](#dfn-rdf-graph) is the set of subjects and objects of triples in the graph. It is possible for a predicate IRI to also occur as a node in the same graph.

[IRIs](#dfn-iri "IRI"), [literals](#dfn-literal "literal") and [blank nodes](#dfn-blank-node "blank node") are collectively known as RDF terms.

[IRIs](#dfn-iri "IRI"), [literals](#dfn-literal "literal") and [blank nodes](#dfn-blank-node "blank node") are distinct and distinguishable. For example, `http://example.org/` as a string literal is neither equal to `http://example.org/` as an IRI, nor to a blank node with the [blank node identifier](#dfn-blank-node-identifier) `http://example.org/`.

### 3.2 IRIs

An IRI (Internationalized Resource Identifier) within an RDF graph is a Unicode string \[[UNICODE](#bib-UNICODE)\] that conforms to the syntax defined in RFC 3987 \[[RFC3987](#bib-RFC3987)\].

IRIs in the RDF abstract syntax _MUST_ be absolute, and _MAY_ contain a fragment identifier.

IRI equality: Two IRIs are equal if and only if they are equivalent under Simple String Comparison according to [section 5.1](http://tools.ietf.org/html/rfc3987#section-5.1) of \[[RFC3987](#bib-RFC3987)\]. Further normalization _MUST NOT_ be performed when comparing IRIs for equality.

Note

**URIs and IRIs:** IRIs are a generalization of URIs \[[RFC3986](#bib-RFC3986)\] that permits a wider range of Unicode characters. Every absolute URI and URL is an IRI, but not every IRI is an URI. When IRIs are used in operations that are only defined for URIs, they must first be converted according to the mapping defined in [section 3.1](http://tools.ietf.org/html/rfc3987#section-3.1) of \[[RFC3987](#bib-RFC3987)\]. A notable example is retrieval over the HTTP protocol. The mapping involves UTF-8 encoding of non-ASCII characters, %-encoding of octets not allowed in URIs, and Punycode-encoding of domain names.

**Relative IRIs:** Some [concrete RDF syntaxes](#dfn-concrete-rdf-syntax "concrete RDF syntax") permit relative IRIs as a convenient shorthand that allows authoring of documents independently from their final publishing location. Relative IRIs must be [resolved against](http://tools.ietf.org/html/rfc3986#section-5.2) a base IRI to make them absolute. Therefore, the RDF graph serialized in such syntaxes is well-defined only if a [base IRI can be established](http://tools.ietf.org/html/rfc3986#section-5.1) \[[RFC3986](#bib-RFC3986)\].

**IRI normalization:** Interoperability problems can be avoided by minting only IRIs that are normalized according to [Section 5](http://tools.ietf.org/html/rfc3987#section-5) of \[[RFC3987](#bib-RFC3987)\]. Non-normalized forms that are best avoided include:

-   Uppercase characters in scheme names and domain names
-   Percent-encoding of characters where it is not required by IRI syntax
-   Explicitly stated HTTP default port (`http://example.com:80/`); `http://example.com/` is preferable
-   Completely empty path in HTTP IRIs (`http://example.com`); `http://example.com/` is preferable
-   “`/./`” or “`/../`” in the path component of an IRI
-   Lowercase hexadecimal letters within percent-encoding triplets (“`%3F`” is preferable over “`%3f`”)
-   Punycode-encoding of Internationalized Domain Names in IRIs
-   IRIs that are not in Unicode Normalization Form C \[[NFC](#bib-NFC)\]

### 3.3 Literals

Literals are used for values such as strings, numbers, and dates.

A literal in an [RDF graph](#dfn-rdf-graph) consists of two or three elements:

-   a lexical form, being a Unicode \[[UNICODE](#bib-UNICODE)\] string, which _SHOULD_ be in Normal Form C \[[NFC](#bib-NFC)\],
-   a datatype IRI, being an [IRI](#dfn-iri "IRI") identifying a datatype that determines how the lexical form maps to a [literal value](#dfn-literal-value), and
-   if and only if the [datatype IRI](#dfn-datatype-iri) is `http://www.w3.org/1999/02/22-rdf-syntax-ns#langString`, a non-empty language tag as defined by \[[BCP47](#bib-BCP47)\]. The language tag _MUST_ be well-formed according to [section 2.2.9](http://tools.ietf.org/html/bcp47#section-2.2.9) of \[[BCP47](#bib-BCP47)\].

A literal is a language-tagged string if the third element is present. Lexical representations of language tags _MAY_ be converted to lower case. The value space of language tags is always in lower case.

Please note that concrete syntaxes _MAY_ support simple literals consisting of only a [lexical form](#dfn-lexical-form) without any [datatype IRI](#dfn-datatype-iri) or [language tag](#dfn-language-tag). Simple literals are syntactic sugar for abstract syntax [literals](#dfn-literal "literal") with the [datatype IRI](#dfn-datatype-iri) `http://www.w3.org/2001/XMLSchema#string`. Similarly, most concrete syntaxes represent [language-tagged strings](#dfn-language-tagged-string "language-tagged string") without the [datatype IRI](#dfn-datatype-iri) because it always equals `http://www.w3.org/1999/02/22-rdf-syntax-ns#langString`.

The literal value associated with a [literal](#dfn-literal) is:

1.  If the literal is a [language-tagged string](#dfn-language-tagged-string), then the literal value is a pair consisting of its [lexical form](#dfn-lexical-form) and its [language tag](#dfn-language-tag), in that order.
2.  If the literal's [datatype IRI](#dfn-datatype-iri) is in the set of [recognized datatype IRIs](#dfn-recognized-datatype-iris), let d be the [referent](#dfn-referent) of the datatype IRI.
    1.  If the literal's [lexical form](#dfn-lexical-form) is in the [lexical space](#dfn-lexical-space) of d, then the literal value is the result of applying the [lexical-to-value mapping](#dfn-lexical-to-value-mapping) of d to the [lexical form](#dfn-lexical-form).
    2.  Otherwise, the literal is ill-typed and no literal value can be associated with the literal. Such a case produces a semantic inconsistency but is not _syntactically_ ill-formed. Implementations _MUST_ accept ill-typed literals and produce RDF graphs from them. Implementations _MAY_ produce warnings when encountering ill-typed literals.
3.  If the literal's [datatype IRI](#dfn-datatype-iri) is _not_ in the set of [recognized datatype IRIs](#dfn-recognized-datatype-iris), then the literal value is not defined by this specification.

Literal term equality: Two literals are term-equal (the same RDF literal) if and only if the two [lexical forms](#dfn-lexical-form "lexical form"), the two [datatype IRIs](#dfn-datatype-iri "datatype IRI"), and the two [language tags](#dfn-language-tag "language tag") (if any) compare equal, character by character. Thus, two literals can have the same value without being the same RDF term. For example:

      "1"^^xs:integer
      "01"^^xs:integer
    

denote the same [value](#dfn-literal-value "literal value"), but are not the same literal [RDF terms](#dfn-rdf-term "RDF Term") and are not [term-equal](#dfn-literal-term-equality "literal term equality") because their [lexical form](#dfn-lexical-form) differs.

### 3.4 Blank Nodes

Blank nodes are disjoint from [IRIs](#dfn-iri "IRI") and [literals](#dfn-literal "literal"). Otherwise, the set of possible blank nodes is arbitrary. RDF makes no reference to any internal structure of blank nodes.

Note

Blank node identifiers are local identifiers that are used in some [concrete RDF syntaxes](#dfn-concrete-rdf-syntax "concrete RDF syntax") or RDF store implementations. They are always locally scoped to the file or RDF store, and are _not_ persistent or portable identifiers for blank nodes. Blank node identifiers are _not_ part of the RDF abstract syntax, but are entirely dependent on the concrete syntax or implementation. The syntactic restrictions on blank node identifiers, if any, therefore also depend on the concrete RDF syntax or implementation. Implementations that handle blank node identifiers in concrete syntaxes need to be careful not to create the same blank node from multiple occurrences of the same blank node identifier except in situations where this is supported by the syntax.

### 3.5 Replacing Blank Nodes with IRIs

Blank nodes do not have identifiers in the RDF abstract syntax. The [blank node identifiers](#dfn-blank-node-identifier "blank node identifier") introduced by some concrete syntaxes have only local scope and are purely an artifact of the serialization.

In situations where stronger identification is needed, systems _MAY_ systematically replace some or all of the blank nodes in an RDF graph with [IRIs](#dfn-iri "IRI"). Systems wishing to do this _SHOULD_ mint a new, globally unique IRI (a Skolem IRI) for each blank node so replaced.

This transformation does not appreciably change the meaning of an RDF graph, provided that the Skolem IRIs do not occur anywhere else. It does however permit the possibility of other graphs subsequently using the Skolem IRIs, which is not possible for blank nodes.

Systems may wish to mint Skolem IRIs in such a way that they can recognize the IRIs as having been introduced solely to replace blank nodes. This allows a system to map IRIs back to blank nodes if needed.

Systems that want Skolem IRIs to be recognizable outside of the system boundaries _SHOULD_ use a well-known IRI \[[RFC5785](#bib-RFC5785)\] with the registered name `genid`. This is an IRI that uses the HTTP or HTTPS scheme, or another scheme that has been specified to use well-known IRIs; and whose path component starts with `/.well-known/genid/`.

For example, the authority responsible for the domain `example.com` could mint the following recognizable Skolem IRI:

http://example.com/.well-known/genid/d26a2d0e98334696f4ad70a677abc1f6

Note

RFC 5785 \[[RFC5785](#bib-RFC5785)\] only specifies well-known URIs, not IRIs. For the purpose of this document, a well-known IRI is any IRI that results in a well-known URI after IRI\-to-URI mapping \[[RFC3987](#bib-RFC3987)\].

### 3.6 Graph Comparison

Two [RDF graphs](#dfn-rdf-graph "RDF graph") G and G' are isomorphic (that is, they have an identical form) if there is a bijection M between the sets of nodes of the two graphs, such that:

1.  M maps blank nodes to blank nodes.
2.  M(lit)=lit for all [RDF literals](#dfn-literal "literal") lit which are nodes of G.
3.  M(iri)=iri for all [IRIs](#dfn-iri "IRI") iri which are nodes of G.
4.  The triple ( s, p, o ) is in G if and only if the triple ( M(s), p, M(o) ) is in G'

See also: [IRI equality](#dfn-iri-equality), [literal term equality](#dfn-literal-term-equality).

With this definition, M shows how each blank node in G can be replaced with a new blank node to give G'. Graph isomorphism is needed to support the RDF Test Cases \[[RDF11-TESTCASES](#bib-RDF11-TESTCASES)\] specification.

## 4\. RDF Datasets

An RDF dataset is a collection of [RDF graphs](#dfn-rdf-graph "RDF graph"), and comprises:

-   Exactly one default graph, being an [RDF graph](#dfn-rdf-graph). The default graph does not have a name and _MAY_ be empty.
-   Zero or more named graphs. Each named graph is a pair consisting of an [IRI](#dfn-iri "IRI") or a blank node (the graph name), and an [RDF graph](#dfn-rdf-graph). Graph names are unique within an RDF dataset.

[Blank nodes](#dfn-blank-node "blank node") can be shared between graphs in an [RDF dataset](#dfn-rdf-dataset "RDF Dataset").

Note

Despite the use of the word “name” in “[named graph](#dfn-named-graph)”, the [graph name](#dfn-graph-name) is not required to [denote](#dfn-denote) the graph. It is merely syntactically paired with the graph. RDF does not place any formal restrictions on what [resource](#dfn-resource) the graph name may denote, nor on the relationship between that resource and the graph. A discussion of different RDF dataset semantics can be found in \[[RDF11-DATASETS](#bib-RDF11-DATASETS)\].

Some [RDF dataset](#dfn-rdf-dataset "RDF Dataset") implementations do not track empty [named graphs](#dfn-named-graph "named graph"). Applications can avoid interoperability issues by not ascribing importance to the presence or absence of empty named graphs.

SPARQL 1.1 \[[SPARQL11-OVERVIEW](#bib-SPARQL11-OVERVIEW)\] also defines the concept of an RDF Dataset. The definition of an RDF Dataset in SPARQL 1.1 and this specification differ slightly in that this specification allows RDF Graphs to be identified using either an IRI or a blank node. SPARQL 1.1 Query Language only allows RDF Graphs to be identified using an IRI. Existing SPARQL implementations might not allow blank nodes to be used to identify RDF Graphs for some time, so their use can cause interoperability problems. [Skolemizing](#section-skolemization) blank nodes used as graph names can be used to overcome these interoperability problems.

### 4.1 RDF Dataset Comparison

Two [RDF datasets](#dfn-rdf-dataset "RDF Dataset") (the RDF dataset D1 with default graph DG1 and any named graph NG1 and the RDF dataset D2 with default graph DG2 and any named graph NG2) are dataset-isomorphic if and only if there is a bijection M between the nodes, triples and graphs in D1 and those in D2 such that:

1.  M maps blank nodes to blank nodes;
2.  M is the identity map on literals and URIs;
3.  For every triple <s p o>, M(<s, p, o>)= <M(s), M(p), M(o)\>;
4.  For every graph G\={t1, ..., tn}, M(G)\={M(t1), ..., M(tn)};
5.  DG2 = M(DG1); and
6.  <n, G> is in NG1 if and only if <M(n), M(G)\> is in NG2.

### 4.2 Content Negotiation of RDF Datasets

_This section is non-normative._

Web resources may have multiple representations that are made available via [content negotiation](https://www.w3.org/TR/webarch/#frag-coneg) \[[WEBARCH](#bib-WEBARCH)\]. A representation may be returned in an RDF serialization format that supports the expression of both [RDF datasets](#dfn-rdf-dataset "RDF Dataset") and [RDF graphs](#dfn-rdf-graph "RDF graph"). If an [RDF dataset](#dfn-rdf-dataset "RDF Dataset") is returned and the consumer is expecting an [RDF graph](#dfn-rdf-graph "RDF graph"), the consumer is expected to use the [RDF dataset's](#dfn-rdf-dataset "RDF Dataset") default graph.

## 5\. Datatypes

Datatypes are used with RDF [literals](#dfn-literal "literal") to represent values such as strings, numbers and dates. The datatype abstraction used in RDF is compatible with XML Schema \[[XMLSCHEMA11-2](#bib-XMLSCHEMA11-2)\]. Any datatype definition that conforms to this abstraction _MAY_ be used in RDF, even if not defined in terms of XML Schema. RDF re-uses many of the XML Schema built-in datatypes, and defines two additional non-normative datatypes, `[rdf:HTML](#dfn-rdf-html)` and `[rdf:XMLLiteral](#dfn-rdf-xmlliteral)`. The list of datatypes supported by an implementation is determined by its [recognized datatype IRIs](#dfn-recognized-datatype-iris).

A datatype consists of a [lexical space](#dfn-lexical-space), a [value space](#dfn-value-space) and a [lexical-to-value mapping](#dfn-lexical-to-value-mapping), and is denoted by one or more [IRIs](#dfn-iri "IRI").

The lexical space of a datatype is a set of Unicode \[[UNICODE](#bib-UNICODE)\] strings.

The lexical-to-value mapping of a datatype is a set of pairs whose first element belongs to the [lexical space](#dfn-lexical-space), and the second element belongs to the value space of the datatype. Each member of the lexical space is paired with exactly one value, and is a _lexical representation_ of that value. The mapping can be seen as a function from the lexical space to the value space.

Note

[Language-tagged strings](#dfn-language-tagged-string "language-tagged string") have the [datatype IRI](#dfn-datatype-iri) `http://www.w3.org/1999/02/22-rdf-syntax-ns#langString`. No datatype is formally defined for this IRI because the definition of [datatypes](#dfn-datatype "datatype") does not accommodate [language tags](#dfn-language-tag "language tag") in the [lexical space](#dfn-lexical-space). The [value space](#dfn-value-space) associated with this datatype IRI is the set of all pairs of strings and language tags.

For example, the XML Schema datatype `xsd:boolean`, where each member of the [value space](#dfn-value-space) has two lexical representations, is defined as follows:

Lexical space:

{“`true`”, “`false`”, “`1`”, “`0`”}

Value space:

{_**true**_, _**false**_}

Lexical-to-value mapping

{ <“`true`”, _**true**_\>, <“`false`”, _**false**_\>, <“`1`”, _**true**_\>, <“`0`”, _**false**_\>, }

The [literals](#dfn-literal "literal") that can be defined using this datatype are:

<table class="simple"><caption>This table lists the literals of type xsd:boolean.</caption><tbody><tr><th>Literal</th><th>Value</th></tr><tr><td>&lt;“<code>true</code>”, <code>xsd:boolean</code>&gt;</td><td><em><strong>true</strong></em></td></tr><tr><td>&lt;“<code>false</code>”, <code>xsd:boolean</code>&gt;</td><td><em><strong>false</strong></em></td></tr><tr><td>&lt;“<code>1</code>”, <code>xsd:boolean</code>&gt;</td><td><em><strong>true</strong></em></td></tr><tr><td>&lt;“<code>0</code>”, <code>xsd:boolean</code>&gt;</td><td><em><strong>false</strong></em></td></tr></tbody></table>

### 5.1 The XML Schema Built-in Datatypes

[IRIs](#dfn-iri "IRI") of the form `http://www.w3.org/2001/XMLSchema#_xxx_`, where `_xxx_` is the name of a datatype, denote the built-in datatypes defined in _[XML Schema 1.1 Part 2: Datatypes](https://www.w3.org/TR/xmlschema11-2/)_ \[[XMLSCHEMA11-2](#bib-XMLSCHEMA11-2)\]. The XML Schema built-in types listed in the following table are the RDF-compatible XSD types. Their use is _RECOMMENDED_.

Readers might note that the xsd:hexBinary and xsd:base64Binary datatypes are the only safe datatypes for transferring binary information.

<table class="simple"><caption>A list of the RDF-compatible XSD types, with short descriptions"</caption><tbody><tr><th></th><th>Datatype</th><th>Value space (informative)</th></tr><tr><th rowspan="4">Core types</th><td><a href="https://www.w3.org/TR/xmlschema11-2/#string"><code>xsd:string</code></a></td><td>Character strings (but not all Unicode character strings)</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#boolean"><code>xsd:boolean</code></a></td><td>true, false</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#decimal"><code>xsd:decimal</code></a></td><td>Arbitrary-precision decimal numbers</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#integer"><code>xsd:integer</code></a></td><td>Arbitrary-size integer numbers</td></tr><tr><th rowspan="2">IEEE floating-point<br>numbers</th><td><a href="https://www.w3.org/TR/xmlschema11-2/#double"><code>xsd:double</code></a></td><td>64-bit floating point numbers incl. ±Inf, ±0, NaN</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#float"><code>xsd:float</code></a></td><td>32-bit floating point numbers incl. ±Inf, ±0, NaN</td></tr><tr><th rowspan="4">Time and date</th><td><a href="https://www.w3.org/TR/xmlschema11-2/#date"><code>xsd:date</code></a></td><td>Dates (yyyy-mm-dd) with or without timezone</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#time"><code>xsd:time</code></a></td><td>Times (hh:mm:ss.sss…) with or without timezone</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#dateTime"><code>xsd:dateTime</code></a></td><td>Date and time with or without timezone</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#dateTimeStamp"><code>xsd:dateTimeStamp</code></a></td><td>Date and time with required timezone</td></tr><tr><th rowspan="8">Recurring and<br>partial dates</th><td><a href="https://www.w3.org/TR/xmlschema11-2/#gYear"><code>xsd:gYear</code></a></td><td>Gregorian calendar year</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#gMonth"><code>xsd:gMonth</code></a></td><td>Gregorian calendar month</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#gDay"><code>xsd:gDay</code></a></td><td>Gregorian calendar day of the month</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#gYearMonth"><code>xsd:gYearMonth</code></a></td><td>Gregorian calendar year and month</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#gMonthDay"><code>xsd:gMonthDay</code></a></td><td>Gregorian calendar month and day</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#duration"><code>xsd:duration</code></a></td><td>Duration of time</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#yearMonthDuration"><code>xsd:yearMonthDuration</code></a></td><td>Duration of time (months and years only)</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#dayTimeDuration"><code>xsd:dayTimeDuration</code></a></td><td>Duration of time (days, hours, minutes, seconds only)</td></tr><tr><th rowspan="12">Limited-range<br>integer numbers</th><td><a href="https://www.w3.org/TR/xmlschema11-2/#byte"><code>xsd:byte</code></a></td><td>-128…+127 (8 bit)</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#short"><code>xsd:short</code></a></td><td>-32768…+32767 (16 bit)</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#int"><code>xsd:int</code></a></td><td>-2147483648…+2147483647 (32 bit)</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#long"><code>xsd:long</code></a></td><td>-9223372036854775808…+9223372036854775807 (64 bit)</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#unsignedByte"><code>xsd:unsignedByte</code></a></td><td>0…255 (8 bit)</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#unsignedShort"><code>xsd:unsignedShort</code></a></td><td>0…65535 (16 bit)</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#unsignedInt"><code>xsd:unsignedInt</code></a></td><td>0…4294967295 (32 bit)</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#unsignedLong"><code>xsd:unsignedLong</code></a></td><td>0…18446744073709551615 (64 bit)</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#positiveInteger"><code>xsd:positiveInteger</code></a></td><td>Integer numbers &gt;0</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#nonNegativeInteger"><code>xsd:nonNegativeInteger</code></a></td><td>Integer numbers ≥0</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#negativeInteger"><code>xsd:negativeInteger</code></a></td><td>Integer numbers &lt;0</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#nonPositiveInteger"><code>xsd:nonPositiveInteger</code></a></td><td>Integer numbers ≤0</td></tr><tr><th rowspan="2">Encoded binary data</th><td><a href="https://www.w3.org/TR/xmlschema11-2/#hexBinary"><code>xsd:hexBinary</code></a></td><td>Hex-encoded binary data</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#base64Binary"><code>xsd:base64Binary</code></a></td><td>Base64-encoded binary data</td></tr><tr><th rowspan="7">Miscellaneous<br>XSD types</th><td><a href="https://www.w3.org/TR/xmlschema11-2/#anyURI"><code>xsd:anyURI</code></a></td><td>Absolute or relative URIs and IRIs</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#language"><code>xsd:language</code></a></td><td>Language tags per [<cite><a class="bibref" href="#bib-BCP47">BCP47</a></cite>]</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#normalizedString"><code>xsd:normalizedString</code></a></td><td>Whitespace-normalized strings</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#token"><code>xsd:token</code></a></td><td>Tokenized strings</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#NMTOKEN"><code>xsd:NMTOKEN</code></a></td><td>XML NMTOKENs</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#Name"><code>xsd:Name</code></a></td><td>XML Names</td></tr><tr><td><a href="https://www.w3.org/TR/xmlschema11-2/#NCName"><code>xsd:NCName</code></a></td><td>XML NCNames</td></tr></tbody></table>

The other built-in XML Schema datatypes are unsuitable for various reasons and _SHOULD NOT_ be used:

-   [`xsd:QName`](https://www.w3.org/TR/xmlschema11-2/#QName) and [`xsd:ENTITY`](https://www.w3.org/TR/xmlschema11-2/#ENTITY) require an enclosing XML document context.
-   [`xsd:ID`](https://www.w3.org/TR/xmlschema11-2/#ID) and [`xsd:IDREF`](https://www.w3.org/TR/xmlschema11-2/#IDREF) are for cross references within an XML document.
-   [`xsd:NOTATION`](https://www.w3.org/TR/xmlschema11-2/#NOTATION) is not intended for direct use.
-   [`xsd:IDREFS`](https://www.w3.org/TR/xmlschema11-2/#IDREFS), [`xsd:ENTITIES`](https://www.w3.org/TR/xmlschema11-2/#ENTITIES) and [`xsd:NMTOKENS`](https://www.w3.org/TR/xmlschema11-2/#NMTOKENS) are sequence-valued datatypes which do not fit the RDF [datatype](#dfn-datatype) model.

### 5.2 The `rdf:HTML` Datatype

_This section is non-normative._

RDF provides for HTML content as a possible [literal value](#dfn-literal-value). This allows markup in literal values. Such content is indicated in an [RDF graph](#dfn-rdf-graph) using a [literal](#dfn-literal) whose [datatype](#dfn-datatype) is set to `rdf:HTML`. This datatype is defined as non-normative because it depends on \[[DOM4](#bib-DOM4)\], a specification that has not yet reached W3C Recommendation status.

The `rdf:HTML` datatype is defined as follows:

The IRI denoting this datatype

is `http://www.w3.org/1999/02/22-rdf-syntax-ns#HTML`.

The lexical space

is the set of Unicode \[[UNICODE](#bib-UNICODE)\] strings.

The value space

is a set of DOM [`DocumentFragment`](https://www.w3.org/TR/dom/#interface-documentfragment) nodes \[[DOM4](#bib-DOM4)\]. Two [`DocumentFragment`](https://www.w3.org/TR/dom/#interface-documentfragment) nodes _A_ and _B_ are considered equal if and only if the DOM method `_A_.[isEqualNode](https://www.w3.org/TR/dom/#dom-node-isequalnode)(_B_)` \[[DOM4](#bib-DOM4)\] returns `true`.

The lexical-to-value mapping

Each member of the lexical space is associated with the result of applying the following algorithm:

-   Let `domnodes` be the list of [DOM nodes](https://www.w3.org/TR/dom/#node) \[[DOM4](#bib-DOM4)\] that result from applying the [HTML fragment parsing algorithm](https://www.w3.org/TR/html5/syntax.html#parsing-html-fragments) \[[HTML5](#bib-HTML5)\] to the input string, without a context element.
-   Let `domfrag` be a DOM [`DocumentFragment`](https://www.w3.org/TR/dom/#interface-documentfragment) \[[DOM4](#bib-DOM4)\] whose `childNodes` attribute is equal to `domnodes`
-   Return `domfrag.[normalize](https://www.w3.org/TR/dom/#dom-node-normalize)()`

Note

Any language annotation (`lang="…"`) or XML namespaces (`xmlns`) desired in the HTML content must be included explicitly in the HTML literal. Relative URLs in attributes such as `href` do not have a well-defined base URL and are best avoided. RDF applications may use additional equivalence relations, such as that which relates an `xsd:string` with an `rdf:HTML` literal corresponding to a single text node of the same string.

### 5.3 The `rdf:XMLLiteral` Datatype

_This section is non-normative._

RDF provides for XML content as a possible [literal value](#dfn-literal-value). Such content is indicated in an [RDF graph](#dfn-rdf-graph) using a [literal](#dfn-literal) whose [datatype](#dfn-datatype) is set to `rdf:XMLLiteral`. This datatype is defined as non-normative because it depends on \[[DOM4](#bib-DOM4)\], a specification that has not yet reached W3C Recommendation status.

The `rdf:XMLLiteral` datatype is defined as follows:

The IRI denoting this [datatype](#dfn-datatype)

is `http://www.w3.org/1999/02/22-rdf-syntax-ns#XMLLiteral`.

The [lexical space](#dfn-lexical-space)

is the set of all strings which are well-balanced, self-contained [XML content](https://www.w3.org/TR/2000/REC-xml-20001006#NT-content) \[[XML10](#bib-XML10)\]; and for which embedding between an arbitrary XML start tag and an end tag yields a document conforming to [XML Namespaces](https://www.w3.org/TR/1999/REC-xml-names-19990114/) \[[XML-NAMES](#bib-XML-NAMES)\].

The [value space](#dfn-value-space)

is a set of DOM [`DocumentFragment`](https://www.w3.org/TR/dom/#interface-documentfragment) nodes \[[DOM4](#bib-DOM4)\]. Two [`DocumentFragment`](https://www.w3.org/TR/dom/#interface-documentfragment) nodes _A_ and _B_ are considered equal if and only if the DOM method `_A_.[isEqualNode](https://www.w3.org/TR/dom/#dom-node-isequalnode)(_B_)` returns `true`.

The [lexical-to-value mapping](#dfn-lexical-to-value-mapping)

Each member of the lexical space is associated with the result of applying the following algorithm:

-   Let `domfrag` be a DOM [`DocumentFragment`](https://www.w3.org/TR/dom/#interface-documentfragment) node \[[DOM4](#bib-DOM4)\] corresponding to the input string
-   Return `domfrag.[normalize](https://www.w3.org/TR/dom/#dom-node-normalize)()`

The canonical mapping

defines a [canonical lexical form](https://www.w3.org/TR/xmlschema11-2/#dt-canonical-mapping) \[[XMLSCHEMA11-2](#bib-XMLSCHEMA11-2)\] for each member of the value space. The `rdf:XMLLiteral` canonical mapping is the [exclusive XML canonicalization method](https://www.w3.org/TR/2002/REC-xml-exc-c14n-20020718/#def-exclusive-XML-canonicalization-method) (_with comments, with empty [InclusiveNamespaces PrefixList](https://www.w3.org/TR/2002/REC-xml-exc-c14n-20020718/#def-InclusiveNamespaces-PrefixList)_) \[[XML-EXC-C14N](#bib-XML-EXC-C14N)\].

Note

Any XML namespace declarations (`xmlns`), language annotation (`xml:lang`) or base URI declarations (`xml:base`) desired in the XML content must be included explicitly in the XML literal. Note that some concrete RDF syntaxes may define mechanisms for inheriting them from the context (e.g., [`@parseType="literal"`](https://www.w3.org/TR/rdf-syntax-grammar/#parseTypeLiteralPropertyElt) in RDF/XML \[[RDF11-XML](#bib-RDF11-XML)\]).

### 5.4 Datatype IRIs

Datatypes are identified by [IRIs](#dfn-iri "IRI"). If D is a set of IRIs which are used to refer to datatypes, then the elements of D are called recognized datatype IRIs. Recognized IRIs have fixed [referents](#referents). If any IRI of the form `http://www.w3.org/2001/XMLSchema#xxx` is recognized, it _MUST_ refer to the RDF-compatible XSD type named `xsd:xxx` for every XSD type listed in [section 5.1](#xsd-datatypes). Furthermore, the following IRIs are allocated for non-normative datatypes:

-   The IRI `http://www.w3.org/1999/02/22-rdf-syntax-ns#XMLLiteral` refers to the datatype `[rdf:XMLLiteral](#dfn-rdf-xmlliteral)`
-   The IRI `http://www.w3.org/1999/02/22-rdf-syntax-ns#HTML` refers to the datatype `[rdf:HTML](#dfn-rdf-html)`

Note

Semantic extensions of RDF might choose to recognize other datatype IRIs and require them to refer to a fixed datatype. See the RDF Semantics specification \[[RDF11-MT](#bib-RDF11-MT)\] for more information on semantic extensions.

RDF processors are not required to recognize datatype IRIs. Any literal typed with an unrecognized IRI is treated just like an unknown IRI, i.e. as referring to an unknown thing. Applications _MAY_ give a warning message if they are unable to determine the referent of an IRI used in a typed literal, but they _SHOULD NOT_ reject such RDF as either a syntactic or semantic error.

Other specifications _MAY_ impose additional constraints on [datatype IRIs](#dfn-datatype-iri "datatype IRI"), for example, require support for certain datatypes.

Note

The Web Ontology Language \[[OWL2-OVERVIEW](#bib-OWL2-OVERVIEW)\] offers facilities for formally defining [custom datatypes](https://www.w3.org/TR/owl2-syntax/#Datatype_Definitions) that can be used with RDF. Furthermore, a practice for identifying [user-defined simple XML Schema datatypes](https://www.w3.org/TR/swbp-xsch-datatypes/#sec-userDefined) is suggested in \[[SWBP-XSCH-DATATYPES](#bib-SWBP-XSCH-DATATYPES)\]. RDF implementations are not required to support either of these facilities.

## 6\. Fragment Identifiers

_This section is non-normative._

RDF uses [IRIs](#dfn-iri "IRI"), which may include fragment identifiers, as resource identifiers. The semantics of fragment identifiers is [defined in RFC 3986](http://tools.ietf.org/html/rfc3986#section-3.5) \[[RFC3986](#bib-RFC3986)\]: They identify a secondary resource that is usually a part of, view of, defined in, or described in the primary resource, and the precise semantics depend on the set of representations that might result from a retrieval action on the primary resource.

This section discusses the handling of fragment identifiers in representations that encode [RDF graphs](#dfn-rdf-graph "RDF graph").

In RDF-bearing representations of a primary resource `<foo>`, the secondary resource identified by a fragment `bar` is the [resource](#dfn-resource) [denoted](#dfn-denote "denote") by the full [IRI](#dfn-iri "IRI") `<foo#bar>` in the [RDF graph](#dfn-rdf-graph). Since IRIs in RDF graphs can denote anything, this can be something external to the representation, or even external to the web.

In this way, the RDF-bearing representation acts as an intermediary between the web-accessible primary resource, and some set of possibly non-web or abstract entities that the [RDF graph](#dfn-rdf-graph) may describe.

In cases where other specifications constrain the semantics of fragment identifiers in RDF-bearing representations, the encoded [RDF graph](#dfn-rdf-graph) should use fragment identifiers in a way that is consistent with these constraints. For example, in an HTML+RDFa document \[[HTML-RDFA](#bib-HTML-RDFA)\], the fragment `chapter1` may identify a document section via the semantics of HTML's `@name` or `@id` attributes. The [IRI](#dfn-iri "IRI") `<#chapter1>` should then be taken to [denote](#dfn-denote) that same section in any RDFa-encoded [triples](#dfn-rdf-triple "RDF triple") within the same document. Similarly, fragment identifiers should be used consistently in resources with multiple representations that are made available via [content negotiation](https://www.w3.org/TR/webarch/#frag-coneg) \[[WEBARCH](#bib-WEBARCH)\]. For example, if the fragment `chapter1` identifies a document section in an HTML representation of the primary resource, then the [IRI](#dfn-iri "IRI") `<#chapter1>` should be taken to [denote](#dfn-denote) that same section in all RDF-bearing representations of the same primary resource.

## 7\. Generalized RDF Triples, Graphs, and Datasets

_This section is non-normative._

It is sometimes convenient to loosen the requirements on [RDF triple](#dfn-rdf-triple)s. For example, the completeness of the RDFS entailment rules is easier to show with a generalization of RDF triples.

A generalized RDF triple is a triple having a subject, a predicate, and object, where each can be an [IRI](#dfn-iri "iri"), a [blank node](#dfn-blank-node "blank node") or a [literal](#dfn-literal). A generalized RDF graph is a set of generalized RDF triples. A generalized RDF dataset comprises a distinguished generalized RDF graph, and zero or more pairs each associating an IRI, a blank node or a literal to a generalized RDF graph.

Generalized RDF triples, graphs, and datasets differ from normative RDF [triples](#dfn-rdf-triple "RDF triple"), [graphs](#dfn-rdf-graph "RDF graph"), and [datasets](#dfn-rdf-dataset "RDF dataset") only by allowing [IRIs](#dfn-iri "IRI"), [blank nodes](#dfn-blank-node "blank node") and [literals](#dfn-literal "literal") to appear in any position, i.e., as subject, predicate, object or graph names.

Note

Any users of generalized RDF triples, graphs or datasets need to be aware that these notions are non-standard extensions of RDF and their use may cause interoperability problems. There is no requirement on the part of any RDF tool to accept, process, or produce anything beyond standard RDF triples, graphs, and datasets.

## 8\. Acknowledgments

_This section is non-normative._

The editors acknowledge valuable contributions from Thomas Baker, Tim Berners-Lee, David Booth, Dan Brickley, Gavin Carothers, Jeremy Carroll, Pierre-Antoine Champin, Dan Connolly, John Cowan, Martin J. Dürst, Alex Hall, Steve Harris, Sandro Hawke, Pat Hayes, Ivan Herman, Peter F. Patel-Schneider, Addison Phillips, Eric Prud'hommeaux, Nathan Rixham, Andy Seaborne, Leif Halvard Silli, Guus Schreiber, Dominik Tomaszuk, and Antoine Zimmermann.

The membership of the RDF Working Group included Thomas Baker, Scott Bauer, Dan Brickley, Gavin Carothers, Pierre-Antoine Champin, Olivier Corby, Richard Cyganiak, Souripriya Das, Ian Davis, Lee Feigenbaum, Fabien Gandon, Charles Greer, Alex Hall, Steve Harris, Sandro Hawke, Pat Hayes, Ivan Herman, Nicholas Humfrey, Kingsley Idehen, Gregg Kellogg, Markus Lanthaler, Arnaud Le Hors, Peter F. Patel-Schneider, Eric Prud'hommeaux, Yves Raimond, Nathan Rixham, Guus Schreiber, Andy Seaborne, Manu Sporny, Thomas Steiner, Ted Thibodeau, Mischa Tuffield, William Waites, Jan Wielemaker, David Wood, Zhe Wu, and Antoine Zimmermann.

## A. Changes between RDF 1.0 and RDF 1.1

_This section is non-normative._

A detailed overview of the differences between RDF versions 1.0 and 1.1 can be found in [What’s New in RDF 1.1](https://www.w3.org/TR/rdf11-new/) \[[RDF11-NEW](#bib-RDF11-NEW)\].

## B. References

### B.1 Normative references

\[BCP47\]

A. Phillips; M. Davis. [Tags for Identifying Languages](http://tools.ietf.org/html/bcp47). September 2009. IETF Best Current Practice. URL: [http://tools.ietf.org/html/bcp47](http://tools.ietf.org/html/bcp47)

\[NFC\]

M. Davis, Ken Whistler. [TR15, Unicode Normalization Forms.](http://www.unicode.org/reports/tr15/). 17 September 2010, URL: [http://www.unicode.org/reports/tr15/](http://www.unicode.org/reports/tr15/)

\[RFC2119\]

S. Bradner. [Key words for use in RFCs to Indicate Requirement Levels.](http://www.ietf.org/rfc/rfc2119.txt) March 1997. Internet RFC 2119. URL: [http://www.ietf.org/rfc/rfc2119.txt](http://www.ietf.org/rfc/rfc2119.txt)

\[RFC3987\]

M. Dürst; M. Suignard. [Internationalized Resource Identifiers (IRIs)](http://www.ietf.org/rfc/rfc3987.txt). January 2005. RFC. URL: [http://www.ietf.org/rfc/rfc3987.txt](http://www.ietf.org/rfc/rfc3987.txt)

\[UNICODE\]

[The Unicode Standard](http://www.unicode.org/versions/latest/). URL: [http://www.unicode.org/versions/latest/](http://www.unicode.org/versions/latest/)

\[XMLSCHEMA11-2\]

David Peterson; Sandy Gao; Ashok Malhotra; Michael Sperberg-McQueen; Henry Thompson; Paul V. Biron et al. [W3C XML Schema Definition Language (XSD) 1.1 Part 2: Datatypes](https://www.w3.org/TR/xmlschema11-2/). 5 April 2012. W3C Recommendation. URL: [http://www.w3.org/TR/xmlschema11-2/](https://www.w3.org/TR/xmlschema11-2/)

### B.2 Informative references

\[COOLURIS\]

Leo Sauermann; Richard Cyganiak. [Cool URIs for the Semantic Web](https://www.w3.org/TR/cooluris). 3 December 2008. W3C Note. URL: [http://www.w3.org/TR/cooluris](https://www.w3.org/TR/cooluris)

\[DOM4\]

Anne van Kesteren; Aryeh Gregor; Ms2ger; Alex Russell; Robin Berjon. [W3C DOM4](https://www.w3.org/TR/dom/). 4 February 2014. W3C Last Call Working Draft. URL: [http://www.w3.org/TR/dom/](https://www.w3.org/TR/dom/)

\[HTML-RDFA\]

Manu Sporny. [HTML+RDFa 1.1](https://www.w3.org/TR/html-rdfa/). 22 August 2013. W3C Recommendation. URL: [http://www.w3.org/TR/html-rdfa/](https://www.w3.org/TR/html-rdfa/)

\[HTML5\]

Robin Berjon; Steve Faulkner; Travis Leithead; Erika Doyle Navara; Theresa O'Connor; Silvia Pfeiffer. [HTML5](https://www.w3.org/TR/html5/). 4 February 2014. W3C Candidate Recommendation. URL: [http://www.w3.org/TR/html5/](https://www.w3.org/TR/html5/)

\[JSON-LD\]

Manu Sporny, Gregg Kellogg, Markus Lanthaler, Editors. [JSON-LD 1.0](https://www.w3.org/TR/json-ld/). 16 January 2014. W3C Recommendation. URL: [http://www.w3.org/TR/json-ld/](https://www.w3.org/TR/json-ld/)

\[LINKED-DATA\]

Tim Berners-Lee. [Linked Data](https://www.w3.org/DesignIssues/LinkedData.html). Personal View, imperfect but published. URL: [http://www.w3.org/DesignIssues/LinkedData.html](https://www.w3.org/DesignIssues/LinkedData.html)

\[OWL2-OVERVIEW\]

W3C OWL Working Group. [OWL 2 Web Ontology Language Document Overview (Second Edition)](https://www.w3.org/TR/owl2-overview/). 11 December 2012. W3C Recommendation. URL: [http://www.w3.org/TR/owl2-overview/](https://www.w3.org/TR/owl2-overview/)

\[RDF11-DATASETS\]

Antoine Zimmermann. [RDF 1.1: On Semantics of RDF Datasets](https://www.w3.org/TR/2014/NOTE-rdf11-datasets-20140225/). W3C Working Group Note, 25 February 2014. The latest version is available at [http://www.w3.org/TR/rdf11-datasets/](https://www.w3.org/TR/rdf11-datasets/).

\[RDF11-MT\]

Patrick J. Hayes, Peter F. Patel-Schneider. [RDF 1.1 Semantics.](https://www.w3.org/TR/2014/REC-rdf11-mt-20140225/) W3C Recommendation, 25 February 2014. URL: [http://www.w3.org/TR/2014/REC-rdf11-mt-20140225/](https://www.w3.org/TR/2014/REC-rdf11-mt-20140225/). The latest edition is available at [http://www.w3.org/TR/rdf11-mt/](https://www.w3.org/TR/rdf11-mt/)

\[RDF11-NEW\]

David Wood. [What’s New in RDF 1.1](https://www.w3.org/TR/2014/NOTE-rdf11-new-20140225/). W3C Working Group Note, 25 February 2014. The latest version is available at [http://www.w3.org/TR/rdf11-new/](https://www.w3.org/TR/rdf11-new/).

\[RDF11-PRIMER\]

Guus Schreiber, Yves Raimond. [RDF 1.1 Primer](https://www.w3.org/TR/2014/NOTE-rdf11-primer-20140225/). W3C Working Group Note, 25 February 2014. The latest version is available at [http://www.w3.org/TR/rdf11-primer/](https://www.w3.org/TR/rdf11-primer/).

\[RDF11-SCHEMA\]

Dan Brickley, R. V. Guha. [RDF Schema 1.1](https://www.w3.org/TR/2014/REC-rdf-schema-20140225/). W3C Recommendation, 25 February 2014. URL: [http://www.w3.org/TR/2014/REC-rdf-schema-20140225/](https://www.w3.org/TR/2014/REC-rdf-schema-20140225/). The latest published version is available at [http://www.w3.org/TR/rdf-schema/](https://www.w3.org/TR/rdf-schema/).

\[RDF11-TESTCASES\]

Gregg Kellogg, Markus Lanthaler. [RDF 1.1 Test Cases](https://www.w3.org/TR/2014/NOTE-rdf11-testcases-20140225/). W3C Working Group Note, 25 February 2014. The latest published version is available at [http://www.w3.org/TR/rdf11-testcases/](https://www.w3.org/TR/rdf11-testcases/).

\[RDF11-XML\]

Fabien Gandon, Guus Schreiber. [RDF 1.1 XML Syntax](https://www.w3.org/TR/2014/REC-rdf-syntax-grammar-20140225/). W3C Recommendation, 25 February 2014. URL: [http://www.w3.org/TR/2014/REC-rdf-syntax-grammar-20140225/](https://www.w3.org/TR/2014/REC-rdf-syntax-grammar-20140225/). The latest published version is available at [http://www.w3.org/TR/rdf-syntax-grammar/](https://www.w3.org/TR/rdf-syntax-grammar/).

\[RDFA-PRIMER\]

Ivan Herman; Ben Adida; Manu Sporny; Mark Birbeck. [RDFa 1.1 Primer - Second Edition](https://www.w3.org/TR/rdfa-primer/). 22 August 2013. W3C Note. URL: [http://www.w3.org/TR/rdfa-primer/](https://www.w3.org/TR/rdfa-primer/)

\[RFC3986\]

T. Berners-Lee; R. Fielding; L. Masinter. [Uniform Resource Identifier (URI): Generic Syntax (RFC 3986)](http://www.ietf.org/rfc/rfc3986.txt). January 2005. RFC. URL: [http://www.ietf.org/rfc/rfc3986.txt](http://www.ietf.org/rfc/rfc3986.txt)

\[RFC5785\]

Mark Nottingham; Eran Hammer-Lahav. [Defining Well-Known Uniform Resource Identifiers (URIs) (RFC 5785)](http://www.rfc-editor.org/rfc/rfc5785.txt). April 2010. RFC. URL: [http://www.rfc-editor.org/rfc/rfc5785.txt](http://www.rfc-editor.org/rfc/rfc5785.txt)

\[SPARQL11-OVERVIEW\]

The W3C SPARQL Working Group. [SPARQL 1.1 Overview](https://www.w3.org/TR/sparql11-overview/). 21 March 2013. W3C Recommendation. URL: [http://www.w3.org/TR/sparql11-overview/](https://www.w3.org/TR/sparql11-overview/)

\[SWBP-N-ARYRELATIONS\]

Natasha Noy; Alan Rector. [Defining N-ary Relations on the Semantic Web](https://www.w3.org/TR/swbp-n-aryRelations). 12 April 2006. W3C Note. URL: [http://www.w3.org/TR/swbp-n-aryRelations](https://www.w3.org/TR/swbp-n-aryRelations)

\[SWBP-XSCH-DATATYPES\]

Jeremy Carroll; Jeff Pan. [XML Schema Datatypes in RDF and OWL](https://www.w3.org/TR/swbp-xsch-datatypes). 14 March 2006. W3C Note. URL: [http://www.w3.org/TR/swbp-xsch-datatypes](https://www.w3.org/TR/swbp-xsch-datatypes)

\[TRIG\]

Gavin Carothers, Andy Seaborne. [TriG: RDF Dataset Language](https://www.w3.org/TR/2014/REC-trig-20140225/). W3C Recommendation, 25 February 2014. URL: [http://www.w3.org/TR/2014/REC-trig-20140225/](https://www.w3.org/TR/2014/REC-trig-20140225/). The latest edition is available at [http://www.w3.org/TR/trig/](https://www.w3.org/TR/trig/)

\[TURTLE\]

Eric Prud'hommeaux, Gavin Carothers. [RDF 1.1 Turtle: Terse RDF Triple Language.](https://www.w3.org/TR/2014/REC-turtle-20140225/) W3C Recommendation, 25 February 2014. URL: [http://www.w3.org/TR/2014/REC-turtle-20140225/](https://www.w3.org/TR/2014/REC-turtle-20140225/). The latest edition is available at [http://www.w3.org/TR/turtle/](https://www.w3.org/TR/turtle/)

\[VOCAB-ORG\]

Dave Reynolds. [The Organization Ontology](https://www.w3.org/TR/vocab-org/). 16 January 2014. W3C Recommendation. URL: [http://www.w3.org/TR/vocab-org/](https://www.w3.org/TR/vocab-org/)

\[WEBARCH\]

Ian Jacobs; Norman Walsh. [Architecture of the World Wide Web, Volume One](https://www.w3.org/TR/webarch/). 15 December 2004. W3C Recommendation. URL: [http://www.w3.org/TR/webarch/](https://www.w3.org/TR/webarch/)

\[XML-EXC-C14N\]

John Boyer; Donald Eastlake; Joseph Reagle. [Exclusive XML Canonicalization Version 1.0](https://www.w3.org/TR/xml-exc-c14n). 18 July 2002. W3C Recommendation. URL: [http://www.w3.org/TR/xml-exc-c14n](https://www.w3.org/TR/xml-exc-c14n)

\[XML-NAMES\]

Tim Bray; Dave Hollander; Andrew Layman; Richard Tobin; Henry Thompson et al. [Namespaces in XML 1.0 (Third Edition)](https://www.w3.org/TR/xml-names). 8 December 2009. W3C Recommendation. URL: [http://www.w3.org/TR/xml-names](https://www.w3.org/TR/xml-names)

\[XML10\]

Tim Bray; Jean Paoli; Michael Sperberg-McQueen; Eve Maler; François Yergeau et al. [Extensible Markup Language (XML) 1.0 (Fifth Edition)](https://www.w3.org/TR/xml). 26 November 2008. W3C Recommendation. URL: [http://www.w3.org/TR/xml](https://www.w3.org/TR/xml)
