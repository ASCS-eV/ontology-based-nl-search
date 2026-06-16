<!--
  ⚠ THIRD-PARTY SPECIFICATION — NOT AN ORIGINAL WORK OF THIS PROJECT.
  Title:     OWL 2 Web Ontology Language — Document Overview (2nd Ed.)
  Source:    https://www.w3.org/TR/owl2-overview/
  Publisher: W3C
  License:   W3C Document License 2023 (https://www.w3.org/copyright/document-license-2023/)
  Retrieved: 2026-06-16
  Reproduced verbatim for offline reference and AI-agent context. The
  publisher's original copyright and license apply. Do not hand-edit —
  refresh from source (see docs/specs/references/README.md).
-->

> **Third-party specification — reproduced for offline reference and AI-agent context.**
> **Title:** OWL 2 Web Ontology Language — Document Overview (2nd Ed.)  
> **Status:** W3C Recommendation  
> **Source:** <https://www.w3.org/TR/owl2-overview/>  
> **Publisher:** W3C  
> **License:** W3C Document License 2023 — <https://www.w3.org/copyright/document-license-2023/>  
> **Retrieved:** 2026-06-16  
> The publisher's original copyright and license apply. Do not hand-edit;
> refresh from source — see [README](./README.md).

---

OWL 2 Web Ontology Language Document Overview (Second Edition)     

[![W3C](https://www.w3.org/Icons/w3c_home)](https://www.w3.org/)

# OWL 2 Web Ontology Language  
Document Overview (Second Edition)

## W3C Recommendation 11 December 2012

This version:

[http://www.w3.org/TR/2012/REC-owl2-overview-20121211/](https://www.w3.org/TR/2012/REC-owl2-overview-20121211/)

Latest version (series 2):

[http://www.w3.org/TR/owl2-overview/](https://www.w3.org/TR/owl2-overview/)

Latest Recommendation:

[http://www.w3.org/TR/owl-overview](https://www.w3.org/TR/owl-overview)

Previous version:

[http://www.w3.org/TR/2012/PER-owl2-overview-20121018/](https://www.w3.org/TR/2012/PER-owl2-overview-20121018/)

Editors:

W3C OWL Working Group (see [Acknowledgements](#ack))

Please refer to the [**errata**](https://www.w3.org/2007/OWL/errata) for this document, which may include some normative corrections.

A [color-coded version of this document showing changes made since the previous version](https://www.w3.org/TR/2012/REC-owl2-overview-20121211/diff-from-20121018) is also available.

This document is also available in these non-normative formats: [PDF version](https://www.w3.org/2012/pdf/REC-owl2-overview-20121211.pdf).

See also [translations](https://www.w3.org/2007/OWL/translation/owl2-overview).

[Copyright](https://www.w3.org/Consortium/Legal/ipr-notice#Copyright) © 2012 [W3C](https://www.w3.org/)® ([MIT](http://www.csail.mit.edu/), [ERCIM](http://www.ercim.eu/), [Keio](http://www.keio.ac.jp/)), All Rights Reserved. W3C [liability](https://www.w3.org/Consortium/Legal/ipr-notice#Legal_Disclaimer), [trademark](https://www.w3.org/Consortium/Legal/ipr-notice#W3C_Trademarks) and [document use](https://www.w3.org/Consortium/Legal/copyright-documents) rules apply.

---

## Abstract

The OWL 2 Web Ontology Language, informally OWL 2, is an ontology language for the Semantic Web with formally defined meaning. OWL 2 ontologies provide classes, properties, individuals, and data values and are stored as Semantic Web documents. OWL 2 ontologies can be used along with information written in RDF, and OWL 2 ontologies themselves are primarily exchanged as RDF documents.

This document serves as an introduction to OWL 2 and the various other OWL 2 documents. It describes the syntaxes for OWL 2, the different kinds of semantics, the available profiles (sub-languages), and the relationship between OWL 1 and OWL 2.

## Status of this Document

#### May Be Superseded

_This section describes the status of this document at the time of its publication. Other documents may supersede this document. A list of current W3C publications and the latest revision of this technical report can be found in the [W3C technical reports index](https://www.w3.org/TR/) at http://www.w3.org/TR/._

#### Summary of Changes

There have been no [substantive](https://www.w3.org/2005/10/Process-20051014/tr#substantive-change) changes since the [previous version](https://www.w3.org/TR/2012/PER-owl2-overview-20121018/). For details on the minor changes see the [change log](#changelog) and [color-coded diff](https://www.w3.org/TR/2012/REC-owl2-overview-20121211/diff-from-20121018).

#### Please Send Comments

Please send any comments to [public-owl-comments@w3.org](mailto:public-owl-comments@w3.org) ([public archive](http://lists.w3.org/Archives/Public/public-owl-comments/)). Although work on this document by the [OWL Working Group](https://www.w3.org/2007/OWL/) is complete, comments may be addressed in the [errata](https://www.w3.org/2007/OWL/errata) or in future revisions. Open discussion among developers is welcome at [public-owl-dev@w3.org](mailto:public-owl-dev@w3.org) ([public archive](http://lists.w3.org/Archives/Public/public-owl-dev/)).

#### Endorsed By W3C

_This document has been reviewed by W3C Members, by software developers, and by other W3C groups and interested parties, and is endorsed by the Director as a W3C Recommendation. It is a stable document and may be used as reference material or cited from another document. W3C's role in making the Recommendation is to draw attention to the specification and to promote its widespread deployment. This enhances the functionality and interoperability of the Web._

#### Patents

_This document was produced by a group operating under the [5 February 2004 W3C Patent Policy](https://www.w3.org/Consortium/Patent-Policy-20040205/). This document is informative only. W3C maintains a [public list of any patent disclosures](https://www.w3.org/2004/01/pp-impl/41712/status) made in connection with the deliverables of the group; that page also includes instructions for disclosing a patent._

---

<table class="toc" id="toc" summary="Contents"><tbody><tr><td><div id="toctitle"><h2>Table of Contents</h2></div><ul><li class="toclevel-1"><a href="#Introduction"><span class="tocnumber">1</span> <span class="toctext">Introduction</span></a></li><li class="toclevel-1"><a href="#Overview"><span class="tocnumber">2</span> <span class="toctext">Overview</span></a><ul><li class="toclevel-2"><a href="#Ontologies"><span class="tocnumber">2.1</span> <span class="toctext">Ontologies</span></a></li><li class="toclevel-2"><a href="#Syntaxes"><span class="tocnumber">2.2</span> <span class="toctext">Syntaxes</span></a></li><li class="toclevel-2"><a href="#Semantics"><span class="tocnumber">2.3</span> <span class="toctext">Semantics</span></a></li><li class="toclevel-2"><a href="#Profiles"><span class="tocnumber">2.4</span> <span class="toctext">Profiles</span></a></li></ul></li><li class="toclevel-1"><a href="#Relationship_to_OWL_1"><span class="tocnumber">3</span> <span class="toctext">Relationship to OWL 1</span></a></li><li class="toclevel-1"><a href="#Documentation_Roadmap"><span class="tocnumber">4</span> <span class="toctext">Documentation Roadmap</span></a></li><li class="toclevel-1"><a href="#Appendix:_Change_Log_.28Informative.29"><span class="tocnumber">5</span> <span class="toctext">Appendix: Change Log (Informative)</span></a><ul><li class="toclevel-2"><a href="#Changes_Since_Recommendation"><span class="tocnumber">5.1</span> <span class="toctext">Changes Since Recommendation</span></a></li><li class="toclevel-2"><a href="#Changes_Since_Proposed_Recommendation"><span class="tocnumber">5.2</span> <span class="toctext">Changes Since Proposed Recommendation</span></a></li><li class="toclevel-2"><a href="#Changes_Since_Last_Call"><span class="tocnumber">5.3</span> <span class="toctext">Changes Since Last Call</span></a></li></ul></li><li class="toclevel-1"><a href="#Acknowledgements"><span class="tocnumber">6</span> <span class="toctext">Acknowledgements</span></a></li><li class="toclevel-1"><a href="#References"><span class="tocnumber">7</span> <span class="toctext">References</span></a></li></ul></td></tr></tbody></table>

  

## 1 Introduction

This document provides a non-normative high-level overview of the OWL 2 Web Ontology Language and serves as a roadmap for the documents that define and describe OWL 2.

Ontologies are formalized vocabularies of terms, often covering a specific domain and shared by a community of users. They specify the definitions of terms by describing their relationships with other terms in the ontology. OWL 2 is an extension and revision of the [OWL Web Ontology Language](https://www.w3.org/TR/2004/REC-owl-features-20040210/ "http://www.w3.org/TR/2004/REC-owl-features-20040210/") developed by the [W3C Web Ontology Working Group](https://www.w3.org/2001/sw/WebOnt/ "http://www.w3.org/2001/sw/WebOnt/") and published in 2004 (referred to hereafter as “OWL 1”). OWL 2 is being developed (and this document was written) by a follow-on group, the [W3C OWL Working Group](https://www.w3.org/2007/OWL/ "http://www.w3.org/2007/OWL/"). Like OWL 1, OWL 2 is designed to facilitate ontology development and sharing via the Web, with the ultimate goal of making Web content more accessible to machines.

## 2 Overview

Figure 1 gives an overview of the OWL 2 language, showing its main building blocks and how they relate to each other. The ellipse in the center represents the abstract notion of an ontology, which can be thought of either as an abstract structure or as an RDF graph (see [2.1 Ontologies](#sec-ont)). At the top are various concrete syntaxes (see [2.2 Syntaxes](#sec-syn)) that can be used to serialize and exchange ontologies. At the bottom are the two semantic specifications that define the meaning of OWL 2 ontologies (see [2.3 Semantics](#sec-sem)).

Most users of OWL 2 will need only one syntax and one semantics; for them, this diagram would be much simpler, with only their one syntax at the top, their one semantics at the bottom, and rarely a need to see what's inside the ellipse in the center.

![Diagram showing that each syntax maps to/from ontologies and ontologies have two semantics](OWL2-structure2-800.png)  
Figure 1. The Structure of OWL 2

  

### 2.1 Ontologies

The conceptual structure of OWL 2 ontologies is defined in the OWL 2 Structural Specification document \[[OWL 2 Structural Specification](#ref-owl-2-specification)\]. This document uses UML \[[UML](#ref-uml)\] to define the structural elements available in OWL 2, explaining their roles and functionalities in abstract terms and without reference to any particular syntax. It also defines the functional-style syntax, which closely follows the structural specification and allows OWL 2 ontologies to be written in a compact form.

Any OWL 2 ontology can also be viewed as an RDF graph. The relationship between these two views is specified by the Mapping to RDF Graphs document \[[OWL 2 RDF Mapping](#ref-owl-2-rdf-mapping)\], which defines a mapping from the structural form to the RDF graph form, and vice versa. The OWL 2 Quick Reference Guide \[[OWL 2 Quick Guide](#ref-owl-2-quick-reference)\] provides a simple overview of these two views of OWL 2, laid out side by side.

### 2.2 Syntaxes

In practice, a concrete syntax is needed in order to store OWL 2 ontologies and to exchange them among tools and applications. The primary exchange syntax for OWL 2 is RDF/XML \[[RDF Syntax](#ref-rdf-syntax)\]; this is indeed the only syntax that _must_ be supported by all OWL 2 tools (see Section 2.1 of the OWL 2 Conformance document \[[OWL 2 Conformance](#ref-owl-2-conformance)\]).

While RDF/XML provides for interoperability among OWL 2 tools, other concrete syntaxes may also be used. These include alternative RDF serializations, such as Turtle \[[Turtle](#ref-turtle)\]; an XML serialization \[[OWL 2 XML](#ref-owl-2-xml-serialization)\]; and a more "readable" syntax, called the Manchester Syntax \[[OWL 2 Manchester Syntax](#ref-owl-2-manchester-syntax)\], that is used in several ontology editing tools. Finally, the functional-style syntax can also be used for serialization, although its main purpose is specifying the structure of the language \[[OWL 2 Structural Specification](#ref-owl-2-specification)\].

  

| Name of Syntax | Specification | Status | Purpose |
| --- | --- | --- | --- |
| RDF/XML | [Mapping to RDF Graphs](https://www.w3.org/TR/2012/REC-owl2-mapping-to-rdf-20121211/ "Mapping to RDF Graphs"),  
[RDF/XML](https://www.w3.org/TR/2004/REC-rdf-syntax-grammar-20040210/ "http://www.w3.org/TR/2004/REC-rdf-syntax-grammar-20040210/") | Mandatory | Interchange (can be written and read by all conformant OWL 2 software) |
| OWL/XML | [XML Serialization](https://www.w3.org/TR/2012/REC-owl2-xml-serialization-20121211/ "XML Serialization") | Optional | Easier to process using XML tools |
| Functional Syntax | [Structural Specification](https://www.w3.org/TR/2012/REC-owl2-syntax-20121211/ "Syntax") | Optional | Easier to see the formal structure of ontologies |
| Manchester Syntax | [Manchester Syntax](https://www.w3.org/TR/2012/NOTE-owl2-manchester-syntax-20121211/ "ManchesterSyntax") | Optional | Easier to read/write DL Ontologies |
| Turtle | [Mapping to RDF Graphs](https://www.w3.org/TR/2012/REC-owl2-mapping-to-rdf-20121211/ "Mapping to RDF Graphs"),  
[Turtle](https://www.w3.org/TeamSubmission/turtle/ "http://www.w3.org/TeamSubmission/turtle/") | Optional, Not from OWL-WG | Easier to read/write RDF triples |

### 2.3 Semantics

The OWL 2 Structural Specification document defines the abstract structure of OWL 2 ontologies, but it does not define their meaning. The Direct Semantics \[[OWL 2 Direct Semantics](#ref-owl-2-direct-semantics)\] and the RDF-Based Semantics \[[OWL 2 RDF-Based Semantics](#ref-owl-2-rdf-semantics)\] provide two alternative ways of assigning meaning to OWL 2 ontologies, with a correspondence theorem providing a link between the two. These two semantics are used by reasoners and other tools, e.g., to answer class consistency, subsumption and instance retrieval queries.

The Direct Semantics assigns meaning directly to ontology structures, resulting in a semantics compatible with the model theoretic semantics of the _SROIQ_ description logic—a fragment of first order logic with useful computational properties. The advantage of this close connection is that the extensive description logic literature and implementation experience can be directly exploited by OWL 2 tools. However, some conditions must be placed on ontology structures in order to ensure that they can be translated into a _SROIQ_ knowledge base; for example, transitive properties cannot be used in number restrictions (see [Section 3](https://www.w3.org/TR/2012/REC-owl2-syntax-20121211/#Ontologies "Syntax") of the OWL 2 Structural Specification document \[[OWL 2 Structural Specification](#ref-owl-2-specification)\] for a complete list of these conditions). Ontologies that satisfy these syntactic conditions are called _OWL 2 DL_ ontologies. "OWL 2 DL" is used informally to refer to OWL 2 DL ontologies interpreted using the Direct Semantics \[[OWL 2 Direct Semantics](#ref-owl-2-direct-semantics)\].

The RDF-Based Semantics \[[OWL 2 RDF-Based Semantics](#ref-owl-2-rdf-semantics)\] assigns meaning directly to RDF graphs and so indirectly to ontology structures via the Mapping to RDF graphs. The RDF-Based Semantics is fully compatible with the RDF Semantics \[[RDF Semantics](#ref-rdf-semantics)\], and extends the semantic conditions defined for RDF. The RDF-Based Semantics can be applied to _any_ OWL 2 Ontology, without restrictions, as any OWL 2 Ontology can be mapped to RDF. "OWL 2 Full" is used informally to refer to RDF graphs considered as OWL 2 ontologies and interpreted using the RDF-Based Semantics.

The correspondence theorem in [Section 7.2](https://www.w3.org/TR/2012/REC-owl2-rdf-based-semantics-20121211/#Correspondence_Theorem "RDF-Based Semantics") of the RDF-Based Semantics Document \[[OWL 2 RDF-Based Semantics](#ref-owl-2-rdf-semantics)\]) defines a precise, close relationship between the Direct and RDF-Based Semantics. This theorem states, in essence, that given an OWL 2 DL ontology, inferences drawn using the Direct Semantics will still be valid if the ontology is mapped into an RDF graph _and_ interpreted using the RDF-Based Semantics.

### 2.4 Profiles

OWL 2 Profiles \[[OWL 2 Profiles](#ref-owl-2-profiles)\] are sub-languages (syntactic subsets) of OWL 2 that offer important advantages in particular application scenarios. Three different profiles are defined: OWL 2 EL, OWL 2 QL, and OWL 2 RL. Each profile is defined as a _syntactic restriction_ of the OWL 2 Structural Specification, i.e., as a subset of the structural elements that can be used in a conforming ontology, and each is more restrictive than OWL DL. Each of the profiles trades off different aspects of OWL's expressive power in return for different computational and/or implementational benefits.

**OWL 2 EL** enables polynomial time algorithms for all the standard reasoning tasks; it is particularly suitable for applications where very large ontologies are needed, and where expressive power can be traded for performance guarantees. **OWL 2 QL** enables conjunctive queries to be answered in LogSpace (more precisely, AC0) using standard relational database technology; it is particularly suitable for applications where relatively lightweight ontologies are used to organize large numbers of individuals and where it is useful or necessary to access the data directly via relational queries (e.g., SQL). **OWL 2 RL** enables the implementation of polynomial time reasoning algorithms using rule-extended database technologies operating directly on RDF triples; it is particularly suitable for applications where relatively lightweight ontologies are used to organize large numbers of individuals and where it is useful or necessary to operate directly on data in the form of RDF triples.

Any OWL 2 EL, QL or RL ontology is, of course, also an OWL 2 ontology and can be interpreted using either the Direct or RDF-Based Semantics. When using OWL 2 RL, a rule-based implementation can operate directly on RDF triples and so can be applied to an arbitrary RDF graph, i.e., to any OWL 2 ontology. In this case, reasoning will always be _sound_ (that is, only correct answers to queries will be computed), but it may not be _complete_ (that is, it is not guaranteed that all correct answers to queries will be computed). Theorem PR1 of the Profiles document states, however, that (in general) when the ontology is consistent with the structural definition of OWL 2 RL, a suitable rule-based implementation performing ground atomic queries will be both sound and complete.

## 3 Relationship to OWL 1

OWL 2 has a very similar overall structure to OWL 1. Looking at Figure 1, almost all the building blocks of OWL 2 were present in OWL 1, albeit possibly under different names.

The central role of RDF/XML, the role of other syntaxes, and the relationships between the Direct and RDF-Based semantics (i.e., the correspondence theorem) have not changed. More importantly, backwards compatibility with OWL 1 is, to all intents and purposes, complete: all OWL 1 Ontologies remain valid OWL 2 Ontologies, with identical inferences in all practical cases (see [Section 4.2](https://www.w3.org/TR/2012/REC-owl2-new-features-20121211/#Backward_Compatibility "http://www.w3.org/2007/OWL/wiki/New_Features_and_Rationale#Backward_Compatibility") of OWL 2 New Features and Rationale \[[OWL 2 New Features and Rationale](#ref-owl-2-new-features)\]).

OWL 2 adds new functionality with respect to OWL 1. Some of the new features are syntactic sugar (e.g., disjoint union of classes) while others offer new expressivity, including:

-   keys;
-   property chains;
-   richer datatypes, data ranges;
-   qualified cardinality restrictions;
-   asymmetric, reflexive, and disjoint properties; and
-   enhanced annotation capabilities

OWL 2 also defines three new profiles \[[OWL 2 Profiles](#ref-owl-2-profiles)\] and a new syntax \[[OWL 2 Manchester Syntax](#ref-owl-2-manchester-syntax)\]. In addition, some of the restrictions applicable to OWL DL have been relaxed; as a result, the set of RDF Graphs that can be handled by Description Logics reasoners is slightly larger in OWL 2.

All of the above is documented in detail in the OWL 2 New Features and Rationale document \[[OWL 2 New Features and Rationale](#ref-owl-2-new-features)\]. The OWL 2 Quick Reference Guide \[[OWL 2 Quick Guide](#ref-owl-2-quick-reference)\] also provides an overview of the features of OWL 2, clearly indicating those that are new.

## 4 Documentation Roadmap

The OWL 2 ontology language is normatively defined by five core specification documents describing its conceptual structure, primary exchange syntax (RDF/XML), two alternative semantics (Direct and RDF-Based), and conformance requirements. Three additional specification documents describe optional features that may be supported by some implementations: the language profiles, and two alternative concrete syntaxes (OWL/XML and Manchester).

These documents are, however, all rather technical and mainly aimed at OWL 2 implementers and tool developers. Those looking for a more approachable guide to the features and usage of OWL 2 may prefer to consult one of the user documents (Primer, New Features and Rationale, and Quick Reference Guide).

  

| Part | Type | Document |
| --- | --- | --- |
| 1 | For Users | [Document Overview](#). A quick overview of the OWL 2 specification that includes a description of its relationship to OWL 1. This it the starting point and primary reference point for OWL 2. |
| 2 | Core Specification | [Structural Specification and Functional-Style Syntax](https://www.w3.org/TR/2012/REC-owl2-syntax-20121211/) defines the constructs of OWL 2 ontologies in terms of both their structure and a functional-style syntax, and defines OWL 2 DL ontologies in terms of global restrictions on OWL 2 ontologies. |
| 3 | Core Specification | [Mapping to RDF Graphs](https://www.w3.org/TR/2012/REC-owl2-mapping-to-rdf-20121211/) defines a mapping of the OWL 2 constructs into RDF graphs, and thus defines the primary means of exchanging OWL 2 ontologies in the Semantic Web. |
| 4 | Core Specification | [Direct Semantics](https://www.w3.org/TR/2012/REC-owl2-direct-semantics-20121211/) defines the meaning of OWL 2 ontologies in terms of a model-theoretic semantics. |
| 5 | Core Specification | [RDF-Based Semantics](https://www.w3.org/TR/2012/REC-owl2-rdf-based-semantics-20121211/) defines the meaning of OWL 2 ontologies via an extension of the [RDF Semantics](https://www.w3.org/TR/rdf-mt/). |
| 6 | Core Specification | [Conformance](https://www.w3.org/TR/2012/REC-owl2-conformance-20121211/) provides requirements for OWL 2 tools and a set of test cases to help determine conformance. |
| 7 | Specification | [Profiles](https://www.w3.org/TR/2012/REC-owl2-profiles-20121211/) defines three sub-languages of OWL 2 that offer important advantages in particular applications scenarios. |
| 8 | For Users | [OWL 2 Primer](https://www.w3.org/TR/2012/REC-owl2-primer-20121211/) provides an approachable introduction to OWL 2, including orientation for those coming from other disciplines. |
| 9 | For Users | [OWL 2 New Features and Rationale](https://www.w3.org/TR/2012/REC-owl2-new-features-20121211/) provides an overview of the main new features of OWL 2 and motivates their inclusion in the language. |
| 10 | For Users | [OWL 2 Quick Reference Guide](https://www.w3.org/TR/2012/REC-owl2-quick-reference-20121211/) provides a brief guide to the constructs of OWL 2, noting the changes from OWL 1. |
| 11 | Specification | [XML Serialization](https://www.w3.org/TR/2012/REC-owl2-xml-serialization-20121211/) defines an XML syntax for exchanging OWL 2 ontologies, suitable for use with XML tools like schema-based editors and XQuery/XPath. |
| 12 | Specification | [Manchester Syntax](https://www.w3.org/TR/2012/NOTE-owl2-manchester-syntax-20121211/) (WG Note) defines an easy-to-read, but less formal, syntax for OWL 2 that is used in some OWL 2 user interface tools and is also used in the [Primer](https://www.w3.org/TR/2012/REC-owl2-primer-20121211/). |
| 13 | Specification | [Data Range Extension: Linear Equations](https://www.w3.org/TR/2012/NOTE-owl2-dr-linear-20121211/) (WG Note) specifies an optional extension to OWL 2 which supports advanced constraints on the values of properties. |

## 5 Appendix: Change Log (Informative)

### 5.1 Changes Since Recommendation

This section summarizes the changes to this document since the [Recommendation of 27 October 2009](https://www.w3.org/TR/2009/REC-owl2-syntax-20091027/ "http://www.w3.org/TR/2009/REC-owl2-syntax-20091027/").

-   With the publication of the XML Schema Definition Language (XSD) 1.1 Part 2: Datatypes [Recommendation of 5 April 2012](https://www.w3.org/TR/2012/REC-xmlschema11-2-20120405/ "http://www.w3.org/TR/2012/REC-xmlschema11-2-20120405/"), the elements of OWL 2 which are based on XSD 1.1 are now considered required, and the note detailing the optional dependency on the XSD 1.1 [Candidate Recommendation of 30 April, 2009](https://www.w3.org/TR/2009/CR-xmlschema11-2-20090430/ "http://www.w3.org/TR/2009/CR-xmlschema11-2-20090430/") has been removed from the "Status of this Document" section.

### 5.2 Changes Since Proposed Recommendation

No changes have been made to this document since the [Proposed Recommendation of 22 September, 2009](https://www.w3.org/TR/2009/PR-owl2-overview-20090922/ "http://www.w3.org/TR/2009/PR-owl2-overview-20090922/").

### 5.3 Changes Since Last Call

This section summarizes the changes to this document since the [Last Call Working Draft of 11 June, 2009](https://www.w3.org/TR/2009/WD-owl2-overview-20090611/ "http://www.w3.org/TR/2009/WD-owl2-overview-20090611/").

-   Some minor editorial changes were made.

## 6 Acknowledgements

The starting point for the development of OWL 2 was the [OWL1.1 member submission](https://www.w3.org/Submission/2006/10/ "http://www.w3.org/Submission/2006/10/"), itself a result of user and developer feedback, and in particular of information gathered during the [OWL Experiences and Directions (OWLED) Workshop series](http://www.webont.org/owled/ "http://www.webont.org/owled/"). The working group also considered [postponed issues](https://www.w3.org/2001/sw/WebOnt/webont-issues.html "http://www.w3.org/2001/sw/WebOnt/webont-issues.html") from the [WebOnt Working Group](https://www.w3.org/2004/OWL/ "http://www.w3.org/2004/OWL/").

This document has been produced by the OWL Working Group (see below), and its contents reflect extensive discussions within the Working Group as a whole. The editors extend special thanks to Ivan Herman (W3C/ERCIM), Ian Horrocks (Oxford University) and Peter F. Patel-Schneider (Bell Labs Research, Alcatel-Lucent) for their thorough reviews.

The regular attendees at meetings of the OWL Working Group at the time of publication of this document were: Jie Bao (RPI), Diego Calvanese (Free University of Bozen-Bolzano), Bernardo Cuenca Grau (Oxford University Computing Laboratory), Martin Dzbor (Open University), Achille Fokoue (IBM Corporation), Christine Golbreich (Université de Versailles St-Quentin and LIRMM), Sandro Hawke (W3C/MIT), Ivan Herman (W3C/ERCIM), Rinke Hoekstra (University of Amsterdam), Ian Horrocks (Oxford University Computing Laboratory), Elisa Kendall (Sandpiper Software), Markus Krötzsch (FZI), Carsten Lutz (Universität Bremen), Deborah L. McGuinness (RPI), Boris Motik (Oxford University Computing Laboratory), Jeff Pan (University of Aberdeen), Bijan Parsia (University of Manchester), Peter F. Patel-Schneider (Bell Labs Research, Alcatel-Lucent), Sebastian Rudolph (FZI), Alan Ruttenberg (Science Commons), Uli Sattler (University of Manchester), Michael Schneider (FZI), Mike Smith (Clark & Parsia), Evan Wallace (NIST), Zhe Wu (Oracle Corporation), and Antoine Zimmermann (DERI Galway). We would also like to thank past members of the working group: Jeremy Carroll, Jim Hendler, and Vipul Kashyap.

## 7 References

\[OWL 2 Conformance\]

[OWL 2 Web Ontology Language: Conformance (Second Edition)](https://www.w3.org/TR/2012/REC-owl2-conformance-20121211/) Michael Smith, Ian Horrocks, Markus Krötzsch, Birte Glimm, eds. W3C Recommendation, 11 December 2012, [http://www.w3.org/TR/2012/REC-owl2-conformance-20121211/](https://www.w3.org/TR/2012/REC-owl2-conformance-20121211/). Latest version available at [http://www.w3.org/TR/owl2-conformance/](https://www.w3.org/TR/owl2-conformance/).

\[OWL 2 Direct Semantics\]

[OWL 2 Web Ontology Language: Direct Semantics (Second Edition)](https://www.w3.org/TR/2012/REC-owl2-direct-semantics-20121211/) Boris Motik, Peter F. Patel-Schneider, Bernardo Cuenca Grau, eds. W3C Recommendation, 11 December 2012, [http://www.w3.org/TR/2012/REC-owl2-direct-semantics-20121211/](https://www.w3.org/TR/2012/REC-owl2-direct-semantics-20121211/). Latest version available at [http://www.w3.org/TR/owl2-direct-semantics/](https://www.w3.org/TR/owl2-direct-semantics/).

\[OWL 2 Manchester Syntax\]

[OWL 2 Web Ontology Language: Manchester Syntax (Second Edition)](https://www.w3.org/TR/2012/NOTE-owl2-manchester-syntax-20121211/) Matthew Horridge, Peter F. Patel-Schneider. W3C Working Group Note, 11 December 2012, [http://www.w3.org/TR/2012/NOTE-owl2-manchester-syntax-20121211/](https://www.w3.org/TR/2012/NOTE-owl2-manchester-syntax-20121211/). Latest version available at [http://www.w3.org/TR/owl2-manchester-syntax/](https://www.w3.org/TR/owl2-manchester-syntax/).

\[OWL 2 New Features and Rationale\]

[OWL 2 Web Ontology Language: New Features and Rationale (Second Edition)](https://www.w3.org/TR/2012/REC-owl2-new-features-20121211/) Christine Golbreich, Evan K. Wallace, eds. W3C Recommendation, 11 December 2012, [http://www.w3.org/TR/2012/REC-owl2-new-features-20121211/](https://www.w3.org/TR/2012/REC-owl2-new-features-20121211/). Latest version available at [http://www.w3.org/TR/owl2-new-features/](https://www.w3.org/TR/owl2-new-features/).

\[OWL 2 Primer\]

[OWL 2 Web Ontology Language: Primer (Second Edition)](https://www.w3.org/TR/2012/REC-owl2-primer-20121211/) Pascal Hitzler, Markus Krötzsch, Bijan Parsia, Peter F. Patel-Schneider, Sebastian Rudolph, eds. W3C Recommendation, 11 December 2012, [http://www.w3.org/TR/2012/REC-owl2-primer-20121211/](https://www.w3.org/TR/2012/REC-owl2-primer-20121211/). Latest version available at [http://www.w3.org/TR/owl2-primer/](https://www.w3.org/TR/owl2-primer/).

\[OWL 2 Profiles\]

[OWL 2 Web Ontology Language: Profiles (Second Edition)](https://www.w3.org/TR/2012/REC-owl2-profiles-20121211/) Boris Motik, Bernardo Cuenca Grau, Ian Horrocks, Zhe Wu, Achille Fokoue, Carsten Lutz, eds. W3C Recommendation, 11 December 2012, [http://www.w3.org/TR/2012/REC-owl2-profiles-20121211/](https://www.w3.org/TR/2012/REC-owl2-profiles-20121211/). Latest version available at [http://www.w3.org/TR/owl2-profiles/](https://www.w3.org/TR/owl2-profiles/).

\[OWL 2 Quick Reference Guide\]

[OWL 2 Web Ontology Language: Quick Reference Guide (Second Edition)](https://www.w3.org/TR/2012/REC-owl2-quick-reference-20121211/) Jie Bao, Elisa F. Kendall, Deborah L. McGuinness, Peter F. Patel-Schneider, eds. W3C Recommendation, 11 December 2012, [http://www.w3.org/TR/2012/REC-owl2-quick-reference-20121211/](https://www.w3.org/TR/2012/REC-owl2-quick-reference-20121211/). Latest version available at [http://www.w3.org/TR/owl2-quick-reference/](https://www.w3.org/TR/owl2-quick-reference/).

\[OWL 2 RDF Mapping\]

[OWL 2 Web Ontology Language: Mapping to RDF Graphs (Second Edition)](https://www.w3.org/TR/2012/REC-owl2-mapping-to-rdf-20121211/) Peter F. Patel-Schneider, Boris Motik, eds. W3C Recommendation, 11 December 2012, [http://www.w3.org/TR/2012/REC-owl2-mapping-to-rdf-20121211/](https://www.w3.org/TR/2012/REC-owl2-mapping-to-rdf-20121211/). Latest version available at [http://www.w3.org/TR/owl2-mapping-to-rdf/](https://www.w3.org/TR/owl2-mapping-to-rdf/).

\[OWL 2 RDF-Based Semantics\]

[OWL 2 Web Ontology Language: RDF-Based Semantics (Second Edition)](https://www.w3.org/TR/2012/REC-owl2-rdf-based-semantics-20121211/) Michael Schneider, editor. W3C Recommendation, 11 December 2012, [http://www.w3.org/TR/2012/REC-owl2-rdf-based-semantics-20121211/](https://www.w3.org/TR/2012/REC-owl2-rdf-based-semantics-20121211/). Latest version available at [http://www.w3.org/TR/owl2-rdf-based-semantics/](https://www.w3.org/TR/owl2-rdf-based-semantics/).

\[OWL 2 Specification\]

[OWL 2 Web Ontology Language: Structural Specification and Functional-Style Syntax (Second Edition)](https://www.w3.org/TR/2012/REC-owl2-syntax-20121211/) Boris Motik, Peter F. Patel-Schneider, Bijan Parsia, eds. W3C Recommendation, 11 December 2012, [http://www.w3.org/TR/2012/REC-owl2-syntax-20121211/](https://www.w3.org/TR/2012/REC-owl2-syntax-20121211/). Latest version available at [http://www.w3.org/TR/owl2-syntax/](https://www.w3.org/TR/owl2-syntax/).

\[OWL 2 XML Serialization\]

[OWL 2 Web Ontology Language: XML Serialization (Second Edition)](https://www.w3.org/TR/2012/REC-owl2-xml-serialization-20121211/) Boris Motik, Bijan Parsia, Peter F. Patel-Schneider, eds. W3C Recommendation, 11 December 2012, [http://www.w3.org/TR/2012/REC-owl2-xml-serialization-20121211/](https://www.w3.org/TR/2012/REC-owl2-xml-serialization-20121211/). Latest version available at [http://www.w3.org/TR/owl2-xml-serialization/](https://www.w3.org/TR/owl2-xml-serialization/).

\[RDF Semantics\]

[RDF Semantics](https://www.w3.org/TR/2004/REC-rdf-mt-20040210/ "http://www.w3.org/TR/2004/REC-rdf-mt-20040210/"). Patrick Hayes, ed., W3C Recommendation, 10 February 2004, http://www.w3.org/TR/2004/REC-rdf-mt-20040210/. Latest version available as http://www.w3.org/TR/rdf-mt/.

\[RDF Syntax\]

[RDF/XML Syntax Specification (Revised)](https://www.w3.org/TR/2004/REC-rdf-syntax-grammar-20040210/ "http://www.w3.org/TR/2004/REC-rdf-syntax-grammar-20040210/"). Dave Beckett, ed. W3C Recommendation, 10 February 2004, http://www.w3.org/TR/2004/REC-rdf-syntax-grammar-20040210/. Latest version available as http://www.w3.org/TR/rdf-syntax-grammar/.

\[Turtle\]

[Turtle: Terse RDF Triple Language](https://www.w3.org/TR/turtle/ "http://www.w3.org/TR/turtle/"). Eric Prud'hommeaux and Gavin Carothers. W3C Last Call Working Draft, 10 July 2012, http://www.w3.org/TR/2012/WD-turtle-20120710/. Latest version available at http://www.w3.org/TR/turtle/.

\[UML\]

[OMG Unified Modeling Language (OMG UML), Infrastructure, V2.1.2](http://www.omg.org/spec/UML/2.1.2/Infrastructure/PDF/ "http://www.omg.org/spec/UML/2.1.2/Infrastructure/PDF/"). Object Management Group, OMG Available Specification, November 2007, http://www.omg.org/spec/UML/2.1.2/Infrastructure/PDF/.
