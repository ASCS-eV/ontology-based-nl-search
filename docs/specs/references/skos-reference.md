<!--
  ⚠ THIRD-PARTY SPECIFICATION — NOT AN ORIGINAL WORK OF THIS PROJECT.
  Title:     SKOS Simple Knowledge Organization System Reference
  Source:    https://www.w3.org/TR/skos-reference/
  Publisher: W3C
  License:   W3C Document License 2023 (https://www.w3.org/copyright/document-license-2023/)
  Retrieved: 2026-06-16
  Reproduced verbatim for offline reference and AI-agent context. The
  publisher's original copyright and license apply. Do not hand-edit —
  refresh from source (see docs/specs/references/README.md).
-->

> **Third-party specification — reproduced for offline reference and AI-agent context.**
> **Title:** SKOS Simple Knowledge Organization System Reference  
> **Status:** W3C Recommendation  
> **Source:** <https://www.w3.org/TR/skos-reference/>  
> **Publisher:** W3C  
> **License:** W3C Document License 2023 — <https://www.w3.org/copyright/document-license-2023/>  
> **Retrieved:** 2026-06-16  
> The publisher's original copyright and license apply. Do not hand-edit;
> refresh from source — see [README](./README.md).

---

SKOS Simple Knowledge Organization System Reference   

[![W3C](https://www.w3.org/Icons/w3c_home)](https://www.w3.org/)

# SKOS Simple Knowledge Organization System  
Reference

## W3C Recommendation 18 August 2009

This version:

[http://www.w3.org/TR/2009/REC-skos-reference-20090818/](https://www.w3.org/TR/2009/REC-skos-reference-20090818/)  

Latest version:

[http://www.w3.org/TR/skos-reference](https://www.w3.org/TR/skos-reference)

Previous versions:

[http://www.w3.org/TR/2009/PR-skos-reference-20090615/](https://www.w3.org/TR/2009/PR-skos-reference-20090615/)

Editors:

[Alistair Miles](http://purl.org/net/aliman), STFC Rutherford Appleton Laboratory / University of Oxford  
[Sean Bechhofer](http://www.cs.man.ac.uk/~seanb/#me), University of Manchester  

Please refer to the [**errata**](https://www.w3.org/2006/07/SWD/SKOS/reference/20090811-errata) for this document, which may include some normative corrections.

See also [**translations**](https://www.w3.org/2003/03/Translations/byTechnology?technology=skos-reference).

[Copyright](https://www.w3.org/Consortium/Legal/ipr-notice#Copyright) © 2009 [W3C](https://www.w3.org/)® ([MIT](http://www.csail.mit.edu/), [ERCIM](http://www.ercim.org/), [Keio](http://www.keio.ac.jp/)), All Rights Reserved. W3C [liability](https://www.w3.org/Consortium/Legal/ipr-notice#Legal_Disclaimer), [trademark](https://www.w3.org/Consortium/Legal/ipr-notice#W3C_Trademarks) and [document use](https://www.w3.org/Consortium/Legal/copyright-documents) rules apply.

---

## Abstract

This document defines the Simple Knowledge Organization System (SKOS), a common data model for sharing and linking knowledge organization systems via the Web.

Many knowledge organization systems, such as thesauri, taxonomies, classification schemes and subject heading systems, share a similar structure, and are used in similar applications. SKOS captures much of this similarity and makes it explicit, to enable data and technology sharing across diverse applications.

The SKOS data model provides a standard, low-cost migration path for porting existing knowledge organization systems to the Semantic Web. SKOS also provides a lightweight, intuitive language for developing and sharing new knowledge organization systems. It may be used on its own, or in combination with formal knowledge representation languages such as the Web Ontology language (OWL).

This document is the normative specification of the Simple Knowledge Organization System. It is intended for readers who are involved in the design and implementation of information systems, and who already have a good understanding of Semantic Web technology, especially RDF and OWL.

For an informative guide to using SKOS, see the \[[SKOS-PRIMER](#ref-SKOS-PRIMER)\].

### Synopsis

Using SKOS, **[concepts](#concepts)** can be identified using URIs, **[labeled](#labels)** with lexical strings in one or more natural languages, assigned **[notations](#notations)** (lexical codes), **[documented](#notes)** with various types of note, **[linked to other concepts](#semantic-relations)** and organized into informal hierarchies and association networks, aggregated into **[concept schemes](#schemes)**, grouped into labeled and/or ordered **[collections](#collections)**, and **[mapped](#mapping)** to concepts in other schemes.

\[show quick access panel\]

---

## Status of This Document

_This section describes the status of this document at the time of its publication. Other documents may supersede this document. A list of current W3C publications and the latest revision of this technical report can be found in the [W3C technical reports index](https://www.w3.org/TR/) at http://www.w3.org/TR/._

This document is a W3C Recommendation developed by the [Semantic Web Deployment Working Group](https://www.w3.org/2006/07/SWD/), part of the [W3C Semantic Web Activity](https://www.w3.org/2001/sw/Activity). This document reflects an editorial change arising during the Proposed Recommendation review: a non-normative example and preceding text was removed that suggested one means to reference a system of notation (e.g. a symbolic notation) in a label where the system of notation does not correspond to a natural language. This suggestion was deemed inconsistent with IETF [Best Current Practice 47](http://www.rfc-editor.org/rfc/bcp/bcp47.txt) on the use of tags for identifying languages. Users should consider the [SKOS Extension vocabulary](#xl) for support of alternate systems of notation. An [implementation report](https://www.w3.org/2006/07/SWD/SKOS/reference/20090315/implementation.html) documents known uses of SKOS during the Candidate Recommendation review period. An updated [SKOS Primer](https://www.w3.org/TR/skos-primer) is being published concurrently with this Recommendation.

Changes Since [15 June 2009 Proposed Recommendation](https://www.w3.org/TR/2009/PR-skos-reference-20090615/):

-   Removed final paragraph and example from section 6.5.4 on use of private use language sub-tags.
-   Editorial changes to references section and citation of SKOS Primer.

Comments on this document may be sent to [public-swd-wg@w3.org](mailto:public-swd-wg@w3.org) with [public archive](http://lists.w3.org/Archives/Public/public-swd-wg/).

This document was produced by a group operating under the [5 February 2004 W3C Patent Policy](https://www.w3.org/Consortium/Patent-Policy-20040205/). W3C maintains a [public list of any patent disclosures](https://www.w3.org/2004/01/pp-impl/39408/status) made in connection with the deliverables of the group; that page also includes instructions for disclosing a patent. An individual who has actual knowledge of a patent which the individual believes contains [Essential Claim(s)](https://www.w3.org/Consortium/Patent-Policy-20040205/#def-essential) must disclose the information in accordance with [section 6 of the W3C Patent Policy](https://www.w3.org/Consortium/Patent-Policy-20040205/#sec-Disclosure).

This document has been reviewed by W3C Members, by software developers, and by other W3C groups and interested parties, and is endorsed by the Director as a W3C Recommendation. It is a stable document and may be used as reference material or cited from another document. W3C's role in making the Recommendation is to draw attention to the specification and to promote its widespread deployment. This enhances the functionality and interoperability of the Web.

Quick Access Panel \[hide\]

[Full Table of Contents](#toc)

**Classes**

-   [skos:Collection](#Collection)
-   [skos:Concept](#Concept)
-   [skos:ConceptScheme](#ConceptScheme)
-   [skos:OrderedCollection](#OrderedCollection)

**Properties**

-   [skos:altLabel](#altLabel)
-   [skos:broadMatch](#broadMatch)
-   [skos:broader](#broader)
-   [skos:broaderTransitive](#broaderTransitive)
-   [skos:changeNote](#changeNote)
-   [skos:closeMatch](#closeMatch)
-   [skos:definition](#definition)
-   [skos:editorialNote](#editorialNote)
-   [skos:exactMatch](#exactMatch)
-   [skos:example](#example)
-   [skos:hasTopConcept](#hasTopConcept)
-   [skos:hiddenLabel](#hiddenLabel)
-   [skos:historyNote](#historyNote)
-   [skos:inScheme](#inScheme)
-   [skos:mappingRelation](#mappingRelation)
-   [skos:member](#member)
-   [skos:memberList](#memberList)
-   [skos:narrowMatch](#narrowMatch)
-   [skos:narrower](#narrower)
-   [skos:narrowerTransitive](#narrowerTransitive)
-   [skos:notation](#notation)
-   [skos:note](#note)
-   [skos:prefLabel](#prefLabel)
-   [skos:related](#related)
-   [skos:relatedMatch](#relatedMatch)
-   [skos:scopeNote](#scopeNote)
-   [skos:semanticRelation](#semanticRelation)
-   [skos:topConceptOf](#topConceptOf)

**Sections**

-   [1\. Introduction](#intro)
-   [2\. Namespace and Vocabulary](#vocab)
-   [3\. The skos:Concept Class](#concepts)
-   [4\. Concept Schemes](#schemes)
-   [5\. Lexical Labels](#labels)
-   [6\. Notations](#notations)
-   [7\. Documentation Properties](#notes)
-   [8\. Semantic Relations](#semantic-relations)
-   [9\. Concept Collections](#collections)
-   [10\. Mapping Properties](#mapping)
-   [11\. References](#references)

**Appendices**

-   [A. SKOS Properties and Classes](#overview)
-   [B. SKOS eXtension for Labels (SKOS-XL)](#xl)
-   [C. SKOS and SKOS-XL Namespace Documents](#namespace-documents)
-   [D. SKOS Namespace](#namespace)

## Table of Contents

\[show quick access panel\]

-   [**1\. Introduction**](#intro)
    -   [1.1. Background and Motivation](#L879)
    -   [1.2. SKOS Overview](#L895)
    -   [1.3. SKOS, RDF and OWL](#L1045)
    -   [1.4. Consistency and Integrity](#L831)
    -   [1.5. Inference, Dependency and the Open-World Assumption](#L881)
    -   [1.6. Design Rationale](#rationale)
    -   [1.7. How to Read this Document](#L649)
        -   [1.7.1. Formal Definitions](#L1291)
        -   [1.7.2. URI Abbreviations](#L1368)
        -   [1.7.3. Examples](#L1501)
    -   [1.8. Conformance](#L434)
-   [**2\. SKOS Namespace and Vocabulary**](#vocab)
-   [**3\. The skos:Concept Class**](#concepts)
    -   [3.1. Preamble](#L1437)
    -   [3.2. Vocabulary](#L2039)
    -   [3.3. Class & Property Definitions](#L842)
    -   [3.4. Examples](#L2118)
    -   [3.5. Notes](#L2145)
        -   [3.5.1. SKOS Concepts, OWL Classes and OWL Properties](#L896)
-   [**4\. Concept Schemes**](#schemes)
    -   [4.1. Preamble](#L1638)
    -   [4.2. Vocabulary](#L2457)
    -   [4.3. Class & Property Definitions](#L8421)
    -   [4.4. Integrity Conditions](#L1228)
    -   [4.5. Examples](#L21181)
    -   [4.6. Notes](#L2497)
        -   [4.6.1. Closed vs. Open Systems](#L1101)
        -   [4.6.2. SKOS Concept Schemes and OWL Ontologies](#L1170)
        -   [4.6.3. Top Concepts and Semantic Relations](#L2446)
        -   [4.6.4. Scheme Containment and Semantic Relations](#L2577)
        -   [4.6.5. Domain of skos:inScheme](#L2805)
-   [**5\. Lexical Labels**](#labels)
    -   [5.1. Preamble](#L2007)
    -   [5.2. Vocabulary](#L1304)
    -   [5.3. Class & Property Definitions](#L1329)
    -   [5.4. Integrity Conditions](#L1567)
    -   [5.5. Examples](#L1409)
    -   [5.6. Notes](#L1539)
        -   [5.6.1. Domain of SKOS Lexical Labeling Properties](#L1541)
        -   [5.6.2. Range of SKOS Lexical Labeling Properties](#L1581)
        -   [5.6.3. Defining Label Relations](#L3260)
        -   [5.6.4. Alternates Without Preferred](#L1606)
        -   [5.6.5. Labeling and Language Tags](#L1629)
-   [**6\. Notations**](#notations)
    -   [6.1. Preamble](#L2531)
    -   [6.2. Vocabulary](#L2542)
    -   [6.3. Class & Property Definitions](#L2557)
    -   [6.4. Examples](#L2584)
    -   [6.5. Notes](#L2611)
        -   [6.5.1. Notations, Typed Literals and Datatypes](#L2613)
        -   [6.5.2. Multiple Notations](#L2637)
        -   [6.5.3. Unique Notations in Concept Schemes](#L2646)
        -   [6.5.4. Notations and Preferred Labels](#L2655)
        -   [6.5.5. Domain of skos:notation](#notations-note-domain)
-   [**7\. Documentation Properties (Note Properties)**](#notes)
    -   [7.1. Preamble](#L2543)
    -   [7.2. Vocabulary](#L1693)
    -   [7.3. Class & Property Definitions](#L1738)
    -   [7.4. Examples](#L1812)
    -   [7.5. Notes](#L1877)
        -   [7.5.1. Domain of the SKOS Documentation Properties](#L1879)
        -   [7.5.2. Range of the SKOS Documentation Properties](#L1917)
-   [**8\. Semantic Relations**](#semantic-relations)
    -   [8.1. Preamble](#L2810)
    -   [8.2. Vocabulary](#L2010)
    -   [8.3. Class & Property Definitions](#L2055)
    -   [8.4. Integrity Conditions](#L2422)
    -   [8.5. Examples](#L2157)
    -   [8.6. Notes](#L2249)
        -   [8.6.1. Sub-Property Relationships](#L3732)
        -   [8.6.2. Domain and Range of SKOS Semantic Relation Properties](#L2251)
        -   [8.6.3. Symmetry of skos:related](#L2255)
        -   [8.6.4. skos:related and Transitivity](#L2344)
        -   [8.6.5. skos:related and Reflexivity](#L2376)
        -   [8.6.6. skos:broader and Transitivity](#L2413)
        -   [8.6.7. skos:broader and Reflexivity](#L2449)
        -   [8.6.8. Cycles in the Hierarchical Relation (skos:broaderTransitive and Reflexivity)](#L2484)
        -   [8.6.9. Alternate Paths in the Hierarchical Relation](#L2518)
        -   [8.6.10. Disjointness of skos:related and skos:broaderTransitive](#L4261)
-   [**9\. Concept Collections**](#collections)
    -   [9.1. Preamble](#L3806)
    -   [9.2. Vocabulary](#L3282)
    -   [9.3. Class & Property Definitions](#L3312)
    -   [9.4. Integrity Conditions](#L3424)
    -   [9.5. Examples](#L3460)
    -   [9.6. Notes](#L3512)
        -   [9.6.1. Inferring Collections from Ordered Collections](#L3514)
        -   [9.6.2. skos:memberList Integrity](#L3551)
        -   [9.6.3. Nested Collections](#L3588)
        -   [9.6.4. SKOS Concepts, Concept Collections and Semantic Relations](#L3625)
-   [**10\. Mapping Properties**](#mapping)
    -   [10.1. Preamble](#L4307)
    -   [10.2. Vocabulary](#L4138)
    -   [10.3. Class & Property Definitions](#L4186)
    -   [10.4. Integrity Conditions](#L5429)
    -   [10.5. Examples](#L4316)
    -   [10.6. Notes](#L4412)
        -   [10.6.1. Mapping Properties, Semantic Relation Properties and Concept Schemes](#L4160)
        -   [10.6.2. Clashes Between Hierarchical and Associative Links](#L4394)
        -   [10.6.3. Mapping Properties and Transitivity](#L4414)
        -   [10.6.4. Mapping Properties and Reflexivity](#L4499)
        -   [10.6.5. Cycles and Alternate Paths Involving skos:broadMatch](#L4564)
        -   [10.6.6. Cycles Involving skos:exactMatch and skos:closeMatch](#mapping-cycles-exactMatch)
        -   [10.6.7. Sub-Property Chains Involving skos:exactMatch](#L5675)
        -   [10.6.8. skos:closeMatch, skos:exactMatch, owl:sameAs, owl:equivalentClass, owl:equivalentProperty](#L4858)
-   [**11\. References**](#references)
-   [**12\. Acknowledgments**](#ack)
-   [**Appendix A. SKOS Properties and Classes**](#overview)
    -   [A.1. Classes in the SKOS Data Model](#L7130)
    -   [A.2. Properties in the SKOS Data Model](#L7307)
-   [**Appendix B. SKOS eXtension for Labels (SKOS-XL)**](#xl)
    -   [B.1. SKOS-XL Namespace and Vocabulary](#L5212)
    -   [B.2. The skosxl:Label Class](#L5444)
        -   [B.2.1. Preamble](#L375)
        -   [B.2.2. Class and Property Definitions](#L5518)
        -   [B.2.3. Examples](#L5525)
        -   [B.2.4. Notes](#L5716)
            -   [B.2.4.1. Identity and Entailment](#L5739)
            -   [B.2.4.2. Membership of Concept Schemes](#L648)
    -   [B.3. Preferred, Alternate and Hidden skosxl:Labels](#L5981)
        -   [B.3.1. Preamble](#L661)
        -   [B.3.2. Class and Property Definitions](#L677)
        -   [B.3.3. Examples](#L724)
        -   [B.3.4. Notes](#L778)
            -   [B.3.4.1. Dumbing-Down to SKOS Lexical Labels](#L780)
            -   [B.3.4.2. SKOS-XL Labeling Integrity](#L899)
    -   [B.4. Links Between skosxl:Labels](#L7196)
        -   [B.4.1. Preamble](#L1120)
        -   [B.4.2. Class and Property Definitions](#L1129)
        -   [B.4.3. Examples](#L1160)
        -   [B.4.4. Notes](#L1193)
            -   [B.4.4.1. Refinements of this Pattern](#L1195)
-   [**Appendix C. SKOS and SKOS-XL Namespace Documents**](#namespace-documents)
-   [**Appendix D. SKOS Namespace: a historical note**](#namespace)

---

## 1\. Introduction

### 1.1. Background and Motivation

The Simple Knowledge Organization System is a data-sharing standard, bridging several different fields of knowledge, technology and practice.

In the library and information sciences, a long and distinguished heritage is devoted to developing tools for organizing large collections of objects such as books or museum artifacts. These tools are known generally as "knowledge organization systems" (KOS) or sometimes as "controlled structured vocabularies". Several similar yet distinct traditions have emerged over time, each supported by a community of practice and set of agreed standards. Different families of knowledge organization systems, including thesauri, classification schemes, subject heading systems, and taxonomies are widely recognized and applied in both modern and traditional information systems. In practice it can be hard to draw an absolute distinction between thesauri and classification schemes or taxonomies, although some properties can be used to broadly characterize these different families (see e.g., \[[BS8723-3](#ref-BS8723-3)\]). The important point for SKOS is that, in addition to their unique features, each of these families shares much in common, and can often be used in similar ways \[[SKOS-UCR](#ref-SKOS-UCR)\]. However, there is currently no widely deployed standard for representing these knowledge organization systems as data and exchanging them between computer systems.

The W3C's Semantic Web Activity \[[SW](#ref-SW)\] has stimulated a new field of integrative research and technology development, at the boundaries between database systems, formal logic and the World Wide Web. This work has led to the development of foundational standards for the Semantic Web. The Resource Description Framework (RDF) provides a common data abstraction and syntax for the Web \[[RDF-PRIMER](#ref-RDF-PRIMER)\]. The RDF Vocabulary Description language (RDFS) and the Web Ontology language (OWL) together provide a common data modeling (schema) language for data in the Web \[[RDFS](#ref-RDFS)\] \[[OWL-GUIDE](#ref-OWL-GUIDE)\]. The SPARQL Query Language and Protocol provide a standard means for interacting with data in the Web \[[SPARQL](#ref-SPARQL)\].

These technologies are being applied across diverse applications, because many applications require a common framework for publishing, sharing, exchanging and integrating ("joining up") data from different sources. The ability to link data from different sources is motivating many projects, as different communities seek to exploit the hidden value in data previously spread across isolated sources.

One facet of the Semantic Web vision is the hope of better organizing the vast amounts of unstructured (i.e., human-readable) information in the Web, providing new routes to discovering and sharing that information. RDFS and OWL are formally defined knowledge representation languages, providing ways of expressing meaning that are amenable to computation, meaning that complements and gives structure to information already present in the Web \[[RDF-PRIMER](#ref-RDF-PRIMER)\] \[[OWL-GUIDE](#ref-OWL-GUIDE)\]. However, to actually apply these technologies over large bodies of information requires the construction of detailed maps of particular domains of knowledge, in addition to the accurate description (i.e., annotation or cataloging) of information resources on a large scale, much of which cannot be done automatically. The accumulated experience and best practices in the library and information sciences regarding the organization of information and knowledge are obviously complementary and applicable to this vision, as are the many existing knowledge organization systems already developed and in use, such as the Library of Congress Subject Headings \[[LCSH](#ref-LCSH)\] or the United Nations Food and Agriculture Organization's AGROVOC Thesaurus \[[AGROVOC](#ref-AGROVOC)\].

The Simple Knowledge Organization System therefore aims to provide a bridge between different communities of practice within the library and information sciences involved in the design and application of knowledge organization systems. In addition, SKOS aims to provide a bridge between these communities and the Semantic Web, by transferring existing models of knowledge organization to the Semantic Web technology context, and by providing a low-cost migration path for porting existing knowledge organization systems to RDF.

Looking to the future, SKOS occupies a position between the exploitation and analysis of unstructured information, the informal and socially-mediated organization of information on a large scale, and the formal representation of knowledge. By making the accumulated experience and wisdom of knowledge organization in the library and information sciences accessible, applicable and transferable to the technological context of the Semantic Web, in a way that is complementary to existing Semantic Web technology (and in particular formal systems of knowledge representation such as OWL), it is hoped that SKOS will enable many new and valuable applications, and will also lead to new integrative lines of research and development in both technology and practice.

### 1.2. SKOS Overview

The Simple Knowledge Organization System is a common data model for knowledge organization systems such as thesauri, classification schemes, subject heading systems and taxonomies. Using SKOS, a knowledge organization system can be expressed **as machine-readable data**. It can then be exchanged between computer applications and published in a machine-readable format in the Web.

The SKOS data model is formally defined in this specification as an OWL Full ontology \[[OWL-SEMANTICS](#ref-OWL-SEMANTICS)\]. SKOS data are expressed as RDF triples \[[RDF-CONCEPTS](#ref-RDF-CONCEPTS)\], and may be encoded using any concrete RDF syntax (such as RDF/XML \[[RDF-XML](#ref-RDF-XML)\] or Turtle \[[TURTLE](#ref-TURTLE)\]). For more on the relationships between SKOS, RDF and OWL, see the next sub-section below.

The SKOS data model views a knowledge organization system as a **concept scheme** comprising a set of **concepts**. These SKOS concept schemes and SKOS concepts are identified by URIs, enabling anyone to refer to them unambiguously from any context, and making them a part of the World Wide Web. See [Section 3. The skos:Concept Class](#concepts) for more on identifying and describing SKOS concepts, and [Section 4. Concept Schemes](#schemes) for more on concept schemes.

SKOS concepts can be **labeled** with any number of lexical (UNICODE) strings, such as "romantic love" or "れんあい", in any given natural language, such as English or Japanese (written here in hiragana). One of these labels in any given language can be indicated as the preferred label for that language, and the others as alternative labels. Labels may also be "hidden", which is useful where a knowledge organization system is being queried via a text index. See [Section 5. Lexical Labels](#labels) for more on the SKOS lexical labeling properties.

SKOS concepts can be assigned one or more **notations**, which are lexical codes used to uniquely identify the concept within the scope of a given concept scheme. While URIs are the preferred means of identifying SKOS concepts within computer systems, notations provide a bridge to other systems of identification already in use such as classification codes used in library catalogs. See [Section 6. Notations](#notations) for more on notations.

SKOS concepts can be **documented** with notes of various types. The SKOS data model provides a basic set of documentation properties, supporting scope notes, definitions and editorial notes, among others. This set is not meant to be exhaustive, but rather to provide a framework that can be extended by third parties to provide support for more specific types of note. See [Section 7. Documentation Properties](#notes) for more on notes.

SKOS concepts can be **linked** to other SKOS concepts via semantic relation properties. The SKOS data model provides support for hierarchical and associative links between SKOS concepts. Again, as with any part of the SKOS data model, these can be extended by third parties to provide support for more specific needs. See [Section 8. Semantic Relations](#semantic-relations) for more on linking SKOS concepts.

SKOS concepts can be grouped into **collections**, which can be labeled and/or ordered. This feature of the SKOS data model is intended to provide support for node labels within thesauri, and for situations where the ordering of a set of concepts is meaningful or provides some useful information. See [Section 9. Concept Collections](#collections) for more on collections.

SKOS concepts can be **mapped** to other SKOS concepts in different concept schemes. The SKOS data model provides support for four basic types of mapping link: hierarchical, associative, close equivalent and exact equivalent. See [Section 10. Mapping Properties](#mapping) for more on mapping.

Finally, an optional extension to SKOS is defined in [Appendix B. SKOS eXtension for Labels (SKOS-XL)](#xl). SKOS-XL provides more support for identifying, describing and linking lexical entities.

### 1.3. SKOS, RDF and OWL

The elements of the SKOS data model are classes and properties, and the structure and integrity of the data model is defined by the logical characteristics of, and interdependencies between, those classes and properties. This is perhaps one of the most powerful and yet potentially confusing aspects of SKOS, because SKOS can, in more advanced applications, also be used side-by-side with OWL to express and exchange knowledge about a domain. However, SKOS is **not** a formal knowledge representation language.

To understand this distinction, consider that the "knowledge" made explicit in a formal ontology is expressed as sets of axioms and facts. A thesaurus or classification scheme is of a completely different nature, and does not assert any axioms or facts. Rather, a thesaurus or classification scheme identifies and describes, through natural language and other informal means, a set of distinct ideas or meanings, which are sometimes conveniently referred to as "concepts". These "concepts" may also be arranged and organized into various structures, most commonly hierarchies and association networks. These structures, however, do not have any formal semantics, and cannot be reliably interpreted as either formal axioms or facts about the world. Indeed they were never intended to be so, for they serve only to provide a convenient and intuitive map of some subject domain, which can then be used as an aid to organizing and finding objects, such as documents, which are relevant to that domain.

To make the "knowledge" embedded in a thesaurus or classification scheme explicit in any formal sense requires that the thesaurus or classification scheme be _re-engineered_ as a formal ontology. In other words, some person has to do the work of transforming the structure and intellectual content of a thesaurus or classification scheme into a set of formal axioms and facts. This work of transformation is both intellectually demanding and time consuming, and therefore costly. Much can be gained from using thesauri, etc., as-is, as informal, convenient structures for navigation within a subject domain. Using them as-is does not require any re-engineering and is therefore much less costly. In addition, some KOS are, by design, not intended to represent a logical view of their domain. Converting such KOS to a formal logic-based representation may, in practice, involve changes which result in a representation that no longer meets the originally intended purpose.

OWL does, however, provide a powerful data modeling language. We can, therefore, use OWL to construct a data model for representing thesauri or classification schemes as-is. This is exactly what SKOS does. Taking this approach, the "concepts" of a thesaurus or classification scheme are modeled as individuals in the SKOS data model, and the informal descriptions about and links between those "concepts" as given by the thesaurus or classification scheme are modeled as facts about those individuals, never as class or property axioms. Note that these are facts _about_ the thesaurus or classification scheme _itself_, such as "concept X has preferred label 'Y' and is part of thesaurus Z"; these are **not** facts about the way the world is arranged within a particular subject domain, as might be expressed in a formal ontology.

SKOS data are then expressed as RDF triples. The RDF graph below (in \[[TURTLE](#ref-TURTLE)\] as discussed in [Section 1.7.3](#L1501)) expresses some facts about a thesaurus.

<A> rdf:type skos:Concept ;
  skos:prefLabel "love"@en ;
  skos:altLabel "adoration"@en ;
  skos:broader <B> ;
  skos:inScheme <S> .

<B> rdf:type skos:Concept ;
  skos:prefLabel "emotion"@en ;
  skos:altLabel "feeling"@en ;
  skos:topConceptOf <S> .

<S> rdf:type skos:ConceptScheme ;
  dct:title "My First Thesaurus" ;
  skos:hasTopConcept <B> .

This point is vital to understanding the formal definition of the SKOS data model and how it may be implemented in software systems. This point is also vital to more advanced applications of SKOS, especially where SKOS and OWL are used in combination as part of a hybrid formal/semi-formal design.

From a user's point of view, however, the distinction between a formal knowledge representation system and an informal or semi-formal knowledge organization system may naturally become blurred. In other words, it may not be relevant to a user that `<A>` and `<B>` in the graph below are individuals (instances of `skos:Concept`), and `<C>` and `<D>` are classes (instances of `owl:Class`) .

<A> rdf:type skos:Concept ;
  skos:prefLabel "love"@en ;
  skos:broader <B> .

<B> rdf:type skos:Concept ;
  skos:prefLabel "emotion"@en .

<C> rdf:type owl:Class ;
  rdfs:label "mammals"@en ;
  rdfs:subClassOf <D> .

<D> rdf:type owl:Class ;
  rdfs:label "animals"@en .

An information system that has any awareness of the SKOS data model will, however, need to appreciate the distinction.

RDF schemas for SKOS and the SKOS eXtension for Labels (SKOS-XL) are described in [Appendix C. SKOS and SKOS-XL Namespace Documents](#namespace-documents). Note that, as there are constraints that cannot be completely captured in the schema, the RDF/XML document provides a normative subset of this specification.

### 1.4. Consistency and Integrity

Under the RDF and OWL Full semantics, the formal meaning (_interpretation_) of an RDF graph is a truth value \[[RDF-SEMANTICS](#ref-RDF-SEMANTICS)\] \[[OWL-SEMANTICS](#ref-OWL-SEMANTICS)\], i.e., an RDF graph is interpreted as either true or false.

In general, an RDF graph is said to be _inconsistent_ if it cannot possibly be true. In other words, an RDF graph is inconsistent if it contains a contradiction.

Using the RDF and RDFS vocabularies alone, it is virtually impossible to make a contradictory statement. When the OWL vocabulary is used as well, there are many ways to state a contradiction, e.g., consider the RDF graph below.

<Dog> rdf:type owl:Class .
<Cat> rdf:type owl:Class .
<Dog> owl:disjointWith <Cat> .
<dogcat> rdf:type <Dog> , <Cat> .

The graph states that `<Dog>` and `<Cat>` are both classes, and that they are disjoint, i.e., that they do not have any members in common. This is contradicted by the statement that `<dogcat>` has type both `<Dog>` and `<Cat>`. There is no OWL Full interpretation which can satisfy this graph, and therefore this graph is **not** OWL Full consistent.

When OWL Full is used as a knowledge representation language, the notion of inconsistency is useful because it reveals contradictions within the axioms and facts that are asserted in an ontology. By resolving these inconsistencies we learn more about a domain of knowledge, and come to a better model of that domain from which interesting and valid inferences can be drawn.

When OWL Full is used as a data modeling (i.e., schema) language, the notion of inconsistency is again useful, but in a different way. Here we are not concerned with the logical consistency of human knowledge itself. We are simply interested in formally defining a data model, so that we can establish with certainty whether or not some given data fit with (i.e., conform to) the given data model. If the data are inconsistent with respect to the data model, then the data does not fit.

Here, we are not concerned with whether or not some given data have any correspondence with the real world, i.e., whether they are true or false in any absolute sense. We are simply interested in whether or not the data fit the data model, because interoperability within a given class of applications depends on data conforming to a common data model.

Another way to express this view is via the notion of _integrity_. Integrity conditions are statements within the formal definition of a data model, which are used to establish whether or not given data are consistent with respect to the data model, e.g., the statement that `<Dog>` and `<Cat>` are disjoint classes can be viewed as an integrity condition on a data model. Given this condition, the data below are then not consistent.

<dogcat> rdf:type <Dog> , <Cat> .

The definition of the SKOS data model given in this document contains a limited number of statements that are intended as integrity conditions. These integrity conditions are included to promote interoperability, by defining the circumstances under which data are **not consistent** with respect to the SKOS data model. Tools can then be implemented which check whether some or all of these integrity conditions are met for given data, and therefore whether the data are consistent with the SKOS data model.

These integrity conditions are part of the formal definition of the classes and properties of the SKOS data model. However, they are presented separately from other parts of the formal definition because they serve a different purpose. Integrity conditions serve primarily to establish whether given data are consistent with the SKOS data model. All other statements within the definition of the SKOS data model serve **only** to support logical inferences. (See also the next sub-section.)

Integrity conditions are defined for the SKOS data model in a way that is independent of strategies for their implementation, in so far as that is possible. This is because there are several different ways in which a procedure to find inconsistencies with the SKOS data model could be implemented. Inconsistencies could be found using an OWL reasoner. Alternatively, some inconsistencies could be found by searching for specific patterns within the data, or by a hybrid strategy (e.g., drawing inferences using an RDFS or OWL reasoner, then searching for patterns in the inferred graph).

The integrity conditions on the SKOS data model are fewer than might be expected, especially for those used to working within the closed world of database systems. See also the next sub-section, and the notes in sections 3-10 below.

### 1.5. Inference, Dependency and the Open World Assumption

This document defines the SKOS data model as an OWL Full ontology. There are other ways in which the SKOS data model could have been defined, for example as an entity-relationship model, or a UML class model. Although OWL Full as a data modeling language appears intuitively similar in many ways to these other modeling approaches, there is an important fundamental distinction.

RDF and OWL Full are designed for systems in which data may be widely distributed (e.g., the Web). As such a system becomes larger, it becomes both impractical and virtually impossible to know where all of the data in the system are located. Therefore, one cannot generally assume that data obtained from such a system are complete. If some data appear to be missing, one has to assume, in general, that the data _might_ exist somewhere else in the system. This assumption, roughly speaking, is known as the **open world assumption** \[[OWL-GUIDE](#ref-OWL-GUIDE)\].

This means in practice that, for a data model defined as an OWL Full ontology, some definitions can have a counter-intuitive meaning. No conclusions can be drawn from missing data, and removing something will never make the remaining data inconsistent. This is illustrated, for example, by the definition of `skos:semanticRelation` in [Section 8](#semantic-relations) below. The property `skos:semanticRelation` is defined to have domain and range `skos:Concept`. These domain and range definitions give license to **inferences**. Consider the graph below.

<A> skos:semanticRelation <B>.

In this case, the graph above entails the following graph.

<A> rdf:type skos:Concept .
<B> rdf:type skos:Concept .

Thus, we do not need to _explicitly_ state here that `<A>` and `<B>` are instances of `skos:Concept`, because such statements are entailed by the definition of `skos:semanticRelation`.

In the SKOS data model, most statements of definition are **not** integrity conditions, but are statements of logical dependency between different elements of the data model, which (under the open world assumption) give license to a number of simple inferences. This is illustrated, for example, by the statement in [Section 7](#semantic-relations) below that `skos:broader` and `skos:narrower` are inverse properties. This statement means that

<A> skos:narrower <B> .

entails

<B> skos:broader <A> .

Both of these two graphs are, by themselves, consistent with the SKOS data model.

Knowledge organization systems such as thesauri and classification schemes are applied in a wide range of situations, and an individual knowledge organization system can be used in many different information systems. By defining the SKOS data model as an OWL Full ontology, the Semantic Web can then be used as a medium for publishing, exchanging, sharing and linking data involving these knowledge organization systems. For this reason, for the expressiveness of OWL Full as a data modeling language, and for the possibility of using thesauri, classification schemes, etc., side-by-side with formal ontologies, OWL Full has been used to define the SKOS data model. The open world assumption is therefore a fundamental premise of the SKOS data model, and should be borne in mind when reading this document.

See also \[[RDF-PRIMER](#ref-RDF-PRIMER)\] and \[[OWL-GUIDE](#ref-OWL-GUIDE)\].

### 1.6. Design Rationale

As discussed above, the notion of a Knowledge Organization System encompasses a wide range of artifacts. There is thus a danger of overcommitment in the SKOS schema, which could preclude the use of SKOS in some applications. In order to alleviate this, in situations where there is doubt about the inclusion of a formal constraint (for example, see the discussion about `skos:hasTopConcept`), the constraint has not been stated formally. In some cases, although no formal constraint is stated, usage conventions are recommended. Applications that require more constrained behaviour may define extensions to the SKOS vocabulary. See also the \[[SKOS-PRIMER](#ref-SKOS-PRIMER)\].

### 1.7. How to Read this Document

This document formally defines the Simple Knowledge Organization System data model as an OWL Full ontology. The elements of the SKOS data model are OWL classes and properties, and a Uniform Resource Identifier (URI) is provided for each of these classes and properties so that they may be used unambiguously in the Web. This set of URIs is the SKOS vocabulary.

The complete SKOS vocabulary is given in section 2 below. Sections 3 to 10 then formally define the SKOS data model. The definition of the data model is broken down into a number of sections purely for convenience. Each of these sections 3 to 10 follows a common layout:

-   **Preamble** — the main ideas covered in the section are introduced informally.
-   **Vocabulary** — URIs from the SKOS vocabulary which are defined in the section are given.
-   **Class & Property Definitions** — the logical characteristics and interdependencies between the classes and properties denoted by those URIs are formally defined.
-   **Integrity Conditions** — if there are any integrity conditions, those are given.
-   **Examples** — some canonical examples are given, both of data which **are** consistent with the SKOS data model, and (where appropriate) of data which are **not** consistent with the SKOS data model.
-   **Notes** — any further notes and discussion are presented.

#### 1.7.1. Formal Definitions

Most of the class and property definitions and integrity conditions stated in this document could be stated as RDF triples, using the RDF, RDFS and OWL vocabularies. However, a small number cannot, either because of limitations in the expressiveness of OWL Full or lack of a standard URI for some class. To improve the overall readability of this document, rather than mix RDF triples and other notations, the formal definitions and integrity conditions are stated throughout using prose.

The style of this prose generally follows the style used in \[[RDFS](#ref-RDFS)\], and should be clear to a reader with a working knowledge of RDF and OWL.

So, for example, "`ex:Person` is an instance of `owl:Class`" means

ex:Person rdf:type owl:Class .

"`ex:hasParent` and `ex:hasMother` are each instances of `owl:ObjectProperty`" means:

ex:hasParent rdf:type owl:ObjectProperty .
ex:hasMother rdf:type owl:ObjectProperty .

"`ex:hasMother` is a sub-property of `ex:hasParent`" means

ex:hasMother rdfs:subPropertyOf ex:hasParent .

"the `rdfs:range` of `ex:hasParent` is the class `ex:Person`" means:

ex:hasParent rdfs:range ex:Person .

Where some formal aspects of the SKOS data model cannot be stated as RDF triples using either RDF, RDFS or OWL vocabularies, it should be clear to a reader with a basic understanding of the RDF and OWL semantics how these statements might be translated into formal conditions on the interpretation of an RDF vocabulary (e.g., from [Section 5](#labels), "A resource has no more than one value of `skos:prefLabel` per language tag" means for any resource x, no two members of the set { y | <x,y> is in IEXT(I(`skos:prefLabel`)) } share the same language tag, where I and IEXT are functions as defined in \[[RDF-SEMANTICS](#ref-RDF-SEMANTICS)\]).

#### 1.7.2. URI Abbreviations

Full URIs are cited in the text of this document in monospace font, enclosed by angle brackets, e.g., `<http://example.org/ns/example>`. Relative URIs are cited in the same way, and are relative to the base URI `<http://example.org/ns/>`, e.g., `<example>` and `<http://example.org/ns/example>` are the same URI.

URIs are also cited in the text of this document in an abbreviated form. Abbreviated URIs are cited in monospace font without angle brackets, and should be expanded using the table of abbreviations below.

<table border="0" class="vocab"><caption>Table 1. URI Abbreviations</caption><tbody><tr><th>URI</th><th>Abbreviation</th></tr><tr><td><strong>http://www.w3.org/2004/02/skos/core#</strong></td><td><strong>skos:</strong></td></tr><tr><td>http://www.w3.org/1999/02/22-rdf-syntax-ns#</td><td>rdf:</td></tr><tr><td>http://www.w3.org/2000/01/rdf-schema#</td><td>rdfs:</td></tr><tr><td>http://www.w3.org/2002/07/owl#</td><td>owl:</td></tr></tbody></table>

So, for example, `skos:Concept` is an abbreviation of `<http://www.w3.org/2004/02/skos/core#Concept>`.

#### 1.7.3. Examples

Examples of RDF graphs are given using the Terse RDF Triple language (Turtle) \[[TURTLE](#ref-TURTLE)\]. All examples assume that they are preceded by the following prefix and URI base directives:

@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .  
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .  
@base <http://example.org/ns/> .  

Therefore, the example given below

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-1">Example 1</th></tr><tr><td><div>&lt;MyConcept&gt; rdf:type skos:Concept .</div></td></tr></tbody></table>

is equivalent to the following Turtle document

@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .  
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .  
@base <http://example.org/ns/> .
    
<MyConcept> rdf:type skos:Concept .

which is equivalent to the following RDF/XML document \[[RDF-XML](#ref-RDF-XML)\]

<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF   
    xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"   
    xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"   
    xmlns:skos="http://www.w3.org/2004/02/skos/core#"  
    xmlns:owl="http://www.w3.org/2002/07/owl#"  
    xml:base="http://example.org/ns/">
    
    <skos:Concept rdf:about="MyConcept"/>
    
</rdf:RDF>

which is equivalent to the following N-TRIPLES document \[[NTRIPLES](#ref-NTRIPLES)\]

<http://example.org/ns/MyConcept> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2004/02/skos/core#Concept> .

Note the use in Turtle of the ";" and "," characters to abbreviate multiple triples with the same subject or predicate. Some examples also make use of the Turtle syntax "(...)", representing an RDF Collection.

### 1.8. Conformance

This specification does not define a formal notion of conformance.

However, an RDF graph will be **inconsistent** with the SKOS data model if that graph and the SKOS data model (as defined formally below) taken together lead to a logical contradiction.

Where URIs are used to identify resources of type `skos:Concept`, `skos:ConceptScheme`, `skos:Collection` or `skosxl:Label`, this specification **does not** require specific behavior when dereferencing those URIs via the Web \[[WEBARCH](#ref-WEBARCH)\]. It is, however, strongly recommended that publishers of SKOS data follow the guidelines given in \[[COOLURIS](#ref-COOLURIS)\] and \[[RECIPES](#ref-RECIPES)\].

---

## 2\. SKOS Namespace and Vocabulary

The SKOS namespace URI is:

-   **http://www.w3.org/2004/02/skos/core#**

The SKOS vocabulary is a set of URIs, given in the left-hand column in the table below.

<table border="0" class="vocab"><caption>Table 1. SKOS Vocabulary</caption><tbody><tr><th>URI</th><th>Definition</th></tr><tr><td>skos:Concept</td><td><a href="#concepts">Section 3. The skos:Concept Class</a></td></tr><tr><td>skos:ConceptScheme</td><td><a href="#schemes">Section 4. Concept Schemes</a></td></tr><tr><td>skos:inScheme</td><td><a href="#schemes">Section 4. Concept Schemes</a></td></tr><tr><td>skos:hasTopConcept</td><td><a href="#schemes">Section 4. Concept Schemes</a></td></tr><tr><td>skos:topConceptOf</td><td><a href="#schemes">Section 4. Concept Schemes</a></td></tr><tr><td>skos:altLabel</td><td><a href="#labels">Section 5. Lexical Labels</a></td></tr><tr><td>skos:hiddenLabel</td><td><a href="#labels">Section 5. Lexical Labels</a></td></tr><tr><td>skos:prefLabel</td><td><a href="#labels">Section 5. Lexical Labels</a></td></tr><tr><td>skos:notation</td><td><a href="#notations">Section 6. Notations</a></td></tr><tr><td>skos:changeNote</td><td><a href="#notes">Section 7. Documentation Properties</a></td></tr><tr><td>skos:definition</td><td><a href="#notes">Section 7. Documentation Properties</a></td></tr><tr><td>skos:editorialNote</td><td><a href="#notes">Section 7. Documentation Properties</a></td></tr><tr><td>skos:example</td><td><a href="#notes">Section 7. Documentation Properties</a></td></tr><tr><td>skos:historyNote</td><td><a href="#notes">Section 7. Documentation Properties</a></td></tr><tr><td>skos:note</td><td><a href="#notes">Section 7. Documentation Properties</a></td></tr><tr><td>skos:scopeNote</td><td><a href="#notes">Section 7. Documentation Properties</a></td></tr><tr><td>skos:broader</td><td><a href="#semantic-relations">Section 8. Semantic Relations</a></td></tr><tr><td>skos:broaderTransitive</td><td><a href="#semantic-relations">Section 8. Semantic Relations</a></td></tr><tr><td>skos:narrower</td><td><a href="#semantic-relations">Section 8. Semantic Relations</a></td></tr><tr><td>skos:narrowerTransitive</td><td><a href="#semantic-relations">Section 8. Semantic Relations</a></td></tr><tr><td>skos:related</td><td><a href="#semantic-relations">Section 8. Semantic Relations</a></td></tr><tr><td>skos:semanticRelation</td><td><a href="#semantic-relations">Section 8. Semantic Relations</a></td></tr><tr><td>skos:Collection</td><td><a href="#collections">Section 9. Concept Collections</a></td></tr><tr><td>skos:OrderedCollection</td><td><a href="#collections">Section 9. Concept Collections</a></td></tr><tr><td>skos:member</td><td><a href="#collections">Section 9. Concept Collections</a></td></tr><tr><td>skos:memberList</td><td><a href="#collections">Section 9. Concept Collections</a></td></tr><tr><td>skos:broadMatch</td><td><a href="#mapping">Section 10. Mapping Properties</a></td></tr><tr><td>skos:closeMatch</td><td><a href="#mapping">Section 10. Mapping Properties</a></td></tr><tr><td>skos:exactMatch</td><td><a href="#mapping">Section 10. Mapping Properties</a></td></tr><tr><td>skos:mappingRelation</td><td><a href="#mapping">Section 10. Mapping Properties</a></td></tr><tr><td>skos:narrowMatch</td><td><a href="#mapping">Section 10. Mapping Properties</a></td></tr><tr><td>skos:relatedMatch</td><td><a href="#mapping">Section 10. Mapping Properties</a></td></tr></tbody></table>

All URIs in the SKOS vocabulary are constructed by appending a local name (e.g., "prefLabel") to the SKOS namespace URI.

See also the SKOS overview in [Appendix B](#overview) and the quick access panel.

---

## 3\. The skos:Concept Class

### 3.1. Preamble

The class `skos:Concept` is the class of SKOS concepts.

A SKOS concept can be viewed as an idea or notion; a unit of thought. However, what constitutes a unit of thought is subjective, and this definition is meant to be suggestive, rather than restrictive.

The notion of a SKOS concept is useful when describing the conceptual or intellectual structure of a knowledge organization system, and when referring to specific ideas or meanings established within a KOS.

Note that, because SKOS is designed to be a vehicle for representing semi-formal KOS, such as thesauri and classification schemes, a certain amount of flexibility has been built in to the formal definition of this class.

See the \[[SKOS-PRIMER](#ref-SKOS-PRIMER)\] for more examples of identifying and describing SKOS concepts.

### 3.2. Vocabulary

<table border="0" class="vocab"><caption></caption><tbody><tr><td><code>skos:Concept</code></td></tr></tbody></table>

### 3.3. Class & Property Definitions

<table border="0" class="semantics"><caption></caption><tbody><tr><td id="S1">S1</td><td><code>skos:Concept</code> is an instance of <code>owl:Class</code>.</td></tr></tbody></table>

### 3.4. Examples

The graph below states that `<MyConcept>` is a SKOS concept (i.e., an instance of `skos:Concept`).

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-2">Example 2 (consistent)</th></tr><tr><td><div>&lt;MyConcept&gt; rdf:type skos:Concept .</div></td></tr></tbody></table>

### 3.5. Notes

#### 3.5.1. SKOS Concepts, OWL Classes and OWL Properties

Other than the assertion that `skos:Concept` is an instance of `owl:Class`, this specification does **not** make any additional statement about the formal relationship between the class of SKOS concepts and the class of OWL classes. The decision **not** to make any such statement has been made to allow applications the freedom to explore different design patterns for working with SKOS in combination with OWL.

In the example graph below, `<MyConcept>` is an instance of `skos:Concept` **and** an instance of `owl:Class`.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-3">Example 3 (consistent)</th></tr><tr><td><div>&lt;MyConcept&gt; rdf:type skos:Concept , owl:Class .</div></td></tr></tbody></table>

This example is **consistent** with the SKOS data model.

Similarly, this specification does **not** make any statement about the formal relationship between the class of SKOS concepts and the class of OWL properties.

In the example graph below, `<MyConcept>` is an instance of `skos:Concept` **and** an instance of `owl:ObjectProperty`.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-4">Example 4 (consistent)</th></tr><tr><td><div>&lt;MyConcept&gt; rdf:type skos:Concept , owl:ObjectProperty .</div></td></tr></tbody></table>

This example is **consistent** with the SKOS data model.

---

## 4\. Concept Schemes

### 4.1. Preamble

A SKOS concept scheme can be viewed as an aggregation of one or more SKOS concepts. Semantic relationships (links) between those concepts may also be viewed as part of a concept scheme. This definition is, however, meant to be suggestive rather than restrictive, and there is some flexibility in the formal data model stated below.

The notion of a concept scheme is useful when dealing with data from an unknown source, and when dealing with data that describes two or more different knowledge organization systems.

See the \[[SKOS-PRIMER](#ref-SKOS-PRIMER)\] for more examples of identifying and describing concept schemes.

### 4.2. Vocabulary

<table border="0" class="vocab"><caption></caption><tbody><tr><td><code>skos:ConceptScheme</code></td></tr><tr><td><code>skos:inScheme</code></td></tr><tr><td><code>skos:hasTopConcept</code></td></tr><tr><td><code>skos:topConceptOf</code></td></tr></tbody></table>

### 4.3. Class & Property Definitions

<table border="0" class="semantics"><caption></caption><tbody><tr><td id="S2">S2</td><td><code>skos:ConceptScheme</code> is an instance of <code>owl:Class</code>.</td></tr><tr><td id="S3">S3</td><td><code>skos:inScheme</code>, <code>skos:hasTopConcept</code> and <code>skos:topConceptOf</code> are each instances of <code>owl:ObjectProperty</code>.</td></tr><tr><td id="S4">S4</td><td>The <code>rdfs:range</code> of <code>skos:inScheme</code> is the class <code>skos:ConceptScheme</code>.</td></tr><tr><td id="S5">S5</td><td>The <code>rdfs:domain</code> of <code>skos:hasTopConcept</code> is the class <code>skos:ConceptScheme</code>.</td></tr><tr><td id="S6">S6</td><td>The <code>rdfs:range</code> of <code>skos:hasTopConcept</code> is the class <code>skos:Concept</code>.</td></tr><tr><td id="S7">S7</td><td><code>skos:topConceptOf</code> is a sub-property of <code>skos:inScheme</code>.</td></tr><tr><td id="S8">S8</td><td><code>skos:topConceptOf</code> is <code>owl:inverseOf</code> the property <code>skos:hasTopConcept</code>.</td></tr></tbody></table>

### 4.4. Integrity Conditions

<table border="0" class="semantics"><caption></caption><tbody><tr><td id="S9">S9</td><td><code>skos:ConceptScheme</code> is disjoint with <code>skos:Concept</code>.</td></tr></tbody></table>

### 4.5. Examples

The graph below describes a concept scheme with two SKOS concepts, one of which is a top-level concept in that scheme.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-5">Example 5 (consistent)</th></tr><tr><td><div>&lt;MyScheme&gt; rdf:type skos:ConceptScheme ;<br>&nbsp;&nbsp;skos:hasTopConcept &lt;MyConcept&gt; .<br><br>&lt;MyConcept&gt; skos:topConceptOf &lt;MyScheme&gt; .<br><br>&lt;AnotherConcept&gt; skos:inScheme &lt;MyScheme&gt; .</div></td></tr></tbody></table>

### 4.6. Notes

#### 4.6.1. Closed vs. Open Systems

The notion of an individual SKOS concept scheme corresponds **roughly** to the notion of an individual thesaurus, classification scheme, subject heading system or other knowledge organization system.

However, in most current information systems, a thesaurus or classification scheme is treated as a **closed system** — conceptual units defined within that system cannot take part in other systems (although they can be _mapped_ to units in other systems).

Although SKOS does take a similar approach, there are **no** conditions preventing a SKOS concept from taking part in zero, one, or more than one concept scheme.

So, for example, in the graph below the SKOS concept `<MyConcept>` takes part in two different concept schemes — this is **consistent** with the SKOS data model.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-6">Example 6 (consistent)</th></tr><tr><td><div>&lt;MyScheme&gt; rdf:type skos:ConceptScheme .<br><br>&lt;AnotherScheme&gt; rdf:type skos:ConceptScheme ;<br>&nbsp;&nbsp;owl:differentFrom &lt;MyScheme&gt; .<br><br>&lt;MyConcept&gt; skos:inScheme &lt;MyScheme&gt; , &lt;AnotherScheme&gt; .</div></td></tr></tbody></table>

This flexibility is desirable because it allows, for example, new concept schemes to be described by linking two or more existing concept schemes together.

Also, note that there is no way to close the boundary of a concept scheme. So, while it is possible using `skos:inScheme` to say that SKOS concepts X, Y and Z take part in concept scheme A, there is no way to say that **only** X, Y and Z take part in A.

Therefore, while SKOS can be used to **describe** a concept scheme, SKOS does not provide any mechanism to completely **define** a concept scheme.

#### 4.6.2. SKOS Concept Schemes and OWL Ontologies

This specification does **not** make any statement about the formal relationship between the class of SKOS concept schemes and the class of OWL ontologies. The decision **not** to make any such statement has been made to allow different design patterns to be explored for using SKOS in combination with OWL \[[OWL-GUIDE](#ref-OWL-GUIDE)\].

In the example graph below, `<MyScheme>` is both a SKOS concept scheme and an OWL ontology. This is **consistent** with the SKOS data model.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-7">Example 7 (consistent)</th></tr><tr><td><div>&lt;MyScheme&gt; rdf:type skos:ConceptScheme , owl:Ontology .<br><br>&lt;MyConcept&gt; skos:inScheme &lt;MyScheme&gt; .</div></td></tr></tbody></table>

#### 4.6.3. Top Concepts and Semantic Relations

The property `skos:hasTopConcept` is, by convention, used to link a concept scheme to the SKOS concept(s) which are topmost in the hierarchical relations for that scheme. However, there are no integrity conditions enforcing this convention. Therefore, the graph below, whilst not strictly adhering to the usage convention for `skos:hasTopConcept`, is nevertheless **consistent** with the SKOS data model.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-8">Example 8 (consistent)</th></tr><tr><td><div>&lt;MyScheme&gt; skos:hasTopConcept &lt;MyConcept&gt; .<br>&lt;MyConcept&gt; skos:broader &lt;AnotherConcept&gt; .<br>&lt;AnotherConcept&gt; skos:inScheme &lt;MyScheme&gt; .</div></td></tr></tbody></table>

An application may reject such data but is not required to.

#### 4.6.4. Scheme Containment and Semantic Relations

A link between two SKOS concepts **does not** entail containment within the same concept scheme. This is illustrated in the example below.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-9">Example 9 (non-entailment)</th></tr><tr><td><div>&lt;A&gt; skos:narrower &lt;B&gt; .<br>&lt;A&gt; skos:inScheme &lt;MyScheme&gt; .</div><p><em>does not entail</em></p><div>&lt;B&gt; skos:inScheme &lt;MyScheme&gt; .</div></td></tr></tbody></table>

See also [Section 8](#semantic-relations) below.

#### 4.6.5. Domain of skos:inScheme

Note that **no domain is stated** for the property `skos:inScheme`, i.e., the domain is effectively the class of all resources (`rdfs:Resource`). The decision not to state any domain has been made to provide some flexibility, enabling extensions to SKOS to define new classes of resource but still use `skos:inScheme` to link them to a `skos:ConceptScheme`. See also [example 82](#example-82) below.

---

## 5\. Lexical Labels

### 5.1. Preamble

A lexical label is a string of UNICODE characters, such as "romantic love" or "れんあい", in a given natural language, such as English or Japanese (written here in hiragana).

The Simple Knowledge Organization System provides some basic vocabulary for associating lexical labels with resources of any type. In particular, SKOS enables a distinction to be made between the preferred, alternative and "hidden" lexical labels for any given resource.

The preferred and alternative labels are useful when generating or creating human-readable representations of a knowledge organization system. These labels provide the strongest clues as to the meaning of a SKOS concept.

The hidden labels are useful when a user is interacting with a knowledge organization system via a text-based search function. The user may, for example, enter mis-spelled words when trying to find a relevant concept. If the mis-spelled query can be matched against a hidden label, the user will be able to find the relevant concept, but the hidden label won't otherwise be visible to the user (so further mistakes aren't encouraged).

Formally, a lexical label is an RDF plain literal \[[RDF-CONCEPTS](#ref-RDF-CONCEPTS)\]. An RDF plain literal is composed of a lexical form, which is a string of UNICODE characters, and an optional language tag, which is a string of characters conforming to the syntax defined by \[[BCP47](#ref-BCP47)\].

See the \[[SKOS-PRIMER](#ref-SKOS-PRIMER)\] for more examples of labeling SKOS concepts. Note especially that the examples below serve only to illustrate general features of the SKOS data model, and **do not** necessarily indicate best practice for the provision of labels with different language tags. The SKOS Reference aims to establish a data model that is applicable across a range of situations, which may then be refined and/or constrained by usage conventions for more specific situations. Application- and language-specific usage conventions with respect to labels and language tags are out of scope for the SKOS Reference.

### 5.2. Vocabulary

<table border="0" class="vocab"><caption></caption><tbody><tr><td><code>skos:prefLabel</code></td></tr><tr><td><code>skos:altLabel</code></td></tr><tr><td><code>skos:hiddenLabel</code></td></tr></tbody></table>

### 5.3. Class & Property Definitions

<table border="0" class="semantics"><caption></caption><tbody><tr><td id="S10">S10</td><td><code></code><code>skos:prefLabel</code>, <code>skos:altLabel</code> and <code>skos:hiddenLabel</code> are each instances of <code>owl:AnnotationProperty</code>.</td></tr><tr><td id="S11">S11</td><td><code></code><code>skos:prefLabel</code>, <code>skos:altLabel</code> and <code>skos:hiddenLabel</code> are each sub-properties of <code>rdfs:label</code>.</td></tr><tr><td id="S12">S12</td><td>The <code>rdfs:range</code> of each of <code>skos:prefLabel</code>, <code>skos:altLabel</code> and <code>skos:hiddenLabel</code> is the class of RDF plain literals.</td></tr></tbody></table>

### 5.4. Integrity Conditions

<table border="0" class="semantics"><caption></caption><tbody><tr><td id="S13">S13</td><td><code>skos:prefLabel</code>, <code>skos:altLabel</code> and <code>skos:hiddenLabel</code> are pairwise disjoint properties.</td></tr><tr><td id="S14">S14</td><td><code></code>A resource has no more than one value of <code>skos:prefLabel</code> per language tag.</td></tr></tbody></table>

### 5.5. Examples

The following graph is **consistent**, and illustrates the provision of lexical labels in two different languages (French and English).

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-10">Example 10 (consistent)</th></tr><tr><td><div>&lt;MyResource&gt;<br>&nbsp;&nbsp;skos:prefLabel "animals"@en ;<br>&nbsp;&nbsp;skos:altLabel "fauna"@en ;<br>&nbsp;&nbsp;skos:hiddenLabel "aminals"@en ;<br>&nbsp;&nbsp;skos:prefLabel "animaux"@fr ;<br>&nbsp;&nbsp;skos:altLabel "faune"@fr .</div></td></tr></tbody></table>

The following graph is **consistent** and illustrates the provision of lexical labels in four different variations (Japanese written with kanji, the hiragana script, the katakana script or with latin characters (rōmaji)).

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-11">Example 11 (consistent)</th></tr><tr><td><div>&lt;AnotherResource&gt;<br>&nbsp;&nbsp;skos:prefLabel "東"@ja-Hani ;<br>&nbsp;&nbsp;skos:prefLabel "ひがし"@ja-Hira ;<br>&nbsp;&nbsp;skos:altLabel "あずま"@ja-Hira ;<br>&nbsp;&nbsp;skos:prefLabel "ヒガシ"@ja-Kana ;<br>&nbsp;&nbsp;skos:altLabel "アズマ"@ja-Kana ;<br>&nbsp;&nbsp;skos:prefLabel "higashi"@ja-Latn ;<br>&nbsp;&nbsp;skos:altLabel "azuma"@ja-Latn .</div></td></tr></tbody></table>

The following graph is **not consistent** with the SKOS data model, because two different preferred lexical labels have been given with the same language tag.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-12">Example 12 (not consistent)</th></tr><tr><td><div>&lt;Love&gt; skos:prefLabel "love"@en ; skos:prefLabel "adoration"@en .</div></td></tr></tbody></table>

The following graph is **not consistent** with the SKOS data model, because there is a clash between the preferred and alternative lexical labels.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-13">Example 13 (not consistent)</th></tr><tr><td><div>&lt;Love&gt; skos:prefLabel "love"@en ; skos:altLabel "love"@en .</div></td></tr></tbody></table>

The following graph is **not consistent** with the SKOS data model, because there is a clash between alternative and hidden lexical labels.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-14">Example 14 (not consistent)</th></tr><tr><td><div>&lt;Love&gt; skos:altLabel "love"@en ; skos:hiddenLabel "love"@en .</div></td></tr></tbody></table>

The following graph is **not consistent** with the SKOS data model, because there is a clash between preferred and hidden lexical labels.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-15">Example 15 (not consistent)</th></tr><tr><td><div>&lt;Love&gt; skos:prefLabel "love"@en ; skos:hiddenLabel "love"@en .</div></td></tr></tbody></table>

### 5.6. Notes

#### 5.6.1. Domain of SKOS Lexical Labeling Properties

Note that **no domain is stated** for `skos:prefLabel`, `skos:altLabel` and `skos:hiddenLabel`. Thus, the effective domain of these properties is the class of all resources (`rdfs:Resource`).

Therefore, using the properties `skos:prefLabel`, `skos:altLabel` and `skos:hiddenLabel` to **label any type of resource** is **consistent** with the SKOS data model.

In the example graph below, `skos:prefLabel`, `skos:altLabel` and `skos:hiddenLabel` have been used to label a resource of type `owl:Class` — this is **consistent** with the SKOS data model.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-16">Example 16 (consistent)</th></tr><tr><td><div>&lt;MyClass&gt; rdf:type owl:Class ;<br>&nbsp;&nbsp;skos:prefLabel "animals"@en ;<br>&nbsp;&nbsp;skos:altLabel "fauna"@en ;<br>&nbsp;&nbsp;skos:hiddenLabel "aminals"@en ;<br>&nbsp;&nbsp;skos:prefLabel "animaux"@fr ;<br>&nbsp;&nbsp;skos:altLabel "faune"@fr .</div></td></tr></tbody></table>

#### 5.6.2. Range of SKOS Lexical Labeling Properties

Note that the range of `skos:prefLabel`, `skos:altLabel` and `skos:hiddenLabel` is the class of RDF plain literals \[[RDF-CONCEPTS](#ref-RDF-CONCEPTS)\].

By convention, RDF plain literals are always used in the object position of a triple, where the predicate is one of `skos:prefLabel`, `skos:altLabel` or `skos:hiddenLabel`. If a graph **does not** follow this usage convention an application may reject such data but is not required to. See also the note below.

#### 5.6.3. Defining Label Relations

Some applications require additional functionality relating to labels, for example allowing the description of those labels or the definition of additional relations between the labels (such as acronyms). This can be achieved through the identification of labels using URIs. The SKOS eXtension for Labels defined in [Appendix A](#xl) provides support for this.

#### 5.6.4. Alternates Without Preferred

In the graph below, a resource has two alternative lexical labels, but no preferred lexical label. This is **consistent** with the SKOS data model, and there are no additional entailments which follow from the data model. However, note that many applications will require a preferred lexical label in order to generate an optimum human-readable display.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-17">Example 17 (consistent)</th></tr><tr><td><div>&lt;Love&gt; skos:altLabel "adoration"@en , "desire"@en .</div></td></tr></tbody></table>

#### 5.6.5. Labeling and Language Tags

\[[BCP47](#ref-BCP47)\] defines tags for identifying languages. Note that "en", "en-GB", "en-US" are three different language tags, used with English, British English and US English respectively. Similarly "ja", "ja-Hani", "ja-Hira", "ja-Kana" and "ja-Latn" are five different language tags used with Japanese, Japanese written with kanji, the hiragana script, the katakana script or with latin characters (rōmaji) respectively.

The graph below is **consistent** with the SKOS data model, because "en", "en-US" and "en-GB" are different language tags.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-18">Example 18 (consistent)</th></tr><tr><td><div>&lt;Colour&gt; skos:prefLabel "color"@en , "color"@en-US , "colour"@en-GB .</div></td></tr></tbody></table>

In the graph below, there is no clash between the lexical labeling properties, again because "en" and "en-GB" are different language tags, and therefore the graph is **consistent** with the SKOS data model.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-19">Example 19 (consistent)</th></tr><tr><td><div>&lt;Love&gt; skos:prefLabel "love"@en ; skos:altLabel "love"@en-GB .</div></td></tr></tbody></table>

Note however that, as stated above in section 5.1, these examples serve only to illustrate general features of the SKOS data model, and **do not** necessarily indicate best practice for the provision of labels with different language tags. Application- and language-specific usage conventions with respect to labels and language tags are out of scope for the SKOS Reference.

It is suggested that applications match requests for labels in a given language to labels with related language tags that are provided by a SKOS concept scheme, e.g., by implementing the "lookup" algorithm defined by \[[BCP 47](#ref-BCP47)\]. Applications that perform matching in this way do not require labels to be provided in all possible language variations (of which there could be many), and are compatible with SKOS concept schemes that provide only those labels whose lexical forms are distinct for a given language or collection of languages.

---

## 6\. Notations

### 6.1. Preamble

A notation is a string of characters such as "T58.5" or "303.4833" used to uniquely identify a concept within the scope of a given concept scheme.

A notation is different from a lexical label in that a notation is not normally recognizable as a word or sequence of words in any natural language.

This section defines the `skos:notation` property. This property is used to assign a notation as a typed literal \[[RDF-CONCEPTS](#ref-RDF-CONCEPTS)\].

### 6.2. Vocabulary

<table border="0" class="vocab"><caption></caption><tbody><tr><td><code>skos:notation</code></td></tr></tbody></table>

### 6.3. Class & Property Definitions

<table border="0" class="semantics"><caption></caption><tbody><tr><td id="S15">S15</td><td><code></code><code>skos:notation</code> is an instance of <code>owl:DatatypeProperty</code>.</td></tr></tbody></table>

### 6.4. Examples

The example below illustrates a resource `<http://example.com/ns/MyConcept>` with a notation whose lexical form is the UNICODE string "303.4833" and whose datatype is denoted by the URI `<http://example.com/ns/MyNotationDatatype>`.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-20">Example 20 (consistent)</th></tr><tr><td><div>&lt;MyConcept&gt; skos:notation "303.4833"^^&lt;MyNotationDatatype&gt; .</div></td></tr></tbody></table>

### 6.5. Notes

#### 6.5.1. Notations, Typed Literals and Datatypes

A typed literal is a UNICODE string combined with a datatype URI \[[RDF-CONCEPTS](#ref-RDF-CONCEPTS)\].

Typed literals are commonly used to denote values such as integers, floating point numbers and dates, and there are a number of datatypes pre-defined by the XML Schema specification \[[XML-SCHEMA](#ref-XML-SCHEMA)\] such as `xs:integer`, `xs:float` and `xs:date`.

For other situations, new datatypes can be defined, and these are commonly called "user-defined datatypes" \[[SWBP-DATATYPES](#ref-SWBP-DATATYPES)\].

By convention, the property `skos:notation` is only used with a typed literal in the object position of the triple, where the datatype URI denotes a user-defined datatype corresponding to a particular system of notations or classification codes.

For many situations it may be sufficient to simply coin a datatype URI for a particular notation system, and define the datatype informally via a document that describes how the notations are constructed and/or which lexical forms are allowed. Note, however, that it is also possible to define at least the lexical space of a datatype more formally via the XML Schema language, see \[[SWBP-DATATYPES](#ref-SWBP-DATATYPES)\] section 2. Users should be aware that tools may vary in their support of datatypes. However, as discussed in \[[OWL-REFERENCE](#ref-OWL-REFERENCE)\] section 6.3, tools should at least treat lexically identical literals as equal.

#### 6.5.2. Multiple Notations

There are no constraints on the cardinality of the `skos:notation` property. A concept may have zero, 1 or more notations.

Where a concept has more than 1 notation, these may be from the same or different notation systems. In the case where notations are from different systems, different datatypes may be used to indicate this. It is not common practice to assign more than one notation from the same notation system (i.e., with the same datatype URI).

#### 6.5.3. Unique Notations in Concept Schemes

By convention, no two concepts in the same concept scheme are given the same notation. If they were, it would not be possible to use the notation to uniquely refer to a concept (i.e., the notation would become ambiguous).

#### 6.5.4. Notations and Preferred Labels

There are no constraints on the combined use of `skos:notation` and `skos:prefLabel`. In the example below, the same string is given both as the lexical form of a notation and as a the lexical form of a preferred label.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-21">Example 21 (consistent)</th></tr><tr><td><div>&lt;Potassium&gt;<br>&nbsp;&nbsp;skos:prefLabel "K"@en ;<br>&nbsp;&nbsp;skos:notation "K"^^&lt;ChemicalSymbolNotation&gt; .</div></td></tr></tbody></table>

Typed literals consist of a string of characters and a datatype URI. By convention, `skos:notation` is only used with **typed literals** in the object position of the triple.

Plain literals consist of a string of characters and a language tag. By convention, `skos:prefLabel` (and `skos:altLabel` and `skos:hiddenLabel`) are only used with **plain literals** in the object position of the triple.

There is no such thing as an RDF literal with both a language tag and a datatype URI, i.e., a typed literal does not have a language tag, and a plain literal does not have a datatype URI.

#### 6.5.5. Domain of skos:notation

Note that **no domain is stated** for `skos:notation`. Thus, the effective domain is the class of all resources (`rdfs:Resource`). Therefore, using `skos:notation` with any type of resource is consistent with the SKOS data model.

---

## 7\. Documentation Properties (Note Properties)

### 7.1. Preamble

Notes are used to provide information relating to SKOS concepts. There is no restriction on the nature of this information, e.g., it could be plain text, hypertext, or an image; it could be a definition, information about the scope of a concept, editorial information, or any other type of information.

There are seven properties in SKOS for associating notes with concepts, defined formally in this section. For more information on the recommended usage of each of the SKOS documentation properties, see the \[[SKOS-PRIMER](#ref-SKOS-PRIMER)\].

These seven properties are not intended to cover every situation, but rather to be useful in some of the most common situations, and to provide a set of extension points for defining more specific types of note. For more information on recommended best practice for extending SKOS, see the \[[SKOS-PRIMER](#ref-SKOS-PRIMER)\].

Three different usage patterns are recommended in the \[[SKOS-PRIMER](#ref-SKOS-PRIMER)\] for the SKOS documentation properties — "documentation as an RDF literal", "documentation as a related resource description" and "documentation as a document reference". The data model defined in this section is intended to accommodate all three design patterns.

### 7.2. Vocabulary

<table border="0" class="vocab"><caption></caption><tbody><tr><td><code>skos:note</code></td></tr><tr><td><code>skos:changeNote</code></td></tr><tr><td><code>skos:definition</code></td></tr><tr><td><code>skos:editorialNote</code></td></tr><tr><td><code>skos:example</code></td></tr><tr><td><code>skos:historyNote</code></td></tr><tr><td><code>skos:scopeNote</code></td></tr></tbody></table>

### 7.3. Class & Property Definitions

<table border="0" class="semantics"><caption></caption><tbody><tr><td id="S16">S16</td><td><code></code><code>skos:note</code>, <code>skos:changeNote</code>, <code>skos:definition</code>, <code>skos:editorialNote</code>, <code>skos:example</code>, <code>skos:historyNote</code> and <code>skos:scopeNote</code> are each instances of <code>owl:AnnotationProperty</code>.</td></tr><tr><td id="S17">S17</td><td><code>skos:changeNote</code>, <code>skos:definition</code>, <code>skos:editorialNote</code>, <code>skos:example</code>, <code>skos:historyNote</code> and <code>skos:scopeNote</code> are each sub-properties of <code>skos:note</code>.</td></tr></tbody></table>

### 7.4. Examples

The graph below gives an example of the "documentation as an RDF literal" pattern.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-22">Example 22 (consistent)</th></tr><tr><td><div>&lt;MyResource&gt; skos:note "this is a note"@en .</div></td></tr></tbody></table>

The graph below gives an example of the "documentation as a document reference" pattern.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-23">Example 23 (consistent)</th></tr><tr><td><div>&lt;MyResource&gt; skos:note &lt;MyNote&gt; .</div></td></tr></tbody></table>

### 7.5. Notes

#### 7.5.1. Domain of the SKOS Documentation Properties

Note that **no domain is stated** for the SKOS documentation properties. Thus, the effective domain for these properties is the class of all resources (`rdfs:Resource`). Therefore, using the SKOS documentation properties to provide information on **any type of resource** is consistent with the SKOS data model.

In the example graph below, `skos:definition` has been used to provide a plain text definition for a resource of type `owl:Class` — this is consistent with the SKOS data model.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-24">Example 24 (consistent)</th></tr><tr><td><div>&lt;Protein&gt; rdf:type owl:Class ;<br>&nbsp;&nbsp;skos:definition """A physical entity consisting of a sequence of amino-acids; a protein monomer; a single polypeptide chain. An example is the EGFR protein."""@en .</div></td></tr></tbody></table>

#### 7.5.2. Range of the SKOS Documentation Properties

Note that no range is stated for the SKOS documentation properties, and thus the range of these properties is effectively the class of all resources (`rdfs:Resource`). Under the RDF and OWL Full semantics, everything is a resource, including RDF plain literals.

---

## 8\. Semantic Relations

### 8.1. Preamble

SKOS semantic relations are links between SKOS concepts, where the link is inherent in the meaning of the linked concepts.

The Simple Knowledge Organization System distinguishes between two basic categories of semantic relation: **hierarchical** and **associative**. A hierarchical link between two concepts indicates that one is in some way more general ("broader") than the other ("narrower"). An associative link between two concepts indicates that the two are inherently "related", but that one is **not** in any way more general than the other.

The properties `skos:broader` and `skos:narrower` are used to assert a direct hierarchical link between two SKOS concepts. A triple `<A> skos:broader <B>` asserts that `<B>`, the object of the triple, is a broader concept than `<A>`, the subject of the triple. Similarly, a triple `<C> skos:narrower <D>` asserts that `<D>`, the object of the triple, is a narrower concept than `<C>`, the subject of the triple.

By convention, `skos:broader` and `skos:narrower` are **only** used to assert a **direct** (i.e., immediate) hierarchical link between two SKOS concepts. This provides applications with a convenient and reliable way to access the direct broader and narrower links for any given concept. Note that, to support this usage convention, the properties `skos:broader` and `skos:narrower` are **not** declared as transitive properties.

Some applications need to make use of **both direct and indirect** hierarchical links between concepts, for instance to improve search recall through query expansion. For this purpose, the properties `skos:broaderTransitive` and `skos:narrowerTransitive` are provided. A triple `<A>` `skos:broaderTransitive` `<B>` represents a direct or indirect hierarchical link, where `<B>` is a broader "ancestor" of `<A>`. Similarly a triple `<C> skos:narrowerTransitive <D>` represents a direct or indirect hierarchical link, where `<D>` is a narrower "descendant" of `<C>`.

By convention, the properties `skos:broaderTransitive` and `skos:narrowerTransitive` are **not** used to make assertions. Rather, these properties are used to infer the transitive closure of the hierarchical links, which can then be used to access direct or indirect hierarchical links between concepts.

The property `skos:related` is used to assert an associative link between two SKOS concepts.

For more examples of stating hierarchical and associative links, see the \[[SKOS-PRIMER](#ref-SKOS-PRIMER)\].

### 8.2. Vocabulary

<table border="0" class="vocab"><caption></caption><tbody><tr><td><code>skos:semanticRelation</code></td></tr><tr><td><code>skos:broader</code></td></tr><tr><td><code>skos:narrower</code></td></tr><tr><td><code>skos:related</code></td></tr><tr><td><code>skos:broaderTransitive</code></td></tr><tr><td><code>skos:narrowerTransitive</code></td></tr></tbody></table>

### 8.3. Class & Property Definitions

<table border="0" class="semantics"><caption></caption><tbody><tr><td id="S18">S18</td><td><code></code><code>skos:semanticRelation</code>, <code>skos:broader</code>, <code>skos:narrower</code>, <code>skos:related</code>, <code>skos:broaderTransitive</code> and <code>skos:narrowerTransitive</code> are each instances of <code>owl:ObjectProperty</code>.</td></tr><tr><td id="S19">S19</td><td>The <code>rdfs:domain</code> of <code>skos:semanticRelation</code> is the class <code>skos:Concept</code>.</td></tr><tr><td id="S20">S20</td><td>The <code>rdfs:range</code> of <code>skos:semanticRelation</code> is the class <code>skos:Concept</code>.</td></tr><tr><td id="S21">S21</td><td><code>skos:broaderTransitive</code>, <code>skos:narrowerTransitive</code> and <code>skos:related</code> are each sub-properties of <code>skos:semanticRelation</code>.</td></tr><tr><td id="S22">S22</td><td><code>skos:broader</code> is a sub-property of <code>skos:broaderTransitive</code>, and <code>skos:narrower</code> is a sub-property of <code>skos:narrowerTransitive</code>.</td></tr><tr><td id="S23">S23</td><td><code>skos:related</code> is an instance of <code>owl:SymmetricProperty</code>.</td></tr><tr><td id="S24">S24</td><td><code>skos:broaderTransitive</code> and <code>skos:narrowerTransitive</code> are each instances of <code>owl:TransitiveProperty</code>.</td></tr><tr><td id="S25">S25</td><td><code>skos:narrower</code> is <code>owl:inverseOf</code> the property <code>skos:broader</code>.</td></tr><tr><td id="S26">S26</td><td><code>skos:narrowerTransitive</code> is <code>owl:inverseOf</code> the property <code>skos:broaderTransitive</code>.</td></tr></tbody></table>

### 8.4. Integrity Conditions

<table border="0" class="semantics"><caption></caption><tbody><tr><td id="S27">S27</td><td><code>skos:related</code> is disjoint with the property <code>skos:broaderTransitive</code>.</td></tr></tbody></table>

Note that because `skos:related` is a symmetric property, and `skos:broaderTransitive` and `skos:narrowerTransitive` are inverses, `skos:related` is therefore also disjoint with `skos:narrowerTransitive`.

### 8.5. Examples

The graph below asserts a direct hierarchical link between `<A>` and `<B>` (where `<B>` is broader than `<A>`), and an associative link between `<A>` and `<C>`, and is **consistent** with the SKOS data model.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-25">Example 25 (consistent)</th></tr><tr><td><div>&lt;A&gt; skos:broader &lt;B&gt; ; skos:related &lt;C&gt; .</div></td></tr></tbody></table>

The graph below is **not consistent** with the SKOS data model, because there is a clash between associative links and hierarchical links.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-26">Example 26 (not consistent)</th></tr><tr><td><div>&lt;A&gt; skos:broader &lt;B&gt; ; skos:related &lt;B&gt; .</div></td></tr></tbody></table>

The graph below is **not consistent** with the SKOS data model, again because there is a clash between associative links and hierarchical links.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-27">Example 27 (not consistent)</th></tr><tr><td><div>&lt;A&gt; skos:broader &lt;B&gt; ; skos:related &lt;C&gt; .<br>&lt;B&gt; skos:broader &lt;C&gt; .</div></td></tr></tbody></table>

In the example above, the clash is not immediately obvious. The clash becomes apparent when inferences are drawn, based on the class and property definitions above, giving the following graph.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-28">Example 28 (not consistent)</th></tr><tr><td><div>&lt;A&gt; skos:broaderTransitive &lt;C&gt; ; skos:related &lt;C&gt; .<br></div></td></tr></tbody></table>

The graph below is **not consistent** with the SKOS data model, again because there is a clash between associative links and hierarchical links, which can be inferred from the class and property definitions given above.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-29">Example 29 (not consistent)</th></tr><tr><td><div>&lt;A&gt; skos:narrower &lt;B&gt; ; skos:related &lt;C&gt; .<br>&lt;B&gt; skos:narrower &lt;C&gt; .</div></td></tr></tbody></table>

### 8.6. Notes

#### 8.6.1. Sub-Property Relationships

The diagram below illustrates informally the sub-property relationships between the SKOS semantic relation properties.

skos:semanticRelation
 |
 +— skos:related
 |
 +— skos:broaderTransitive
 |    |
 |    +— skos:broader
 |
 +— skos:narrowerTransitive
      |
      +— skos:narrower

#### 8.6.2. Domain and Range of SKOS Semantic Relation Properties

Note that the domain and range of `skos:semanticRelation` is the class `skos:Concept`. Because `skos:broader`, `skos:narrower` and `skos:related` are each sub-properties of `skos:semanticRelation`, the graph in [example 26](#example-26) above entails that `<A>`, `<B>` and `<C>` are each instances of `skos:Concept`.

#### 8.6.3. Symmetry of skos:related

`skos:related` is a symmetric property. The example below illustrates an entailment which follows from this condition.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-30">Example 30 (entailment)</th></tr><tr><td><div>&lt;A&gt; skos:related &lt;B&gt; .</div><p><em>entails</em></p><div>&lt;B&gt; skos:related &lt;A&gt; .</div></td></tr></tbody></table>

Note that, although `skos:related` is a symmetric property, this condition does **not** place any restrictions on sub-properties of `skos:related` (i.e., sub-properties of `skos:related` could be symmetric, not symmetric or antisymmetric, and still be consistent with the SKOS data model).

To illustrate this point, in the example below, two new properties which are **not** symmetric are declared as sub-properties of `skos:related`. The example, which is **consistent** with the SKOS data model, also shows some of the entailments which follow.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-31">Example 31 (entailment)</th></tr><tr><td><div>&lt;cause&gt; rdf:type owl:ObjectProperty ;<br>&nbsp;&nbsp;rdfs:subPropertyOf skos:related .<br><br>&lt;effect&gt; rdf:type owl:ObjectProperty ;<br>&nbsp;rdfs:subPropertyOf skos:related ;<br>&nbsp;&nbsp;owl:inverseOf &lt;cause&gt; .<br><br>&lt;A&gt; &lt;cause&gt; &lt;B&gt; .</div><p><em>entails</em></p><div>&lt;A&gt; skos:related &lt;B&gt; .<br><br>&lt;B&gt; &lt;effect&gt; &lt;A&gt; ; skos:related &lt;A&gt; .</div></td></tr></tbody></table>

See also the \[[SKOS-PRIMER](#ref-SKOS-PRIMER)\] for best practice recommendations on extending SKOS.

#### 8.6.4. skos:related and Transitivity

Note that `skos:related` is **not** a transitive property. Therefore, the SKOS data model does **not** support an entailment as illustrated in the example below.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-32">Example 32 (non-entailment)</th></tr><tr><td><div>&lt;A&gt; skos:related &lt;B&gt; .<br>&lt;B&gt; skos:related &lt;C&gt; .</div><p><em>does not entail</em></p><div>&lt;A&gt; skos:related &lt;C&gt; .</div></td></tr></tbody></table>

#### 8.6.5. skos:related and Reflexivity

Note that this specification does not state that `skos:related` is a reflexive property, **neither** does it state that `skos:related` is an irreflexive property.

Because `skos:related` is **not** defined as an irreflexive property, the graph below is **consistent** with the SKOS data model.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-33">Example 33 (consistent)</th></tr><tr><td><div>&lt;A&gt; skos:related &lt;A&gt; .</div></td></tr></tbody></table>

However, for many applications that use knowledge organization systems, statements of the form X `skos:related` X are a potential problem. Where this is the case, an application may wish to search for such statements prior to processing SKOS data, although how an application should handle such statements is not defined in this specification and may vary between applications.

#### 8.6.6. skos:broader and Transitivity

Note that `skos:broader` is **not** a transitive property. Similarly, `skos:narrower` is **not** a transitive property. Therefore, the SKOS data model does **not** support an entailment as illustrated in the example below.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-34">Example 34 (non-entailment)</th></tr><tr><td><div>&lt;A&gt; skos:broader &lt;B&gt; .<br>&lt;B&gt; skos:broader &lt;C&gt; .</div><p><em>does not entail</em></p><div>&lt;A&gt; skos:broader &lt;C&gt; .</div></td></tr></tbody></table>

However, `skos:broader` is a sub-property of `skos:broaderTransitive`, which **is** a transitive property. Similarly, `skos:narrower` is a sub-property of `skos:narrowerTransitive`, which **is** a transitive property. Therefore the SKOS data model **does** support the entailments illustrated below.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-35">Example 35 (entailment)</th></tr><tr><td><div>&lt;A&gt; skos:broader &lt;B&gt; .<br>&lt;B&gt; skos:broader &lt;C&gt; .</div><p><em>entails</em></p><div>&lt;A&gt; skos:broaderTransitive &lt;B&gt; .<br>&lt;B&gt; skos:broaderTransitive &lt;C&gt; .<br>&lt;A&gt; skos:broaderTransitive &lt;C&gt; .</div></td></tr></tbody></table>

Note especially that, by convention, `skos:broader` and `skos:narrower` are **only** used to assert immediate (i.e., direct) hierarchical links between two SKOS concepts. By convention, `skos:broaderTransitive` and `skos:narrowerTransitive` are **not** used to make assertions, but are instead used only to draw inferences.

This pattern allows the information about direct (i.e., immediate) hierarchical links to be preserved, which is necessary for many tasks (e.g., building various types of visual representation of a knowledge organization system), whilst also providing a mechanism for conveniently querying the transitive closure of those hierarchical links (which will include both direct and indirect links), which is useful in other situations (e.g., query expansion algorithms).

Note also that a sub-property of a transitive property is **not** necessarily transitive.

See also the note on alternative paths below.

#### 8.6.7. skos:broader and Reflexivity

Note that this specification makes no statements regarding the reflexive characteristics of the `skos:broader` relationship. It does not state that `skos:broader` is a reflexive property, **neither** does it state that `skos:broader` is an irreflexive property. Thus for any graph and resource `<A>`, the triple:

<table class="example-good" border="0"><caption></caption><tbody><tr><th id="example-36">Example 36 (consistent)</th></tr><tr><td><div>&lt;A&gt; skos:broader &lt;A&gt; .</div></td></tr></tbody></table>

may or may not be present. This conservative position allows SKOS to be used to model both KOS where the interpretation of `skos:broader` is reflexive (e.g., a direct translation of an inferred OWL sub-class hierarchy), or KOS where `skos:broader` could be considered irreflexive (as would be appropriate for most thesauri or classification schemes).

Similarly, there are no assertions made as to the reflexivity or irreflexivity of `skos:narrower`.

However, for many applications that use knowledge organization systems, statements of the form X `skos:broader` X or Y `skos:narrower` Y represent a potential problem. Where this is the case, an application may wish to search for such statements prior to processing SKOS data, although how an application should handle such statements is not defined in this specification and may vary between applications.

#### 8.6.8. Cycles in the Hierarchical Relation (skos:broaderTransitive and Reflexivity)

In the graph below, a cycle has been stated in the hierarchical relation. Note that this graph is **consistent** with the SKOS data model, i.e., there is **no** condition requiring that `skos:broaderTransitive` be irreflexive.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-37">Example 37 (consistent)</th></tr><tr><td><div>&lt;A&gt; skos:broader &lt;B&gt; .<br>&lt;B&gt; skos:broader &lt;A&gt; .</div></td></tr></tbody></table>

However, for many applications where knowledge organization systems are used, a cycle in the hierarchical relation represents a potential problem. For these applications, computing the transitive closure of `skos:broaderTransitive` then looking for statements of the form X `skos:broaderTransitive` X is a convenient strategy for finding cycles in the hierarchical relation. How an application should handle such statements is not defined in this specification and may vary between applications.

#### 8.6.9. Alternate Paths in the Hierarchical Relation

In the graph below, there are two alternative paths from A to C in the hierarchical relation.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-38">Example 38 (consistent)</th></tr><tr><td><div>&lt;A&gt; skos:broader &lt;B&gt; , &lt;C&gt; .<br>&lt;B&gt; skos:broader &lt;C&gt; .</div></td></tr></tbody></table>

In the graph below, there are two alternative paths from A to D in the hierarchical relation.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-39">Example 39 (consistent)</th></tr><tr><td><div>&lt;A&gt; skos:broader &lt;B&gt; , &lt;C&gt; .<br>&lt;B&gt; skos:broader &lt;D&gt; .<br>&lt;C&gt; skos:broader &lt;D&gt; .</div></td></tr></tbody></table>

This is a pattern which arises naturally in poly-hierarchical knowledge organization systems.

Both of these graphs are **consistent** with the SKOS data model, i.e., there is **no** condition requiring that there be only one path between any two nodes in the hierarchical relation.

#### 8.6.10. Disjointness of skos:related and skos:broaderTransitive

This specification treats the hierarchical and associative relations as fundamentally distinct in nature. Therefore a clash between hierarchical and associative links is **not** consistent with the SKOS data model. The examples above illustrate some situations in which a clash is seen to arise.

This position follows the usual definitions given to hierarchical and associative relations in thesaurus standards \[[ISO2788](#ref-ISO2788)\] \[[BS8723-2](#ref-BS8723-2)\], and supports common practice in many existing knowledge organization systems.

Note that this specification takes the stronger position that, not only are the immediate (i.e., direct) hierarchical and associative links disjoint, but associative links are also disjoint with _indirect_ hierarchical links. This is captured formally in the integrity condition asserting that `skos:related` and `skos:broaderTransitive` are disjoint properties.

---

## 9\. Concept Collections

### 9.1. Preamble

SKOS concept collections are labeled and/or ordered groups of SKOS concepts.

Collections are useful where a group of concepts shares something in common, and it is convenient to group them under a common label, or where some concepts can be placed in a meaningful order.

### 9.2. Vocabulary

<table border="0" class="vocab"><caption></caption><tbody><tr><td><code>skos:Collection</code></td></tr><tr><td><code>skos:OrderedCollection</code></td></tr><tr><td><code>skos:member</code></td></tr><tr><td><code>skos:memberList</code></td></tr></tbody></table>

### 9.3. Class & Property Definitions

<table border="0" class="semantics"><caption></caption><tbody><tr><td id="S28">S28</td><td><code>skos:Collection</code> and <code>skos:OrderedCollection</code> are each instances of <code>owl:Class</code>.</td></tr><tr><td id="S29">S29</td><td><code>skos:OrderedCollection</code> is a sub-class of <code>skos:Collection</code>.</td></tr><tr><td id="S30">S30</td><td><code>skos:member</code> and <code>skos:memberList</code> are each instances of <code>owl:ObjectProperty</code>.</td></tr><tr><td id="S31">S31</td><td>The <code>rdfs:domain</code> of <code>skos:member</code> is the class <code>skos:Collection</code>.</td></tr><tr><td id="S32">S32</td><td>The <code>rdfs:range</code> of <code>skos:member</code> is the union of classes <code>skos:Concept</code> and <code>skos:Collection</code>.</td></tr><tr><td id="S33">S33</td><td>The <code>rdfs:domain</code> of <code>skos:memberList</code> is the class <code>skos:OrderedCollection</code>.</td></tr><tr><td id="S34">S34</td><td>The <code>rdfs:range</code> of <code>skos:memberList</code> is the class <code>rdf:List</code>.</td></tr><tr><td id="S35">S35</td><td><code>skos:memberList</code> is an instance of <code>owl:FunctionalProperty</code>.</td></tr><tr><td id="S36">S36</td><td>For any resource, every item in the list given as the value of the <code>skos:memberList</code> property is also a value of the <code>skos:member</code> property.</td></tr></tbody></table>

### 9.4. Integrity Conditions

<table border="0" class="semantics"><caption></caption><tbody><tr><td id="S37">S37</td><td><code>skos:Collection</code> is disjoint with each of <code>skos:Concept</code> and <code>skos:ConceptScheme</code>.</td></tr></tbody></table>

### 9.5. Examples

The graph below illustrates a SKOS collection with 3 members.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-40">Example 40 (consistent)</th></tr><tr><td><div>&lt;MyCollection&gt; rdf:type skos:Collection ;<br>&nbsp;&nbsp;skos:member &lt;X&gt; , &lt;Y&gt; , &lt;Z&gt; .</div></td></tr></tbody></table>

The graph below illustrates an ordered SKOS collection with 3 members. Note the use of the Turtle syntax `(...)`, representing an RDF Collection (list).

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-41">Example 41 (consistent)</th></tr><tr><td><div>&lt;MyOrderedCollection&gt; rdf:type skos:OrderedCollection ;<br>&nbsp;&nbsp;skos:memberList ( &lt;X&gt; &lt;Y&gt; &lt;Z&gt; ) .</div></td></tr></tbody></table>

### 9.6. Notes

#### 9.6.1. Inferring Collections from Ordered Collections

Statement [S36](#S36) states the logical relationship between the `skos:memberList` and `skos:member` properties. This relationship means that a collection can be inferred from an ordered collection. This is illustrated in the example below.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-42">Example 42 (entailment)</th></tr><tr><td><div>&lt;MyOrderedCollection&gt; rdf:type skos:OrderedCollection ;<br>&nbsp;&nbsp;skos:memberList ( &lt;X&gt; &lt;Y&gt; &lt;Z&gt; ) .</div><p><em>entails</em></p><div>&lt;MyOrderedCollection&gt; rdf:type skos:Collection ;<br>&nbsp;&nbsp;skos:member &lt;X&gt; , &lt;Y&gt; , &lt;Z&gt; .</div></td></tr></tbody></table>

Note that SKOS does not provide any way to explicitly state that a collection is **not** ordered.

#### 9.6.2. skos:memberList Integrity

Note that `skos:memberList` is a functional property, i.e., it does not have more than one value. This is intended to capture within the SKOS data model that it doesn't make sense for an ordered collection to have more than one member list. Unfortunately, there is no way to use this condition as an integrity condition without explicitly stating that two lists are different objects. In other words, although the graph below is **consistent** with the SKOS data model, it entails nonsense (a list with two first elements and a forked tail).

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-43">Example 43 (entailment)</th></tr><tr><td><div>&lt;OrderedCollectionResource&gt;<br>&nbsp;&nbsp;skos:memberList ( &lt;A&gt; &lt;B&gt; ) , ( &lt;X&gt; &lt;Y&gt; ) .</div><p><em>entails</em></p><div>&lt;OrderedCollectionResource&gt;<br>&nbsp;&nbsp;skos:memberList [ rdf:first &lt;A&gt; , &lt;X&gt; ; rdf:rest [ rdf:first &lt;B&gt; ; rdf:rest rdf:nil ] , [ rdf:first &lt;Y&gt; ; rdf:rest rdf:nil ] ] .</div></td></tr></tbody></table>

However, as stated in \[[RDF-SEMANTICS](#ref-RDF-SEMANTICS)\] section 3.3.3, semantic extensions to RDF may place extra syntactic well-formedness restrictions on the use of the RDF collection vocabulary (`rdf:first`, `rdf:rest`, `rdf:nil`) in order to rule out such graphs.

#### 9.6.3. Nested Collections

In the example below, a collection is nested within another collection.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-44">Example 44 (consistent)</th></tr><tr><td><div>&lt;MyCollection&gt; rdf:type skos:Collection ;<br>&nbsp;&nbsp;skos:member &lt;A&gt; , &lt;B&gt; , &lt;MyNestedCollection&gt; .<br><br>&lt;MyNestedCollection&gt; rdf:type skos:Collection ;<br>&nbsp;&nbsp;skos:member &lt;X&gt; , &lt;Y&gt; , &lt;Z&gt; .</div></td></tr></tbody></table>

This example is **consistent** with the SKOS data model, because the range of `skos:member` is the union of `skos:Concept` and `skos:Collection`.

#### 9.6.4. SKOS Concepts, Concept Collections and Semantic Relations

In the SKOS data model, `skos:Concept` and `skos:Collection` are disjoint classes. The domain and range of the SKOS semantic relation properties is `skos:Concept`. Therefore, if any of the SKOS semantic relation properties (e.g., `skos:narrower`) are used to link to or from a collection, the graph will **not** be consistent with the SKOS data model.

This is illustrated in the example below, which is **not** consistent with the SKOS data model.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-45">Example 45 (not consistent)</th></tr><tr><td><div>&lt;A&gt; skos:narrower &lt;B&gt; .<br>&lt;B&gt; rdf:type skos:Collection .</div></td></tr></tbody></table>

Similarly, the graph below is **not** consistent with the SKOS data model.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-46">Example 46 (not consistent)</th></tr><tr><td><div>&lt;A&gt; skos:broader &lt;B&gt; .<br>&lt;B&gt; rdf:type skos:Collection .</div></td></tr></tbody></table>

Similarly, the graph below is **not** consistent with the SKOS data model.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-47">Example 47 (not consistent)</th></tr><tr><td><div>&lt;A&gt; skos:related &lt;B&gt; .<br>&lt;B&gt; rdf:type skos:Collection .</div></td></tr></tbody></table>

However, the graph below is consistent with the SKOS data model.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-48">Example 48 (consistent)</th></tr><tr><td><div>&lt;A&gt; skos:narrower &lt;B&gt; , &lt;C&gt; , &lt;D&gt; .<br><br>&lt;ResourceCollection&gt; rdfs:label "Resource Collection"@en ;<br>&nbsp;&nbsp;skos:member &lt;B&gt; , &lt;C&gt; , &lt;D&gt; .</div></td></tr></tbody></table>

This means that, for thesauri and other knowledge organization systems where node labels are used within the systematic display for that thesaurus, the appropriate SKOS representation requires careful consideration. Furthermore, where node labels are used in the systematic display, it may not always be possible to fully reconstruct the systematic display from a SKOS representation alone. Fully representing all of the information represented in a systematic display of a thesaurus or other knowledge organization system, including details of layout and presentation, is beyond the scope of SKOS.

---

## 10\. Mapping Properties

### 10.1. Preamble

The SKOS mapping properties are `skos:closeMatch`, `skos:exactMatch`, `skos:broadMatch`, `skos:narrowMatch` and `skos:relatedMatch`. These properties are used to state mapping (alignment) links between SKOS concepts in different concept schemes, where the links are inherent in the meaning of the linked concepts.

The properties `skos:broadMatch` and `skos:narrowMatch` are used to state a hierarchical mapping link between two concepts.

The property `skos:relatedMatch` is used to state an associative mapping link between two concepts.

The property `skos:closeMatch` is used to link two concepts that are sufficiently similar that they can be used interchangeably in **some** information retrieval applications. In order to avoid the possibility of "compound errors" when combining mappings across more than two concept schemes, `skos:closeMatch` is **not** declared to be a transitive property.

The property `skos:exactMatch` is used to link two concepts, indicating a high degree of confidence that the concepts can be used interchangeably across a wide range of information retrieval applications. `skos:exactMatch` is a transitive property, and is a sub-property of `skos:closeMatch`.

### 10.2. Vocabulary

<table border="0" class="vocab"><caption></caption><tbody><tr><td><code>skos:mappingRelation</code></td></tr><tr><td><code>skos:closeMatch</code></td></tr><tr><td><code>skos:exactMatch</code></td></tr><tr><td><code>skos:broadMatch</code></td></tr><tr><td><code>skos:narrowMatch</code></td></tr><tr><td><code>skos:relatedMatch</code></td></tr></tbody></table>

### 10.3. Class & Property Definitions

<table border="0" class="semantics"><caption></caption><tbody><tr><td id="S38">S38</td><td><code>skos:mappingRelation</code>, <code>skos:closeMatch</code>, <code>skos:exactMatch</code>, <code>skos:broadMatch</code>, <code>skos:narrowMatch</code> and <code>skos:relatedMatch</code> are each instances of <code>owl:ObjectProperty</code>.</td></tr><tr><td id="S39">S39</td><td><code>skos:mappingRelation</code> is a sub-property of <code>skos:semanticRelation</code>.</td></tr><tr><td id="S40">S40</td><td><code>skos:closeMatch</code>, <code>skos:broadMatch</code>, <code>skos:narrowMatch</code> and <code>skos:relatedMatch</code> are each sub-properties of <code>skos:mappingRelation</code>.</td></tr><tr><td id="S41">S41</td><td><code>skos:broadMatch</code> is a sub-property of <code>skos:broader</code>, <code>skos:narrowMatch</code> is a sub-property of <code>skos:narrower</code>, and <code>skos:relatedMatch</code> is a sub-property of <code>skos:related</code>.</td></tr><tr><td id="S42">S42</td><td><code>skos:exactMatch</code> is a sub-property of <code>skos:closeMatch</code>.</td></tr><tr><td id="S43">S43</td><td><code>skos:narrowMatch</code> is <code>owl:inverseOf</code> the property <code>skos:broadMatch</code>.</td></tr><tr><td id="S44">S44</td><td><code>skos:relatedMatch</code>, <code>skos:closeMatch</code> and <code>skos:exactMatch</code> are each instances of <code>owl:SymmetricProperty</code>.</td></tr><tr><td id="S45">S45</td><td><code>skos:exactMatch</code> is an instance of <code>owl:TransitiveProperty</code>.</td></tr></tbody></table>

### 10.4. Integrity Conditions

<table border="0" class="semantics"><caption></caption><tbody><tr><td id="S46">S46</td><td><code>skos:exactMatch</code> is disjoint with each of the properties <code>skos:broadMatch</code> and <code>skos:relatedMatch</code>.</td></tr></tbody></table>

Note that because `skos:exactMatch` is a symmetric property, and `skos:broadMatch` and `skos:narrowMatch` are inverses, `skos:exactMatch` is therefore also disjoint with `skos:narrowMatch`.

### 10.5. Examples

The graph below asserts an exact equivalence mapping link between `<A>` and `<B>`.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-49">Example 49 (consistent)</th></tr><tr><td><div>&lt;A&gt; skos:exactMatch &lt;B&gt; .</div></td></tr></tbody></table>

The graph below asserts a close equivalence mapping link between `<A>` and `<B>`.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-50">Example 50 (consistent)</th></tr><tr><td><div>&lt;A&gt; skos:closeMatch &lt;B&gt; .</div></td></tr></tbody></table>

The graph below asserts a hierarchical mapping link between `<A>` and `<B>` (where `<B>` is broader than `<A>`), and an associative mapping link between `<A>` and `<C>`.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-51">Example 51 (consistent)</th></tr><tr><td><div>&lt;A&gt; skos:broadMatch &lt;B&gt; ; skos:relatedMatch &lt;C&gt; .</div></td></tr></tbody></table>

The graph below is **not consistent** with the SKOS data model, because there is a clash between exact and hierarchical mapping links.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-52">Example 52 (not consistent)</th></tr><tr><td><div>&lt;A&gt; skos:exactMatch &lt;B&gt; ; skos:broadMatch &lt;B&gt; .<br></div></td></tr></tbody></table>

The graph below is **not consistent** with the SKOS data model, because there is a clash between exact and associative mapping links.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-53">Example 53 (not consistent)</th></tr><tr><td><div>&lt;A&gt; skos:exactMatch &lt;B&gt; ; skos:relatedMatch &lt;B&gt; .<br></div></td></tr></tbody></table>

### 10.6. Notes

#### 10.6.1. Mapping Properties, Semantic Relation Properties and Concept Schemes

By convention, the SKOS mapping properties are only used to link concepts in **different** concept schemes. However, note that using the SKOS semantic relation properties (`skos:broader`, `skos:narrower`, `skos:related`) to link concepts in **different** concept schemes is also **consistent** with the SKOS data model (see [Section 8](#semantic-relations)).

The mapping properties `skos:broadMatch`, `skos:narrowMatch` and `skos:relatedMatch` are provided as a convenience, for situations where the provenance of data is known, and it is useful to be able to tell at a glance the difference between internal links within a concept scheme and mapping links between concept schemes.

However, using the SKOS mapping properties is **no substitute** for the careful management of RDF graphs or the use of provenance mechanisms.

The rationale behind this design is that it is hard to draw an absolute distinction between internal links within a concept scheme and mapping links between concept schemes. This is especially true in an open environment where different people might re-organize concepts into concept schemes in different ways. What one person views as two concept schemes with mapping links between, another might view as one single concept scheme with internal links only. This specification allows both points of view to co-exist, which (it is hoped) will promote flexibility and innovation in the re-use of SKOS data in the Web.

There is therefore an intimate connection between the SKOS semantic relation properties and the SKOS mapping properties. The property `skos:broadMatch` is a sub-property of `skos:broader`, `skos:narrowMatch` is a sub-property of `skos:narrower`, and `skos:relatedMatch` is a sub-property of `skos:related`. The full set of sub-property relationships is illustrated below.

skos:semanticRelation
 |
 +- skos:related
 |   |
 |   +- skos:relatedMatch
 |
 +- skos:broaderTransitive
 |   |
 |   +- skos:broader
 |       |
 |       +- skos:broadMatch
 |
 +- skos:narrowerTransitive
 |   |
 |   +- skos:narrower
 |       |
 |       +- skos:narrowMatch
 |
 +- skos:mappingRelation
     |
     +- skos:closeMatch
     |   |
     |   +- skos:exactMatch
     |
     +- skos:relatedMatch
     |
     +- skos:broadMatch
     |
     +- skos:narrowMatch 

Examples below illustrate some entailments which follow from this sub-property tree, and from the domain and range of `skos:semanticRelation`.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-54">Example 54 (entailment)</th></tr><tr><td><div>&lt;A&gt; skos:broadMatch &lt;B&gt; .</div><p><em>entails</em></p><div>&lt;A&gt; skos:mappingRelation &lt;B&gt; .<br>&lt;A&gt; skos:broader &lt;B&gt; .<br>&lt;A&gt; skos:broaderTransitive &lt;B&gt; .<br>&lt;A&gt; skos:semanticRelation &lt;B&gt; .<br>&lt;A&gt; rdf:type skos:Concept .<br>&lt;B&gt; rdf:type skos:Concept .</div></td></tr></tbody></table>

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-55">Example 55 (entailment)</th></tr><tr><td><div>&lt;A&gt; skos:narrowMatch &lt;B&gt; .</div><p><em>entails</em></p><div>&lt;A&gt; skos:mappingRelation &lt;B&gt; .<br>&lt;A&gt; skos:narrower &lt;B&gt; .<br>&lt;A&gt; skos:narrowerTransitive &lt;B&gt; .<br>&lt;A&gt; skos:semanticRelation &lt;B&gt; .<br>&lt;A&gt; rdf:type skos:Concept .<br>&lt;B&gt; rdf:type skos:Concept .</div></td></tr></tbody></table>

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-56">Example 56 (entailment)</th></tr><tr><td><div>&lt;A&gt; skos:relatedMatch &lt;B&gt; .</div><p><em>entails</em></p><div>&lt;A&gt; skos:mappingRelation &lt;B&gt; .<br>&lt;A&gt; skos:related &lt;B&gt; .<br>&lt;A&gt; skos:semanticRelation &lt;B&gt; .<br>&lt;A&gt; rdf:type skos:Concept .<br>&lt;B&gt; rdf:type skos:Concept .</div></td></tr></tbody></table>

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-57">Example 57 (entailment)</th></tr><tr><td><div>&lt;A&gt; skos:exactMatch &lt;B&gt; .</div><p><em>entails</em></p><div>&lt;A&gt; skos:closeMatch &lt;B&gt; .<br>&lt;A&gt; skos:mappingRelation &lt;B&gt; .<br>&lt;A&gt; skos:semanticRelation &lt;B&gt; .<br>&lt;A&gt; rdf:type skos:Concept .<br>&lt;B&gt; rdf:type skos:Concept .</div></td></tr></tbody></table>

Note also that, because different people might re-organize concepts into concept schemes in different ways, a graph might assert **mapping** links between concepts in the **same** concept scheme, and there are **no** formal integrity conditions in the SKOS data model that would make such a graph inconsistent, e.g., the graph below is **consistent** with the SKOS data model. However, in practice it is expected that such a graph would only ever arise from the merge of two or more graphs from different sources.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-58">Example 58 (consistent)</th></tr><tr><td><div>&lt;A&gt; skos:broadMatch &lt;B&gt; ; skos:relatedMatch &lt;C&gt; .<br><br>&lt;A&gt; skos:inScheme &lt;MyScheme&gt; .<br>&lt;B&gt; skos:inScheme &lt;MyScheme&gt; .<br>&lt;C&gt; skos:inScheme &lt;MyScheme&gt; .</div></td></tr></tbody></table>

#### 10.6.2. Clashes Between Hierarchical and Associative Links

Examples below illustrate "clashes" between hierarchical and associative mapping links, which are **not consistent** with the SKOS data model (because of the sub-property relationships illustrated above, and because of the data model for SKOS semantic relation properties defined in [Section 8](#semantic-relations)).

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-59">Example 59 (not consistent)</th></tr><tr><td><div>&lt;A&gt; skos:broadMatch &lt;B&gt; ; skos:relatedMatch &lt;B&gt; .</div></td></tr></tbody></table>

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-60">Example 60 (not consistent)</th></tr><tr><td><div>&lt;A&gt; skos:narrowMatch &lt;B&gt; ; skos:relatedMatch &lt;B&gt; .</div></td></tr></tbody></table>

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-61">Example 61 (not consistent)</th></tr><tr><td><div>&lt;A&gt; skos:broadMatch &lt;B&gt; .<br>&lt;B&gt; skos:broadMatch &lt;C&gt; .<br>&lt;A&gt; skos:relatedMatch &lt;C&gt; .</div></td></tr></tbody></table>

#### 10.6.3. Mapping Properties and Transitivity

The only SKOS mapping property which is declared as transitive is `skos:exactMatch`. An example entailment is illustrated below:

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-62">Example 62 (entailment)</th></tr><tr><td><div>&lt;A&gt; skos:exactMatch &lt;B&gt; .<br>&lt;B&gt; skos:exactMatch &lt;C&gt; .</div><p><em>entails</em></p><div>&lt;A&gt; skos:exactMatch &lt;C&gt; .</div></td></tr></tbody></table>

All other SKOS mapping properties are not transitive. Therefore, entailments as illustrated in examples below are **not** supported by the SKOS data model.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-63">Example 63 (non-entailment)</th></tr><tr><td><div>&lt;A&gt; skos:broadMatch &lt;B&gt; .<br>&lt;B&gt; skos:broadMatch &lt;C&gt; .</div><p><em>does not entail</em></p><div>&lt;A&gt; skos:broadMatch &lt;C&gt; .</div></td></tr></tbody></table>

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-64">Example 64 (non-entailment)</th></tr><tr><td><div>&lt;A&gt; skos:relatedMatch &lt;B&gt; .<br>&lt;B&gt; skos:relatedMatch &lt;C&gt; .</div><p><em>does not entail</em></p><div>&lt;A&gt; skos:relatedMatch &lt;C&gt; .</div></td></tr></tbody></table>

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-65">Example 65 (non-entailment)</th></tr><tr><td><div>&lt;A&gt; skos:closeMatch &lt;B&gt; .<br>&lt;B&gt; skos:closeMatch &lt;C&gt; .</div><p><em>does not entail</em></p><div>&lt;A&gt; skos:closeMatch &lt;C&gt; .</div></td></tr></tbody></table>

#### 10.6.4. Mapping Properties and Reflexivity

**None** of the SKOS mapping properties are reflexive, **neither** are they irreflexive.

Because `skos:exactMatch`, `skos:broadMatch` and `skos:relatedMatch` are **not** **irreflexive**, the graph below is **consistent** with the SKOS data model.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-66">Example 66 (consistent)</th></tr><tr><td><div>&lt;A&gt; skos:exactMatch &lt;A&gt; .<br>&lt;B&gt; skos:broadMatch &lt;B&gt; .<br>&lt;C&gt; skos:relatedMatch &lt;C&gt; .</div></td></tr></tbody></table>

However, see also [Section 8](#semantic-relations) on the reflexivity of SKOS semantic relation properties.

#### 10.6.5. Cycles and Alternate Paths Involving skos:broadMatch

There are no formal integrity conditions preventing either cycles or alternative paths in a graph of hierarchical mapping links.

In the graph below there are two cycles involving `skos:broadMatch`. This graph is **consistent** with the SKOS data model.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-67">Example 67 (consistent)</th></tr><tr><td><div>&lt;A&gt; skos:broadMatch &lt;B&gt; .<br>&lt;B&gt; skos:broadMatch &lt;A&gt; .<br><br>&lt;X&gt; skos:broadMatch &lt;Y&gt; .<br>&lt;Y&gt; skos:broadMatch &lt;Z&gt; .<br>&lt;Z&gt; skos:broadMatch &lt;X&gt; .</div></td></tr></tbody></table>

In the graph below there are two alternative paths involving `skos:broadMatch`. This graph is **consistent** with the SKOS data model.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-68">Example 68 (consistent)</th></tr><tr><td><div>&lt;A&gt; skos:broadMatch &lt;B&gt; .<br>&lt;B&gt; skos:broadMatch &lt;C&gt; .<br>&lt;A&gt; skos:broadMatch &lt;C&gt; .</div></td></tr></tbody></table>

See however [Section 8](#semantic-relations) on cycles and alternative paths involving `skos:broader`.

#### 10.6.6. Cycles Involving skos:exactMatch and skos:closeMatch

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-69">Example 69 (entailment)</th></tr><tr><td><div>&lt;A&gt; skos:exactMatch &lt;B&gt;</div><p><em>entails</em></p><div>&lt;A&gt; skos:exactMatch &lt;A&gt; .<br>&lt;A&gt; skos:closeMatch &lt;A&gt; .</div></td></tr></tbody></table>

Due to the entailment above (which arises through a combination of [S42](#S42), [S44](#S44) and [S45](#S45)), applications must be able to cope with cycles in `skos:exactMatch` and `skos:closeMatch`.

#### 10.6.7. Sub-Property Chains Involving skos:exactMatch

There are no sub-property chain axioms in the SKOS data model involving the `skos:exactMatch` or `skos:closeMatch` properties. Hence the entailments illustrated below are **not** supported.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-70">Example 70 (non-entailment)</th></tr><tr><td><div>&lt;A&gt; skos:exactMatch &lt;B&gt; .<br>&lt;B&gt; skos:broadMatch &lt;C&gt; .</div><p><em>does not entail</em></p><div>&lt;A&gt; skos:broadMatch &lt;C&gt; .</div></td></tr></tbody></table>

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-71">Example 71 (non-entailment)</th></tr><tr><td><div>&lt;A&gt; skos:exactMatch &lt;B&gt; .<br>&lt;B&gt; skos:relatedMatch &lt;C&gt; .</div><p><em>does not entail</em></p><div>&lt;A&gt; skos:relatedMatch &lt;C&gt; .</div></td></tr></tbody></table>

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-72">Example 72 (non-entailment)</th></tr><tr><td><div>&lt;A&gt; skos:closeMatch &lt;B&gt; .<br>&lt;B&gt; skos:broadMatch &lt;C&gt; .</div><p><em>does not entail</em></p><div>&lt;A&gt; skos:broadMatch &lt;C&gt; .</div></td></tr></tbody></table>

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-73">Example 73 (non-entailment)</th></tr><tr><td><div>&lt;A&gt; skos:closeMatch &lt;B&gt; .<br>&lt;B&gt; skos:relatedMatch &lt;C&gt; .</div><p><em>does not entail</em></p><div>&lt;A&gt; skos:relatedMatch &lt;C&gt; .</div></td></tr></tbody></table>

#### 10.6.8. skos:closeMatch, skos:exactMatch, owl:sameAs, owl:equivalentClass, owl:equivalentProperty

OWL provides three properties which might, at first glance, appear similar to `skos:closeMatch` or `skos:exactMatch`. `owl:sameAs` is used to link two individuals in an ontology, and indicates that they are the same individual (i.e., the same resource). `owl:equivalentClass` is used to link two classes in an ontology, and indicates that those classes have the same class extension. `owl:equivalentProperty` is used to link two properties in an ontology and indicates that both properties have the same property extension.

`skos:closeMatch` and `skos:exactMatch` are used to link SKOS concepts in different schemes. A `skos:closeMatch` link indicates that two concepts are sufficiently similar that they can be used interchangeably in **some** information retrieval applications. A `skos:exactMatch` link indicates a high degree of confidence that two concepts can be used interchangeably across a wide range of information retrieval applications.

`owl:sameAs`, `owl:equivalentClass` or `owl:equivalentProperty` would typically be inappropriate for linking SKOS concepts in different concept schemes, because the formal consequences that follow could be undesirable.

The example below illustrates some undesirable entailments that would follow from using `owl:sameAs` in this way.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-74">Example 74 (entailment)</th></tr><tr><td><div>&lt;A&gt; rdf:type skos:Concept ;<br>&nbsp;&nbsp;skos:prefLabel "love"@en ;<br>&nbsp;&nbsp;skos:inScheme &lt;MyScheme&gt; .<br><br>&lt;B&gt; rdf:type skos:Concept ;<br>&nbsp;&nbsp;skos:prefLabel "adoration"@en ;<br>&nbsp;&nbsp;skos:inScheme &lt;AnotherScheme&gt; .<br><br>&lt;A&gt; owl:sameAs &lt;B&gt; .</div><p><em>entails</em></p><div>&lt;A&gt;<br>&nbsp;&nbsp;skos:prefLabel "love"@en ;<br>&nbsp;&nbsp;skos:prefLabel "adoration"@en ;<br>&nbsp;&nbsp;skos:inScheme &lt;MyScheme&gt; ;<br>&nbsp;&nbsp;skos:inScheme &lt;AnotherScheme&gt; .<br><br>&lt;B&gt; &nbsp;&nbsp;<br>&nbsp;&nbsp;skos:prefLabel "love"@en ;<br>&nbsp;&nbsp;skos:prefLabel "adoration"@en ;<br>&nbsp;&nbsp;skos:inScheme &lt;MyScheme&gt; ;<br>&nbsp;&nbsp;skos:inScheme &lt;AnotherScheme&gt; .<br></div></td></tr></tbody></table>

In this example, using `owl:sameAs` to link two SKOS concepts in different concept schemes does actually lead to an inconsistency with the SKOS data model, because both `<A>` and `<B>` now have two preferred lexical labels in the same language. This will not always be the case, however.

---

## 11\. References

\[AGROVOC\]

[AGROVOC Thesaurus](http://www.fao.org/agrovoc), Food and Agriculture Organization of the United Nations (FAO). Available at http://www.fao.org/agrovoc

\[BCP47\]

[Tags for Identifying Languages](http://www.rfc-editor.org/rfc/bcp/bcp47.txt), A. Phillips and M. Davis, Editors, September 2006. Available at http://www.rfc-editor.org/rfc/bcp/bcp47.txt

\[BS8723-2\]

BS8723 Structured Vocabularies for Information Retrieval Part 2: Thesauri, British Standards Institution (BSI), 2005.

\[BS8723-3\]

BS8723 Structured Vocabularies for Information Retrieval Part 3: Vocabularies Other Than Thesauri, British Standards Institution (BSI), 2005.

\[COOLURIS\]

[Cool URIs for the Semantic Web](https://www.w3.org/TR/2008/NOTE-cooluris-20080331/), Leo Sauermann and Richard Cyganiak, Editors, W3C Interest Group Note, 31 March 2008, http://www.w3.org/TR/2008/NOTE-cooluris-20080331/. [Latest version](https://www.w3.org/TR/cooluris/) available at http://www.w3.org/TR/cooluris/

\[ISO2788\]

ISO 2788:1986 Documentation -- Guidelines for the establishment and development of monolingual thesauri, International Organization for Standardization (ISO), 1986.

\[LCSH\]

[Library of Congress Subject Headings](http://www.loc.gov/cds/lcsh.html), The Library of Congress Cataloging Distribution Service. Available at http://www.loc.gov/cds/lcsh.html and at [http://id.loc.gov/](http://id.loc.gov/)

\[NTRIPLES\]

[RDF Test Cases](https://www.w3.org/TR/2004/REC-rdf-testcases-20040210/), Jan Grant and Dave Beckett, Editors, W3C Recommendation, 10 February 2004, http://www.w3.org/TR/2004/REC-rdf-testcases-20040210/. [Latest version](https://www.w3.org/TR/rdf-testcases/) available at http://www.w3.org/TR/rdf-testcases/

\[OWL-GUIDE\]

[OWL Web Ontology Language Guide](https://www.w3.org/TR/2004/REC-owl-guide-20040210/), Michael K. Smith, Chris Welty and Deborah L. McGuinness, Editors, W3C Recommendation, 10 February 2004, http://www.w3.org/TR/2004/REC-owl-guide-20040210/. [Latest version](https://www.w3.org/TR/owl-guide/) available at http://www.w3.org/TR/owl-guide/

\[OWL-REFERENCE\]

[OWL Web Ontology Language Reference](https://www.w3.org/TR/2004/REC-owl-ref-20040210/), Mike Dean and Guus Schreiber, Editors, W3C Recommendation, 10 February 2004, http://www.w3.org/TR/2004/REC-owl-ref-20040210/. [Latest version](https://www.w3.org/TR/owl-ref/) available at http://www.w3.org/TR/owl-ref/

\[OWL-SEMANTICS\]

[OWL Web Ontology Language Semantics and Abstract Syntax](https://www.w3.org/TR/2004/REC-owl-semantics-20040210/), Peter F. Patel-Schneider, Patrick Hayes and Ian Horrocks, Editors, W3C Recommendation, 10 February 2004, http://www.w3.org/TR/2004/REC-owl-semantics-20040210/. [Latest version](https://www.w3.org/TR/owl-semantics/) available at http://www.w3.org/TR/owl-semantics/

\[RDF-CONCEPTS\]

[Resource Description Framework (RDF): Concepts and Abstract Syntax](https://www.w3.org/TR/2004/REC-rdf-concepts-20040210/), Graham Klyne and Jeremy J. Carroll, Editors, W3C Recommendation, 10 February 2004, http://www.w3.org/TR/2004/REC-rdf-concepts-20040210/. [Latest version](https://www.w3.org/TR/rdf-concepts/) available at http://www.w3.org/TR/rdf-concepts/

\[RDF-PRIMER\]

[RDF Primer](https://www.w3.org/TR/2004/REC-rdf-primer-20040210/), Frank Manola and Eric Miller, Editors, W3C Recommendation, 10 February 2004, http://www.w3.org/TR/2004/REC-rdf-primer-20040210/. [Latest version](https://www.w3.org/TR/rdf-primer/) available at http://www.w3.org/TR/rdf-primer/

\[RDF-SEMANTICS\]

[RDF Semantics](https://www.w3.org/TR/2004/REC-rdf-mt-20040210/), Patrick Hayes, Editor, W3C Recommendation, 10 February 2004, http://www.w3.org/TR/2004/REC-rdf-mt-20040210/. [Latest version](https://www.w3.org/TR/rdf-mt/) available at http://www.w3.org/TR/rdf-mt/

\[RDF-XML\]

[RDF/XML Syntax Specification (Revised)](https://www.w3.org/TR/2004/REC-rdf-syntax-grammar-20040210/), Dave Beckett, Editor, W3C Recommendation, 10 February 2004, http://www.w3.org/TR/2004/REC-rdf-syntax-grammar-20040210/. [Latest version](https://www.w3.org/TR/rdf-syntax-grammar/) available at http://www.w3.org/TR/rdf-syntax-grammar/

\[RDFS\]

[RDF Vocabulary Description Language 1.0: RDF Schema](https://www.w3.org/TR/2004/REC-rdf-schema-20040210/), Dan Brickley and R. V. Guha, Editors, W3C Recommendation, 10 February 2004, http://www.w3.org/TR/2004/REC-rdf-schema-20040210/. [Latest version](https://www.w3.org/TR/rdf-schema/) available at http://www.w3.org/TR/rdf-schema/

\[RECIPES\]

[Best Practice Recipes for Publishing RDF Vocabularies](https://www.w3.org/TR/2008/WD-swbp-vocab-pub-20080123/), Diego Berrueta and Jon Phipps, Editors, W3C Working Draft, 23 January 2008, http://www.w3.org/TR/2008/WD-swbp-vocab-pub-20080123/. [Latest version](https://www.w3.org/TR/swbp-vocab-pub/) available at http://www.w3.org/TR/swbp-vocab-pub/

\[SKOS-HTML\]

[SKOS Namespace Document - HTML Variant](https://www.w3.org/TR/skos-reference/skos.html). [Latest version](https://www.w3.org/TR/skos-reference/skos.html) available at http://www.w3.org/TR/skos-reference/skos.html

\[SKOS-PRIMER\]

[SKOS Simple Knowledge Organization System Primer](https://www.w3.org/TR/2009/NOTE-skos-primer-20090818), Antoine Isaac and Ed Summers, Editors, W3C Working Group Note, 18 August 2009, http://www.w3.org/TR/2009/NOTE-skos-primer-20090818. [Latest version](https://www.w3.org/TR/skos-primer) available at http://www.w3.org/TR/skos-primer

\[SKOS-RDF\]

[SKOS Namespace Document - RDF/XML Variant](https://www.w3.org/TR/skos-reference/skos.rdf). [Latest version](https://www.w3.org/TR/skos-reference/skos.rdf) available at http://www.w3.org/TR/skos-reference/skos.rdf

\[SKOS-RDF-OWL1-DL\]

[SKOS RDF Schema - OWL 1 DL Sub-set](https://www.w3.org/TR/skos-reference/skos-owl1-dl.rdf). [Latest version](https://www.w3.org/TR/skos-reference/skos-owl1-dl.rdf) available at http://www.w3.org/TR/skos-reference/skos-owl1-dl.rdf

\[SKOS-UCR\]

[SKOS Use Cases and Requirements](https://www.w3.org/TR/2009/NOTE-skos-ucr-20090818), Antoine Isaac, Jon Phipps and Daniel Rubin, Editors, W3C Working Group Note, 18 August 2009, http://www.w3.org/TR/2009/NOTE-skos-ucr-20090818. [Latest version](https://www.w3.org/TR/skos-ucr) available at http://www.w3.org/TR/skos-ucr

\[SKOS-XL-HTML\]

[SKOS-XL Namespace Document - HTML Variant](https://www.w3.org/TR/skos-reference/skos-xl.html). [Latest version](https://www.w3.org/TR/skos-reference/skos-xl.html) available at http://www.w3.org/TR/skos-reference/skos-xl.html

\[SKOS-XL-RDF\]

[SKOS-XL Namespace Document - RDF/XML Variant](https://www.w3.org/TR/skos-reference/skos-xl.rdf). [Latest version](https://www.w3.org/TR/skos-reference/skos-xl.rdf) available at http://www.w3.org/TR/skos-reference/skos-xl.rdf

\[SPARQL\]

[SPARQL Query Language for RDF](https://www.w3.org/TR/2008/REC-rdf-sparql-query-20080115/), Eric Prud'hommeaux and Andy Seaborne, Editors, W3C Recommendation, 15 January 2008, http://www.w3.org/TR/2008/REC-rdf-sparql-query-20080115/. [Latest version](https://www.w3.org/TR/rdf-sparql-query/) available at http://www.w3.org/TR/rdf-sparql-query/

\[SW\]

[W3C Semantic Web Activity](https://www.w3.org/2001/sw/). Available at http://www.w3.org/2001/sw/

\[SWBP-DATATYPES\]

[XML Schema Datatypes in RDF and OWL](https://www.w3.org/TR/2006/NOTE-swbp-xsch-datatypes-20060314/), Jeremy J. Carroll and Jeff Z. Pan, Editors, W3C Working Group Note, 14 March 2006, http://www.w3.org/TR/2006/NOTE-swbp-xsch-datatypes-20060314/. [Latest version](https://www.w3.org/TR/swbp-xsch-datatypes/) available at http://www.w3.org/TR/swbp-xsch-datatypes/

\[TURTLE\]

[Turtle - Terse RDF Triple Language](https://www.w3.org/TeamSubmission/2008/SUBM-turtle-20080114/), David Beckett and Tim Berners-Lee, W3C Team Submission, 14 January 2008, http://www.w3.org/TeamSubmission/2008/SUBM-turtle-20080114/. [Latest version](https://www.w3.org/TeamSubmission/turtle/) available at http://www.w3.org/TeamSubmission/turtle/

\[WEBARCH\]

[Architecture of the World Wide Web, Volume One](https://www.w3.org/TR/2004/REC-webarch-20041215/), Ian Jacobs and Norman Walsh, Editors, W3C Recommendation, 15 December 2004, http://www.w3.org/TR/2004/REC-webarch-20041215/. [Latest version](https://www.w3.org/TR/webarch/) available at http://www.w3.org/TR/webarch/

\[XML-SCHEMA\]

[XML Schema Part 2: Datatypes Second Edition](https://www.w3.org/TR/2004/REC-xmlschema-2-20041028/), Paul V. Biron and Ashok Malhotra, Editors, W3C Recommendation, 28 October 2004, http://www.w3.org/TR/2004/REC-xmlschema-2-20041028/. [Latest version](https://www.w3.org/TR/xmlschema-2/) available at http://www.w3.org/TR/xmlschema-2/

---

## 12\. Acknowledgments

This document is the result of extensive discussions within the [W3C Semantic Web Deployment Working Group](https://www.w3.org/2006/07/SWD/). The document drew on the experiences of earlier groups and projects, including [SWAD-Europe](https://www.w3.org/2001/sw/Europe/) and the [W3C Semantic Web Best Practices and Deployment Working Group](https://www.w3.org/2001/sw/BestPractices/). Members of the W3C's [public-esw-thes](http://lists.w3.org/Archives/Public/public-esw-thes/) mailing list also made valuable contributions.

---

## Appendix A. SKOS Properties and Classes

### A.1. Classes in the SKOS Data Model

<table class="quick-reference"><caption></caption><colgroup><col class="quick-ref-key"><col class="quick-ref-value"></colgroup><tbody><tr><th colspan="2"><a href="#Collection" id="Collection">skos:Collection</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#Collection</code></td></tr><tr><td>Definition:</td><td><a href="#collections">Section 9. Concept Collections</a></td></tr><tr><td>Label:</td><td><em>Collection</em></td></tr><tr><td>Disjoint classes:</td><td><code><a href="#Concept">skos:Concept</a></code><br><code><a href="#ConceptScheme">skos:ConceptScheme</a></code><br></td></tr><tr><th colspan="2"><a href="#Concept" id="Concept">skos:Concept</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#Concept</code></td></tr><tr><td>Definition:</td><td><a href="#concepts">Section 3. The skos:Concept Class</a></td></tr><tr><td>Label:</td><td><em>Concept</em></td></tr><tr><td>Disjoint classes:</td><td><code><a href="#Collection">skos:Collection</a></code><br><code><a href="#ConceptScheme">skos:ConceptScheme</a></code><br></td></tr><tr><th colspan="2"><a href="#ConceptScheme" id="ConceptScheme">skos:ConceptScheme</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#ConceptScheme</code></td></tr><tr><td>Definition:</td><td><a href="#schemes">Section 4. Concept Schemes</a></td></tr><tr><td>Label:</td><td><em>Concept Scheme</em></td></tr><tr><td>Disjoint classes:</td><td><code><a href="#Collection">skos:Collection</a></code><br><code><a href="#Concept">skos:Concept</a></code><br></td></tr><tr><th colspan="2"><a href="#OrderedCollection" id="OrderedCollection">skos:OrderedCollection</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#OrderedCollection</code></td></tr><tr><td>Definition:</td><td><a href="#collections">Section 9. Concept Collections</a></td></tr><tr><td>Label:</td><td><em>Ordered Collection</em></td></tr><tr><td>Super-classes:</td><td><code><a href="#Collection">skos:Collection</a></code><br></td></tr></tbody></table>

### A.2. Properties in the SKOS Data Model

<table class="quick-reference"><caption></caption><colgroup><col class="quick-ref-key"><col class="quick-ref-value"></colgroup><tbody><tr><th colspan="2"><a href="#altLabel" id="altLabel">skos:altLabel</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#altLabel</code></td></tr><tr><td>Definition:</td><td><a href="#labels">Section 5. Lexical Labels</a></td></tr><tr><td>Label:</td><td><em>alternative label</em></td></tr><tr><td>Super-properties:</td><td><code>http://www.w3.org/2000/01/rdf-schema#label</code></td></tr><tr><th colspan="2"><a href="#broadMatch" id="broadMatch">skos:broadMatch</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#broadMatch</code></td></tr><tr><td>Definition:</td><td><a href="#mapping">Section 10. Mapping Properties</a></td></tr><tr><td>Label:</td><td><em>has broader match</em></td></tr><tr><td>Super-properties:</td><td><code><a href="#broader">skos:broader</a></code><br><code><a href="#mappingRelation">skos:mappingRelation</a></code><br></td></tr><tr><td>Inverse of:</td><td><code><a href="#narrowMatch">skos:narrowMatch</a></code><br></td></tr><tr><th colspan="2"><a href="#broader" id="broader">skos:broader</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#broader</code></td></tr><tr><td>Definition:</td><td><a href="#semantic-relations">Section 8. Semantic Relations</a></td></tr><tr><td>Label:</td><td><em>has broader</em></td></tr><tr><td>Super-properties:</td><td><code><a href="#broaderTransitive">skos:broaderTransitive</a></code><br></td></tr><tr><td>Inverse of:</td><td><code><a href="#narrower">skos:narrower</a></code><br></td></tr><tr><th colspan="2"><a href="#broaderTransitive" id="broaderTransitive">skos:broaderTransitive</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#broaderTransitive</code></td></tr><tr><td>Definition:</td><td><a href="#semantic-relations">Section 8. Semantic Relations</a></td></tr><tr><td>Label:</td><td><em>has broader transitive</em></td></tr><tr><td>Super-properties:</td><td><code><a href="#semanticRelation">skos:semanticRelation</a></code><br></td></tr><tr><td>Inverse of:</td><td><code><a href="#narrowerTransitive">skos:narrowerTransitive</a></code><br></td></tr><tr><td>Other characteristics:</td><td>Transitive<br></td></tr><tr><th colspan="2"><a href="#changeNote" id="changeNote">skos:changeNote</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#changeNote</code></td></tr><tr><td>Definition:</td><td><a href="#notes">Section 7. Documentation Properties</a></td></tr><tr><td>Label:</td><td><em>change note</em></td></tr><tr><td>Super-properties:</td><td><code><a href="#note">skos:note</a></code><br></td></tr><tr><th colspan="2"><a href="#closeMatch" id="closeMatch">skos:closeMatch</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#closeMatch</code></td></tr><tr><td>Definition:</td><td><a href="#mapping">Section 10. Mapping Properties</a></td></tr><tr><td>Label:</td><td><em>has close match</em></td></tr><tr><td>Super-properties:</td><td><code><a href="#mappingRelation">skos:mappingRelation</a></code><br></td></tr><tr><td>Other characteristics:</td><td>Symmetric<br></td></tr><tr><th colspan="2"><a href="#definition" id="definition">skos:definition</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#definition</code></td></tr><tr><td>Definition:</td><td><a href="#notes">Section 7. Documentation Properties</a></td></tr><tr><td>Label:</td><td><em>definition</em></td></tr><tr><td>Super-properties:</td><td><code><a href="#note">skos:note</a></code><br></td></tr><tr><th colspan="2"><a href="#editorialNote" id="editorialNote">skos:editorialNote</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#editorialNote</code></td></tr><tr><td>Definition:</td><td><a href="#notes">Section 7. Documentation Properties</a></td></tr><tr><td>Label:</td><td><em>editorial note</em></td></tr><tr><td>Super-properties:</td><td><code><a href="#note">skos:note</a></code><br></td></tr><tr><th colspan="2"><a href="#exactMatch" id="exactMatch">skos:exactMatch</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#exactMatch</code></td></tr><tr><td>Definition:</td><td><a href="#mapping">Section 10. Mapping Properties</a></td></tr><tr><td>Label:</td><td><em>has exact match</em></td></tr><tr><td>Super-properties:</td><td><code><a href="#closeMatch">skos:closeMatch</a></code><br></td></tr><tr><td>Other characteristics:</td><td>Transitive<br>Symmetric<br></td></tr><tr><th colspan="2"><a href="#example" id="example">skos:example</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#example</code></td></tr><tr><td>Definition:</td><td><a href="#notes">Section 7. Documentation Properties</a></td></tr><tr><td>Label:</td><td><em>example</em></td></tr><tr><td>Super-properties:</td><td><code><a href="#note">skos:note</a></code><br></td></tr><tr><th colspan="2"><a href="#hasTopConcept" id="hasTopConcept">skos:hasTopConcept</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#hasTopConcept</code></td></tr><tr><td>Definition:</td><td><a href="#schemes">Section 4. Concept Schemes</a></td></tr><tr><td>Label:</td><td><em>label</em></td></tr><tr><td>Domain:</td><td><code><a href="#ConceptScheme">skos:ConceptScheme</a></code><br></td></tr><tr><td>Range:</td><td><code><a href="#Concept">skos:Concept</a></code><br></td></tr><tr><td>Inverse of:</td><td><code><a href="#topConceptOf">skos:topConceptOf</a></code><br></td></tr><tr><th colspan="2"><a href="#hiddenLabel" id="hiddenLabel">skos:hiddenLabel</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#hiddenLabel</code></td></tr><tr><td>Definition:</td><td><a href="#labels">Section 5. Lexical Labels</a></td></tr><tr><td>Label:</td><td><em>hidden label</em></td></tr><tr><td>Super-properties:</td><td><code>http://www.w3.org/2000/01/rdf-schema#label</code></td></tr><tr><th colspan="2"><a href="#historyNote" id="historyNote">skos:historyNote</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#historyNote</code></td></tr><tr><td>Definition:</td><td><a href="#notes">Section 7. Documentation Properties</a></td></tr><tr><td>Label:</td><td><em>history note</em></td></tr><tr><td>Super-properties:</td><td><code><a href="#note">skos:note</a></code><br></td></tr><tr><th colspan="2"><a href="#inScheme" id="inScheme">skos:inScheme</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#inScheme</code></td></tr><tr><td>Definition:</td><td><a href="#schemes">Section 4. Concept Schemes</a></td></tr><tr><td>Label:</td><td><em>is in scheme</em></td></tr><tr><td>Range:</td><td><code><a href="#ConceptScheme">skos:ConceptScheme</a></code><br></td></tr><tr><th colspan="2"><a href="#mappingRelation" id="mappingRelation">skos:mappingRelation</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#mappingRelation</code></td></tr><tr><td>Definition:</td><td><a href="#mapping">Section 10. Mapping Properties</a></td></tr><tr><td>Label:</td><td><em>is in mapping relation with</em></td></tr><tr><td>Super-properties:</td><td><code><a href="#semanticRelation">skos:semanticRelation</a></code><br></td></tr><tr><th colspan="2"><a href="#member" id="member">skos:member</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#member</code></td></tr><tr><td>Definition:</td><td><a href="#collections">Section 9. Concept Collections</a></td></tr><tr><td>Label:</td><td><em>has member</em></td></tr><tr><td>Domain:</td><td><code><a href="#Collection">skos:Collection</a></code><br></td></tr><tr><td>Range:</td><td>union of <code><a href="#Concept">skos:Concept</a></code> and <code><a href="#Collection">skos:Collection</a></code><br></td></tr><tr><th colspan="2"><a href="#memberList" id="memberList">skos:memberList</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#memberList</code></td></tr><tr><td>Definition:</td><td><a href="#collections">Section 9. Concept Collections</a></td></tr><tr><td>Label:</td><td><em>has member list</em></td></tr><tr><td>Domain:</td><td><code><a href="#OrderedCollection">skos:OrderedCollection</a></code><br></td></tr><tr><td>Range:</td><td><code>http://www.w3.org/1999/02/22-rdf-syntax-ns#List</code><br></td></tr><tr><td>Other characteristics:</td><td>Functional<br></td></tr><tr><th colspan="2"><a href="#narrowMatch" id="narrowMatch">skos:narrowMatch</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#narrowMatch</code></td></tr><tr><td>Definition:</td><td><a href="#mapping">Section 10. Mapping Properties</a></td></tr><tr><td>Label:</td><td><em>has narrower match</em></td></tr><tr><td>Super-properties:</td><td><code><a href="#mappingRelation">skos:mappingRelation</a></code><br><code><a href="#narrower">skos:narrower</a></code><br></td></tr><tr><td>Inverse of:</td><td><code><a href="#broadMatch">skos:broadMatch</a></code><br></td></tr><tr><th colspan="2"><a href="#narrower" id="narrower">skos:narrower</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#narrower</code></td></tr><tr><td>Definition:</td><td><a href="#semantic-relations">Section 8. Semantic Relations</a></td></tr><tr><td>Label:</td><td><em>has narrower</em></td></tr><tr><td>Super-properties:</td><td><code><a href="#narrowerTransitive">skos:narrowerTransitive</a></code><br></td></tr><tr><td>Inverse of:</td><td><code><a href="#broader">skos:broader</a></code><br></td></tr><tr><th colspan="2"><a href="#narrowerTransitive" id="narrowerTransitive">skos:narrowerTransitive</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#narrowerTransitive</code></td></tr><tr><td>Definition:</td><td><a href="#semantic-relations">Section 8. Semantic Relations</a></td></tr><tr><td>Label:</td><td><em>has narrower transitive</em></td></tr><tr><td>Super-properties:</td><td><code><a href="#semanticRelation">skos:semanticRelation</a></code><br></td></tr><tr><td>Inverse of:</td><td><code><a href="#broaderTransitive">skos:broaderTransitive</a></code><br></td></tr><tr><td>Other characteristics:</td><td>Transitive<br></td></tr><tr><th colspan="2"><a href="#notation" id="notation">skos:notation</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#notation</code></td></tr><tr><td>Definition:</td><td><a href="#notations">Section 6. Notations</a></td></tr><tr><td>Label:</td><td><em>notation</em></td></tr><tr><th colspan="2"><a href="#note" id="note">skos:note</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#note</code></td></tr><tr><td>Definition:</td><td><a href="#notes">Section 7. Documentation Properties</a></td></tr><tr><td>Label:</td><td><em>note</em></td></tr><tr><th colspan="2"><a href="#prefLabel" id="prefLabel">skos:prefLabel</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#prefLabel</code></td></tr><tr><td>Definition:</td><td><a href="#labels">Section 5. Lexical Labels</a></td></tr><tr><td>Label:</td><td><em>preferred label</em></td></tr><tr><td>Super-properties:</td><td><code>http://www.w3.org/2000/01/rdf-schema#label</code></td></tr><tr><th colspan="2"><a href="#related" id="related">skos:related</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#related</code></td></tr><tr><td>Definition:</td><td><a href="#semantic-relations">Section 8. Semantic Relations</a></td></tr><tr><td>Label:</td><td><em>has related</em></td></tr><tr><td>Super-properties:</td><td><code><a href="#semanticRelation">skos:semanticRelation</a></code><br></td></tr><tr><td>Other characteristics:</td><td>Symmetric<br></td></tr><tr><th colspan="2"><a href="#relatedMatch" id="relatedMatch">skos:relatedMatch</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#relatedMatch</code></td></tr><tr><td>Definition:</td><td><a href="#mapping">Section 10. Mapping Properties</a></td></tr><tr><td>Label:</td><td><em>has related match</em></td></tr><tr><td>Super-properties:</td><td><code><a href="#mappingRelation">skos:mappingRelation</a></code><br><code><a href="#related">skos:related</a></code><br></td></tr><tr><td>Other characteristics:</td><td>Symmetric<br></td></tr><tr><th colspan="2"><a href="#scopeNote" id="scopeNote">skos:scopeNote</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#scopeNote</code></td></tr><tr><td>Definition:</td><td><a href="#notes">Section 7. Documentation Properties</a></td></tr><tr><td>Label:</td><td><em>scope note</em></td></tr><tr><td>Super-properties:</td><td><code><a href="#note">skos:note</a></code><br></td></tr><tr><th colspan="2"><a href="#semanticRelation" id="semanticRelation">skos:semanticRelation</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#semanticRelation</code></td></tr><tr><td>Definition:</td><td><a href="#semantic-relations">Section 8. Semantic Relations</a></td></tr><tr><td>Label:</td><td><em>is in semantic relation with</em></td></tr><tr><td>Domain:</td><td><code><a href="#Concept">skos:Concept</a></code><br></td></tr><tr><td>Range:</td><td><code><a href="#Concept">skos:Concept</a></code><br></td></tr><tr><th colspan="2"><a href="#topConceptOf" id="topConceptOf">skos:topConceptOf</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2004/02/skos/core#topConceptOf</code></td></tr><tr><td>Definition:</td><td><a href="#schemes">Section 4. Concept Schemes</a></td></tr><tr><td>Label:</td><td><em>is top concept in scheme</em></td></tr><tr><td>Super-properties:</td><td><code><a href="#inScheme">skos:inScheme</a></code><br></td></tr><tr><td>Inverse of:</td><td><code><a href="#hasTopConcept">skos:hasTopConcept</a></code><br></td></tr></tbody></table>

---

## Appendix B. SKOS eXtension for Labels (SKOS-XL)

This appendix defines an **optional** extension to the Simple Knowledge Organization System, called the SKOS eXtension for Labels (SKOS-XL). This extension provides additional support for identifying, describing and linking lexical entities.

A special class of lexical entities, called `skosxl:Label`, is defined. Each instance of this class has a single RDF plain literal form, but two instances of this class are not necessarily the same individual if they share the same literal form.

Three labeling properties, `skosxl:prefLabel`, `skosxl:altLabel` and `skosxl:hiddenLabel`, are defined. These properties are used to label SKOS concepts with instances of `skosxl:Label`, and are otherwise analogous to the properties of the same local name defined in SKOS (`skos:prefLabel`, `skos:altLabel` and `skos:hiddenLabel` respectively).

The SKOS data model also defines the property `skosxl:labelRelation`. This property can be used to assert a direct (binary) link between instances of `skosxl:Label`. It is primarily intended as an extension point, to be refined for more specific types of link. No built-in refinements of `skosxl:labelRelation` are provided, although some examples of how this could be done are given.

### B.1. SKOS-XL Namespace and Vocabulary

The SKOS-XL namespace URI is:

-   **http://www.w3.org/2008/05/skos-xl#**

Here the prefix `skosxl:` is used as an abbreviation for the SKOS-XL namespace URI.

The SKOS-XL vocabulary is the set of URIs given in the left-hand column of the table below.

<table border="0" class="vocab"><caption>Table 2. The SKOS-XL Vocabulary</caption><tbody><tr><th>URI</th><th>Defined by (section of this appendix)</th></tr><tr><td><code>skosxl:Label</code></td><td><a href="#xl-Label">The skosxl:Label Class</a></td></tr><tr><td><code>skosxl:literalForm</code></td><td><a href="#xl-Label">The skosxl:Label Class</a></td></tr><tr><td><code>skosxl:prefLabel</code></td><td><a href="#xl-labels">Preferred, Alternate and Hidden skosxl:Labels</a></td></tr><tr><td><code>skosxl:altLabel</code></td><td><a href="#xl-labels">Preferred, Alternate and Hidden skosxl:Labels</a></td></tr><tr><td><code>skosxl:hiddenLabel</code></td><td><a href="#xl-labels">Preferred, Alternate and Hidden skosxl:Labels</a></td></tr><tr><td><code>skosxl:labelRelation</code></td><td><a href="#xl-label-relations">Links Between skosxl:Labels</a></td></tr></tbody></table>

Here "the SKOS-XL vocabulary" refers to the union of the SKOS vocabulary and the SKOS-XL vocabulary.

Here "the XL data model" refers to the class and property definitions stated in this appendix only. "The SKOS+XL data model" refers to the union of the data model defined in sections 3-10 above and the XL data model.

### B.2. The skosxl:Label Class

#### B.2.1. Preamble

The class `skosxl:Label` is a special class of lexical entities.

An instance of the class `skosxl:Label` is a resource and may be named with a URI.

An instance of the class `skosxl:Label` has a single literal form. This literal form is an RDF plain literal (which is a string of UNICODE characters and an optional language tag \[[RDF-CONCEPTS](#ref-RDF-CONCEPTS)\]). The property `skosxl:literalForm` is used to give the literal form of an `skosxl:Label`.

If two instances of the class `skosxl:Label` have the same literal form, they are **not** necessarily the same resource.

#### B.2.2. Class and Property Definitions

<table border="0" class="semantics"><caption></caption><tbody><tr><td id="S47">S47</td><td><code>skosxl:Label</code> is an instance of <code>owl:Class</code>.</td></tr><tr><td id="S48">S48</td><td><code>skosxl:Label</code> is disjoint with each of <code>skos:Concept</code>, <code>skos:ConceptScheme</code> and <code>skos:Collection</code>.</td></tr><tr><td id="S49">S49</td><td><code>skosxl:literalForm</code> is an instance of <code>owl:DatatypeProperty</code>.</td></tr><tr><td id="S50">S50</td><td>The <code>rdfs:domain</code> of <code>skosxl:literalForm</code> is the class <code>skosxl:Label</code>.</td></tr><tr><td id="S51">S51</td><td>The <code>rdfs:range</code> of <code>skosxl:literalForm</code> is the class of RDF plain literals.</td></tr><tr><td id="S52">S52</td><td><code>skosxl:Label</code> is a sub-class of a restriction on <code>skosxl:literalForm</code> cardinality exactly 1.</td></tr></tbody></table>

#### B.2.3. Examples

The example below describes a `skosxl:Label` named with the URI `<http://example.com/ns/A>`, with the literal form "love" in English.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-75">Example 75 (consistent)</th></tr><tr><td><div>&lt;A&gt; rdf:type skosxl:Label ; skosxl:literalForm "love"@en .</div></td></tr></tbody></table>

The four examples below are each **not consistent** with the XL data model, because an `skosxl:Label` is described with two different literal forms.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-76">Example 76 (not consistent)</th></tr><tr><td><div>&lt;B&gt; rdf:type skosxl:Label ; skosxl:literalForm "love" ; skosxl:literalForm "adoration" .<br></div></td></tr></tbody></table>

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-77">Example 77 (not consistent)</th></tr><tr><td><div>&lt;B&gt; rdf:type skosxl:Label ; skosxl:literalForm "love"@en ; skosxl:literalForm "love"@fr .<br></div></td></tr></tbody></table>

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-78">Example 78 (not consistent)</th></tr><tr><td><div>&lt;B&gt; rdf:type skosxl:Label ; skosxl:literalForm "love"@en-GB ; skosxl:literalForm "love"@en-US .<br></div></td></tr></tbody></table>

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-79">Example 79 (not consistent)</th></tr><tr><td><div>&lt;B&gt; rdf:type skosxl:Label ; skosxl:literalForm "東"@ja-Hani ; skosxl:literalForm "ひがし"@ja-Hira .<br></div></td></tr></tbody></table>

#### B.2.4. Notes

##### B.2.4.1. Identity and Entailment

As stated above, each instance of the class `skosxl:Label` has **one and only one literal form**. In other words, there is a function mapping the class extension of `skosxl:Label` to the set of RDF plain literals. This function is defined by the property extension of `skosxl:literalForm`. Note especially two facts about this function.

First, the function is **not** injective. In other words, there is **not** a one-to-one mapping from instances of `skosxl:Label` to the set of RDF plain literals (in fact it is many-to-one). This means that two instances of `skosxl:Label` which have the same literal form are **not necessarily** the same individual. So, for example, the entailment illustrated below is **not** supported by the XL data model.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-80">Example 80 (non-entailment)</th></tr><tr><td><div>&lt;A&gt; skosxl:literalForm "love"@en .<br>&lt;B&gt; skosxl:literalForm "love"@en .</div><p><em>does not entail</em></p><div>&lt;A&gt; owl:sameAs &lt;B&gt; .</div></td></tr></tbody></table>

Second, the function is **not** surjective. In other words, for a given plain literal `l`, there might not be any instances of `skosxl:Label` with literal form `l`.

##### B.2.4.2. Membership of Concept Schemes

The membership of an instance of `skosxl:Label` within a SKOS concept scheme can be asserted using the `skos:inScheme` property.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-81">Example 81 (consistent)</th></tr><tr><td><div>&lt;A&gt; rdf:type skosxl:Label ; skosxl:literalForm "love"@en ; skos:inScheme &lt;MyScheme&gt; .</div></td></tr></tbody></table>

### B.3. Preferred, Alternate and Hidden skosxl:Labels

#### B.3.1. Preamble

The three properties `skosxl:prefLabel`, `skosxl:altLabel` and `skosxl:hiddenLabel` are used to give the preferred, alternative and hidden labels of a resource respectively, where those labels are instances of the class `skosxl:Label`. These properties are analogous to the properties of the same local name defined in the SKOS vocabulary, and there are logical dependencies between these two sets of properties defined below.

#### B.3.2. Class and Property Definitions

<table border="0" class="semantics"><caption></caption><tbody><tr><td id="S53">S53</td><td><code>skosxl:prefLabel</code>, <code>skosxl:altLabel</code> and <code>skosxl:hiddenLabel</code> are each instances of <code>owl:ObjectProperty</code>.</td></tr><tr><td id="S54">S54</td><td>The <code>rdfs:range</code> of each of <code>skosxl:prefLabel</code>, <code>skosxl:altLabel</code> and <code>skosxl:hiddenLabel</code> is the class <code>skosxl:Label</code>.</td></tr><tr><td id="S55">S55</td><td>The property chain (<code>skosxl:prefLabel</code>, <code>skosxl:literalForm</code>) is a sub-property of <code>skos:prefLabel</code>.</td></tr><tr><td id="S56">S56</td><td>The property chain (<code>skosxl:altLabel</code>, <code>skosxl:literalForm</code>) is a sub-property of <code>skos:altLabel</code>.</td></tr><tr><td id="S57">S57</td><td>The property chain (<code>skosxl:hiddenLabel</code>, <code>skosxl:literalForm</code>) is a sub-property of <code>skos:hiddenLabel</code>.</td></tr><tr><td id="S58">S58</td><td><code>skosxl:prefLabel</code>, <code>skosxl:altLabel</code> and <code>skosxl:hiddenLabel</code> are pairwise disjoint properties.</td></tr></tbody></table>

#### B.3.3. Examples

The example below illustrates the use of all three XL labeling properties, and is consistent with the SKOS+XL data model.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-82">Example 82 (consistent)</th></tr><tr><td><div>&lt;Love&gt;<br>&nbsp;&nbsp;skosxl:prefLabel &lt;A&gt; ;<br>&nbsp;&nbsp;skosxl:altLabel &lt;B&gt; ;<br>&nbsp;&nbsp;skosxl:hiddenLabel &lt;C&gt; .<br><br>&lt;A&gt; rdf:type skosxl:Label ;<br>&nbsp;&nbsp;skosxl:literalForm "love"@en .<br><br>&lt;B&gt; rdf:type skosxl:Label ;<br>&nbsp;&nbsp;skosxl:literalForm "adoration"@en .<br><br>&lt;C&gt; rdf:type skosxl:Label&nbsp;;<br>&nbsp;&nbsp;skosxl:literalForm "luv"@en .</div></td></tr></tbody></table>

#### B.3.4. Notes

##### B.3.4.1. Dumbing-Down to SKOS Lexical Labels

The sub-property chain axioms [S55](#S55), [S56](#S56) and [S57](#S57) support the dumbing-down of XL labels to vanilla SKOS lexical labels via inference. This is illustrated in the example below.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-83">Example 83 (entailment)</th></tr><tr><td><div>&lt;Love&gt;<br>&nbsp;&nbsp;skosxl:prefLabel &lt;A&gt; ;<br>&nbsp;&nbsp;skosxl:altLabel &lt;B&gt; ;<br>&nbsp;&nbsp;skosxl:hiddenLabel &lt;C&gt; .<br><br>&lt;A&gt; rdf:type skosxl:Label ;<br>&nbsp;&nbsp;skosxl:literalForm "love"@en .<br><br>&lt;B&gt; rdf:type skosxl:Label ;<br>&nbsp;&nbsp;skosxl:literalForm "adoration"@en .<br><br>&lt;C&gt; rdf:type skosxl:Label&nbsp;;<br>&nbsp;&nbsp;skosxl:literalForm "luv"@en .</div><p><em>entails</em></p><div>&lt;Love&gt;<br>&nbsp;&nbsp;skos:prefLabel "love"@en ;<br>&nbsp;&nbsp;skos:altLabel "adoration"@en ;<br>&nbsp;&nbsp;skos:hiddenLabel "luv"@en .</div></td></tr></tbody></table>

##### B.3.4.2. SKOS+XL Labeling Integrity

In [Section 5](#labels), two integrity conditions were defined on the basic SKOS labeling properties. First, the properties `skos:prefLabel`, `skos:altLabel` and `skos:hiddenLabel` are pairwise disjoint. Second, a resource has no more than one value of `skos:prefLabel` per language. Because of the sub-property chain axioms defined above, the following four examples, whilst consistent w.r.t. the XL data model alone, are **not** consistent with the SKOS+XL data model.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-84">Example 84 (not consistent)</th></tr><tr><td><div># Two different preferred labels in the same language<br><br>&lt;Love&gt; skosxl:prefLabel &lt;A&gt; ; skosxl:prefLabel &lt;B&gt; .<br>&lt;A&gt; skosxl:literalForm "love"@en .<br>&lt;B&gt; skosxl:literalForm "adoration"@en .<br></div></td></tr></tbody></table>

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-85">Example 85 (not consistent)</th></tr><tr><td><div># Clash between preferred and alternative labels<br><br>&lt;Love&gt; skosxl:prefLabel &lt;A&gt; ; skosxl:altLabel &lt;B&gt; .<br>&lt;A&gt; skosxl:literalForm "love"@en .<br>&lt;B&gt; skosxl:literalForm "love"@en .<br></div></td></tr></tbody></table>

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-86">Example 86 (not consistent)</th></tr><tr><td><div># Clash between alternative and hidden labels<br><br>&lt;Love&gt; skosxl:altLabel &lt;A&gt; ; skosxl:hiddenLabel &lt;B&gt; .<br>&lt;A&gt; skosxl:literalForm "love"@en .<br>&lt;B&gt; skosxl:literalForm "love"@en .<br></div></td></tr></tbody></table>

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-87">Example 87 (not consistent)</th></tr><tr><td><div># Clash between preferred and hidden labels<br><br>&lt;Love&gt; skosxl:prefLabel &lt;A&gt; ; skosxl:hiddenLabel &lt;B&gt; .<br>&lt;A&gt; skosxl:literalForm "love"@en .<br>&lt;B&gt; skosxl:literalForm "love"@en .<br></div></td></tr></tbody></table>

### B.4. Links Between skosxl:Labels

#### B.4.1. Preamble

This section defines a pattern for representing binary links between instances of the class `skosxl:Label`.

Note that the vocabulary defined in this section is not intended to be used directly, but rather as an extension point which can be refined for more specific labeling scenarios.

#### B.4.2. Class and Property Definitions

<table border="0" class="semantics"><caption></caption><tbody><tr><td id="S59">S59</td><td><code>skosxl:labelRelation</code> is an instance of <code>owl:ObjectProperty</code>.</td></tr><tr><td id="S60">S60</td><td>The <code>rdfs:domain</code> of <code>skosxl:labelRelation</code> is the class <code>skosxl:Label</code>.</td></tr><tr><td id="S61">S61</td><td>The <code>rdfs:range</code> of <code>skosxl:labelRelation</code> is the class <code>skosxl:Label</code>.</td></tr><tr><td id="S62">S62</td><td><code>skosxl:labelRelation</code> is an instance of <code>owl:SymmetricProperty</code>.</td></tr></tbody></table>

#### B.4.3. Examples

The example below illustrates a link between two instances of the class `skosxl:Label`.

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-88">Example 88 (consistent)</th></tr><tr><td><div>&lt;A&gt; rdf:type skosxl:Label ; skosxl:literalForm "love" .<br>&lt;B&gt; rdf:type skosxl:Label ; skosxl:literalForm "adoration" .<br>&lt;A&gt; skosxl:labelRelation &lt;B&gt; .<br></div></td></tr></tbody></table>

#### B.4.4. Notes

##### B.4.4.1. Refinements of this Pattern

As mentioned above, the `skosxl:labelRelation` property serves as an extension point, which can be refined for more specific labeling scenarios.

In the example below, a third party has refined the property `skos:labelRelation` to express acronym relationships, and used it to express the fact that "FAO" is an acronym for "Food and Agriculture Organization".

<table border="0" class="example-good"><caption></caption><tbody><tr><th id="example-89">Example 89 (consistent)</th></tr><tr><td><div># First define an extension to skosxl:labelRelation<br>ex:acronym rdfs:subPropertyOf skosxl:labelRelation .<br><br># Now use it<br>&lt;A&gt; rdf:type skosxl:Label ; skosxl:literalForm "FAO"@en .<br>&lt;B&gt; rdf:type skosxl:Label ; skosxl:literalForm "Food and Agriculture Organization"@en .<br>&lt;B&gt; ex:acronym &lt;A&gt; .<br></div></td></tr></tbody></table>

Note that a sub-property of a symmetric property is not necessarily symmetric.

### B.5. SKOS-XL Schema Overview

The following table gives an overview of the SKOS-XL vocabulary.

### B.5.1 Classes in the SKOS-XL Data Model

<table class="quick-reference"><caption></caption><colgroup><col class="quick-ref-key"><col class="quick-ref-value"></colgroup><tbody><tr><th colspan="2"><a href="#Label" id="Label" name="Label">skosxl:Label</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2008/05/skos-xl#Label</code></td></tr><tr><td>Definition:</td><td><a href="https://www.w3.org/TR/skos-reference#xl-Label">Section B.2. The skosxl:Label Class</a></td></tr><tr><td>Label:</td><td><em>Label</em></td></tr><tr><td>Super-classes:</td><td>restriction on <code><a href="#xl-literalForm">skosxl:literalForm</a></code> cardinality exactly 1</td></tr><tr><td>Disjoint classes:</td><td><code><a href="https://www.w3.org/2008/05/skos#Collection">skos:Collection</a></code><br><code><a href="https://www.w3.org/2008/05/skos#Concept">skos:Concept</a></code><br><code><a href="https://www.w3.org/2008/05/skos#ConceptScheme">skos:ConceptScheme</a></code><br></td></tr></tbody></table>

### B.5.2.Properties in the SKOS-XL Data Model

<table class="quick-reference"><caption></caption><colgroup><col class="quick-ref-key"><col class="quick-ref-value"></colgroup><tbody><tr><th colspan="2"><a href="#xl-altLabel" id="xl-altLabel" name="xl-altLabel">skosxl:altLabel</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2008/05/skos-xl#altLabel</code></td></tr><tr><td>Definition:</td><td><a href="https://www.w3.org/TR/skos-reference#xl-labels">Section B.3. Preferred, Alternate and Hidden skosxl:Labels</a></td></tr><tr><td>Label:</td><td><em>alternative label</em></td></tr><tr><td>Range:</td><td><code><a href="#xl-Label">skosxl:Label</a></code><br></td></tr><tr><th colspan="2"><a href="#xl-hiddenLabel" id="xl-hiddenLabel" name="xl-hiddenLabel">skosxl:hiddenLabel</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2008/05/skos-xl#hiddenLabel</code></td></tr><tr><td>Definition:</td><td><a href="https://www.w3.org/TR/skos-reference#xl-labels">Section B.3. Preferred, Alternate and Hidden skosxl:Labels</a></td></tr><tr><td>Label:</td><td><em>hidden label</em></td></tr><tr><td>Range:</td><td><code><a href="#xl-Label">skosxl:Label</a></code><br></td></tr><tr><th colspan="2"><a href="#xl-labelRelation" id="xl-labelRelation" name="xl-labelRelation">skosxl:labelRelation</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2008/05/skos-xl#labelRelation</code></td></tr><tr><td>Definition:</td><td><a href="https://www.w3.org/TR/skos-reference#xl-label-relations">Section B.4. Links Between skosxl:Labels</a></td></tr><tr><td>Label:</td><td><em>label relation</em></td></tr><tr><td>Domain:</td><td><code><a href="#xl-Label">skosxl:Label</a></code><br></td></tr><tr><td>Range:</td><td><code><a href="#xl-Label">skosxl:Label</a></code><br></td></tr><tr><td>Other characteristics:</td><td>Symmetric<br></td></tr><tr><th colspan="2"><a href="#xl-literalForm" id="xl-literalForm" name="xl-literalForm">skosxl:literalForm</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2008/05/skos-xl#literalForm</code></td></tr><tr><td>Definition:</td><td><a href="https://www.w3.org/TR/skos-reference#xl-Label">Section B.2. The skosxl:Label Class</a></td></tr><tr><td>Label:</td><td><em>literal form</em></td></tr><tr><td>Domain:</td><td><code><a href="#xl-Label">skosxl:Label</a></code><br></td></tr><tr><th colspan="2"><a href="#xl-prefLabel" id="xl-prefLabel" name="xl-prefLabel">skosxl:prefLabel</a></th></tr><tr><td>URI:</td><td><code>http://www.w3.org/2008/05/skos-xl#prefLabel</code></td></tr><tr><td>Definition:</td><td><a href="https://www.w3.org/TR/skos-reference#xl-labels">Section B.3. Preferred, Alternate and Hidden skosxl:Labels</a></td></tr><tr><td>Label:</td><td><em>preferred label</em></td></tr><tr><td>Range:</td><td><code><a href="#xl-Label">skosxl:Label</a></code><br></td></tr></tbody></table>

---

## Appendix C. SKOS and SKOS-XL Namespace Documents

Following Architecture of the World Wide Web, Volume One \[[WEBARCH](#ref-WEBARCH)\], a "namespace document" is an "information resource that contains useful information, machine-usable and/or human-usable, about terms in the namespace".

The SKOS vocabulary is a conceptual resource identified by the namespace URI `[http://www.w3.org/2004/02/skos/core#](https://www.w3.org/TR/skos-reference/)`. The normative definition of the SKOS vocabulary is found in SKOS Reference (this document).

The following namespace documents provide alternative representations of the SKOS vocabulary:

### C.1. SKOS Namespace Document - HTML Variant (normative)

The SKOS vocabulary is summarized in SKOS Namespace Document - HTML Variant \[[SKOS-HTML](#ref-SKOS-HTML)\], which is served from the namespace URI `[http://www.w3.org/2004/02/skos/core#](https://www.w3.org/2004/02/skos/core#)` via content negotiation using Recipe 3 of "Best Practice Recipes for Publishing Vocabularies" \[[RECIPES](#ref-RECIPES)\]. Clients requiring HTML or XHTML should include an appropriate "Accept" header in the HTTP request. Alternatively, the SKOS Namespace Document - HTML Variant can be referenced directly by citing its URI: `[http://www.w3.org/TR/skos-reference/skos.html](https://www.w3.org/TR/skos-reference/skos.html)`.

The SKOS Namespace Document - HTML Variant replicates [Appendix A. SKOS Properties and Classes](#overview) of this document.

### C.2. SKOS Namespace Document - RDF/XML Variant (normative)

The SKOS Namespace Document - RDF/XML Variant \[[SKOS-RDF](#ref-SKOS-RDF)\] expresses the SKOS vocabulary and data model (in so far as possible) as RDF triples. It is served via content negotiation using Recipe 3 of "Best Practice Recipes for Publishing Vocabularies" \[[RECIPES](#ref-RECIPES)\]. Clients requiring RDF/XML should include an appropriate "Accept" header in the HTTP request. Alternatively, the RDF schema can be referenced directly (and downloaded) by citing its URI: `[http://www.w3.org/TR/skos-reference/skos.rdf](https://www.w3.org/TR/skos-reference/skos.rdf)`.

It is not possible to express all of the statements of the SKOS data model as RDF triples, so this schema forms a normative subset of SKOS Reference. The RDF schema defines an OWL Full ontology \[[OWL-SEMANTICS](#ref-OWL-SEMANTICS)\] \[[OWL-REFERENCE](#ref-OWL-REFERENCE)\]. SKOS vocabularies can be defined as instances of this ontology.

### C.3. SKOS RDF Schema - OWL 1 DL Sub-set (informative)

For the convenience of tools and applications that wish to work within the constraints of OWL DL, the SKOS RDF Schema - OWL 1 DL Sub-set \[[SKOS-RDF-OWL1-DL](#ref-SKOS-RDF-OWL1-DL)\] provides a modified, informative, schema which conforms to those constraints. Note that this schema is obtained through the deletion of triples representing axioms that violate OWL DL constraints. Alternative prunings could be performed.

The SKOS OWL 1 DL Sub-set is available by citing its URI: `[http://www.w3.org/TR/skos-reference/skos-owl1-dl.rdf](https://www.w3.org/TR/skos-reference/skos-owl1-dl.rdf)`

### C.4. SKOS-XL Namespace Document - HTML Variant (normative)

The SKOS-XL vocabulary is summarized in SKOS-XL Namespace Document - HTML Variant \[[SKOS-XL-HTML](#ref-SKOS-XL-HTML)\], which is served from the namespace URI `[http://www.w3.org/2008/05/skos-xl#](https://www.w3.org/2008/05/skos-xl#)` via content negotiation using Recipe 3 of "Best Practice Recipes for Publishing Vocabularies" \[[RECIPES](#ref-RECIPES)\]. Clients requiring HTML or XHTML should include an appropriate "Accept" header in the HTTP request. Alternatively, the SKOS-XL Namespace Document - HTML Variant can be referenced directly by citing its URI: `[http://www.w3.org/TR/skos-reference/skos-xl.html](https://www.w3.org/TR/skos-reference/skos-xl.html)`.

The SKOS-XL HTML Variant Namespace Document replicates [Appendix B.5 SKOS-XL Schema Overview](#xl-overview) of this document.

### C.5. SKOS-XL Namespace Document - RDF/XML Variant (normative)

This RDF schema document expresses the SKOS vocabulary and data model (in so far as possible) as RDF triples. It is served from the namespace URI `[http://www.w3.org/2008/05/skos-xl#](https://www.w3.org/2008/05/skos-xl#)` via content negotiation using Recipe 3 of "Best Practice Recipes for Publishing Vocabularies" \[[RECIPES](#ref-RECIPES)\]. Clients requiring RDF/XML should include an appropriate "Accept" header in the HTTP request. Alternatively, the RDF schema can be referenced directly (and downloaded) by citing its URI: `[http://www.w3.org/TR/skos-reference/skos-xl.rdf](https://www.w3.org/TR/skos-reference/skos-xl.rdf)`.

---

## Appendix D. SKOS Namespace: a historical note

The SKOS schema defines vocabulary using the namespace [http://www.w3.org/2004/02/skos/core#](https://www.w3.org/2004/02/skos/core#). This namespace was used to define the original SKOS schema which served as a starting point for this Recommendation. As a result of this, elements present in previous versions of the machine-readable schema have been removed from the current version. In a number of cases, the definition or semantics of elements in the schema has changed.

Retaining the existing SKOS namespace avoids some issues with existing KOS that are already using the SKOS schema. Users should, however, be aware of the change in the semantics of `skos:broader` (and `skos:narrower`) which _may_ impact on SKOS applications.

Where elements have been removed, no explicit deprecation axioms have been expressed in the schema. Historical versions of the SKOS schema, are, however, available from the [SKOS Web site "version history" page](https://www.w3.org/2004/02/skos/history), and those elements which have been removed from the recent version of the vocabulary are listed below.

-   `skos:symbol`
-   `skos:prefSymbol`
-   `skos:altSymbol`
-   `skos:CollectableProperty`
-   `skos:subject`
-   `skos:isSubjectOf`
-   `skos:primarySubject`
-   `skos:isPrimarySubjectOf`
-   `skos:subjectIndicator`

In the case of `skos:broader` and `skos:narrower`, the semantics of the vocabulary elements have been changed — these properties are no longer declared to be transitive. Thus the follow entailment does not hold.

<table border="0" class="example-bad"><caption></caption><tbody><tr><th id="example-90">Example 90 (non-entailment)</th></tr><tr><td><div>&lt;A&gt; skos:broader &lt;B&gt; .<br>&lt;B&gt; skos:broader &lt;C&gt; .</div><p><em>does not entail</em></p><div>&lt;A&gt; skos:broader &lt;C&gt; .</div></td></tr></tbody></table>

A transitive super property of `skos:broader` — `skos:broaderTransitive` — is provided which allows for query across the transitive closure of `skos:broader` relations. A similar property — `skos:narrowerTransitive` — is provided for query across the transitive closure of `skos:narrower`.

---

[![Valid XHTML + RDFa](https://www.w3.org/Icons/valid-xhtml-rdfa-blue)](http://validator.w3.org/check?uri=referer)
