<!--
  ⚠ THIRD-PARTY SPECIFICATION — NOT AN ORIGINAL WORK OF THIS PROJECT.
  Title:     RDF 1.1 Turtle — Terse RDF Triple Language
  Source:    https://www.w3.org/TR/turtle/
  Publisher: W3C
  License:   W3C Document License 2023 (https://www.w3.org/copyright/document-license-2023/)
  Retrieved: 2026-06-16
  Reproduced verbatim for offline reference and AI-agent context. The
  publisher's original copyright and license apply. Do not hand-edit —
  refresh from source (see docs/specs/references/README.md).
-->

> **Third-party specification — reproduced for offline reference and AI-agent context.**
> **Title:** RDF 1.1 Turtle — Terse RDF Triple Language  
> **Status:** W3C Recommendation  
> **Source:** <https://www.w3.org/TR/turtle/>  
> **Publisher:** W3C  
> **License:** W3C Document License 2023 — <https://www.w3.org/copyright/document-license-2023/>  
> **Retrieved:** 2026-06-16  
> The publisher's original copyright and license apply. Do not hand-edit;
> refresh from source — see [README](./README.md).

---

RDF 1.1 Turtle   

[![W3C](https://www.w3.org/Icons/w3c_home)](https://www.w3.org/)

# RDF 1.1 Turtle

## Terse RDF Triple Language

## W3C Recommendation 25 February 2014

This version:

[http://www.w3.org/TR/2014/REC-turtle-20140225/](https://www.w3.org/TR/2014/REC-turtle-20140225/)

Latest published version:

[http://www.w3.org/TR/turtle/](https://www.w3.org/TR/turtle/)

Test suite:

[http://www.w3.org/TR/2014/NOTE-rdf11-testcases-20140225/](https://www.w3.org/TR/2014/NOTE-rdf11-testcases-20140225/)

Implementation report:

[http://www.w3.org/2013/TurtleReports/index.html](https://www.w3.org/2013/TurtleReports/index.html)

Previous version:

[http://www.w3.org/TR/2014/PR-turtle-20140225/](https://www.w3.org/TR/2014/PR-turtle-20140109/)

Editors:

[Eric Prud'hommeaux](https://www.w3.org/People/Eric/), [W3C](https://www.w3.org/)

[Gavin Carothers](http://gavin.carothers.name/), [Lex Machina, Inc](http://lexmachina.com/)

Authors:

[David Beckett](http://www.dajobe.org/)

[Tim Berners-Lee](https://www.w3.org/People/Berners-Lee/), [W3C](https://www.w3.org/)

[Eric Prud'hommeaux](https://www.w3.org/People/Eric/), [W3C](https://www.w3.org/)

[Gavin Carothers](http://gavin.carothers.name/), [Lex Machina, Inc](http://lexmachina.com/)

Please check the [**errata**](https://www.w3.org/2014/rdf1.1-errata) for any errors or issues reported since publication.

The English version of this specification is the only normative version. Non-normative [translations](https://www.w3.org/Consortium/Translation/) may also be available.

[Copyright](https://www.w3.org/Consortium/Legal/ipr-notice#Copyright) © 2008-2014 [W3C](https://www.w3.org/)® ([MIT](http://www.csail.mit.edu/), [ERCIM](http://www.ercim.eu/), [Keio](http://www.keio.ac.jp/), [Beihang](http://ev.buaa.edu.cn/)), All Rights Reserved. W3C [liability](https://www.w3.org/Consortium/Legal/ipr-notice#Legal_Disclaimer), [trademark](https://www.w3.org/Consortium/Legal/ipr-notice#W3C_Trademarks) and [document use](https://www.w3.org/Consortium/Legal/copyright-documents) rules apply.

---

## Abstract

The Resource Description Framework (RDF) is a general-purpose language for representing information in the Web.

This document defines a textual syntax for RDF called Turtle that allows an RDF graph to be completely written in a compact and natural text form, with abbreviations for common usage patterns and datatypes. Turtle provides levels of compatibility with the N-Triples \[[N-TRIPLES](#bib-N-TRIPLES)\] format as well as the triple pattern syntax of the [SPARQL](https://www.w3.org/TR/sparql11-query/) W3C Recommendation.

## Status of This Document

_This section describes the status of this document at the time of its publication. Other documents may supersede this document. A list of current W3C publications and the latest revision of this technical report can be found in the [W3C technical reports index](https://www.w3.org/TR/) at http://www.w3.org/TR/._

This document is a part of the RDF 1.1 document suite. The document defines Turtle, the Terse RDF Triple Language, a concrete syntax for RDF \[[RDF11-CONCEPTS](#bib-RDF11-CONCEPTS)\].

This document was published by the [RDF Working Group](https://www.w3.org/2011/rdf-wg/) as a Recommendation. If you wish to make comments regarding this document, please send them to [public-rdf-comments@w3.org](mailto:public-rdf-comments@w3.org) ([subscribe](mailto:public-rdf-comments-request@w3.org?subject=subscribe), [archives](http://lists.w3.org/Archives/Public/public-rdf-comments/)). All comments are welcome.

Please see the Working Group's [implementation report](https://www.w3.org/2013/TurtleReports/index.html).

This document has been reviewed by W3C Members, by software developers, and by other W3C groups and interested parties, and is endorsed by the Director as a W3C Recommendation. It is a stable document and may be used as reference material or cited from another document. W3C's role in making the Recommendation is to draw attention to the specification and to promote its widespread deployment. This enhances the functionality and interoperability of the Web.

This document was produced by a group operating under the [5 February 2004 W3C Patent Policy](https://www.w3.org/Consortium/Patent-Policy-20040205/). W3C maintains a [public list of any patent disclosures](https://www.w3.org/2004/01/pp-impl/46168/status) made in connection with the deliverables of the group; that page also includes instructions for disclosing a patent. An individual who has actual knowledge of a patent which the individual believes contains [Essential Claim(s)](https://www.w3.org/Consortium/Patent-Policy-20040205/#def-essential) must disclose the information in accordance with [section 6 of the W3C Patent Policy](https://www.w3.org/Consortium/Patent-Policy-20040205/#sec-Disclosure).

## Table of Contents

-   [1\. Introduction](#sec-intro)
-   [2\. Turtle Language](#language-features)
    -   [2.1 Simple Triples](#simple-triples)
    -   [2.2 Predicate Lists](#predicate-lists)
    -   [2.3 Object Lists](#object-lists)
    -   [2.4 IRIs](#sec-iri)
    -   [2.5 RDF Literals](#literals)
        -   [2.5.1 Quoted Literals](#turtle-literals)
        -   [2.5.2 Numbers](#abbrev)
        -   [2.5.3 Booleans](#booleans)
    -   [2.6 RDF Blank Nodes](#BNodes)
    -   [2.7 Nesting Unlabeled Blank Nodes in Turtle](#unlabeled-bnodes)
    -   [2.8 Collections](#collections)
-   [3\. Examples](#sec-examples)
-   [4\. Turtle compared to SPARQL](#sec-diff-sparql)
-   [5\. Conformance](#conformance)
    -   [5.1 Media Type and Content Encoding](#sec-mime)
-   [6\. Turtle Grammar](#sec-grammar)
    -   [6.1 White Space](#sec-grammar-ws)
    -   [6.2 Comments](#sec-grammar-comments)
    -   [6.3 IRI References](#sec-iri-references)
    -   [6.4 Escape Sequences](#sec-escapes)
    -   [6.5 Grammar](#sec-grammar-grammar)
-   [7\. Parsing](#sec-parsing)
    -   [7.1 Parser State](#sec-parsing-state)
    -   [7.2 RDF Term Constructors](#sec-parsing-terms)
    -   [7.3 RDF Triples Constructors](#sec-parsing-triples)
    -   [7.4 Parsing Example](#sec-parsing-example)
-   [A. Embedding Turtle in HTML documents](#in-html)
    -   [A.1 XHTML](#xhtml)
    -   [A.2 Parsing Turtle in HTML](#in-html-parsing)
-   [B. Internet Media Type, File Extension and Macintosh File Type](#sec-mediaReg)
-   [C. Acknowledgements](#sec-acks)
-   [D. Change Log](#sec-changelog)
    -   [D.1 Changes since January 2014 Proposed Recommendation](#sec-change-log-PR-REC)
    -   [D.2 Changes from February 2013 Candidate Recommendation to January 2014 Proposed Recommendation](#sec-changelog-CR-PR)
    -   [D.3 Changes from August 2011 First Public Working Draft to Candidate Recommendation](#sec-changelog-WD-CR)
    -   [D.4 Changes from January 2008 Team Submission to First Public Working Draft](#sec-changelog-Subm-WD)
-   [E. References](#references)
    -   [E.1 Normative references](#normative-references)
    -   [E.2 Informative references](#informative-references)

## 1\. Introduction

_This section is non-normative._

This document defines Turtle, the Terse RDF Triple Language, a concrete syntax for RDF \[[RDF11-CONCEPTS](#bib-RDF11-CONCEPTS)\].

A Turtle document is a textual representations of an RDF graph. The following Turtle document describes the relationship between Green Goblin and Spiderman.

Example 1

@base <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix rel: <http://www.perceive.net/schemas/relationship/> .

<#green-goblin>
    rel:enemyOf <#spiderman> ;
    a foaf:Person ;    # in the context of the Marvel universe
    foaf:name "Green Goblin" .

<#spiderman>
    rel:enemyOf <#green-goblin> ;
    a foaf:Person ;
    foaf:name "Spiderman", "Человек-паук"@ru .

This example introduces many of features of the Turtle language: [@base and Relative IRIs](#relative-iri), [@prefix and prefixed names](#prefixed-name), [predicate lists](#predicate-lists) separated by '`;`', [object lists](#object-lists) separated by '`,`', the token `[a](#iri-a)`, and [literals](#literals).

The Turtle grammar for [`triples`](#grammar-production-triples) is a subset of the [SPARQL 1.1 Query Language](https://www.w3.org/TR/sparql11-query/) \[[SPARQL11-QUERY](#bib-SPARQL11-QUERY)\] grammar for [`TriplesBlock`](https://www.w3.org/TR/sparql11-query/#rTriplesBlock). The two grammars share production and terminal names where possible.

The construction of an RDF graph from a Turtle document is defined in [Turtle Grammar](#sec-grammar) and [Parsing](#sec-parsing).

## 2\. Turtle Language

_This section is non-normative._

A Turtle document allows writing down an RDF graph in a compact textual form. An RDF graph is made up of [triples](https://www.w3.org/TR/rdf11-concepts/#dfn-rdf-triple) consisting of a subject, predicate and object.

Comments may be given after a '`#`' that is not part of another lexical token and continue to the end of the line.

### 2.1 Simple Triples

The simplest triple statement is a sequence of (subject, predicate, object) terms, separated by whitespace and terminated by '`.`' after each triple.

Example 2

<http://example.org/#spiderman> <http://www.perceive.net/schemas/relationship/enemyOf> <http://example.org/#green-goblin> .
			

### 2.2 Predicate Lists

Often the same subject will be referenced by a number of predicates. The [predicateObjectList production](#grammar-production-predicateObjectList) matches a series of predicates and objects, separated by '`;`', following a subject. This expresses a series of RDF Triples with that subject and each predicate and object allocated to one triple. Thus, the '`;`' symbol is used to repeat the subject of triples that vary only in predicate and object RDF terms.

These two examples are equivalent ways of writing the triples about Spiderman.

Example 3

<http://example.org/#spiderman> <http://www.perceive.net/schemas/relationship/enemyOf> <http://example.org/#green-goblin> ;
				<http://xmlns.com/foaf/0.1/name> "Spiderman" .
			

Example 4

<http://example.org/#spiderman> <http://www.perceive.net/schemas/relationship/enemyOf> <http://example.org/#green-goblin> .
<http://example.org/#spiderman> <http://xmlns.com/foaf/0.1/name> "Spiderman" .
			

### 2.3 Object Lists

As with predicates often objects are repeated with the same subject and predicate. The [objectList production](#grammar-production-objectList) matches a series of objects separated by '`,`' following a predicate. This expresses a series of RDF Triples with the corresponding subject and predicate and each object allocated to one triple. Thus, the '`,`' symbol is used to repeat the subject and predicate of triples that only differ in the object RDF term.

These two examples are equivalent ways of writing Spiderman's name in two languages.

Example 5

<http://example.org/#spiderman> <http://xmlns.com/foaf/0.1/name> "Spiderman", "Человек-паук"@ru .
			

Example 6

<http://example.org/#spiderman> <http://xmlns.com/foaf/0.1/name> "Spiderman" .
<http://example.org/#spiderman> <http://xmlns.com/foaf/0.1/name> "Человек-паук"@ru .
			

There are three types of _RDF Term_ defined in RDF Concepts: [IRIs](https://www.w3.org/TR/rdf11-concepts/#dfn-iri) (Internationalized Resource Identifiers), [literals](https://www.w3.org/TR/rdf11-concepts/#dfn-literal) and [blank nodes](https://www.w3.org/TR/rdf11-concepts/#dfn-blank-node). Turtle provides a number of ways of writing each.

### 2.4 IRIs

[IRIs](https://www.w3.org/TR/rdf11-concepts/#dfn-iri) may be written as relative or absolute IRIs or prefixed names. Relative and absolute IRIs are enclosed in '<' and '>' and may contain [numeric escape sequences](#numeric) (described below). For example `<http://example.org/#green-goblin>`.

Relative IRIs like `<#green-goblin>` are resolved relative to the current base IRI. A new base IRI can be defined using the '`@base`' or '`BASE`' directive. Specifics of this operation are defined in [section 6.3 IRI References](#sec-iri-references)

The token '`a`' in the predicate position of a Turtle triple represents the IRI `http://www.w3.org/1999/02/22-rdf-syntax-ns#type` .

A _prefixed name_ is a prefix label and a local part, separated by a colon ":". A prefixed name is turned into an IRI by concatenating the IRI associated with the prefix and the local part. The '`@prefix`' or '`PREFIX`' directive associates a prefix label with an IRI. Subsequent '`@prefix`' or '`PREFIX`' directives may re-map the same prefix label.

Note

The Turtle language originally permitted only the syntax including the '`@`' character for writing prefix and base directives. The case-insensitive '`PREFIX`' and '`BASE`' forms were added to align Turtle's syntax with that of SPARQL. It is advisable to serialize RDF using the '`@prefix`' and '`@base`' forms until RDF 1.1 Turtle parsers are widely deployed.

To write `http://www.perceive.net/schemas/relationship/enemyOf` using a prefixed name:

1.  Define a prefix label for the vocabulary IRI `http://www.perceive.net/schemas/relationship/` as `somePrefix`
2.  Then write `somePrefix:enemyOf` which is equivalent to writing `<http://www.perceive.net/schemas/relationship/enemyOf>`

This can be written using either the original Turtle syntax for prefix declarations:

Example 7

@prefix somePrefix: <http://www.perceive.net/schemas/relationship/> .

<http://example.org/#green-goblin> somePrefix:enemyOf <http://example.org/#spiderman> .
				  

or SPARQL's syntax for prefix declarations:

Example 8

PREFIX somePrefix: <http://www.perceive.net/schemas/relationship/>

<http://example.org/#green-goblin> somePrefix:enemyOf <http://example.org/#spiderman> .
				  

Note

Prefixed names are a superset of XML QNames. They differ in that the local part of prefixed names may include:

-   leading digits, e.g. `leg:3032571` or `isbn13:9780136019701`
-   non leading colons, e.g. `og:video:height`
-   [reserved character escape sequences](#reserved), e.g. `wgs:lat\-long`

The following Turtle document contains examples of all the different ways of writing IRIs in Turtle.

Example 9

\# A triple with all absolute IRIs
<http://one.example/subject1> <http://one.example/predicate1> <http://one.example/object1> .

@base <http://one.example/> .
<subject2> <predicate2> <object2> .     # relative IRIs, e.g. http://one.example/subject2

BASE <http://one.example/>
<subject2> <predicate2> <object2> .     # relative IRIs, e.g. http://one.example/subject2

@prefix p: <http://two.example/> .
p:subject3 p:predicate3 p:object3 .     # prefixed name, e.g. http://two.example/subject3

PREFIX p: <http://two.example/>
p:subject3 p:predicate3 p:object3 .     # prefixed name, e.g. http://two.example/subject3

@prefix p: <path/> .                    # prefix p: now stands for http://one.example/path/
p:subject4 p:predicate4 p:object4 .     # prefixed name, e.g. http://one.example/path/subject4

@prefix : <http://another.example/> .    # empty prefix
:subject5 :predicate5 :object5 .        # prefixed name, e.g. http://another.example/subject5

:subject6 a :subject7 .                 # same as :subject6 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> :subject7 .

<http://伝言.example/?user=أكرم&amp;channel=R%26D> a :subject8 . # a multi-script subject IRI .

Note

The '`@prefix`' and '`@base`' directives require a trailing '`.`' after the IRI, the equalivent '`PREFIX`' and '`BASE`' must not have a trailing '`.`' after the IRI part of the directive.

### 2.5 RDF Literals

[Literals](https://www.w3.org/TR/rdf11-concepts/#dfn-literal) are used to identify values such as strings, numbers, dates.

Example 10

@prefix foaf: <http://xmlns.com/foaf/0.1/> .

<http://example.org/#green-goblin> foaf:name "Green Goblin" .

<http://example.org/#spiderman> foaf:name "Spiderman" .

#### 2.5.1 Quoted Literals

Quoted Literals (Grammar production [RDFLiteral](#grammar-production-RDFLiteral)) have a lexical form followed by a language tag, a datatype IRI, or neither. The representation of the lexical form consists of an initial delimiter, e.g. `"` (U+0022), a sequence of permitted characters or [numeric escape sequence](#numeric) or [string escape sequence](#string), and a final delimiter. The corresponding [RDF lexical form](https://www.w3.org/TR/rdf11-concepts/#dfn-lexical-form) is the characters between the delimiters, after processing any escape sequences. If present, the [language tag](https://www.w3.org/TR/rdf11-concepts/#dfn-language-tagged-string) is preceded by a '`@`' (U+0040). If there is no language tag, there may be a [datatype IRI](https://www.w3.org/TR/rdf11-concepts/#dfn-datatype-iri), preceeded by '`^^`' (U+005E U+005E). The datatype IRI in Turtle may be written using either an [absolute IRI](#sec-iri), a [relative IRI](#sec-iri), or [prefixed name](#prefixed-name). If there is no datatype IRI and no language tag, the datatype is `xsd:string`.

'`\`' (U+005C) may not appear in any quoted literal except as part of an escape sequence. Other restrictions depend on the delimiter:

-   Literals delimited by `'` (U+0027), may not contain the characters `'`, `LF` (U+000A), or `CR` (U+000D).
-   Literals delimited by `"`, may not contain the characters `"`, `LF`, or `CR`.
-   Literals delimited by `'''` may not contain the sequence of characters `'''`.
-   Literals delimited by `"""` may not contain the sequence of characters `"""`.

Example 11

@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix show: <http://example.org/vocab/show/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

show:218 rdfs:label "That Seventies Show"^^xsd:string .            # literal with XML Schema string datatype
show:218 rdfs:label "That Seventies Show"^^<http://www.w3.org/2001/XMLSchema#string> . # same as above
show:218 rdfs:label "That Seventies Show" .                                            # same again
show:218 show:localName "That Seventies Show"@en .                 # literal with a language tag
show:218 show:localName 'Cette Série des Années Soixante-dix'@fr . # literal delimited by single quote
show:218 show:localName "Cette Série des Années Septante"@fr-be .  # literal with a region subtag
show:218 show:blurb '''This is a multi-line                        # literal with embedded new lines and quotes
literal with many quotes (""""")
and up to two sequential apostrophes ('').''' .

#### 2.5.2 Numbers

Numbers can be written like other literals with lexical form and datatype (e.g. `"-5.0"^^xsd:decimal`). Turtle has a shorthand syntax for writing integer values, arbitrary precision decimal values, and double precision floating point values.

| Data Type | Abbreviated | Lexical | Description |
| --- | --- | --- | --- |
| **xsd:integer** | `-5` | `"-5"^^xsd:integer` | Integer values may be written as an optional sign and a series of digits. Integers match the regular expression "`[+-]?[0-9]+`". |
| **xsd:decimal** | `-5.0` | `"-5.0"^^xsd:decimal` | Arbitrary-precision decimals may be written as an optional sign, zero or more digits, a decimal point and one or more digits. Decimals match the regular expression "`[+-]?[0-9]*\.[0-9]+`". |
| **xsd:double** | `4.2E9` | `"4.2E9"^^xsd:double` | Double-precision floating point values may be written as an optionally signed mantissa with an optional decimal point, the letter "e" or "E", and an optionally signed integer exponent. The exponent matches the regular expression "`[+-]?[0-9]+`" and the mantissa one of these regular expressions: "`[+-]?[0-9]+\.[0-9]+`", "`[+-]?\.[0-9]+`" or "`[+-]?[0-9]`". |

Example 12

@prefix : <http://example.org/elements> .                                                                              
<http://en.wikipedia.org/wiki/Helium>                                                                                  
    :atomicNumber 2 ;               # xsd:integer                                                                      
    :atomicMass 4.002602 ;          # xsd:decimal                                                                      
    :specificGravity 1.663E-4 .     # xsd:double                                                                       
				

#### 2.5.3 Booleans

Boolean values may be written as either '`true`' or '`false`' (case-sensitive) and represent RDF literals with the datatype [xsd:boolean](https://www.w3.org/TR/xmlschema-2/#boolean).

Example 13

@prefix : <http://example.org/stats> .
<http://somecountry.example/census2007>
    :isLandlocked false .           # xsd:boolean

### 2.6 RDF Blank Nodes

[RDF blank nodes](https://www.w3.org/TR/rdf11-concepts/#dfn-blank-node) in Turtle are expressed as `_:` followed by a blank node label which is a series of name characters. The characters in the label are built upon [PN\_CHARS\_BASE](#grammar-production-PN_CHARS_BASE), liberalized as follows:

-   The characters `_` and digits may appear anywhere in a blank node label.
-   The character `.` may appear anywhere except the first or last character.
-   The characters `-`, `U+00B7`, `U+0300` to `U+036F` and `U+203F` to `U+2040` are permitted anywhere except the first character.

A fresh RDF blank node is allocated for each unique blank node label in a document. Repeated use of the same blank node label identifies the same RDF blank node.

Example 14

@prefix foaf: <http://xmlns.com/foaf/0.1/> .

\_:alice foaf:knows \_:bob .
\_:bob foaf:knows \_:alice .

### 2.7 Nesting Unlabeled Blank Nodes in Turtle

In Turtle, fresh RDF blank nodes are also allocated when matching the production [blankNodePropertyList](#grammar-production-blankNodePropertyList) and the terminal [ANON](#grammar-production-ANON). Both of these may appear in the [subject](#grammar-production-subject) or [object](#grammar-production-object) position of a triple (see the Turtle Grammar). That subject or object is a fresh RDF blank node. This blank node also serves as the subject of the triples produced by matching the [predicateObjectList](#grammar-production-predicateObjectList) production embedded in a blankNodePropertyList. The generation of these triples is described in [Predicate Lists](#predicate-lists). Blank nodes are also allocated for [collections](#collections) described below.

Example 15

@prefix foaf: <http://xmlns.com/foaf/0.1/> .

# Someone knows someone else, who has the name "Bob".
\[\] foaf:knows \[ foaf:name "Bob" \] .

The Turtle grammar allows [blankNodePropertyList](#grammar-production-blankNodePropertyList)s to be nested. In this case, each inner `[` establishes a new subject blank node which reverts to the outer node at the `]`, and serves as the current subject for [predicate object lists](#grammar-production-predicateObjectList).

The use of [predicateObjectList](#grammar-production-predicateObjectList) within a [blankNodePropertyList](#grammar-production-blankNodePropertyList) is a common idiom for representing a series of properties of a node.

Abbreviated:

Example 16

@prefix foaf: <http://xmlns.com/foaf/0.1/> .

\[ foaf:name "Alice" \] foaf:knows \[
    foaf:name "Bob" ;
    foaf:knows \[
        foaf:name "Eve" \] ;
    foaf:mbox <bob@example.com> \] .
				

Corresponding simple triples:

Example 17

\_:a <http://xmlns.com/foaf/0.1/name> "Alice" .
\_:a <http://xmlns.com/foaf/0.1/knows> \_:b .
\_:b <http://xmlns.com/foaf/0.1/name> "Bob" .
\_:b <http://xmlns.com/foaf/0.1/knows> \_:c .
\_:c <http://xmlns.com/foaf/0.1/name> "Eve" .
\_:b <http://xmlns.com/foaf/0.1/mbox> <bob@example.com> .
				

### 2.8 Collections

RDF provides a [Collection](https://www.w3.org/TR/rdf11-mt/#rdf-collections) \[[RDF11-MT](#bib-RDF11-MT)\] structure for lists of RDF nodes. The Turtle syntax for Collections is a possibly empty list of RDF terms enclosed by `()`. This collection represents an `rdf:first`/`rdf:rest` list structure with the sequence of objects of the `rdf:first` statements being the order of the terms enclosed by `()`.

The `(…)` syntax _MUST_ appear in the [subject](#grammar-production-subject) or [object](#grammar-production-object) position of a triple (see the Turtle Grammar). The blank node at the head of the list is the subject or object of the containing triple.

Example 18

@prefix : <http://example.org/foo> .
# the object of this triple is the RDF collection blank node
:subject :predicate ( :a :b :c ) .

# an empty collection value - rdf:nil
:subject :predicate2 () .
				

## 3\. Examples

_This section is non-normative._

This example is a Turtle translation of [example 7](https://www.w3.org/TR/rdf-syntax-grammar/#example7) in the [RDF/XML Syntax specification](https://www.w3.org/TR/rdf-syntax-grammar/) ([example1.ttl](examples/example1.ttl)):

Example 19

@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix dc: <http://purl.org/dc/elements/1.1/> .
@prefix ex: <http://example.org/stuff/1.0/> .

<http://www.w3.org/TR/rdf-syntax-grammar>
  dc:title "RDF/XML Syntax Specification (Revised)" ;
  ex:editor \[
    ex:fullname "Dave Beckett";
    ex:homePage <http://purl.org/net/dajobe/>
  \] .

An example of an RDF collection of two literals.

Example 20

PREFIX : <http://example.org/stuff/1.0/>
:a :b ( "apple" "banana" ) .
          

which is short for ([example2.ttl](examples/example2.ttl)):

Example 21

@prefix : <http://example.org/stuff/1.0/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
:a :b
  \[ rdf:first "apple";
    rdf:rest \[ rdf:first "banana";
               rdf:rest rdf:nil \]
  \] .

An example of two identical triples containing literal objects containing newlines, written in plain and long literal forms. The line breaks in this example are LINE FEED characters (U+000A). ([example3.ttl](examples/example3.ttl)):

Example 22

@prefix : <http://example.org/stuff/1.0/> .

:a :b "The first line\\nThe second line\\n  more" .

:a :b """The first line
The second line
  more""" .

As indicated by the grammar, a [collection](#grammar-production-collection) can be either a [subject](#grammar-production-subject) or an [object](#grammar-production-object). This subject or object will be the novel blank node for the first object, if the collection has one or more objects, or `rdf:nil` if the collection is empty.

For example,

Example 23

@prefix : <http://example.org/stuff/1.0/> .
(1 2.0 3E1) :p "w" .

is syntactic sugar for (noting that the blank nodes `b0`, `b1` and `b2` do not occur anywhere else in the RDF graph):

Example 24

@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
    \_:b0  rdf:first  1 ;
          rdf:rest   \_:b1 .
    \_:b1  rdf:first  2.0 ;
          rdf:rest   \_:b2 .
    \_:b2  rdf:first  3E1 ;
          rdf:rest   rdf:nil .
    \_:b0  :p         "w" . 

RDF collections can be nested and can involve other syntactic forms:

Example 25

PREFIX : <http://example.org/stuff/1.0/>
(1 \[:p :q\] ( 2 ) ) :p2 :q2 .

is syntactic sugar for:

Example 26

@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
    \_:b0  rdf:first  1 ;
          rdf:rest   \_:b1 .
    \_:b1  rdf:first  \_:b2 .
    \_:b2  :p         :q .
    \_:b1  rdf:rest   \_:b3 .
    \_:b3  rdf:first  \_:b4 .
    \_:b4  rdf:first  2 ;
          rdf:rest   rdf:nil .
    \_:b3  rdf:rest   rdf:nil .

## 4\. Turtle compared to SPARQL

_This section is non-normative._

The [SPARQL 1.1 Query LanguageF](https://www.w3.org/TR/sparql11-query/) (SPARQL) \[[SPARQL11-QUERY](#bib-SPARQL11-QUERY)\] uses a Turtle style syntax for its [TriplesBlock production](https://www.w3.org/TR/sparql11-query/#rTriplesBlock). This production differs from the Turtle language in that:

1.  [SPARQL permits RDF Literals](https://www.w3.org/TR/sparql11-query/#rGraphTerm) as the subject of RDF triples.
2.  SPARQL permits variables (`?`_name_ or `$`_name_) in any part of the triple of the form.
3.  Turtle allows [prefix and base declarations](#grammar-production-directive) anywhere outside of a triple. In SPARQL, they are only allowed in the [Prologue](https://www.w3.org/TR/sparql11-query/#rPrologue) (at the start of the SPARQL query).
4.  SPARQL uses case insensitive keywords, except for '`a`'. Turtle's `@prefix` and `@base` declarations are case sensitive, the SPARQL dervied `PREFIX` and `BASE` are case insensitive.
5.  '`true`' and '`false`' are case insensitive in SPARQL and case sensitive in Turtle. `TrUe` is not a valid boolean value in Turtle.

For further information see the [Syntax for IRIs](https://www.w3.org/TR/sparql11-query/#QSynIRI) and [SPARQL Grammar](https://www.w3.org/TR/sparql11-query/#grammar) sections of the SPARQL query document \[[SPARQL11-QUERY](#bib-SPARQL11-QUERY)\].

## 5\. Conformance

As well as sections marked as non-normative, all authoring guidelines, diagrams, examples, and notes in this specification are non-normative. Everything else in this specification is normative.

The key words _MUST_, _MUST NOT_, _REQUIRED_, _SHOULD_, _SHOULD NOT_, _RECOMMENDED_, _MAY_, and _OPTIONAL_ in this specification are to be interpreted as described in \[[RFC2119](#bib-RFC2119)\].

This specification defines conformance criteria for:

-   Turtle documents
-   Turtle parsers

A conforming **Turtle document** is a Unicode string that conforms to the grammar and additional constraints defined in [section 6. Turtle Grammar](#sec-grammar), starting with the [`turtleDoc` production](#grammar-production-turtleDoc). A Turtle document serializes an RDF Graph.

A conforming **Turtle parser** is a system capable of reading Turtle documents on behalf of an application. It makes the serialized RDF dataset, as defined in [section 7. Parsing](#sec-parsing), available to the application, usually through some form of API.

The IRI that identifies the Turtle language is: `http://www.w3.org/ns/formats/Turtle`

Note

This specification does not define how Turtle parsers handle non-conforming input documents.

### 5.1 Media Type and Content Encoding

The media type of Turtle is `text/turtle`. The content encoding of Turtle content is always UTF-8. Charset parameters on the mime type are required until such time as the `text/` media type tree permits UTF-8 to be sent without a charset parameter. See [section B. Internet Media Type, File Extension and Macintosh File Type](#sec-mediaReg) for the media type registration form.

## 6\. Turtle Grammar

A Turtle document is a Unicode\[[UNICODE](#bib-UNICODE)\] character string encoded in UTF-8. Unicode characters only in the range U+0000 to U+10FFFF inclusive are allowed.

### 6.1 White Space

White space (production [WS](#grammar-production-WS)) is used to separate two terminals which would otherwise be (mis-)recognized as one terminal. Rule names below in capitals indicate where white space is significant; these form a possible choice of terminals for constructing a Turtle parser.

White space is significant in the production [String](#grammar-production-String).

### 6.2 Comments

Comments in Turtle take the form of '#', outside an [IRIREF](#grammar-production-IRIREF) or [String](#grammar-production-String), and continue to the end of line (marked by characters U+000D or U+000A) or end of file if there is no end of line after the comment marker. Comments are treated as white space.

### 6.3 IRI References

Relative IRIs are resolved with base IRIs as per [Uniform Resource Identifier (URI): Generic Syntax](http://www.ietf.org/rfc/rfc3986.txt) \[[RFC3986](#bib-RFC3986)\] using only the basic algorithm in section 5.2. Neither Syntax-Based Normalization nor Scheme-Based Normalization (described in sections 6.2.2 and 6.2.3 of RFC3986) are performed. Characters additionally allowed in IRI references are treated in the same way that unreserved characters are treated in URI references, per section 6.5 of [Internationalized Resource Identifiers (IRIs)](http://www.ietf.org/rfc/rfc3987.txt) \[[RFC3987](#bib-RFC3987)\].

The `@base` or `BASE` directive defines the Base IRI used to resolve relative IRIs per RFC3986 section 5.1.1, "Base URI Embedded in Content". Section 5.1.2, "Base URI from the Encapsulating Entity" defines how the In-Scope Base IRI may come from an encapsulating document, such as a SOAP envelope with an xml:base directive or a mime multipart document with a Content-Location header. The "Retrieval URI" identified in 5.1.3, Base "URI from the Retrieval URI", is the URL from which a particular Turtle document was retrieved. If none of the above specifies the Base URI, the default Base URI (section 5.1.4, "Default Base URI") is used. Each `@base` or `BASE` directive sets a new In-Scope Base URI, relative to the previous one.

### 6.4 Escape Sequences

There are three forms of escapes used in turtle documents:

-   _numeric escape sequences_ represent Unicode code points:
    
    | Escape sequence | Unicode code point |
    | --- | --- |
    | '\\u' [hex](#grammar-production-HEX) [hex](#grammar-production-HEX) [hex](#grammar-production-HEX) [hex](#grammar-production-HEX) | A Unicode character in the range U+0000 to U+FFFF inclusive corresponding to the value encoded by the four hexadecimal digits interpreted from most significant to least significant digit. |
    | '\\U' [hex](#grammar-production-HEX) [hex](#grammar-production-HEX) [hex](#grammar-production-HEX) [hex](#grammar-production-HEX) [hex](#grammar-production-HEX) [hex](#grammar-production-HEX) [hex](#grammar-production-HEX) [hex](#grammar-production-HEX) | A Unicode character in the range U+0000 to U+10FFFF inclusive corresponding to the value encoded by the eight hexadecimal digits interpreted from most significant to least significant digit. |
    
    where [HEX](#grammar-production-HEX) is a hexadecimal character
    
    > HEX ::= \[0-9\] | \[A-F\] | \[a-f\]
    
-   _string escape sequences_ represent the characters traditionally escaped in string literals:
    
    | Escape sequence | Unicode code point |
    | --- | --- |
    | '\\t' | U+0009 |
    | '\\b' | U+0008 |
    | '\\n' | U+000A |
    | '\\r' | U+000D |
    | '\\f' | U+000C |
    | '\\"' | U+0022 |
    | '\\'' | U+0027 |
    | '\\\\' | U+005C |
    
-   _reserved character escape sequences_ consist of a '\\' followed by one of `~.-!$&'()*+,;=/?#@%_` and represent the character to the right of the '\\'.
    

Context where each kind of escape sequence can be used
|  | [numeric  
escapes](#numeric) | [string  
escapes](#string) | [reserved character  
escapes](#reserved) |
| --- | --- | --- | --- |
| IRIs, used as [RDF terms](#grammar-production-IRIREF) or as in [@prefix](#grammar-production-prefixID), [PREFIX](#grammar-production-sparqlPrefix), [@base](#grammar-production-base), or [BASE](#grammar-production-sparqlBase) declarations | yes | no | no |
| [local names](#grammar-production-PN_LOCAL) | no | no | yes |
| Strings | yes | yes | no |

Note

%-encoded sequences are in the [character range for IRIs](#grammar-production-IRIREF) and are [explicitly allowed](#grammar-production-PERCENT) in local names. These appear as a '%' followed by two hex characters and represent that same sequence of three characters. These sequences are _not_ decoded during processing. A term written as `<http://a.example/%66oo-bar>` in Turtle designates the IRI `http://a.example/%66oo-bar` and not IRI `http://a.example/foo-bar`. A term written as `ex:%66oo-bar` with a prefix `@prefix ex: <http://a.example/>` also designates the IRI `http://a.example/%66oo-bar`.

### 6.5 Grammar

The EBNF used here is defined in XML 1.0 \[[EBNF-NOTATION](#bib-EBNF-NOTATION)\]. Production labels consisting of a number and a final 's', e.g. \[[60s](https://www.w3.org/TR/sparql11-query/#rRDFLiteral)\], reference the production with that number in the [SPARQL 1.1 Query Language grammar](https://www.w3.org/TR/sparql11-query/#sparqlGrammar) \[[SPARQL11-QUERY](#bib-SPARQL11-QUERY)\].

Notes:

1.  Keywords in single quotes ('`@base`', '`@prefix`', '`a`', '`true`', '`false`') are case-sensitive. Keywords in double quotes ("`BASE`", "`PREFIX`") are case-insensitive.
2.  Escape sequences `[UCHAR](#grammar-production-UCHAR)` and `[ECHAR](#grammar-production-ECHAR)` are case sensitive.
3.  When tokenizing the input and choosing grammar rules, the longest match is chosen.
4.  The Turtle grammar is LL(1) and LALR(1) when the rules with uppercased names are used as terminals.
5.  The entry point into the grammar is `turtleDoc`.
6.  In signed numbers, no white space is allowed between the sign and the number.
7.  The \[162s\] `ANON` ::= '`[`' [WS](#grammar-production-WS)`*` '`]`' token allows any amount of white space and comments between `[]`s. The single space version is used in the grammar for clarity.
8.  The strings '[`@prefix`](#grammar-production-prefixID)' and '[`@base`](#grammar-production-base)' match the pattern for [LANGTAG](#grammar-production-LANGTAG), though neither "`prefix`" nor "`base`" are [registered language subtags](http://www.iana.org/assignments/language-subtag-registry). This specification does not define whether a quoted literal followed by either of these tokens (e.g. `"A"@base`) is in the Turtle language.

<table class="grammar"><tbody class="grammar-productions"><tr id="grammar-production-turtleDoc"><td>[1]</td><td><code>turtleDoc</code></td><td>::=</td><td><a href="#grammar-production-statement">statement</a><code class="grammar-star">*</code></td></tr><tr id="grammar-production-statement"><td>[2]</td><td><code>statement</code></td><td>::=</td><td><a href="#grammar-production-directive">directive</a> <code>| </code><a href="#grammar-production-triples">triples</a> '<code class="grammar-literal">.</code>'</td></tr><tr id="grammar-production-directive"><td>[3]</td><td><code>directive</code></td><td>::=</td><td><a href="#grammar-production-prefixID">prefixID</a> <code>| </code><a href="#grammar-production-base">base</a> <code>| </code><a href="#grammar-production-sparqlPrefix">sparqlPrefix</a> <code>| </code><a href="#grammar-production-sparqlBase">sparqlBase</a></td></tr><tr id="grammar-production-prefixID"><td>[4]</td><td><code>prefixID</code></td><td>::=</td><td>'<code class="grammar-literal">@prefix</code>' <a href="#grammar-production-PNAME_NS">PNAME_NS</a> <a href="#grammar-production-IRIREF">IRIREF</a> '<code class="grammar-literal">.</code>'</td></tr><tr id="grammar-production-base"><td>[5]</td><td><code>base</code></td><td>::=</td><td>'<code class="grammar-literal">@base</code>' <a href="#grammar-production-IRIREF">IRIREF</a> '<code class="grammar-literal">.</code>'</td></tr><tr id="grammar-production-sparqlBase"><td>[5s]</td><td><code>sparqlBase</code></td><td>::=</td><td><span class="add">"<code class="grammar-literal">BASE</code>"</span> <a href="#grammar-production-IRIREF">IRIREF</a></td></tr><tr id="grammar-production-sparqlPrefix"><td>[6s]</td><td><code>sparqlPrefix</code></td><td>::=</td><td><span class="add">"<code class="grammar-literal">PREFIX</code>"</span> <a href="#grammar-production-PNAME_NS">PNAME_NS</a> <a href="#grammar-production-IRIREF">IRIREF</a></td></tr><tr id="grammar-production-triples"><td>[6]</td><td><code>triples</code></td><td>::=</td><td><a href="#grammar-production-subject">subject</a> <a href="#grammar-production-predicateObjectList">predicateObjectList</a> <code>| </code><a href="#grammar-production-blankNodePropertyList">blankNodePropertyList</a> <a href="#grammar-production-predicateObjectList">predicateObjectList</a>?</td></tr><tr id="grammar-production-predicateObjectList"><td>[7]</td><td><code>predicateObjectList</code></td><td>::=</td><td><a href="#grammar-production-verb">verb</a> <a href="#grammar-production-objectList">objectList</a> ('<code class="grammar-literal">;</code>' (<a href="#grammar-production-verb">verb</a> <a href="#grammar-production-objectList">objectList</a>)?)<code class="grammar-star">*</code></td></tr><tr id="grammar-production-objectList"><td>[8]</td><td><code>objectList</code></td><td>::=</td><td><a href="#grammar-production-object">object</a> ('<code class="grammar-literal">,</code>' <a href="#grammar-production-object">object</a>)<code class="grammar-star">*</code></td></tr><tr id="grammar-production-verb"><td>[9]</td><td><code>verb</code></td><td>::=</td><td><a href="#grammar-production-predicate">predicate</a> <code>| </code>'<code class="grammar-literal">a</code>'</td></tr><tr id="grammar-production-subject"><td>[10]</td><td><code>subject</code></td><td>::=</td><td><a href="#grammar-production-iri">iri</a> <code>| </code><a class="add" href="#grammar-production-BlankNode">BlankNode</a> <code class="add">| </code><a class="add" href="#grammar-production-collection">collection</a></td></tr><tr id="grammar-production-predicate"><td>[11]</td><td><code>predicate</code></td><td>::=</td><td><a href="#grammar-production-iri">iri</a></td></tr><tr id="grammar-production-object"><td>[12]</td><td><code>object</code></td><td>::=</td><td><a href="#grammar-production-iri">iri</a> <code>| </code><a class="add" href="#grammar-production-BlankNode">BlankNode</a> <code class="add">| </code><a class="add" href="#grammar-production-collection">collection</a> <code>| </code><a href="#grammar-production-blankNodePropertyList">blankNodePropertyList</a> <code>| </code><a href="#grammar-production-literal">literal</a></td></tr><tr id="grammar-production-literal"><td>[13]</td><td><code>literal</code></td><td>::=</td><td><a href="#grammar-production-RDFLiteral">RDFLiteral</a> <code>| </code><a href="#grammar-production-NumericLiteral">NumericLiteral</a> <code>| </code><a href="#grammar-production-BooleanLiteral">BooleanLiteral</a></td></tr><tr id="grammar-production-blankNodePropertyList"><td>[14]</td><td><code>blankNodePropertyList</code></td><td>::=</td><td>'<code class="grammar-literal">[</code>' <a href="#grammar-production-predicateObjectList">predicateObjectList</a> '<code class="grammar-literal">]</code>'</td></tr><tr id="grammar-production-collection"><td>[15]</td><td><code>collection</code></td><td>::=</td><td>'<code class="grammar-literal">(</code>' <a href="#grammar-production-object">object</a><code class="grammar-star">*</code> '<code class="grammar-literal">)</code>'</td></tr><tr id="grammar-production-NumericLiteral"><td>[16]</td><td><code>NumericLiteral</code></td><td>::=</td><td><a href="#grammar-production-INTEGER">INTEGER</a> <code>| </code><a href="#grammar-production-DECIMAL">DECIMAL</a> <code>| </code><a href="#grammar-production-DOUBLE">DOUBLE</a></td></tr><tr id="grammar-production-RDFLiteral"><td>[128s]</td><td><code>RDFLiteral</code></td><td>::=</td><td><a href="#grammar-production-String">String</a> (<a href="#grammar-production-LANGTAG">LANGTAG</a> <code>| </code>'<code class="grammar-literal">^^</code>' <a href="#grammar-production-iri">iri</a>)?</td></tr><tr id="grammar-production-BooleanLiteral"><td>[133s]</td><td><code>BooleanLiteral</code></td><td>::=</td><td>'<code class="grammar-literal">true</code>' <code>| </code>'<code class="grammar-literal">false</code>'</td></tr><tr id="grammar-production-String"><td>[17]</td><td><code>String</code></td><td>::=</td><td><a href="#grammar-production-STRING_LITERAL_QUOTE">STRING_LITERAL_QUOTE</a> <code>| </code><a href="#grammar-production-STRING_LITERAL_SINGLE_QUOTE">STRING_LITERAL_SINGLE_QUOTE</a> <code>| </code><a href="#grammar-production-STRING_LITERAL_LONG_SINGLE_QUOTE">STRING_LITERAL_LONG_SINGLE_QUOTE</a> <code>| </code><a href="#grammar-production-STRING_LITERAL_LONG_QUOTE">STRING_LITERAL_LONG_QUOTE</a></td></tr><tr id="grammar-production-iri"><td>[135s]</td><td><code>iri</code></td><td>::=</td><td><a href="#grammar-production-IRIREF">IRIREF</a> <code>| </code><a href="#grammar-production-PrefixedName">PrefixedName</a></td></tr><tr id="grammar-production-PrefixedName"><td>[136s]</td><td><code>PrefixedName</code></td><td>::=</td><td><a href="#grammar-production-PNAME_LN">PNAME_LN</a> <code>| </code><a href="#grammar-production-PNAME_NS">PNAME_NS</a></td></tr><tr id="grammar-production-BlankNode"><td>[137s]</td><td><code>BlankNode</code></td><td>::=</td><td><a href="#grammar-production-BLANK_NODE_LABEL">BLANK_NODE_LABEL</a> <code>| </code><a href="#grammar-production-ANON">ANON</a></td></tr><tr><td colspan="4"><h3 id="terminals">Productions for terminals</h3></td></tr><tr class="grammar-token" id="grammar-production-IRIREF"><td>[18]</td><td><code>IRIREF</code></td><td>::=</td><td>'<code class="grammar-literal">&lt;</code>' ([<code class="grammar-chars">^#x00-#x20&lt;&gt;"{}|^`\</code>] <code>| </code><a href="#grammar-production-UCHAR">UCHAR</a>)<code class="grammar-star">*</code> '<code class="grammar-literal">&gt;</code>'<span class="grammar_comment"> /* #x00=NULL #01-#x1F=control codes #x20=space */</span></td></tr><tr class="grammar-token" id="grammar-production-PNAME_NS"><td>[139s]</td><td><code>PNAME_NS</code></td><td>::=</td><td><a href="#grammar-production-PN_PREFIX">PN_PREFIX</a>? '<code class="grammar-literal">:</code>'</td></tr><tr class="grammar-token" id="grammar-production-PNAME_LN"><td>[140s]</td><td><code>PNAME_LN</code></td><td>::=</td><td><a href="#grammar-production-PNAME_NS">PNAME_NS</a> <a href="#grammar-production-PN_LOCAL">PN_LOCAL</a></td></tr><tr class="grammar-token" id="grammar-production-BLANK_NODE_LABEL"><td>[141s]</td><td><code>BLANK_NODE_LABEL</code></td><td>::=</td><td>'<code class="grammar-literal">_:</code>' (<a href="#grammar-production-PN_CHARS_U">PN_CHARS_U</a> <code>| </code>[<code class="grammar-chars">0-9</code>]) ((<a href="#grammar-production-PN_CHARS">PN_CHARS</a> <code>| </code>'<code class="grammar-literal">.</code>')<code class="grammar-star">*</code> <a href="#grammar-production-PN_CHARS">PN_CHARS</a>)?</td></tr><tr class="grammar-token" id="grammar-production-LANGTAG"><td>[144s]</td><td><code>LANGTAG</code></td><td>::=</td><td>'<code class="grammar-literal">@</code>' [<code class="grammar-chars">a-zA-Z</code>]<code class="grammar-plus">+</code> ('<code class="grammar-literal">-</code>' [<code class="grammar-chars">a-zA-Z0-9</code>]<code class="grammar-plus">+</code>)<code class="grammar-star">*</code></td></tr><tr class="grammar-token" id="grammar-production-INTEGER"><td>[19]</td><td><code>INTEGER</code></td><td>::=</td><td>[<code class="grammar-chars">+-</code>]? [<code class="grammar-chars">0-9</code>]<code class="grammar-plus">+</code></td></tr><tr class="grammar-token" id="grammar-production-DECIMAL"><td>[20]</td><td><code>DECIMAL</code></td><td>::=</td><td>[<code class="grammar-chars">+-</code>]? [<code class="grammar-chars">0-9</code>]<code class="grammar-star">*</code> '<code class="grammar-literal">.</code>' [<code class="grammar-chars">0-9</code>]<code class="grammar-plus">+</code></td></tr><tr class="grammar-token" id="grammar-production-DOUBLE"><td>[21]</td><td><code>DOUBLE</code></td><td>::=</td><td>[<code class="grammar-chars">+-</code>]? ([<code class="grammar-chars">0-9</code>]<code class="grammar-plus">+</code> '<code class="grammar-literal">.</code>' [<code class="grammar-chars">0-9</code>]<code class="grammar-star">*</code> <a href="#grammar-production-EXPONENT">EXPONENT</a> <code>| </code>'<code class="grammar-literal">.</code>' [<code class="grammar-chars">0-9</code>]<code class="grammar-plus">+</code> <a href="#grammar-production-EXPONENT">EXPONENT</a> <code>| </code>[<code class="grammar-chars">0-9</code>]<code class="grammar-plus">+</code> <a href="#grammar-production-EXPONENT">EXPONENT</a>)</td></tr><tr class="grammar-token" id="grammar-production-EXPONENT"><td>[154s]</td><td><code>EXPONENT</code></td><td>::=</td><td>[<code class="grammar-chars">eE</code>] [<code class="grammar-chars">+-</code>]? [<code class="grammar-chars">0-9</code>]<code class="grammar-plus">+</code></td></tr><tr class="grammar-token" id="grammar-production-STRING_LITERAL_QUOTE"><td>[22]</td><td><code>STRING_LITERAL_QUOTE</code></td><td>::=</td><td>'<code class="grammar-literal">"</code>' ([<code class="grammar-chars">^#x22#x5C#xA#xD</code>] <code>| </code><a href="#grammar-production-ECHAR">ECHAR</a> <code>| </code><a href="#grammar-production-UCHAR">UCHAR</a>)<code class="grammar-star">*</code> '<code class="grammar-literal">"</code>'<span class="grammar_comment"> /* #x22=" #x5C=\ #xA=new line #xD=carriage return */</span></td></tr><tr class="grammar-token" id="grammar-production-STRING_LITERAL_SINGLE_QUOTE"><td>[23]</td><td><code>STRING_LITERAL_SINGLE_QUOTE</code></td><td>::=</td><td>"<code class="grammar-literal">'</code>" ([<code class="grammar-chars">^#x27#x5C#xA#xD</code>] <code>| </code><a href="#grammar-production-ECHAR">ECHAR</a> <code>| </code><a href="#grammar-production-UCHAR">UCHAR</a>)<code class="grammar-star">*</code> "<code class="grammar-literal">'</code>"<span class="grammar_comment"> /* #x27=' #x5C=\ #xA=new line #xD=carriage return */</span></td></tr><tr class="grammar-token" id="grammar-production-STRING_LITERAL_LONG_SINGLE_QUOTE"><td>[24]</td><td><code>STRING_LITERAL_LONG_SINGLE_QUOTE</code></td><td>::=</td><td>"<code class="grammar-literal">'''</code>" (("<code class="grammar-literal">'</code>" <code>| </code>"<code class="grammar-literal">''</code>")? ([<code class="grammar-chars">^'\</code>] <code>| </code><a href="#grammar-production-ECHAR">ECHAR</a> <code>| </code><a href="#grammar-production-UCHAR">UCHAR</a>))<code class="grammar-star">*</code> "<code class="grammar-literal">'''</code>"</td></tr><tr class="grammar-token" id="grammar-production-STRING_LITERAL_LONG_QUOTE"><td>[25]</td><td><code>STRING_LITERAL_LONG_QUOTE</code></td><td>::=</td><td>'<code class="grammar-literal">"""</code>' (('<code class="grammar-literal">"</code>' <code>| </code>'<code class="grammar-literal">""</code>')? ([<code class="grammar-chars">^"\</code>] <code>| </code><a href="#grammar-production-ECHAR">ECHAR</a> <code>| </code><a href="#grammar-production-UCHAR">UCHAR</a>))<code class="grammar-star">*</code> '<code class="grammar-literal">"""</code>'</td></tr><tr class="grammar-token" id="grammar-production-UCHAR"><td>[26]</td><td><code>UCHAR</code></td><td>::=</td><td>'<code class="grammar-literal">\u</code>' <a href="#grammar-production-HEX">HEX</a> <a href="#grammar-production-HEX">HEX</a> <a href="#grammar-production-HEX">HEX</a> <a href="#grammar-production-HEX">HEX</a> <code>| </code>'<code class="grammar-literal">\U</code>' <a href="#grammar-production-HEX">HEX</a> <a href="#grammar-production-HEX">HEX</a> <a href="#grammar-production-HEX">HEX</a> <a href="#grammar-production-HEX">HEX</a> <a href="#grammar-production-HEX">HEX</a> <a href="#grammar-production-HEX">HEX</a> <a href="#grammar-production-HEX">HEX</a> <a href="#grammar-production-HEX">HEX</a></td></tr><tr class="grammar-token" id="grammar-production-ECHAR"><td>[159s]</td><td><code>ECHAR</code></td><td>::=</td><td>'<code class="grammar-literal">\</code>' [<code class="grammar-chars">tbnrf"'\</code>]</td></tr><tr class="grammar-token" id="grammar-production-WS"><td>[161s]</td><td><code>WS</code></td><td>::=</td><td><code class="grammar-char-escape">#x20</code> <code>| </code><code class="grammar-char-escape">#x9</code> <code>| </code><code class="grammar-char-escape">#xD</code> <code>| </code><code class="grammar-char-escape">#xA</code><span class="grammar_comment"> /* #x20=space #x9=character tabulation #xD=carriage return #xA=new line */</span></td></tr><tr class="grammar-token" id="grammar-production-ANON"><td>[162s]</td><td><code>ANON</code></td><td>::=</td><td>'<code class="grammar-literal">[</code>' <a href="#grammar-production-WS">WS</a><code class="grammar-star">*</code> '<code class="grammar-literal">]</code>'</td></tr><tr class="grammar-token" id="grammar-production-PN_CHARS_BASE"><td>[163s]</td><td><code>PN_CHARS_BASE</code></td><td>::=</td><td>[<code class="grammar-chars">A-Z</code>] <code>| </code>[<code class="grammar-chars">a-z</code>] <code>| </code>[<code class="grammar-chars">#<span class="add">x</span>00C0-#<span class="add">x</span>00D6</code>] <code>| </code>[<code class="grammar-chars">#<span class="add">x</span>00D8-#<span class="add">x</span>00F6</code>] <code>| </code>[<code class="grammar-chars">#<span class="add">x</span>00F8-#<span class="add">x</span>02FF</code>] <code>| </code>[<code class="grammar-chars">#<span class="add">x</span>0370-#<span class="add">x</span>037D</code>] <code>| </code>[<code class="grammar-chars">#<span class="add">x</span>037F-#<span class="add">x</span>1FFF</code>] <code>| </code>[<code class="grammar-chars">#<span class="add">x</span>200C-#<span class="add">x</span>200D</code>] <code>| </code>[<code class="grammar-chars">#<span class="add">x</span>2070-#<span class="add">x</span>218F</code>] <code>| </code>[<code class="grammar-chars">#<span class="add">x</span>2C00-#<span class="add">x</span>2FEF</code>] <code>| </code>[<code class="grammar-chars">#<span class="add">x</span>3001-#<span class="add">x</span>D7FF</code>] <code>| </code>[<code class="grammar-chars">#<span class="add">x</span>F900-#<span class="add">x</span>FDCF</code>] <code>| </code>[<code class="grammar-chars">#<span class="add">x</span>FDF0-#<span class="add">x</span>FFFD</code>] <code>| </code>[<code class="grammar-chars">#<span class="add">x</span>10000-#<span class="add">x</span>EFFFF</code>]</td></tr><tr class="grammar-token" id="grammar-production-PN_CHARS_U"><td>[164s]</td><td><code>PN_CHARS_U</code></td><td>::=</td><td><a href="#grammar-production-PN_CHARS_BASE">PN_CHARS_BASE</a> <code>| </code>'<code class="grammar-literal">_</code>'</td></tr><tr class="grammar-token" id="grammar-production-PN_CHARS"><td>[166s]</td><td><code>PN_CHARS</code></td><td>::=</td><td><a href="#grammar-production-PN_CHARS_U">PN_CHARS_U</a> <code>| </code>'<code class="grammar-literal">-</code>' <code>| </code>[<code class="grammar-chars">0-9</code>] <code>| </code><code class="grammar-char-escape">#<span class="add">x</span>00B7</code> <code>| </code>[<code class="grammar-chars">#<span class="add">x</span>0300-#<span class="add">x</span>036F</code>] <code>| </code>[<code class="grammar-chars">#<span class="add">x</span>203F-#<span class="add">x</span>2040</code>]</td></tr><tr class="grammar-token" id="grammar-production-PN_PREFIX"><td>[167s]</td><td><code>PN_PREFIX</code></td><td>::=</td><td><a href="#grammar-production-PN_CHARS_BASE">PN_CHARS_BASE</a> ((<a href="#grammar-production-PN_CHARS">PN_CHARS</a> <code>| </code>'<code class="grammar-literal">.</code>')<code class="grammar-star">*</code> <a href="#grammar-production-PN_CHARS">PN_CHARS</a>)?</td></tr><tr class="grammar-token" id="grammar-production-PN_LOCAL"><td>[168s]</td><td><code>PN_LOCAL</code></td><td>::=</td><td>(<a href="#grammar-production-PN_CHARS_U">PN_CHARS_U</a> <code>| </code>'<code class="grammar-literal">:</code>' <code>| </code>[<code class="grammar-chars">0-9</code>] <code>| </code><a href="#grammar-production-PLX">PLX</a>) ((<a href="#grammar-production-PN_CHARS">PN_CHARS</a> <code>| </code>'<code class="grammar-literal">.</code>' <code>| </code>'<code class="grammar-literal">:</code>' <code>| </code><a href="#grammar-production-PLX">PLX</a>)<code class="grammar-star">*</code> (<a href="#grammar-production-PN_CHARS">PN_CHARS</a> <code>| </code>'<code class="grammar-literal">:</code>' <code>| </code><a href="#grammar-production-PLX">PLX</a>))?</td></tr><tr class="grammar-token" id="grammar-production-PLX"><td>[169s]</td><td><code>PLX</code></td><td>::=</td><td><a href="#grammar-production-PERCENT">PERCENT</a> <code>| </code><a href="#grammar-production-PN_LOCAL_ESC">PN_LOCAL_ESC</a></td></tr><tr class="grammar-token" id="grammar-production-PERCENT"><td>[170s]</td><td><code>PERCENT</code></td><td>::=</td><td>'<code class="grammar-literal">%</code>' <a href="#grammar-production-HEX">HEX</a> <a href="#grammar-production-HEX">HEX</a></td></tr><tr class="grammar-token" id="grammar-production-HEX"><td>[171s]</td><td><code>HEX</code></td><td>::=</td><td>[<code class="grammar-chars">0-9</code>] <code>| </code>[<code class="grammar-chars">A-F</code>] <code>| </code>[<code class="grammar-chars">a-f</code>]</td></tr><tr class="grammar-token" id="grammar-production-PN_LOCAL_ESC"><td>[172s]</td><td><code>PN_LOCAL_ESC</code></td><td>::=</td><td>'<code class="grammar-literal">\</code>' ('<code class="grammar-literal">_</code>' <code>| </code>'<code class="grammar-literal">~</code>' <code>| </code>'<code class="grammar-literal">.</code>' <code>| </code>'<code class="grammar-literal">-</code>' <code>| </code>'<code class="grammar-literal">!</code>' <code>| </code>'<code class="grammar-literal">$</code>' <code>| </code>'<code class="grammar-literal">&amp;</code>' <code>| </code>"<code class="grammar-literal">'</code>" <code>| </code>'<code class="grammar-literal">(</code>' <code>| </code>'<code class="grammar-literal">)</code>' <code>| </code>'<code class="grammar-literal">*</code>' <code>| </code>'<code class="grammar-literal">+</code>' <code>| </code>'<code class="grammar-literal">,</code>' <code>| </code>'<code class="grammar-literal">;</code>' <code>| </code>'<code class="grammar-literal">=</code>' <code>| </code>'<code class="grammar-literal">/</code>' <code>| </code>'<code class="grammar-literal">?</code>' <code>| </code>'<code class="grammar-literal">#</code>' <code>| </code>'<code class="grammar-literal">@</code>' <code>| </code>'<code class="grammar-literal">%</code>')</td></tr></tbody></table>

## 7\. Parsing

The RDF 1.1 Concepts and Abstract Syntax specification \[[RDF11-CONCEPTS](#bib-RDF11-CONCEPTS)\] defines three types of _RDF Term_: [IRIs](https://www.w3.org/TR/rdf11-concepts/#dfn-iri), [literals](https://www.w3.org/TR/rdf11-concepts/#dfn-literal) and [blank nodes](https://www.w3.org/TR/rdf11-concepts/#dfn-blank-node). Literals are composed of a [lexical form](https://www.w3.org/TR/rdf11-concepts/#dfn-lexical-form) and an optional [language tag](https://www.w3.org/TR/rdf11-concepts/#dfn-language-tag) \[[BCP47](#bib-BCP47)\] or datatype IRI. An extra type, `prefix`, is used during parsing to map string identifiers to namespace IRIs. This section maps a string conforming to the grammar in [section 6.5 Grammar](#sec-grammar-grammar) to a set of triples by mapping strings matching productions and lexical tokens to RDF terms or their components (e.g. language tags, lexical forms of literals). Grammar productions change the parser state and emit triples.

### 7.1 Parser State

Parsing Turtle requires a state of five items:

-   IRI `baseURI` — When the [base production](#grammar-production-base) is reached, the second rule argument, `IRIREF`, is the base URI used for relative IRI resolution.
-   Map\[[prefix](#prefix) -> IRI\] `namespaces` — The second and third rule arguments (`PNAME_NS` and `IRIREF`) in the [prefixID production](#grammar-production-prefixID) assign a namespace name (`IRIREF`) for the prefix (`PNAME_NS`). Outside of a `prefixID` production, any `PNAME_NS` is substituted with the namespace. Note that the prefix may be an empty string, per the `PNAME_NS` production: `(PN_PREFIX)? ":"`.
-   Map\[string -> [blank node](https://www.w3.org/TR/rdf11-concepts/#dfn-blank-node)\] `bnodeLabels` — A mapping from string to blank node.
-   RDF\_Term `curSubject` — The `curSubject` is bound to the `[subject](#grammar-production-subject)` production.
-   RDF\_Term `curPredicate` — The `curPredicate` is bound to the `[verb](#grammar-production-verb)` production. If token matched was "`a`", `curPredicate` is bound to the IRI `http://www.w3.org/1999/02/22-rdf-syntax-ns#type`.

### 7.2 RDF Term Constructors

This table maps productions and lexical tokens to `RDF terms` or components of `RDF terms` listed in [section 7. Parsing](#sec-parsing):

| production | type | procedure |
| --- | --- | --- |
| [IRIREF](#grammar-production-IRIREF) | [IRI](https://www.w3.org/TR/rdf11-concepts/#dfn-iri) | The characters between "<" and ">" are taken, with the [numeric escape sequences](#numeric) unescaped, to form the unicode string of the IRI. Relative IRI resolution is performed per [Section 6.3](#sec-iri-references). |
| [PNAME\_NS](#grammar-production-PNAME_NS) | [prefix](#prefix) | When used in a [prefixID](#grammar-production-prefixID) or [sparqlPrefix](#grammar-production-sparqlPrefix) production, the `prefix` is the potentially empty unicode string matching the first argument of the rule is a key into the [namespaces map](#namespaces). |
| [IRI](https://www.w3.org/TR/rdf11-concepts/#dfn-iri) | When used in a [PrefixedName](#grammar-production-PrefixedName) production, the `iri` is the value in the [namespaces map](#namespaces) corresponding to the first argument of the rule. |
| [PNAME\_LN](#grammar-production-PNAME_LN) | [IRI](https://www.w3.org/TR/rdf11-concepts/#dfn-iri) | A potentially empty [prefix](#prefix) is identified by the first sequence, `PNAME_NS`. The [namespaces map](#namespaces) __MUST__ have a corresponding `namespace`. The unicode string of the IRI is formed by unescaping the [reserved characters](#reserved) in the second argument, `PN_LOCAL`, and concatenating this onto the `namespace`. |
| [STRING\_LITERAL\_SINGLE\_QUOTE](#grammar-production-STRING_LITERAL_SINGLE_QUOTE) | [lexical form](https://www.w3.org/TR/rdf11-concepts/#dfn-lexical-form) | The characters between the outermost "'"s are taken, with [numeric](#numeric) and [string](#string) escape sequences unescaped, to form the unicode string of a lexical form. |
| [STRING\_LITERAL\_QUOTE](#grammar-production-STRING_LITERAL_QUOTE) | [lexical form](https://www.w3.org/TR/rdf11-concepts/#dfn-lexical-form) | The characters between the outermost '"'s are taken, with [numeric](#numeric) and [string](#string) escape sequences unescaped, to form the unicode string of a lexical form. |
| [STRING\_LITERAL\_LONG\_SINGLE\_QUOTE](#grammar-production-STRING_LITERAL_LONG_SINGLE_QUOTE) | [lexical form](https://www.w3.org/TR/rdf11-concepts/#dfn-lexical-form) | The characters between the outermost "'''"s are taken, with [numeric](#numeric) and [string](#string) escape sequences unescaped, to form the unicode string of a lexical form. |
| [STRING\_LITERAL\_LONG\_QUOTE](#grammar-production-STRING_LITERAL_LONG_QUOTE) | [lexical form](https://www.w3.org/TR/rdf11-concepts/#dfn-lexical-form) | The characters between the outermost '"""'s are taken, with [numeric](#numeric) and [string](#string) escape sequences unescaped, to form the unicode string of a lexical form. |
| [LANGTAG](#grammar-production-LANGTAG) | [language tag](https://www.w3.org/TR/rdf11-concepts/#dfn-language-tag) | The characters following the `@` form the unicode string of the language tag. |
| [RDFLiteral](#grammar-production-RDFLiteral) | [literal](https://www.w3.org/TR/rdf11-concepts/#dfn-literal) | The literal has a lexical form of the first rule argument, `String`. If the `'^^' iri` rule matched, the datatype is `iri` and the literal has no language tag. If the `LANGTAG` rule matched, the datatype is `rdf:langString` and the language tag is `LANGTAG`. If neither matched, the datatype is `xsd:string` and the literal has no language tag. |
| [INTEGER](#grammar-production-INTEGER) | [literal](https://www.w3.org/TR/rdf11-concepts/#dfn-literal) | The literal has a lexical form of the input string, and a datatype of `xsd:integer`. |
| [DECIMAL](#grammar-production-DECIMAL) | [literal](https://www.w3.org/TR/rdf11-concepts/#dfn-literal) | The literal has a lexical form of the input string, and a datatype of `xsd:decimal`. |
| [DOUBLE](#grammar-production-DOUBLE) | [literal](https://www.w3.org/TR/rdf11-concepts/#dfn-literal) | The literal has a lexical form of the input string, and a datatype of `xsd:double`. |
| [BooleanLiteral](#grammar-production-BooleanLiteral) | [literal](https://www.w3.org/TR/rdf11-concepts/#dfn-literal) | The literal has a lexical form of the `true` or `false`, depending on which matched the input, and a datatype of `xsd:boolean`. |
| [BLANK\_NODE\_LABEL](#grammar-production-BLANK_NODE_LABEL) | [blank node](https://www.w3.org/TR/rdf11-concepts/#dfn-blank-node) | The string matching the second argument, `PN_LOCAL`, is a key in [bnodeLabels](#bnodeLabels). If there is no corresponding blank node in the map, one is allocated. |
| [ANON](#grammar-production-ANON) | [blank node](https://www.w3.org/TR/rdf11-concepts/#dfn-blank-node) | A blank node is generated. |
| [blankNodePropertyList](#grammar-production-blankNodePropertyList) | [blank node](https://www.w3.org/TR/rdf11-concepts/#dfn-blank-node) | A blank node is generated. Note the rules for `blankNodePropertyList` in the next section. |
| [collection](#grammar-production-collection) | [blank node](https://www.w3.org/TR/rdf11-concepts/#dfn-blank-node) | For non-empty lists, a blank node is generated. Note the rules for `collection` in the next section. |
| [IRI](https://www.w3.org/TR/rdf11-concepts/#dfn-iri) | For empty lists, the resulting IRI is `rdf:nil`. Note the rules for `collection` in the next section. |

### 7.3 RDF Triples Constructors

A Turtle document defines an [RDF graph](https://www.w3.org/TR/rdf11-concepts/#dfn-rdf-graph) composed of set of [RDF triple](https://www.w3.org/TR/rdf11-concepts/#dfn-rdf-triple)s. The `[subject](#grammar-production-subject)` production sets the `curSubject`. The `[verb](#grammar-production-verb)` production sets the `curPredicate`. Each [object](#grammar-production-object) `N` in the document produces an RDF triple: `curSubject` `curPredicate` `N` .

### Property Lists:

Beginning the `[blankNodePropertyList](#grammar-production-blankNodePropertyList)` production records the `curSubject` and `curPredicate`, and sets `curSubject` to a novel `blank node` `B`. Finishing the `[blankNodePropertyList](#grammar-production-blankNodePropertyList)` production restores `curSubject` and `curPredicate`. The node produced by matching `[blankNodePropertyList](#grammar-production-blankNodePropertyList)` is the blank node `B`.

### Collections:

Beginning the `[collection](#grammar-production-collection)` production records the `curSubject` and `curPredicate`. Each `object` in the `[collection](#grammar-production-collection)` production has a `curSubject` set to a novel `blank node` `B` and a `curPredicate` set to `rdf:first`. For each object `objectn` after the first produces a triple:`objectn-1` `rdf:rest` `objectn` . Finishing the `[collection](#grammar-production-collection)` production creates an additional triple `curSubject rdf:rest rdf:nil` . and restores `curSubject` and `curPredicate` The node produced by matching `[collection](#grammar-production-collection)` is the first blank node `B` for non-empty lists and `rdf:nil` for empty lists.

### 7.4 Parsing Example

_This section is non-normative._

The following informative example shows the semantic actions performed when parsing this Turtle document with an LALR(1) parser:

Example 27

@prefix ericFoaf: <http://www.w3.org/People/Eric/ericP-foaf.rdf#> .
@prefix : <http://xmlns.com/foaf/0.1/> .
ericFoaf:ericP :givenName "Eric" ;
              :knows <http://norman.walsh.name/knows/who/dan-brickley> ,
                      \[ :mbox <mailto:timbl@w3.org> \] ,
                      <http://getopenid.com/amyvdh> .
          

-   Map the prefix `ericFoaf` to the IRI `http://www.w3.org/People/Eric/ericP-foaf.rdf#`.
-   Map the empty prefix to the IRI `http://xmlns.com/foaf/0.1/`.
-   Assign `curSubject` the IRI `http://www.w3.org/People/Eric/ericP-foaf.rdf#ericP`.
-   Assign `curPredicate` the IRI `http://xmlns.com/foaf/0.1/givenName`.
-   Emit an RDF triple: `<...rdf#ericP>` `<.../givenName>` `"Eric"` .
-   Assign `curPredicate` the IRI `http://xmlns.com/foaf/0.1/knows`.
-   Emit an RDF triple: `<...rdf#ericP>` `<.../knows>` `<...who/dan-brickley>` .
-   Emit an RDF triple: `<...rdf#ericP>` `<.../knows>` `_:1` .
-   Save `curSubject` and reassign to the blank node `_:1`.
-   Save `curPredicate`.
-   Assign `curPredicate` the IRI `http://xmlns.com/foaf/0.1/mbox`.
-   Emit an RDF triple: `_:1` `<.../mbox>` `<mailto:timbl@w3.org>` .
-   Restore `curSubject` and `curPredicate` to their saved values (`<...rdf#ericP>`, `<.../knows>`).
-   Emit an RDF triple: `<...rdf#ericP>` `<.../knows>` `<http://getopenid.com/amyvdh>` .

## A. Embedding Turtle in HTML documents

_This section is non-normative._

HTML \[[HTML5](#bib-HTML5)\] `script` tags can be used to embed data blocks in documents. Turtle can be easily embedded in HTML this way.

Example 28

<script type="text/turtle">
@prefix dc: <http://purl.org/dc/terms/> .
@prefix frbr: <http://purl.org/vocab/frbr/core#> .

<http://books.example.com/works/45U8QJGZSQKDH8N> a frbr:Work ;
     dc:creator "Wil Wheaton"@en ;
     dc:title "Just a Geek"@en ;
     frbr:realization <http://books.example.com/products/9780596007683.BOOK>,
         <http://books.example.com/products/9780596802189.EBOOK> .

<http://books.example.com/products/9780596007683.BOOK> a frbr:Expression ;
     dc:type <http://books.example.com/product-types/BOOK> .

<http://books.example.com/products/9780596802189.EBOOK> a frbr:Expression ;
     dc:type <http://books.example.com/product-types/EBOOK> .
</script>

Turtle content should be placed in a `script` tag with the `type` attribute set to `text/turtle`. `<` and `>` symbols do not need to be escaped inside of script tags. The character encoding of the embedded Turtle will match the HTML documents encoding.

### A.1 XHTML

_This section is non-normative._

Like JavaScript, Turtle authored for HTML (`text/html`) can break when used in XHTML (`application/xhtml+xml`). The solution is the same one used for JavaScript.

Example 29

<script type="text/turtle">
**\# <!\[CDATA\[**
@prefix frbr: <http://purl.org/vocab/frbr/core#> .

<http://books.example.com/works/45U8QJGZSQKDH8N> a frbr:Work .
**\# \]\]>**
</script>

When embedded in XHTML Turtle data blocks must be enclosed in CDATA sections. Those CDATA markers must be in Turtle comments. If the character sequence "`]]>`" occurs in the document it must be escaped using strings escapes (`\u005d\u0054\u003e`). This will also make Turtle safe in polyglot documents served as both `text/html` and `application/xhtml+xml`. Failing to use CDATA sections or escape "`]]>`" may result in a non well-formed XML document.

### A.2 Parsing Turtle in HTML

_This section is non-normative._

There are no syntactic or grammar differences between parsing Turtle that has been embedded and normal Turtle documents. A Turtle document parsed from an HTML DOM will be a stream of character data rather than a stream of UTF-8 encoded bytes. No decoding is necessary if the HTML document has already been parsed into DOM. Each `script` data block is considered to be it's own Turtle document. `@prefix` and `@base` declarations in a Turtle data bloc are scoped to that data block and do not effect other data blocks. The HTML `lang` attribute or XHTML `xml:lang` attribute have no effect on the parsing of the data blocks. The base URI of the encapsulating HTML document provides a "Base URI Embedded in Content" per RFC3986 section 5.1.1.

## B. Internet Media Type, File Extension and Macintosh File Type

Contact:

Eric Prud'hommeaux

See also:

[How to Register a Media Type for a W3C Specification](https://www.w3.org/2002/06/registering-mediatype)

[Internet Media Type registration, consistency of use](https://www.w3.org/2001/tag/2002/0129-mime)  
TAG Finding 3 June 2002 (Revised 4 September 2002)

The Internet Media Type / MIME Type for Turtle is "text/turtle".

It is recommended that Turtle files have the extension ".ttl" (all lowercase) on all platforms.

It is recommended that Turtle files stored on Macintosh HFS file systems be given a file type of "TEXT".

This information that follows has been [submitted to the IESG](https://www.w3.org/mid/20071218114549.GQ8244@w3.org) for review, approval, and registration with IANA.

Type name:

text

Subtype name:

turtle

Required parameters:

None

Optional parameters:

`charset` — this parameter is required when transferring non-ASCII data. If present, the value of `charset` is always `UTF-8`.

Encoding considerations:

The syntax of Turtle is expressed over code points in Unicode \[[UNICODE](#bib-UNICODE)\]. The encoding is always UTF-8 \[[UTF-8](#bib-UTF-8)\].

Unicode code points may also be expressed using an \\uXXXX (U+0000 to U+FFFF) or \\UXXXXXXXX syntax (for U+10000 onwards) where X is a hexadecimal digit \[0-9A-Fa-f\]

Security considerations:

Turtle is a general-purpose assertion language; applications may evaluate given data to infer more assertions or to dereference IRIs, invoking the security considerations of the scheme for that IRI. Note in particular, the privacy issues in \[[RFC3023](#bib-RFC3023)\] section 10 for HTTP IRIs. Data obtained from an inaccurate or malicious data source may lead to inaccurate or misleading conclusions, as well as the dereferencing of unintended IRIs. Care must be taken to align the trust in consulted resources with the sensitivity of the intended use of the data; inferences of potential medical treatments would likely require different trust than inferences for trip planning.

Turtle is used to express arbitrary application data; security considerations will vary by domain of use. Security tools and protocols applicable to text (e.g. PGP encryption, MD5 sum validation, password-protected compression) may also be used on Turtle documents. Security/privacy protocols must be imposed which reflect the sensitivity of the embedded information.

Turtle can express data which is presented to the user, for example, RDF Schema labels. Application rendering strings retrieved from untrusted Turtle documents must ensure that malignant strings may not be used to mislead the reader. The security considerations in the media type registration for XML (\[[RFC3023](#bib-RFC3023)\] section 10) provide additional guidance around the expression of arbitrary data and markup.

Turtle uses IRIs as term identifiers. Applications interpreting data expressed in Turtle should address the security issues of [Internationalized Resource Identifiers (IRIs)](http://www.ietf.org/rfc/rfc3987.txt) \[[RFC3987](#bib-RFC3987)\] Section 8, as well as [Uniform Resource Identifier (URI): Generic Syntax](http://www.ietf.org/rfc/rfc3986.txt) \[[RFC3986](#bib-RFC3986)\] Section 7.

Multiple IRIs may have the same appearance. Characters in different scripts may look similar (a Cyrillic "о" may appear similar to a Latin "o"). A character followed by combining characters may have the same visual representation as another character (LATIN SMALL LETTER E followed by COMBINING ACUTE ACCENT has the same visual representation as LATIN SMALL LETTER E WITH ACUTE). Any person or application that is writing or interpreting data in Turtle must take care to use the IRI that matches the intended semantics, and avoid IRIs that make look similar. Further information about matching of similar characters can be found in [Unicode Security Considerations](http://www.unicode.org/reports/tr36/) \[[UNICODE-SECURITY](#bib-UNICODE-SECURITY)\] and [Internationalized Resource Identifiers (IRIs)](http://www.ietf.org/rfc/rfc3987.txt) \[[RFC3987](#bib-RFC3987)\] Section 8.

Interoperability considerations:

There are no known interoperability issues.

Published specification:

This specification.

Applications which use this media type:

No widely deployed applications are known to use this media type. It may be used by some web services and clients consuming their data.

Additional information:

Magic number(s):

Turtle documents may have the strings '@prefix' or '@base' (case sensitive) or the strings 'PREFIX' or 'BASE' (case insensitive) near the beginning of the document.

File extension(s):

".ttl"

Base URI:

The Turtle '@base <IRIref>' or 'BASE <IRIref>' term can change the current base URI for relative IRIrefs in the query language that are used sequentially later in the document.

Macintosh file type code(s):

"TEXT"

Person & email address to contact for further information:

Eric Prud'hommeaux <eric@w3.org>

Intended usage:

COMMON

Restrictions on usage:

None

Author/Change controller:

The Turtle specification is the product of the RDF WG. The W3C reserves change control over this specifications.

## C. Acknowledgements

This work was described in the paper [New Syntaxes for RDF](http://www.dajobe.org/2003/11/new-syntaxes-rdf/) which discusses other RDF syntaxes and the background to the Turtle (Submitted to WWW2004, referred to as _N-Triples Plus_ there).

This work was started during the [Semantic Web Advanced Development Europe (SWAD-Europe)](https://www.w3.org/2001/sw/Europe/) project funded by the EU IST-7 programme IST-2001-34732 (2002-2004) and further development supported by the [Institute for Learning and Research Technology](http://www.ilrt.bris.ac.uk/) at the [University of Bristol](http://www.bristol.ac.uk/), UK (2002-Sep 2005).

Valuable contributions to this version were made by Gregg Kellogg, Andy Seaborn, Sandro Hawke and the members of the RDF Working Group.

The document was improved through the review process by the wider community.

## D. Change Log

### D.1 Changes since [January 2014 Proposed Recommendation](https://www.w3.org/TR/2014/PR-turtle-20140109/)

-   Missing prefix added in example 11 in response to [comment from Lars Svensson](http://lists.w3.org/Archives/Public/public-rdf-comments/2014Feb/0008.html).
-   [Error](http://lists.w3.org/Archives/Public/public-rdf-wg/2014Feb/0027.html) in grammar productions \[21\] and \[23\] fixed.
-   [Error](http://lists.w3.org/Archives/Public/public-rdf-comments/2014Feb/0018.html) in grammar productions \[24\] and \[25\] fixed.

### D.2 Changes from [February 2013 Candidate Recommendation](https://www.w3.org/TR/2013/CR-turtle-20130219/) to [January 2014 Proposed Recommendation](https://www.w3.org/TR/2014/PR-turtle-20140109/)

-   The addition of [sparqlPrefix](#grammar-production-sparqlPrefix) and [sparqlBase](#grammar-production-sparqlBase) which allow for using SPARQL style `BASE` and `PREFIX` directives in a Turtle document was marked "at risk" in the Candidate Recommendation publication. This feature is no longer at risk.
-   The title of this document was changed from "_Turtle_" to "_RDF 1.1 Turtle_".
-   Removed the obsolete links to tests in [Sec. 7.1](#sec-parsing-state).

### D.3 Changes from [August 2011 First Public Working Draft](https://www.w3.org/TR/2011/WD-turtle-20110809/) to [Candidate Recommendation](https://www.w3.org/TR/2013/CR-turtle-20130219/)

-   Renaming for STRING\_\* productions to STRING\_LITERAL\_QUOTE sytle names rather than numbers
-   Local part of prefix names can now include ":"
-   Turtle in HTML
-   Renaming of grammar tokens and rules around IRIs
-   Reserved character escape sequences
-   String escape sequences limited to strings
-   Numeric escape sequences limited to IRIs and Strings
-   Support top-level blank-predicate-object lists
-   Whitespace required between @prefix and prefix label

### D.4 Changes from [January 2008 Team Submission](https://www.w3.org/TeamSubmission/2008/SUBM-turtle-20080114/) to [First Public Working Draft](https://www.w3.org/TR/2011/WD-turtle-20110809/)

-   Adopted three additional string syntaxes from SPARQL: [STRING\_LITERAL2](https://www.w3.org/TR/2013/REC-sparql11-query-20130321/#rSTRING_LITERAL2), [STRING\_LITERAL\_LONG1](https://www.w3.org/TR/2013/REC-sparql11-query-20130321/#rSTRING_LITERAL_LONG1), [STRING\_LITERAL\_LONG2](https://www.w3.org/TR/2013/REC-sparql11-query-20130321/#rSTRING_LITERAL_LONG2)
-   Adopted SPARQL's syntax for prefixed names (see [editor's draft](https://www.w3.org/TR/sparql11-query/#rPrefixedName)):
    -   '.'s in names in all positions of a local name apart from the first or last, e.g. `ex:first.name`.
    -   digits in the first character of the [PN\_LOCAL](https://www.w3.org/TR/rdf-sparql-query/#rPN_LOCAL) lexical token, e.g. `ex:7tm`.
-   adopted SPARQL's IRI resolution and prefix substitution text.
-   explicitly allowed re-use of the same prefix.
-   Added [parsing rules](#sec-parsing).

See also the [pre-W3C Submission changelog](https://www.w3.org/TeamSubmission/2008/SUBM-turtle-20080114#sec-changelog).

## E. References

### E.1 Normative references

\[BCP47\]

A. Phillips; M. Davis. [Tags for Identifying Languages](http://tools.ietf.org/html/bcp47). September 2009. IETF Best Current Practice. URL: [http://tools.ietf.org/html/bcp47](http://tools.ietf.org/html/bcp47)

\[EBNF-NOTATION\]

Tim Bray; Jean Paoli; C. M. Sperberg-McQueen; Eve Maler; François Yergeau. [EBNF Notation](https://www.w3.org/TR/REC-xml/#sec-notation) 26 November 2008. W3C Recommendation. URL: [http://www.w3.org/TR/REC-xml/#sec-notation](https://www.w3.org/TR/REC-xml/#sec-notation)

\[RDF11-CONCEPTS\]

Richard Cyganiak, David Wood, Markus Lanthaler. [RDF 1.1 Concepts and Abstract Syntax.](https://www.w3.org/TR/2014/REC-rdf11-concepts-20140225/) W3C Recommendation, 25 February 2014. URL: [http://www.w3.org/TR/2014/REC-rdf11-concepts-20140225/](https://www.w3.org/TR/2014/REC-rdf11-concepts-20140225/). The latest edition is available at [http://www.w3.org/TR/rdf11-concepts/](https://www.w3.org/TR/rdf11-concepts/)

\[RFC2119\]

S. Bradner. [Key words for use in RFCs to Indicate Requirement Levels.](http://www.ietf.org/rfc/rfc2119.txt) March 1997. Internet RFC 2119. URL: [http://www.ietf.org/rfc/rfc2119.txt](http://www.ietf.org/rfc/rfc2119.txt)

\[RFC3023\]

M. Murata; S. St.Laurent; D. Kohn. [XML Media Types (RFC 3023)](http://www.ietf.org/rfc/rfc3023.txt). January 2001. RFC. URL: [http://www.ietf.org/rfc/rfc3023.txt](http://www.ietf.org/rfc/rfc3023.txt)

\[RFC3986\]

T. Berners-Lee; R. Fielding; L. Masinter. [Uniform Resource Identifier (URI): Generic Syntax (RFC 3986)](http://www.ietf.org/rfc/rfc3986.txt). January 2005. RFC. URL: [http://www.ietf.org/rfc/rfc3986.txt](http://www.ietf.org/rfc/rfc3986.txt)

\[RFC3987\]

M. Dürst; M. Suignard. [Internationalized Resource Identifiers (IRIs)](http://www.ietf.org/rfc/rfc3987.txt). January 2005. RFC. URL: [http://www.ietf.org/rfc/rfc3987.txt](http://www.ietf.org/rfc/rfc3987.txt)

\[UNICODE\]

[The Unicode Standard](http://www.unicode.org/versions/latest/). URL: [http://www.unicode.org/versions/latest/](http://www.unicode.org/versions/latest/)

\[UTF-8\]

F. Yergeau. [UTF-8, a transformation format of ISO 10646](http://www.ietf.org/rfc/rfc3629.txt). IETF RFC 3629. November 2003. URL: [http://www.ietf.org/rfc/rfc3629.txt](http://www.ietf.org/rfc/rfc3629.txt)

### E.2 Informative references

\[HTML5\]

Robin Berjon; Steve Faulkner; Travis Leithead; Erika Doyle Navara; Theresa O'Connor; Silvia Pfeiffer. [HTML5](https://www.w3.org/TR/html5/). 4 February 2014. W3C Candidate Recommendation. URL: [http://www.w3.org/TR/html5/](https://www.w3.org/TR/html5/)

\[N-TRIPLES\]

Gavin Carothers, Andy Seabourne. [RDF 1.1 N-Triples](https://www.w3.org/TR/2014/REC-n-triples-20140225/). W3C Recommendation, 25 February 2014. URL: [http://www.w3.org/TR/2014/REC-n-triples-20140225/](https://www.w3.org/TR/2014/REC-n-triples-20140225/). The latest edition is available at [http://www.w3.org/TR/n-triples/](https://www.w3.org/TR/n-triples/)

\[RDF11-MT\]

Patrick J. Hayes, Peter F. Patel-Schneider. [RDF 1.1 Semantics.](https://www.w3.org/TR/2014/REC-rdf11-mt-20140225/) W3C Recommendation, 25 February 2014. URL: [http://www.w3.org/TR/2014/REC-rdf11-mt-20140225/](https://www.w3.org/TR/2014/REC-rdf11-mt-20140225/). The latest edition is available at [http://www.w3.org/TR/rdf11-mt/](https://www.w3.org/TR/rdf11-mt/)

\[SPARQL11-QUERY\]

Steven Harris; Andy Seaborne. [SPARQL 1.1 Query Language](https://www.w3.org/TR/sparql11-query/). 21 March 2013. W3C Recommendation. URL: [http://www.w3.org/TR/sparql11-query/](https://www.w3.org/TR/sparql11-query/)

\[UNICODE-SECURITY\]

Mark Davis; Michel Suignard. [Unicode Security Considerations](http://www.unicode.org/reports/tr36/). URL: [http://www.unicode.org/reports/tr36/](http://www.unicode.org/reports/tr36/)
