<!--
  ⚠ THIRD-PARTY SPECIFICATION — NOT AN ORIGINAL WORK OF THIS PROJECT.
  Title:     OWL 2 — Structural Specification and Functional-Style Syntax (2nd Ed.)
  Source:    https://www.w3.org/TR/owl2-syntax/
  Publisher: W3C
  License:   W3C Document License 2023 (https://www.w3.org/copyright/document-license-2023/)
  Retrieved: 2026-06-16
  Reproduced verbatim for offline reference and AI-agent context. The
  publisher's original copyright and license apply. Do not hand-edit —
  refresh from source (see docs/specs/references/README.md).
-->

> **Third-party specification — reproduced for offline reference and AI-agent context.**
> **Title:** OWL 2 — Structural Specification and Functional-Style Syntax (2nd Ed.)  
> **Status:** W3C Recommendation  
> **Source:** <https://www.w3.org/TR/owl2-syntax/>  
> **Publisher:** W3C  
> **License:** W3C Document License 2023 — <https://www.w3.org/copyright/document-license-2023/>  
> **Retrieved:** 2026-06-16  
> The publisher's original copyright and license apply. Do not hand-edit;
> refresh from source — see [README](./README.md).

---

OWL 2 Web Ontology Language Structural Specification and Functional-Style Syntax (Second Edition)   

[![W3C](https://www.w3.org/Icons/w3c_home)](https://www.w3.org/)

# OWL 2 Web Ontology Language  
Structural Specification and Functional-Style Syntax (Second Edition)

## W3C Recommendation 11 December 2012

This version:

[http://www.w3.org/TR/2012/REC-owl2-syntax-20121211/](https://www.w3.org/TR/2012/REC-owl2-syntax-20121211/)

Latest version (series 2):

[http://www.w3.org/TR/owl2-syntax/](https://www.w3.org/TR/owl2-syntax/)

Latest Recommendation:

[http://www.w3.org/TR/owl-syntax](https://www.w3.org/TR/owl-syntax)

Previous version:

[http://www.w3.org/TR/2012/PER-owl2-syntax-20121018/](https://www.w3.org/TR/2012/PER-owl2-syntax-20121018/)

Editors:

[Boris Motik](http://www.cs.ox.ac.uk/people/boris.motik/), University of Oxford

Peter F. Patel-Schneider, Nuance Communications

[Bijan Parsia](http://www.cs.man.ac.uk/~bparsia/), University of Manchester

Contributors: (in alphabetical order)

Conrad Bock, National Institute of Standards and Technology (NIST)

[Achille Fokoue](http://domino.research.ibm.com/comm/research_people.nsf/pages/achille.index.html), IBM Corporation

[Peter Haase](http://peterhaase.org/), FZI Research Center for Information Technology

[Rinke Hoekstra](http://www.leibnizcenter.org/~hoekstra/), University of Amsterdam

[Ian Horrocks](http://www.cs.ox.ac.uk/people/ian.horrocks/), University of Oxford

[Alan Ruttenberg](http://sciencecommons.org/about/whoweare/ruttenberg/), Science Commons (Creative Commons)

[Uli Sattler](http://www.cs.man.ac.uk/~sattler/), University of Manchester

[Michael Smith](http://www.clarkparsia.com/about/profiles/msmith), Clark & Parsia

Please refer to the [**errata**](https://www.w3.org/2007/OWL/errata) for this document, which may include some normative corrections.

A [color-coded version of this document showing changes made since the previous version](https://www.w3.org/TR/2012/REC-owl2-syntax-20121211/diff-from-20121018) is also available.

This document is also available in these non-normative formats: [PDF version](https://www.w3.org/2012/pdf/REC-owl2-syntax-20121211.pdf).

See also [translations](https://www.w3.org/2007/OWL/translation/owl2-syntax).

[Copyright](https://www.w3.org/Consortium/Legal/ipr-notice#Copyright) © 2012 [W3C](https://www.w3.org/)® ([MIT](http://www.csail.mit.edu/), [ERCIM](http://www.ercim.eu/), [Keio](http://www.keio.ac.jp/)), All Rights Reserved. W3C [liability](https://www.w3.org/Consortium/Legal/ipr-notice#Legal_Disclaimer), [trademark](https://www.w3.org/Consortium/Legal/ipr-notice#W3C_Trademarks) and [document use](https://www.w3.org/Consortium/Legal/copyright-documents) rules apply.

---

## Abstract

The OWL 2 Web Ontology Language, informally OWL 2, is an ontology language for the Semantic Web with formally defined meaning. OWL 2 ontologies provide classes, properties, individuals, and data values and are stored as Semantic Web documents. OWL 2 ontologies can be used along with information written in RDF, and OWL 2 ontologies themselves are primarily exchanged as RDF documents. The OWL 2 [Document Overview](https://www.w3.org/TR/2012/REC-owl2-overview-20121211/ "Document Overview") describes the overall state of OWL 2, and should be read before other OWL 2 documents.

The meaningful constructs provided by OWL 2 are defined in terms of their structure. As well, a functional-style syntax is defined for these constructs, with examples and informal descriptions. One can reason with OWL 2 ontologies under either the RDF-Based Semantics \[[OWL 2 RDF-Based Semantics](#ref-owl-2-rdf-semantics)\] or the Direct Semantics \[[OWL 2 Direct Semantics](#ref-owl-2-direct-semantics)\]. If certain restrictions on OWL 2 ontologies are satisfied and the ontology is in OWL 2 DL, reasoning under the Direct Semantics can be implemented using techniques well known in the literature.

## Status of this Document

#### May Be Superseded

_This section describes the status of this document at the time of its publication. Other documents may supersede this document. A list of current W3C publications and the latest revision of this technical report can be found in the [W3C technical reports index](https://www.w3.org/TR/) at http://www.w3.org/TR/._

#### Summary of Changes

There have been no [substantive](https://www.w3.org/2005/10/Process-20051014/tr#substantive-change) changes since the [previous version](https://www.w3.org/TR/2012/PER-owl2-syntax-20121018/). For details on the minor changes see the [change log](#changelog) and [color-coded diff](https://www.w3.org/TR/2012/REC-owl2-syntax-20121211/diff-from-20121018).

#### Please Send Comments

Please send any comments to [public-owl-comments@w3.org](mailto:public-owl-comments@w3.org) ([public archive](http://lists.w3.org/Archives/Public/public-owl-comments/)). Although work on this document by the [OWL Working Group](https://www.w3.org/2007/OWL/) is complete, comments may be addressed in the [errata](https://www.w3.org/2007/OWL/errata) or in future revisions. Open discussion among developers is welcome at [public-owl-dev@w3.org](mailto:public-owl-dev@w3.org) ([public archive](http://lists.w3.org/Archives/Public/public-owl-dev/)).

#### Endorsed By W3C

_This document has been reviewed by W3C Members, by software developers, and by other W3C groups and interested parties, and is endorsed by the Director as a W3C Recommendation. It is a stable document and may be used as reference material or cited from another document. W3C's role in making the Recommendation is to draw attention to the specification and to promote its widespread deployment. This enhances the functionality and interoperability of the Web._

#### Patents

_This document was produced by a group operating under the [5 February 2004 W3C Patent Policy](https://www.w3.org/Consortium/Patent-Policy-20040205/). W3C maintains a [public list of any patent disclosures](https://www.w3.org/2004/01/pp-impl/41712/status) made in connection with the deliverables of the group; that page also includes instructions for disclosing a patent._

---

<table class="toc" id="toc" summary="Contents"><tbody><tr><td><div id="toctitle"><h2>Table of Contents</h2></div><ul><li class="toclevel-1"><a href="#Introduction"><span class="tocnumber">1</span> <span class="toctext">Introduction</span></a></li><li class="toclevel-1"><a href="#Preliminary_Definitions"><span class="tocnumber">2</span> <span class="toctext">Preliminary Definitions</span></a><ul><li class="toclevel-2"><a href="#Structural_Specification"><span class="tocnumber">2.1</span> <span class="toctext">Structural Specification</span></a></li><li class="toclevel-2"><a href="#BNF_Notation"><span class="tocnumber">2.2</span> <span class="toctext">BNF Notation</span></a></li><li class="toclevel-2"><a href="#Integers.2C_Characters.2C_Strings.2C_Language_Tags.2C_and_Node_IDs"><span class="tocnumber">2.3</span> <span class="toctext">Integers, Characters, Strings, Language Tags, and Node IDs</span></a></li><li class="toclevel-2"><a href="#IRIs"><span class="tocnumber">2.4</span> <span class="toctext">IRIs</span></a></li></ul></li><li class="toclevel-1"><a href="#Ontologies"><span class="tocnumber">3</span> <span class="toctext">Ontologies</span></a><ul><li class="toclevel-2"><a href="#Ontology_IRI_and_Version_IRI"><span class="tocnumber">3.1</span> <span class="toctext">Ontology IRI and Version IRI</span></a></li><li class="toclevel-2"><a href="#Ontology_Documents"><span class="tocnumber">3.2</span> <span class="toctext">Ontology Documents</span></a></li><li class="toclevel-2"><a href="#Versioning_of_OWL_2_Ontologies"><span class="tocnumber">3.3</span> <span class="toctext">Versioning of OWL 2 Ontologies</span></a></li><li class="toclevel-2"><a href="#Imports"><span class="tocnumber">3.4</span> <span class="toctext">Imports</span></a></li><li class="toclevel-2"><a href="#Ontology_Annotations"><span class="tocnumber">3.5</span> <span class="toctext">Ontology Annotations</span></a></li><li class="toclevel-2"><a href="#Canonical_Parsing_of_OWL_2_Ontologies"><span class="tocnumber">3.6</span> <span class="toctext">Canonical Parsing of OWL 2 Ontologies</span></a></li><li class="toclevel-2"><a href="#Functional-Style_Syntax"><span class="tocnumber">3.7</span> <span class="toctext">Functional-Style Syntax</span></a></li></ul></li><li class="toclevel-1"><a href="#Datatype_Maps"><span class="tocnumber">4</span> <span class="toctext">Datatype Maps</span></a><ul><li class="toclevel-2"><a href="#Real_Numbers.2C_Decimal_Numbers.2C_and_Integers"><span class="tocnumber">4.1</span> <span class="toctext">Real Numbers, Decimal Numbers, and Integers</span></a></li><li class="toclevel-2"><a href="#Floating-Point_Numbers"><span class="tocnumber">4.2</span> <span class="toctext">Floating-Point Numbers</span></a></li><li class="toclevel-2"><a href="#Strings"><span class="tocnumber">4.3</span> <span class="toctext">Strings</span></a></li><li class="toclevel-2"><a href="#Boolean_Values"><span class="tocnumber">4.4</span> <span class="toctext">Boolean Values</span></a></li><li class="toclevel-2"><a href="#Binary_Data"><span class="tocnumber">4.5</span> <span class="toctext">Binary Data</span></a></li><li class="toclevel-2"><a href="#IRIs_2"><span class="tocnumber">4.6</span> <span class="toctext">IRIs</span></a></li><li class="toclevel-2"><a href="#Time_Instants"><span class="tocnumber">4.7</span> <span class="toctext">Time Instants</span></a></li><li class="toclevel-2"><a href="#XML_Literals"><span class="tocnumber">4.8</span> <span class="toctext">XML Literals</span></a></li></ul></li><li class="toclevel-1"><a href="#Entities.2C_Literals.2C_and_Anonymous_Individuals"><span class="tocnumber">5</span> <span class="toctext">Entities, Literals, and Anonymous Individuals</span></a><ul><li class="toclevel-2"><a href="#Classes"><span class="tocnumber">5.1</span> <span class="toctext">Classes</span></a></li><li class="toclevel-2"><a href="#Datatypes"><span class="tocnumber">5.2</span> <span class="toctext">Datatypes</span></a></li><li class="toclevel-2"><a href="#Object_Properties"><span class="tocnumber">5.3</span> <span class="toctext">Object Properties</span></a></li><li class="toclevel-2"><a href="#Data_Properties"><span class="tocnumber">5.4</span> <span class="toctext">Data Properties</span></a></li><li class="toclevel-2"><a href="#Annotation_Properties"><span class="tocnumber">5.5</span> <span class="toctext">Annotation Properties</span></a></li><li class="toclevel-2"><a href="#Individuals"><span class="tocnumber">5.6</span> <span class="toctext">Individuals</span></a><ul><li class="toclevel-3"><a href="#Named_Individuals"><span class="tocnumber">5.6.1</span> <span class="toctext">Named Individuals</span></a></li><li class="toclevel-3"><a href="#Anonymous_Individuals"><span class="tocnumber">5.6.2</span> <span class="toctext">Anonymous Individuals</span></a></li></ul></li><li class="toclevel-2"><a href="#Literals"><span class="tocnumber">5.7</span> <span class="toctext">Literals</span></a></li><li class="toclevel-2"><a href="#Entity_Declarations_and_Typing"><span class="tocnumber">5.8</span> <span class="toctext">Entity Declarations and Typing</span></a><ul><li class="toclevel-3"><a href="#Typing_Constraints_of_OWL_2_DL"><span class="tocnumber">5.8.1</span> <span class="toctext">Typing Constraints of OWL 2 DL</span></a></li><li class="toclevel-3"><a href="#Declaration_Consistency"><span class="tocnumber">5.8.2</span> <span class="toctext">Declaration Consistency</span></a></li></ul></li><li class="toclevel-2"><a href="#Metamodeling"><span class="tocnumber">5.9</span> <span class="toctext">Metamodeling</span></a></li></ul></li><li class="toclevel-1"><a href="#Property_Expressions"><span class="tocnumber">6</span> <span class="toctext">Property Expressions</span></a><ul><li class="toclevel-2"><a href="#Object_Property_Expressions"><span class="tocnumber">6.1</span> <span class="toctext">Object Property Expressions</span></a><ul><li class="toclevel-3"><a href="#Inverse_Object_Properties"><span class="tocnumber">6.1.1</span> <span class="toctext">Inverse Object Properties</span></a></li></ul></li><li class="toclevel-2"><a href="#Data_Property_Expressions"><span class="tocnumber">6.2</span> <span class="toctext">Data Property Expressions</span></a></li></ul></li><li class="toclevel-1"><a href="#Data_Ranges"><span class="tocnumber">7</span> <span class="toctext">Data Ranges</span></a><ul><li class="toclevel-2"><a href="#Intersection_of_Data_Ranges"><span class="tocnumber">7.1</span> <span class="toctext">Intersection of Data Ranges</span></a></li><li class="toclevel-2"><a href="#Union_of_Data_Ranges"><span class="tocnumber">7.2</span> <span class="toctext">Union of Data Ranges</span></a></li><li class="toclevel-2"><a href="#Complement_of_Data_Ranges"><span class="tocnumber">7.3</span> <span class="toctext">Complement of Data Ranges</span></a></li><li class="toclevel-2"><a href="#Enumeration_of_Literals"><span class="tocnumber">7.4</span> <span class="toctext">Enumeration of Literals</span></a></li><li class="toclevel-2"><a href="#Datatype_Restrictions"><span class="tocnumber">7.5</span> <span class="toctext">Datatype Restrictions</span></a></li></ul></li><li class="toclevel-1"><a href="#Class_Expressions"><span class="tocnumber">8</span> <span class="toctext">Class Expressions</span></a><ul><li class="toclevel-2"><a href="#Propositional_Connectives_and_Enumeration_of_Individuals"><span class="tocnumber">8.1</span> <span class="toctext">Propositional Connectives and Enumeration of Individuals</span></a><ul><li class="toclevel-3"><a href="#Intersection_of_Class_Expressions"><span class="tocnumber">8.1.1</span> <span class="toctext">Intersection of Class Expressions</span></a></li><li class="toclevel-3"><a href="#Union_of_Class_Expressions"><span class="tocnumber">8.1.2</span> <span class="toctext">Union of Class Expressions</span></a></li><li class="toclevel-3"><a href="#Complement_of_Class_Expressions"><span class="tocnumber">8.1.3</span> <span class="toctext">Complement of Class Expressions</span></a></li><li class="toclevel-3"><a href="#Enumeration_of_Individuals"><span class="tocnumber">8.1.4</span> <span class="toctext">Enumeration of Individuals</span></a></li></ul></li><li class="toclevel-2"><a href="#Object_Property_Restrictions"><span class="tocnumber">8.2</span> <span class="toctext">Object Property Restrictions</span></a><ul><li class="toclevel-3"><a href="#Existential_Quantification"><span class="tocnumber">8.2.1</span> <span class="toctext">Existential Quantification</span></a></li><li class="toclevel-3"><a href="#Universal_Quantification"><span class="tocnumber">8.2.2</span> <span class="toctext">Universal Quantification</span></a></li><li class="toclevel-3"><a href="#Individual_Value_Restriction"><span class="tocnumber">8.2.3</span> <span class="toctext">Individual Value Restriction</span></a></li><li class="toclevel-3"><a href="#Self-Restriction"><span class="tocnumber">8.2.4</span> <span class="toctext">Self-Restriction</span></a></li></ul></li><li class="toclevel-2"><a href="#Object_Property_Cardinality_Restrictions"><span class="tocnumber">8.3</span> <span class="toctext">Object Property Cardinality Restrictions</span></a><ul><li class="toclevel-3"><a href="#Minimum_Cardinality"><span class="tocnumber">8.3.1</span> <span class="toctext">Minimum Cardinality</span></a></li><li class="toclevel-3"><a href="#Maximum_Cardinality"><span class="tocnumber">8.3.2</span> <span class="toctext">Maximum Cardinality</span></a></li><li class="toclevel-3"><a href="#Exact_Cardinality"><span class="tocnumber">8.3.3</span> <span class="toctext">Exact Cardinality</span></a></li></ul></li><li class="toclevel-2"><a href="#Data_Property_Restrictions"><span class="tocnumber">8.4</span> <span class="toctext">Data Property Restrictions</span></a><ul><li class="toclevel-3"><a href="#Existential_Quantification_2"><span class="tocnumber">8.4.1</span> <span class="toctext">Existential Quantification</span></a></li><li class="toclevel-3"><a href="#Universal_Quantification_2"><span class="tocnumber">8.4.2</span> <span class="toctext">Universal Quantification</span></a></li><li class="toclevel-3"><a href="#Literal_Value_Restriction"><span class="tocnumber">8.4.3</span> <span class="toctext">Literal Value Restriction</span></a></li></ul></li><li class="toclevel-2"><a href="#Data_Property_Cardinality_Restrictions"><span class="tocnumber">8.5</span> <span class="toctext">Data Property Cardinality Restrictions</span></a><ul><li class="toclevel-3"><a href="#Minimum_Cardinality_2"><span class="tocnumber">8.5.1</span> <span class="toctext">Minimum Cardinality</span></a></li><li class="toclevel-3"><a href="#Maximum_Cardinality_2"><span class="tocnumber">8.5.2</span> <span class="toctext">Maximum Cardinality</span></a></li><li class="toclevel-3"><a href="#Exact_Cardinality_2"><span class="tocnumber">8.5.3</span> <span class="toctext">Exact Cardinality</span></a></li></ul></li></ul></li><li class="toclevel-1"><a href="#Axioms"><span class="tocnumber">9</span> <span class="toctext">Axioms</span></a><ul><li class="toclevel-2"><a href="#Class_Expression_Axioms"><span class="tocnumber">9.1</span> <span class="toctext">Class Expression Axioms</span></a><ul><li class="toclevel-3"><a href="#Subclass_Axioms"><span class="tocnumber">9.1.1</span> <span class="toctext">Subclass Axioms</span></a></li><li class="toclevel-3"><a href="#Equivalent_Classes"><span class="tocnumber">9.1.2</span> <span class="toctext">Equivalent Classes</span></a></li><li class="toclevel-3"><a href="#Disjoint_Classes"><span class="tocnumber">9.1.3</span> <span class="toctext">Disjoint Classes</span></a></li><li class="toclevel-3"><a href="#Disjoint_Union_of_Class_Expressions"><span class="tocnumber">9.1.4</span> <span class="toctext">Disjoint Union of Class Expressions</span></a></li></ul></li><li class="toclevel-2"><a href="#Object_Property_Axioms"><span class="tocnumber">9.2</span> <span class="toctext">Object Property Axioms</span></a><ul><li class="toclevel-3"><a href="#Object_Subproperties"><span class="tocnumber">9.2.1</span> <span class="toctext">Object Subproperties</span></a></li><li class="toclevel-3"><a href="#Equivalent_Object_Properties"><span class="tocnumber">9.2.2</span> <span class="toctext">Equivalent Object Properties</span></a></li><li class="toclevel-3"><a href="#Disjoint_Object_Properties"><span class="tocnumber">9.2.3</span> <span class="toctext">Disjoint Object Properties</span></a></li><li class="toclevel-3"><a href="#Inverse_Object_Properties_2"><span class="tocnumber">9.2.4</span> <span class="toctext">Inverse Object Properties</span></a></li><li class="toclevel-3"><a href="#Object_Property_Domain"><span class="tocnumber">9.2.5</span> <span class="toctext">Object Property Domain</span></a></li><li class="toclevel-3"><a href="#Object_Property_Range"><span class="tocnumber">9.2.6</span> <span class="toctext">Object Property Range</span></a></li><li class="toclevel-3"><a href="#Functional_Object_Properties"><span class="tocnumber">9.2.7</span> <span class="toctext">Functional Object Properties</span></a></li><li class="toclevel-3"><a href="#Inverse-Functional_Object_Properties"><span class="tocnumber">9.2.8</span> <span class="toctext">Inverse-Functional Object Properties</span></a></li><li class="toclevel-3"><a href="#Reflexive_Object_Properties"><span class="tocnumber">9.2.9</span> <span class="toctext">Reflexive Object Properties</span></a></li><li class="toclevel-3"><a href="#Irreflexive_Object_Properties"><span class="tocnumber">9.2.10</span> <span class="toctext">Irreflexive Object Properties</span></a></li><li class="toclevel-3"><a href="#Symmetric_Object_Properties"><span class="tocnumber">9.2.11</span> <span class="toctext">Symmetric Object Properties</span></a></li><li class="toclevel-3"><a href="#Asymmetric_Object_Properties"><span class="tocnumber">9.2.12</span> <span class="toctext">Asymmetric Object Properties</span></a></li><li class="toclevel-3"><a href="#Transitive_Object_Properties"><span class="tocnumber">9.2.13</span> <span class="toctext">Transitive Object Properties</span></a></li></ul></li><li class="toclevel-2"><a href="#Data_Property_Axioms"><span class="tocnumber">9.3</span> <span class="toctext">Data Property Axioms</span></a><ul><li class="toclevel-3"><a href="#Data_Subproperties"><span class="tocnumber">9.3.1</span> <span class="toctext">Data Subproperties</span></a></li><li class="toclevel-3"><a href="#Equivalent_Data_Properties"><span class="tocnumber">9.3.2</span> <span class="toctext">Equivalent Data Properties</span></a></li><li class="toclevel-3"><a href="#Disjoint_Data_Properties"><span class="tocnumber">9.3.3</span> <span class="toctext">Disjoint Data Properties</span></a></li><li class="toclevel-3"><a href="#Data_Property_Domain"><span class="tocnumber">9.3.4</span> <span class="toctext">Data Property Domain</span></a></li><li class="toclevel-3"><a href="#Data_Property_Range"><span class="tocnumber">9.3.5</span> <span class="toctext">Data Property Range</span></a></li><li class="toclevel-3"><a href="#Functional_Data_Properties"><span class="tocnumber">9.3.6</span> <span class="toctext">Functional Data Properties</span></a></li></ul></li><li class="toclevel-2"><a href="#Datatype_Definitions"><span class="tocnumber">9.4</span> <span class="toctext">Datatype Definitions</span></a></li><li class="toclevel-2"><a href="#Keys"><span class="tocnumber">9.5</span> <span class="toctext">Keys</span></a></li><li class="toclevel-2"><a href="#Assertions"><span class="tocnumber">9.6</span> <span class="toctext">Assertions</span></a><ul><li class="toclevel-3"><a href="#Individual_Equality"><span class="tocnumber">9.6.1</span> <span class="toctext">Individual Equality</span></a></li><li class="toclevel-3"><a href="#Individual_Inequality"><span class="tocnumber">9.6.2</span> <span class="toctext">Individual Inequality</span></a></li><li class="toclevel-3"><a href="#Class_Assertions"><span class="tocnumber">9.6.3</span> <span class="toctext">Class Assertions</span></a></li><li class="toclevel-3"><a href="#Positive_Object_Property_Assertions"><span class="tocnumber">9.6.4</span> <span class="toctext">Positive Object Property Assertions</span></a></li><li class="toclevel-3"><a href="#Negative_Object_Property_Assertions"><span class="tocnumber">9.6.5</span> <span class="toctext">Negative Object Property Assertions</span></a></li><li class="toclevel-3"><a href="#Positive_Data_Property_Assertions"><span class="tocnumber">9.6.6</span> <span class="toctext">Positive Data Property Assertions</span></a></li><li class="toclevel-3"><a href="#Negative_Data_Property_Assertions"><span class="tocnumber">9.6.7</span> <span class="toctext">Negative Data Property Assertions</span></a></li></ul></li></ul></li><li class="toclevel-1"><a href="#Annotations"><span class="tocnumber">10</span> <span class="toctext">Annotations</span></a><ul><li class="toclevel-2"><a href="#Annotations_of_Ontologies.2C_Axioms.2C_and_other_Annotations"><span class="tocnumber">10.1</span> <span class="toctext">Annotations of Ontologies, Axioms, and other Annotations</span></a></li><li class="toclevel-2"><a href="#Annotation_Axioms"><span class="tocnumber">10.2</span> <span class="toctext">Annotation Axioms</span></a><ul><li class="toclevel-3"><a href="#Annotation_Assertion"><span class="tocnumber">10.2.1</span> <span class="toctext">Annotation Assertion</span></a></li><li class="toclevel-3"><a href="#Annotation_Subproperties"><span class="tocnumber">10.2.2</span> <span class="toctext">Annotation Subproperties</span></a></li><li class="toclevel-3"><a href="#Annotation_Property_Domain"><span class="tocnumber">10.2.3</span> <span class="toctext">Annotation Property Domain</span></a></li><li class="toclevel-3"><a href="#Annotation_Property_Range"><span class="tocnumber">10.2.4</span> <span class="toctext">Annotation Property Range</span></a></li></ul></li></ul></li><li class="toclevel-1"><a href="#Global_Restrictions_on_Axioms_in_OWL_2_DL"><span class="tocnumber">11</span> <span class="toctext">Global Restrictions on Axioms in OWL 2 DL</span></a><ul><li class="toclevel-2"><a href="#Property_Hierarchy_and_Simple_Object_Property_Expressions"><span class="tocnumber">11.1</span> <span class="toctext">Property Hierarchy and Simple Object Property Expressions</span></a></li><li class="toclevel-2"><a href="#The_Restrictions_on_the_Axiom_Closure"><span class="tocnumber">11.2</span> <span class="toctext">The Restrictions on the Axiom Closure</span></a></li></ul></li><li class="toclevel-1"><a href="#Appendix:_Internet_Media_Type.2C_File_Extension.2C_and_Macintosh_File_Type"><span class="tocnumber">12</span> <span class="toctext">Appendix: Internet Media Type, File Extension, and Macintosh File Type</span></a></li><li class="toclevel-1"><a href="#Appendix:_Complete_Grammar_.28Normative.29"><span class="tocnumber">13</span> <span class="toctext">Appendix: Complete Grammar (Normative)</span></a><ul><li class="toclevel-2"><a href="#General_Definitions"><span class="tocnumber">13.1</span> <span class="toctext">General Definitions</span></a></li><li class="toclevel-2"><a href="#Definitions_of_OWL_2_Constructs"><span class="tocnumber">13.2</span> <span class="toctext">Definitions of OWL 2 Constructs</span></a></li></ul></li><li class="toclevel-1"><a href="#Appendix:_Change_Log_.28Informative.29"><span class="tocnumber">14</span> <span class="toctext">Appendix: Change Log (Informative)</span></a><ul><li class="toclevel-2"><a href="#Changes_Since_Recommendation"><span class="tocnumber">14.1</span> <span class="toctext">Changes Since Recommendation</span></a></li><li class="toclevel-2"><a href="#Changes_Since_Proposed_Recommendation"><span class="tocnumber">14.2</span> <span class="toctext">Changes Since Proposed Recommendation</span></a></li><li class="toclevel-2"><a href="#Changes_Since_Candidate_Recommendation"><span class="tocnumber">14.3</span> <span class="toctext">Changes Since Candidate Recommendation</span></a></li><li class="toclevel-2"><a href="#Changes_Since_Last_Call"><span class="tocnumber">14.4</span> <span class="toctext">Changes Since Last Call</span></a></li></ul></li><li class="toclevel-1"><a href="#Acknowledgments"><span class="tocnumber">15</span> <span class="toctext">Acknowledgments</span></a></li><li class="toclevel-1"><a href="#References"><span class="tocnumber">16</span> <span class="toctext">References</span></a><ul><li class="toclevel-2"><a href="#Normative_References"><span class="tocnumber">16.1</span> <span class="toctext">Normative References</span></a></li><li class="toclevel-2"><a href="#Nonnormative_References"><span class="tocnumber">16.2</span> <span class="toctext">Nonnormative References</span></a></li></ul></li></ul></td></tr></tbody></table>

         

## 1 Introduction

This document defines the OWL 2 language. The core part of this specification — called the _structural specification_ — is independent of the concrete exchange syntaxes for OWL 2 ontologies. The structural specification describes the conceptual structure of OWL 2 ontologies and thus provides a normative abstract representation for all (normative and nonnormative) syntaxes of OWL 2. This allows for a clear separation of the essential features of the language from issues related to any particular syntax. Furthermore, such a structural specification of OWL 2 provides the foundation for the implementation of OWL 2 tools such as APIs and reasoners. Each OWL 2 ontology represented as an instance of this conceptual structure can be converted into an RDF graph \[[OWL 2 RDF Mapping](#ref-owl-2-rdf-mapping)\]; conversely, most OWL 2 ontologies represented as RDF graphs can be converted into the conceptual structure defined in this document \[[OWL 2 RDF Mapping](#ref-owl-2-rdf-mapping)\].

This document also defines the _functional-style syntax_, which closely follows the structural specification and allows OWL 2 ontologies to be written in a compact form. This syntax is used in the definitions of the semantics of OWL 2 ontologies, the mappings from and into the RDF/XML exchange syntax, and the different profiles of OWL 2. Concrete syntaxes, such as the functional-style syntax, often provide features not found in the structural specification, such as a mechanism for abbreviating IRIs.

Finally, this document defines OWL 2 DL — the subset of OWL 2 with favorable computational properties. Each RDF graph obtained by applying the RDF mapping to an OWL 2 DL ontology can be converted back into the conceptual structure defined in this document by means of the reverse RDF mapping \[[OWL 2 RDF Mapping](#ref-owl-2-rdf-mapping)\].

An OWL 2 ontology is a formal description of a domain of interest. OWL 2 ontologies consist of the following three different syntactic categories:

-   _Entities_, such as classes, properties, and individuals, are identified by IRIs. They form the primitive _terms_ of an ontology and constitute the basic elements of an ontology. For example, a class _a:Person_ can be used to represent the set of all people. Similarly, the object property _a:parentOf_ can be used to represent the parent-child relationship. Finally, the individual _a:Peter_ can be used to represent a particular person called "Peter".
-   _Expressions_ represent complex notions in the domain being described. For example, a _class expression_ describes a set of individuals in terms of the restrictions on the individuals' characteristics.
-   _Axioms_ are statements that are asserted to be true in the domain being described. For example, using a _subclass axiom_, one can state that the class _a:Student_ is a subclass of the class _a:Person_.

These three syntactic categories are used to express the _logical_ part of OWL 2 ontologies — that is, they are interpreted under a precisely defined semantics that allows useful inferences to be drawn. For example, if an individual _a:Peter_ is an instance of the class _a:Student_, and _a:Student_ is a subclass of _a:Person_, then from the OWL 2 semantics one can derive that _a:Peter_ is also an instance of _a:Person_.

In addition, entities, axioms, and ontologies can be _annotated_ in OWL 2. For example, a class can be given a human-readable label that provides a more descriptive name for the class. Annotations have no effect on the logical aspects of an ontology — that is, for the purposes of the OWL 2 semantics, annotations are treated as not being present. Instead, the use of annotations is left to the applications that use OWL 2. For example, a graphical user interface might choose to visualize a class using one of its labels.

Finally, OWL 2 provides basic support for ontology modularization. In particular, an OWL 2 ontology _O_ can import another OWL 2 ontology _O'_ and thus gain access to all entities, expressions, and axioms in _O'_.

This document defines the structural specification of OWL 2, the functional syntax for OWL 2, the behavior of datatype maps, and OWL 2 DL. Only the parts of the document related to these three purposes are normative. The examples in this document are informative and any part of the document that is specifically identified as informative is not normative. Further, the informal descriptions of the semantics of OWL 2 constructs in this document are informative; the Direct Semantics \[[OWL 2 Direct Semantics](#ref-owl-2-direct-semantics)\] and the RDF-Based \[[OWL 2 RDF-Based Semantics](#ref-owl-2-rdf-semantics)\] are precisely specified in separate documents.

The italicized keywords _MUST_, _MUST NOT_, _SHOULD_, _SHOULD NOT_, and _MAY_ are used to specify normative features of OWL 2 documents and tools, and are interpreted as specified in RFC 2119 \[[RFC 2119](#ref-rfc-2119)\].

## 2 Preliminary Definitions

This section presents certain preliminary definitions that are used in the rest of this document.

### 2.1 Structural Specification

The structural specification of OWL 2 consists of all the figures in this document and the notion of structural equivalence given below. It is used throughout this document to precisely specify the structure of OWL 2 ontologies and the observable behavior of OWL 2 tools. An OWL 2 tool _MAY_ base its APIs and/or internal storage model on the structural specification; however, it _MAY_ also choose a completely different approach as long as its observable behavior conforms to the one specified in this document.

The structural specification is defined using the Unified Modeling Language (UML) \[[UML](#ref-uml)\], and the notation used is compatible with the Meta-Object Facility (MOF) \[[MOF](#ref-mof)\]. This document uses only a very simple form of UML class diagrams that are expected to be easily understandable by readers familiar with the basic concepts of object-oriented systems. The following list summarizes the UML notation used in this document.

-   The names of the UML classes from the structural specification are written in bold font.
-   The names of abstract UML classes (i.e., UML classes that are not intended to be instantiated) are written in bold and italic font.
-   Instances of the UML classes of the structural specification are connected by associations, many of which are of the one-to-many type. Associations whose name is preceded by / are _derived_ — that is, their value is determined based on the value of other associations and attributes. Whether the objects participating in associations are ordered and whether repetitions are allowed is made clear by the following standard UML conventions:
    -   By default, all associations are sets; that is, the objects in them are unordered and repetitions are disallowed.
    -   The { ordered,nonunique } attribute is placed next to the association ends that are ordered and in which repetitions are allowed. Such associations have the semantics of lists.

The narrative in this document often refers to various parts of the structural specification. These references are mainly intended to be informal, but they can often be interpreted as statements about the instances of the UML classes from the structural specification. When precision is required, such statements are captured using the functional-style syntax, which is defined in [Section 3.7](#Functional-Style_Syntax) and other relevant parts of this document. In order to avoid confusion, the term "UML class" is used to refer to elements of the structural specification of OWL 2, whereas the term "class" is used to refer to OWL 2 classes (see [Section 5.1](#Classes)).

The sentence "The individual I is an instance of the class C" can be understood as a statement that I is an instance of the UML class Individual, C is an instance of the UML class Class, and there is an instance of the UML class ClassAssertion that connects I with C. This statement can be captured precisely using the structural specification as ClassAssertion( C I ).

Objects _o1_ and _o2_ from the structural specification are _structurally equivalent_ if the following conditions hold:

-   If _o1_ and _o2_ are atomic values, such as strings or integers, they are structurally equivalent if they are equal according to the notion of equality of the respective UML type.
-   If _o1_ and _o2_ are unordered associations without repetitions, they are structurally equivalent if each element of _o1_ is structurally equivalent to some element of _o2_ and vice versa.
-   If _o1_ and _o2_ are ordered associations with repetitions, they are structurally equivalent if they contain the same number of elements and each element of _o1_ is structurally equivalent to the element of _o2_ with the same index.
-   If _o1_ and _o2_ are instances of UML classes from the structural specification, they are structurally equivalent if
    -   both _o1_ and _o2_ are instances of the same UML class, and
    -   each association of _o1_ is structurally equivalent to the corresponding association of _o2_ and vice versa.

The notion of structural equivalence is used throughout this specification to define various conditions on the structure of OWL 2 ontologies. Note that this is a syntactic, rather than a semantic notion — that is, it compares structures, rather than their meaning under a formal semantics.

The class expression

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectUnionOf( <i>a:Person</i> <i>a:Animal</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>owl:Class</i> .<br>_:x <i>owl:unionOf</i> ( <i>a:Person</i> <i>a:Animal</i> ) .</td></tr></tbody></table>

is structurally equivalent to the class expression

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectUnionOf( <i>a:Animal</i> <i>a:Person</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>owl:Class</i> .<br>_:x <i>owl:unionOf</i> ( <i>a:Animal</i> <i>a:Person</i> ) .</td></tr></tbody></table>

because the order of the elements in an unordered association is not important. In contrast, the class expression

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectUnionOf( <i>a:Person</i> ObjectComplementOf( <i>a:Person</i> ) )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>owl:Class</i> .<br>_:x <i>owl:unionOf</i> ( <i>a:Person</i> _:y ) .<br>_:y <i>rdf:type</i> <i>owl:Class</i> .<br>_:y <i>owl:complementOf</i> <i>a:Person</i> .</td></tr></tbody></table>

is not structurally equivalent to _owl:Thing_ even though the two expressions are semantically equivalent.

Sets written in one of the exchange syntaxes (e.g., XML or RDF/XML) are not necessarily expected to be duplicate free. Duplicates _SHOULD_ be eliminated when ontology documents written in such syntaxes are converted into instances of the UML classes of the structural specification.

An ontology written in functional-style syntax can contain the following class expression:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectUnionOf( <i>a:Person</i> <i>a:Animal</i> <i>a:Animal</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>owl:Class</i> .<br>_:x <i>owl:unionOf</i> ( <i>a:Person</i> <i>a:Animal</i> <i>a:Animal</i> ) .</td></tr></tbody></table>

During parsing, this expression should be "flattened" to the following expression:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectUnionOf( <i>a:Person</i> <i>a:Animal</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>owl:Class</i> .<br>_:x <i>owl:unionOf</i> ( <i>a:Person</i> <i>a:Animal</i> ) .</td></tr></tbody></table>

### 2.2 BNF Notation

Grammars in this document are written using the BNF notation, summarized in Table 1.

<table border="1"><caption><span class="caption">Table 1.</span> The BNF Notation</caption><tbody><tr><th>Construct</th><th>Syntax</th><th>Example</th></tr><tr><td>terminal symbols</td><td>enclosed in single quotes</td><td><span class="name">'PropertyRange'</span></td></tr><tr><td>a set of terminal symbols described in English</td><td>italic</td><td><span class="name"><i>a finite sequence of characters<br>matching the PNAME_LN production of [SPARQL]</i></span></td></tr><tr><td>nonterminal symbols</td><td>boldface</td><td><span class="nonterminal">ClassExpression</span></td></tr><tr><td>zero or more</td><td>curly braces</td><td><span class="name">{ </span><span class="nonterminal">ClassExpression</span><span class="name"> }</span></td></tr><tr><td>zero or one</td><td>square brackets</td><td><span class="name">[ </span><span class="nonterminal">ClassExpression</span><span class="name"> ]</span></td></tr><tr><td>alternative</td><td>vertical bar</td><td><span class="nonterminal">Assertion</span><span class="name"> | </span><span class="nonterminal">Declaration</span></td></tr></tbody></table>

The grammar presented in this document uses the following two "special" terminal symbols, which affect the process of transforming an input sequence of characters into a sequence of regular (i.e., not "special") terminal symbols:

-   _whitespace_ is a nonempty sequence of space (U+20), horizontal tab (U+9), line feed (U+A), or carriage return (U+D) characters, and
-   a _comment_ is a sequence of characters that starts with the # (U+23) character and does not contain the line feed (U+A) or carriage return (U+D) characters.

The following characters are called _delimiters_:

-   \= (U+3D)
-   ( (U+28)
-   ) (U+29)
-   < (U+3C)
-   \> (U+3E)
-   @ (U+40)
-   ^ (U+5E)

Given an input sequence of characters, an OWL 2 implementation _MUST_ exhibit the same observable behavior as if it applied the BNF grammar rules to the sequence of terminal symbols obtained from the input as follows.

1.  For each terminal symbol (including _whitespace_ and _comment_) mentioned in this document, a regular expression is created that can recognize the symbol's characters.
2.  A pointer p is initialized to point to the beginning of input.
3.  All regular expressions are matched to the characters in the input starting from p. Matches are greedy — that is, if several regular expressions match a portion of the input, a regular expression with the longest match wins. The regular expressions corresponding to terminal symbols in this document ensure that there are no ties (i.e., it is not possible for two regular expressions to match a portion of the input of the same length); thus, at most one regular expression can be matched.
4.  If there is no match, the input _SHOULD_ be rejected. Otherwise, if the matched regular expression does not correspond to the _whitespace_ or _comment_ terminal symbols, the corresponding terminal symbol is emitted to the output. (In other words, the matches of _whitespace_ and _comment_ are ignored.)
5.  Pointer p is moved to the first character after the match.
6.  If the terminal symbol matched in step 3 does not end with a delimiter character and p points to a character that is not a delimiter, then the regular expressions for _whitespace_ and _comment_ are matched to the characters in the input starting from p. If there is no match, the input _SHOULD_ be rejected; otherwise, p is moved to the first character after the match (and thus the match is discarded).
7.  If p does not point past the end of input, the process is repeated from step 3.

Character sequence

" #comment\\" " #comment "abc"

should be processed as follows. The first match is for the regular expression for the quoted string terminal symbol, producing a string containing a space, characters #comment", and another space. Next, the regular expression for _whitespace_ is matched to a single space, and the match is discarded. Finally, the _comment_ regular expression is matched to characters #comment "abc", and the match is discarded as well.

In similar vein, character sequence

<#comment>

should be recognized as a full IRI with value #comment (i.e., the occurrence of character # in this example must not be understood as a start of a comment).

All regular expressions are matched in step 3 greedily, so character sequence

SubClassOf:ABC

is parsed as abbreviated IRI with value SubClassOf:ABC. Furthermore, character sequence

pref: ABC

should be rejected: characters pref: are matched as a prefix name, but then ABC cannot be matched by any regular expression corresponding to a terminal symbol.

Character sequence

10abc

should be rejected: characters 10 are matched by the regular expression for nonnegative integers; however, since the match does not end with a delimiter and a is not a delimiter either, the match in step 6 fails.

Character sequences

"10" ^^ xsd:integer  
"10"^^xsd:integer

are both valid should be parsed as a quoted string, terminal symbol ^^, and an abbreviated IRI. In particular, note that the whitespace surrounding ^^ in the first line is acceptable. In similar vein, character sequences

"abc" @en  
"abc"@en

are both valid and should be parsed as a quoted string and a language tag en. In contrast, character sequence

"abc"@ en

should be rejected: characters @ en do not match the regular expression for language tags.

### 2.3 Integers, Characters, Strings, Language Tags, and Node IDs

Nonnegative integers are defined as usual.

nonNegativeInteger := _a nonempty finite sequence of digits between 0 and 9_

Characters and strings are defined in the same way as in \[[RDF:PLAINLITERAL](#ref-rdf-plain-literal)\]. A _character_ is an atomic unit of communication. The structure of characters is not further specified in this document, other than to note that each character has a Universal Character Set (UCS) code point \[[ISO/IEC 10646](#ref-iso-iec-10646)\] (or, equivalently, a Unicode code point \[[UNICODE](#ref-unicode)\]). Each character _MUST_ match the [Char](https://www.w3.org/TR/xml11/#NT-Char "http://www.w3.org/TR/xml11/#NT-Char") production from XML \[[XML](#ref-xml)\]. Code points are written as U+ followed by the hexadecimal value of the code point. A _string_ is a finite sequence of characters, and the _length_ of a string is the number of characters in it. Two strings are identical if and only if they contain exactly the same characters in exactly the same sequence. Strings are written by enclosing them in double quotes (U+22) and using a subset of the N-triples escaping mechanism \[[RDF Test Cases](#ref-rdf-testcases)\] to encode strings containing quotes. Note that the definition below allows a string to span several lines of a document.

quotedString := _a finite sequence of characters in which " (U+22) and \\ (U+5C) occur only in pairs of the form \\" (U+5C, U+22) and \\\\ (U+5C, U+5C), enclosed in a pair of " (U+22) characters_

Language tags are used to identify the language in which a string has been written. They are defined in the same way as in \[[RDF:PLAINLITERAL](#ref-rdf-plain-literal)\], which follows \[[BCP 47](#ref-bcp-47)\]. Language tags are written by prepending them with the @ (U+40) character.

languageTag := _@ (U+40) followed a nonempty sequence of characters matching the langtag production from \[[BCP 47](#ref-bcp-47)\]_

Node IDs are used to identify anonymous individuals (aka _blank nodes_ in RDF \[[RDF Concepts](#ref-rdf-concepts)\]).

nodeID := _a finite sequence of characters matching the BLANK\_NODE\_LABEL production of \[[SPARQL](#ref-sparql)\]_

### 2.4 IRIs

Ontologies and their elements are identified using Internationalized Resource Identifiers (IRIs) \[[RFC3987](#ref-rfc-3987)\]; thus, OWL 2 extends OWL 1, which uses Uniform Resource Identifiers (URIs). Each IRI _MUST_ be absolute (i.e., not relative). In the structural specification, IRIs are represented by the IRI UML class. Two IRIs are structurally equivalent if and only if their string representations are identical.

IRIs can be written as full IRIs by enclosing them in a pair of < (U+3C) and > (U+3E) characters. These characters are not part of the IRI, but are used for quotation purposes to identify an IRI as a full IRI.

Alternatively, IRIs can be abbreviated as in SPARQL \[[SPARQL](#ref-sparql)\]. To this end, one can _declare_ a _prefix name_ _pn:_ — that is, a possibly empty string followed by the : (U+3A) character — by associating it with a _prefix IRI_ _PI_; then, an IRI _I_ whose string representation consists of _PI_ followed by the remaining characters _rc_ can be abbreviated as _pn:rc_. By a slight abuse of terminology, a prefix name is often used to refer to the prefix IRI that is associated with the prefix name, and phrases such as "an IRI whose string representation starts with the prefix IRI associated with the prefix name _pn:_" are typically shortened to less verbose phrases such as "an IRI with prefix _pn:_".

If a concrete syntax uses this IRI abbreviation mechanism, it _SHOULD_ provide a suitable mechanism for declaring prefix names. Furthermore, abbreviated IRIs are not represented in the structural specification of OWL 2, and OWL 2 implementations _MUST_ exhibit the same observable behavior as if all abbreviated IRIs were expanded into full IRIs during parsing. Concrete syntaxes such as the RDF/XML Syntax \[[RDF Syntax](#ref-rdf-syntax)\] allow IRIs to be abbreviated in relation to the IRI of the document they are contained in. If used, such mechanisms are independent from the above described abbreviation mechanism. The abbreviated IRIs have the syntactic form of qualified names from the XML Namespaces specification \[[XML Namespaces](#ref-xml-namespaces)\]; therefore, it is common to refer to _PI_ as a _namespace_ and _rc_ as a _local name_. This abbreviation mechanism, however, is independent from XML namespaces and can be understood as a simple macro mechanism that expands prefix names with the associated IRIs.

fullIRI := _an IRI as defined in \[[RFC3987](#ref-rfc-3987)\], enclosed in a pair of < (U+3C) and > (U+3E) characters_  
prefixName := _a finite sequence of characters matching the as PNAME\_NS production of \[[SPARQL](#ref-sparql)\]_  
abbreviatedIRI := _a finite sequence of characters matching the PNAME\_LN production of \[[SPARQL](#ref-sparql)\]  
_IRI := fullIRI | abbreviatedIRI

Table 2 declares the prefix names that are commonly used throughout this specification.

<table border="1"><caption><span class="caption">Table 2.</span> Declarations of the Standard Prefix Names</caption><tbody><tr><th>Prefix name</th><th>Prefix IRI</th></tr><tr><td><i>rdf:</i></td><td><i>&lt;http://www.w3.org/1999/02/22-rdf-syntax-ns#&gt;</i></td></tr><tr><td><i>rdfs:</i></td><td><i>&lt;http://www.w3.org/2000/01/rdf-schema#&gt;</i></td></tr><tr><td><i>xsd:</i></td><td><i>&lt;http://www.w3.org/2001/XMLSchema#&gt;</i></td></tr><tr><td><i>owl:</i></td><td><i>&lt;http://www.w3.org/2002/07/owl#&gt;</i></td></tr></tbody></table>

IRIs with prefixes _rdf:_, _rdfs:_, _xsd:_, and _owl:_ constitute the _reserved vocabulary_ of OWL 2. As described in the following sections, the IRIs from the reserved vocabulary that are listed in Table 3 have special treatment in OWL 2.

<table border="1"><caption><span class="caption">Table 3.</span> Reserved Vocabulary of OWL 2 with Special Treatment</caption><tbody><tr><td><i>owl:backwardCompatibleWith</i></td><td><i>owl:bottomDataProperty</i></td><td><i>owl:bottomObjectProperty</i></td><td><i>owl:deprecated</i></td><td><i>owl:incompatibleWith</i></td></tr><tr><td><i>owl:Nothing</i></td><td><i>owl:priorVersion</i></td><td><i>owl:rational</i></td><td><i>owl:real</i></td><td><i>owl:versionInfo</i></td></tr><tr><td><i>owl:Thing</i></td><td><i>owl:topDataProperty</i></td><td><i>owl:topObjectProperty</i></td><td><i>rdf:langRange</i></td><td><i>rdf:PlainLiteral</i></td></tr><tr><td><i>rdf:XMLLiteral</i></td><td><i>rdfs:comment</i></td><td><i>rdfs:isDefinedBy</i></td><td><i>rdfs:label</i></td><td><i>rdfs:Literal</i></td></tr><tr><td><i>rdfs:seeAlso</i></td><td><i>xsd:anyURI</i></td><td><i>xsd:base64Binary</i></td><td><i>xsd:boolean</i></td><td><i>xsd:byte</i></td></tr><tr><td><i>xsd:dateTime</i></td><td><i>xsd:dateTimeStamp</i></td><td><i>xsd:decimal</i></td><td><i>xsd:double</i></td><td><i>xsd:float</i></td></tr><tr><td><i>xsd:hexBinary</i></td><td><i>xsd:int</i></td><td><i>xsd:integer</i></td><td><i>xsd:language</i></td><td><i>xsd:length</i></td></tr><tr><td><i>xsd:long</i></td><td><i>xsd:maxExclusive</i></td><td><i>xsd:maxInclusive</i></td><td><i>xsd:maxLength</i></td><td><i>xsd:minExclusive</i></td></tr><tr><td><i>xsd:minInclusive</i></td><td><i>xsd:minLength</i></td><td><i>xsd:Name</i></td><td><i>xsd:NCName</i></td><td><i>xsd:negativeInteger</i></td></tr><tr><td><i>xsd:NMTOKEN</i></td><td><i>xsd:nonNegativeInteger</i></td><td><i>xsd:nonPositiveInteger</i></td><td><i>xsd:normalizedString</i></td><td><i>xsd:pattern</i></td></tr><tr><td><i>xsd:positiveInteger</i></td><td><i>xsd:short</i></td><td><i>xsd:string</i></td><td><i>xsd:token</i></td><td><i>xsd:unsignedByte</i></td></tr><tr><td><i>xsd:unsignedInt</i></td><td><i>xsd:unsignedLong</i></td><td><i>xsd:unsignedShort</i></td><td></td><td></td></tr></tbody></table>

## 3 Ontologies

An OWL 2 _ontology_ is an instance _O_ of the Ontology UML class from the structural specification of OWL 2 shown in Figure 1 that satisfies certain conditions given below. The main component of an OWL 2 ontology is its set of axioms, the structure of which is described in more detail in [Section 9](#Axioms). Because the association between an ontology and its axioms is a set, an ontology cannot contain two axioms that are structurally equivalent. Apart from axioms, ontologies can also contain ontology annotations (as described in more detail in [Section 3.5](#Ontology_Annotations)), and they can also import other ontologies (as described in [Section 3.4](#Imports)).

![The Structure of OWL 2 Ontologies](Ontology.gif)  
Figure 1. The Structure of OWL 2 Ontologies

The following list summarizes all the conditions that _O_ is required to satisfy to be an OWL 2 ontology.

-   _O_ _MUST_ satisfy the restrictions on the presence of the ontology IRI and version IRI from [Section 3.1](#Ontology_IRI_and_Version_IRI).
-   Each DataIntersectionOf and DataUnionOf in _O_ _MUST_ satisfy the restrictions from [Section 7.1](#Intersection_of_Data_Ranges) and [Section 7.2](#Union_of_Data_Ranges), respectively.
-   Each DataSomeValuesFrom and DataAllValuesFrom class expression in _O_ _MUST_ satisfy the restrictions from [Section 8.4.1](#Existential_Quantification_2) and [Section 8.4.2](#Universal_Quantification_2), respectively.
-   Each DataPropertyRange axiom in _O_ _MUST_ satisfy the restriction from [Section 9.3.5](#Data_Property_Range).
-   Each DatatypeDefinition axiom in _O_ _MUST_ satisfy the restrictions from [Section 9.4](#Datatype_Definitions).
-   Each HasKey axiom in _O_ _MUST_ satisfy the restriction from [Section 9.5](#Keys).
-   Each _O'_ directly imported into _O_ _MUST_ satisfy all of these restrictions as well.

The following list summarizes all the conditions that an OWL 2 ontology _O_ is required to satisfy to be an OWL 2 DL ontology.

-   The ontology IRI and the version IRI (if present) of _O_ _MUST_ satisfy the restrictions on usage of the reserved vocabulary from [Section 3.1](#Ontology_IRI_and_Version_IRI).
-   Each datatype and each literal in _O_ _MUST_ satisfy the restrictions from [Section 5.2](#Datatypes) and [Section 5.7](#Literals), respectively.
-   Each entity in _O_ _MUST_ have an IRI satisfying the restrictions on the usage of the reserved vocabulary from Sections [5.1](#Classes)–[5.6](#Individuals).
-   _O_ _MUST_ satisfy the typing constraints from [Section 5.8.1](#Typing_Constraints_of_OWL_2_DL).
-   Each DatatypeRestriction in _O_ _MUST_ satisfy the restriction on the usage of constraining facets from [Section 7.5](#Datatype_Restrictions), respectively.
-   _O_ _MUST_ satisfy the global restriction from [Section 11](#Global_Restrictions_on_Axioms_in_OWL_2_DL).
-   Each _O'_ directly imported into _O_ _MUST_ satisfy all of these restrictions as well.

An instance _O_ of the Ontology UML class _MAY_ have consistent declarations as specified in [Section 5.8.2](#Declaration_Consistency); however, this is not strictly necessary to make _O_ an OWL 2 ontology.

### 3.1 Ontology IRI and Version IRI

Each ontology _MAY_ have an _ontology IRI_, which is used to identify an ontology. If an ontology has an ontology IRI, the ontology _MAY_ additionally have a _version IRI_, which is used to identify the version of the ontology. The version IRI _MAY_ be, but need not be, equal to the ontology IRI. An ontology without an ontology IRI _MUST NOT_ contain a version IRI.

IRIs from the reserved vocabulary _MUST NOT_ be used as an ontology IRI or a version IRI of an OWL 2 DL ontology.

The following list provides conventions for choosing ontology IRIs and version IRIs in OWL 2 ontologies. This specification provides no mechanism for enforcing these constraints across the entire Web; however, OWL 2 tools _SHOULD_ use them to detect problems in ontologies they process.

-   If an ontology has an ontology IRI but no version IRI, then a different ontology with the same ontology IRI but no version IRI _SHOULD NOT_ exist.
-   If an ontology has both an ontology IRI and a version IRI, then a different ontology with the same ontology IRI and the same version IRI _SHOULD NOT_ exist.
-   All other combinations of the ontology IRI and version IRI are not required to be unique. Thus, two different ontologies _MAY_ have no ontology IRI and no version IRI; similarly, an ontology containing only an ontology IRI _MAY_ coexist with another ontology with the same ontology IRI and some other version IRI.

The ontology IRI and the version IRI together identify a particular version from an _ontology series_ — the set of all the versions of a particular ontology identified using a common ontology IRI. In each ontology series, exactly one ontology version is regarded as the _current_ one. Structurally, a version of a particular ontology is an instance of the Ontology UML class from the structural specification. Ontology series are not represented explicitly in the structural specification of OWL 2: they exist only as a side effect of the naming conventions described in this and the following sections.

### 3.2 Ontology Documents

An OWL 2 ontology is an abstract notion defined in terms of the structural specification. Each ontology is associated with an _ontology document_, which physically contains the ontology stored in a particular way. The name "ontology document" reflects the expectation that a large number of ontologies will be stored in physical text documents written in one of the syntaxes of OWL 2. OWL 2 tools, however, are free to devise other types of ontology documents — that is, to introduce other ways of physically storing ontologies.

Ontology documents are not represented in the structural specification of OWL 2, and the specification of OWL 2 makes only the following two assumptions about their nature:

-   Each ontology document can be accessed via an IRI by means of an appropriate protocol.
-   Each ontology document can be converted in some well-defined way into an ontology (i.e., into an instance of the Ontology UML class from the structural specification).

An OWL 2 tool might publish an ontology as a text document written in the functional-style syntax (see [Section 3.7](#Functional-Style_Syntax)) and accessible via the IRI _<http://www.example.com/ontology>_. An OWL 2 tool could also devise a scheme for storing OWL 2 ontologies in a relational database. In such a case, each subset of the database representing the information about one ontology corresponds to one ontology document. To provide a mechanism for accessing these ontology documents, the OWL 2 tool should identify different database subsets with distinct IRIs.

The ontology document of an ontology _O_ _SHOULD_ be accessible via the IRIs determined by the following rules:

-   If _O_ does not contain an ontology IRI (and, consequently, it does not contain a version IRI either), then the ontology document of _O_ _MAY_ be accessible via any IRI.
-   If _O_ contains an ontology IRI _OI_ but no version IRI, then the ontology document of _O_ _SHOULD_ be accessible via the IRI _OI_.
-   If _O_ contains an ontology IRI _OI_ and a version IRI _VI_, then the ontology document of _O_ _SHOULD_ be accessible via the IRI _VI_; furthermore, if _O_ is the current version of the ontology series with the IRI _OI_, then the ontology document of _O_ _SHOULD_ also be accessible via the IRI _OI_.

Thus, the document containing the current version of an ontology series with some IRI _OI_ _SHOULD_ be accessible via _OI_. To access a particular version of _OI_, one needs to know that version's version IRI _VI_; the ontology document of the version _SHOULD_ then be accessible via _VI_.

An ontology document of an ontology that contains an ontology IRI _<http://www.example.com/my>_ but no version IRI should be accessible via the IRI _<http://www.example.com/my>_. In contrast, an ontology document of an ontology that contains an ontology IRI _<http://www.example.com/my>_ and a version IRI _<http://www.example.com/my/2.0>_ should be accessible via the IRI _<http://www.example.com/my/2.0>_. In both cases, the ontology document should be accessible via the respective IRIs using the HTTP protocol.

OWL 2 tools will often need to implement functionality such as caching or off-line processing, where ontology documents may be stored at addresses different from the ones dictated by their ontology IRIs and version IRIs. OWL 2 tools _MAY_ implement a _redirection_ mechanism: when a tool is used to access an ontology document at IRI _I_, the tool _MAY_ redirect _I_ to a different IRI _DI_ and access the ontology document via _DI_ instead. The result of accessing the ontology document via _DI_ _MUST_ be the same as if the ontology were accessed via _I_. Furthermore, once the ontology document is converted into an ontology, the ontology _SHOULD_ satisfy the three conditions from the beginning of this section in the same way as if it the ontology document were accessed via _I_. No particular redirection mechanism is specified — this is assumed to be implementation dependent.

To enable off-line processing, an ontology document that — according to the above rules — should be accessible via _<http://www.example.com/my>_ might be stored in a file accessible via _<file:///usr/local/ontologies/example.owl>_. To access this ontology document, an OWL 2 tool might redirect the IRI _<http://www.example.com/my>_ and actually access the ontology document via _<file:///usr/local/ontologies/example.owl>_. The ontology obtained after accessing the ontology document should satisfy the usual accessibility constraints: if the ontology contains only the ontology IRI, then the ontology IRI should be equal to _<http://www.example.com/my>_, and if the ontology contains both the ontology IRI and the version IRI, then one of them should be equal to _<http://www.example.com/my>_.

### 3.3 Versioning of OWL 2 Ontologies

The conventions from [Section 3.2](#Ontology_Documents) provide a simple mechanism for versioning OWL 2 ontologies. An ontology series is identified using an ontology IRI, and each version in the series is assigned a different version IRI. The ontology document of the ontology representing the current version of the series _SHOULD_ be accessible via the ontology IRI and, if present, via its version IRI as well; the ontology documents of the previous versions _SHOULD_ be accessible solely via their respective version IRIs. When a new version _O_ in the ontology series is created, the ontology document of _O_ _SHOULD_ replace the one accessible via the ontology IRI (and it _SHOULD_ also be accessible via its version IRI).

The ontology document containing the current version of an ontology series might be accessible via the IRI _<http://www.example.com/my>_, as well as via the version-specific IRI _<http://www.example.com/my/2.0>_. When a new version is created, the ontology document of the previous version should remain accessible via _<http://www.example.com/my/2.0>_; the ontology document of the new version, called, say, _<http://www.example.com/my/3.0>_, should be made accessible via both _<http://www.example.com/my>_ and _<http://www.example.com/my/3.0>_.

### 3.4 Imports

An OWL 2 ontology can import other ontologies in order to gain access to their entities, expressions, and axioms, thus providing the basic facility for ontology modularization.

Assume that one wants to describe research projects about diseases. Managing information about the projects and the diseases in the same ontology might be cumbersome. Therefore, one might create a separate ontology _O_ about diseases and a separate ontology _O'_ about projects. The ontology _O'_ would import _O_ in order to gain access to the classes representing diseases; this allows one to use the diseases from _O_ when writing the axioms of _O'_.

From a physical point of view, an ontology contains a set of IRIs, shown in Figure 1 as the directlyImportsDocuments association; these IRIs identify the ontology documents of the directly imported ontologies as specified in [Section 3.2](#Ontology_Documents). The logical _directly imports_ relation between ontologies, shown in Figure 1 as the directlyImports association, is obtained by accessing the directly imported ontology documents and converting them into OWL 2 ontologies. The logical _imports_ relation between ontologies, shown in Figure 1 as the imports association, is the transitive closure of directly imports. In Figure 1, associations directlyImports and imports are shown as derived associations, since their values are derived from the value of the directlyImportsDocuments association. Ontology documents usually store the directlyImportsDocuments association. In contrast, the directlyImports and imports associations are typically not stored in ontology documents, but are determined during parsing as specified in [Section 3.6](#Canonical_Parsing_of_OWL_2_Ontologies).

The following ontology document contains an ontology that directly imports an ontology contained in the ontology document accessible via the IRI _<http://www.example.com/my/2.0>_.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">Ontology( <i>&lt;http://www.example.com/importing-ontology&gt;</i><br>&nbsp;&nbsp;&nbsp; Import( <i>&lt;http://www.example.com/my/2.0&gt;</i> )<br><br>...<br>)</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>&lt;http://www.example.com/importing-ontology&gt;</i> <i>rdf:type</i> <i>owl:Ontology</i> .<br><i>&lt;http://www.example.com/importing-ontology&gt;</i> <i>owl:imports</i> <i>&lt;http://www.example.com/my/2.0&gt;</i> .<br>...</td></tr></tbody></table>

The IRIs identifying the ontology documents of the directly imported ontologies can be redirected as described in [Section 3.2](#Ontology_Documents). For example, in order to access the above mentioned ontology document from a local cache, the IRI _<http://www.example.com/my/2.0>_ might be redirected to _<file:///usr/local/ontologies/imported.v20.owl>_. Note that this can be done without changing the ontology document of the importing ontology.

The _import closure_ of an ontology _O_ is a set containing _O_ and all the ontologies that _O_ imports. The import closure of _O_ _SHOULD NOT_ contain ontologies _O1_ and _O2_ such that

-   _O1_ and _O2_ are different ontology versions from the same ontology series, or
-   _O1_ contains an ontology annotation _owl:incompatibleWith_ with the value equal to either the ontology IRI or the version IRI of _O2_.

The _axiom closure_ of an ontology _O_ is the smallest set that contains all the axioms from each ontology _O'_ in the import closure of _O_ with all anonymous individuals _standardized apart_ — that is, the anonymous individuals from different ontologies in the import closure of _O_ are treated as being different; see [Section 5.6.2](#Anonymous_Individuals) for further details.

### 3.5 Ontology Annotations

An OWL 2 ontology contains a set of annotations. These can be used to associate information with an ontology — for example the ontology creator's name. As discussed in more detail in [Section 10](#Annotations), each annotation consists of an annotation property and an annotation value, and the latter can be a literal, an IRI, or an anonymous individual.

ontologyAnnotations := { Annotation }

OWL 2 provides several built-in annotation properties for ontology annotations. The usage of these annotation properties on entities other than ontologies is discouraged.

-   The _owl:priorVersion_ annotation property specifies the IRI of a prior version of the containing ontology.
-   The _owl:backwardCompatibleWith_ annotation property specifies the IRI of a prior version of the containing ontology that is compatible with the current version of the containing ontology.
-   The _owl:incompatibleWith_ annotation property specifies the IRI of a prior version of the containing ontology that is incompatible with the current version of the containing ontology.

### 3.6 Canonical Parsing of OWL 2 Ontologies

Many OWL 2 tools need to support _ontology parsing_ — the process of converting an ontology document written in a particular syntax into an OWL 2 ontology. Depending on the syntax used, the ontology parser may need to know which IRIs are used in the ontology as entities of which type. This typing information is extracted from declarations — axioms that associate IRIs with entity types. Please refer to [Section 5.8](#Entity_Declarations_and_Typing) for more information about declarations.

An ontology parser for the ontology documents written in the RDF syntax might encounter the following triples:

_a:Father_ _rdfs:subClassOf_ \_:x .  
\_:x _owl:someValuesFrom_ _a:Child_ .  
\_:x _owl:onProperty_ _a:parentOf_.  

From this axiom alone, it is not clear whether _a:parentOf_ is an object or a data property, and whether _a:Child_ is a class or a datatype. In order to disambiguate the types of these IRIs, the parser needs to look at the declarations in the ontology document being parsed, as well as those in the directly or indirectly imported ontology documents.

In OWL 2 there is no requirement for a declaration of an entity to physically precede the entity's usage in ontology documents; furthermore, declarations for entities can be placed in imported ontology documents and imports are allowed to be cyclic. In order to precisely define the result of ontology parsing, this specification defines the notion of _canonical parsing_. An OWL 2 parser _MAY_ implement parsing in any way it chooses, as long as it produces a result that is structurally equivalent to the result of canonical parsing.

An OWL 2 ontology corresponding to an ontology document _DGI_ accessible via a given IRI _GI_ can be obtained using the following _canonical parsing_ process. All steps of this process _MUST_ be successfully completed.

<table class="canonicalparsing"><tbody><tr><td><b>CP&nbsp;1</b></td><td class="one">Make <i>AllDoc</i> and <i>Processed</i> equal to the empty set, and make <i>ToProcess</i> equal to the set containing only the IRI <i>GI</i>.</td></tr><tr><td><b>CP&nbsp;2</b></td><td class="one">While <i>ToProcess</i> is not empty, remove an arbitrary IRI <i>I</i> from it and, if <i>I</i> is not contained in <i>Processed</i>, perform the following steps:</td></tr><tr><td><b>CP&nbsp;2.1</b></td><td class="two">Retrieve the ontology document <i>D<sub>I</sub></i> from <i>I</i> as specified in <a href="#Ontology_Documents" title="">Section 3.2</a>.</td></tr><tr><td><b>CP&nbsp;2.2</b></td><td class="two">Using the rules of the relevant syntax, analyze <i>D<sub>I</sub></i> and compute the set <i>Decl(D<sub>I</sub>)</i> of declarations explicitly present in <i>D<sub>I</sub></i> and the set <i>Imp(D<sub>I</sub>)</i> of IRIs of ontology documents directly imported in <i>D<sub>I</sub></i>.</td></tr><tr><td><b>CP&nbsp;2.3</b></td><td class="two">Add <i>D<sub>I</sub></i> to <i>AllDoc</i>, add <i>I</i> to <i>Processed</i>, and add each IRI from <i>Imp(D<sub>I</sub>)</i> to <i>ToProcess</i>.</td></tr><tr><td><b>CP&nbsp;3</b></td><td class="one">For each ontology document <i>D</i> in <i>AllDoc</i>, perform the following steps:</td></tr><tr><td><b>CP&nbsp;3.1</b></td><td class="two">Compute the set <i>AllDecl(D)</i> as the union of the set <i>Decl(D)</i>, the sets <i>Decl(D')</i> for each ontology document <i>D'</i> that is (directly or indirectly) imported into <i>D</i>, and the set of all declarations listed in Table 5. For an OWL 2 DL ontology, the set <i>AllDecl(D)</i> <em class="RFC2119" title="MUST in RFC 2119 context">MUST</em> satisfy the typing constraints from <a href="#Typing_Constraints_of_OWL_2_DL" title="">Section 5.8.1</a>.</td></tr><tr><td><b>CP&nbsp;3.2</b></td><td class="two">Create an instance <i>O<sub>D</sub></i> of the <span class="nonterminal">Ontology</span> UML class from the structural specification.</td></tr><tr><td><b>CP&nbsp;3.3</b></td><td class="two">Using the rules of the relevant syntax, analyze <i>D</i> and populate <i>O<sub>D</sub></i> by instantiating appropriate classes from the structural specification. Use the declarations in <i>AllDecl(D)</i> to disambiguate IRIs if needed; it <em class="RFC2119" title="MUST in RFC 2119 context">MUST</em> be possible to disambiguate all IRIs.</td></tr><tr><td><b>CP&nbsp;4</b></td><td class="one">For each pair of ontology documents <i>DS</i> and <i>DT</i> in <i>AllDoc</i> such that the latter is directly imported into the former, add <i>O<sub>DT</sub></i> to the <span class="nonterminal">directlyImports</span> association of <i>O<sub>DS</sub></i>.</td></tr><tr><td><b>CP&nbsp;5</b></td><td class="one">For each ontology document <i>D</i> in <i>AllDoc</i>, set the <span class="nonterminal">imports</span> association of <i>O<sub>D</sub></i> to the transitive closure of the <span class="nonterminal">directlyImports</span> association of <i>O<sub>D</sub></i>.</td></tr><tr><td><b>CP&nbsp;6</b></td><td class="one">For each ontology document <i>D</i> in <i>AllDoc</i>, ensure that <i>O<sub>D</sub></i> is an OWL 2 ontology — that is, <i>O<sub>D</sub></i> <em class="RFC2119" title="MUST in RFC 2119 context">MUST</em> satisfy all the restrictions listed in <a href="#Ontologies" title="">Section 3</a>.</td></tr></tbody></table>

It is important to understand that canonical parsing merely defines the result of the parsing process, and that an implementation of OWL 2 _MAY_ optimize this process in numerous ways. In order to enable efficient parsing, OWL 2 implementations are encouraged to write ontologies into documents by placing all IRI declarations before the axioms that use these IRIs; however, this is not required for conformance.

### 3.7 Functional-Style Syntax

A _functional-style syntax ontology document_ is a sequence of Unicode characters \[[UNICODE](#ref-unicode)\] accessible via some IRI by means of the standard protocols such that its text matches the ontologyDocument production of the grammar defined in this specification document, and it can be converted into an ontology by means of the canonical parsing process described in [Section 3.6](#Canonical_Parsing_of_OWL_2_Ontologies) and other parts of this specification document. A functional-style syntax ontology document _SHOULD_ use the UTF-8 encoding \[[RFC 3629](#ref-rfc-3629)\].

ontologyDocument := { prefixDeclaration } Ontology  
prefixDeclaration := 'Prefix' '(' prefixName '=' fullIRI ')'  
Ontology :=  
    'Ontology' '(' \[ ontologyIRI \[ versionIRI \] \]  
       directlyImportsDocuments  
       ontologyAnnotations  
       axioms  
    ')'  
ontologyIRI := IRI  
versionIRI := IRI  
directlyImportsDocuments := { 'Import' '(' IRI ')' }  
axioms := { Axiom }

Each part of the ontology document matching the prefixDeclaration production declares a prefix name and associates it with a prefix IRI. An ontology document _MUST_ contain at most one such declaration per prefix name, and it _MUST NOT_ declare a prefix name listed in Table 2. Prefix declarations are used during parsing to expand abbreviated IRIs in the ontology document — that is, parts of the ontology document matching the abbreviatedIRI production — into full IRIs. This is done as follows:

-   The abbreviated IRI is split into a prefix name _pn:_ — the part up to and including the : (U+3A) character — and the remaining part _rp_ following the : (U+3A) character.
-   If _pn:_ is not one of the standard prefix names listed in Table 2, then the prefix declarations of the ontology document being parsed _MUST_ contain a declaration for _pn:_ associating it with a prefix IRI _PI_.
-   The resulting full IRI is obtained by concatenating the string representation of _PI_ with _rp_. The resulting IRI _MUST_ be a valid IRI.

The following is a functional-style syntax ontology document containing an ontology with the ontology IRI _<http://www.example.com/ontology1>_. The IRI _<http://www.example.com/ontology1#>_ is associated with the prefix name _:_ (that is, the prefix name consisting only of a colon character); this prefix is often called "empty" or "default". This ontology imports an ontology whose ontology document should be accessed via _<http://www.example.com/ontology2>_, and it contains an ontology annotation providing a label for the ontology and a single subclass axiom. The abbreviated IRI _:Child_ is expanded into the full IRI _<http://www.example.com/ontology1#Child>_ during parsing. The prefix name _owl:_ occurs in Table 2 and therefore does not need to be explicitly declared in the ontology document.

Prefix(:=_<http://www.example.com/ontology1#>_)  
Ontology( _<http://www.example.com/ontology1>_  
    Import( _<http://www.example.com/ontology2>_ )  
    Annotation( _rdfs:label_ "An example" )  
  
    SubClassOf( _:Child_ _owl:Thing_ )  
)

## 4 Datatype Maps

OWL 2 ontologies can refer to data values such as strings or integers. Each kind of such values is called a _datatype_. Datatypes can be used in OWL 2 ontologies as described in [Section 5.2](#Datatypes). Each datatype is identified by an IRI and is defined by the following components:

-   The _value space_ is the set of values of the datatype. Elements of the value space are called _data values_.
-   The _lexical space_ is a set of strings that can be used to refer to data values. Each member of the lexical space is called a _lexical form_, and it is mapped to a particular data value.
-   The _facet space_ is a set of pairs of the form ( _F_ , _v_ ) where _F_ is an IRI called a _constraining facet_, and _v_ is an arbitrary data value called the _constraining value_. Each such pair is mapped to a subset of the value space of the datatype.

A set of datatypes supported by a reasoner is called a _datatype map_. This is not a syntactic construct — that is, it is not used directly to construct OWL 2 ontologies in a way that, say, classes and datatypes are. Because of that, a datatype map is not represented in the structural specification of OWL 2.

The rest of this section defines a particular datatype map called the _OWL 2 datatype map_, which lists the datatypes that can be used in OWL 2 ontologies. Most datatypes are taken from the set of XML Schema Datatypes \[[XML Schema Datatypes](#ref-xml-schema-datatypes)\], the RDF specification \[[RDF Concepts](#ref-rdf-concepts)\], or the specification for plain literals \[[RDF:PLAINLITERAL](#ref-rdf-plain-literal)\]. The normative definitions of these datatypes are provided by the respective specifications, and this document merely provides guidance on how to interpret these definitions properly in the context of OWL 2. For all these datatypes, this section lists the _normative constraining facets_ that OWL 2 implementations _MUST_ support. This section also contains the complete normative definitions of the datatypes _owl:real_ and _owl:rational_, as these datatypes have not been taken from other specifications.

### 4.1 Real Numbers, Decimal Numbers, and Integers

The OWL 2 datatype map provides the following datatypes for the representation of real numbers, decimal numbers, and integers:

-   _owl:real_
-   _owl:rational_
-   _xsd:decimal_
-   _xsd:integer_
-   _xsd:nonNegativeInteger_
-   _xsd:nonPositiveInteger_
-   _xsd:positiveInteger_
-   _xsd:negativeInteger_
-   _xsd:long_
-   _xsd:int_
-   _xsd:short_
-   _xsd:byte_
-   _xsd:unsignedLong_
-   _xsd:unsignedInt_
-   _xsd:unsignedShort_
-   _xsd:unsignedByte_

For each datatype from the above list that is identified by an IRI with the _xsd:_ prefix, the definitions of the value space, the lexical space, and the facet space are provided by XML Schema \[[XML Schema Datatypes](#ref-xml-schema-datatypes)\]; furthermore, the normative constraining facets for the datatype are _xsd:minInclusive_, _xsd:maxInclusive_, _xsd:minExclusive_, and _xsd:maxExclusive_. An OWL 2 implementation _MAY_ support all lexical forms of these datatypes; however, it _MUST_ support at least the lexical forms listed in Section 5.4 of XML Schema Datatypes \[[XML Schema Datatypes](#ref-xml-schema-datatypes)\], which can be mapped to the primitive values commonly found in modern implementation platforms.

The datatypes _owl:real_ and _owl:rational_ are defined as follows.

**Value Spaces.**

-   The value space of _owl:real_ is the set of all real numbers.
-   The value space of _owl:rational_ is the set of all rational numbers. It is a subset of the value space of _owl:real_, and it contains the value space of _xsd:decimal_ (and thus of all _xsd:_ numeric datatypes listed above as well).

**Lexical Spaces.**

-   The _owl:real_ datatype does not directly provide any lexical forms.
-   The _owl:rational_ datatype supports lexical forms defined by the following grammar (whitespace within the grammar _MUST_ be ignored and _MUST NOT_ be included in the lexical forms of _owl:rational_, and single quotes are used to introduce terminal symbols):
    
    numerator '/' denominator
    
    Here, numerator is an integer with the syntax as specified for the _xsd:integer_ datatype, and denominator is a positive, nonzero integer with the syntax as specified for the _xsd:integer_ datatype, not containing the plus sign. Each such lexical form of _owl:rational_ is mapped to the rational number obtained by dividing the value of numerator by the value of denominator. An OWL 2 implementation _MAY_ support all such lexical forms; however, it _MUST_ support at least the lexical forms where the numerator and the denominator are in the value space of _xsd:long_.

**Facet Spaces.** The facet spaces of _owl:real_ and _owl:rational_ are defined in Table 4.

<table border="1" style="text-align: left"><caption><span class="caption">Table 4.</span> The Facet Spaces of <i>owl:real</i> and <i>owl:rational</i></caption><tbody><tr><th>Each pair of the form...</th><th>...is mapped to...</th></tr><tr><td>( <i>xsd:minInclusive</i> , <i>v</i> )<br>where <i>v</i> is from the value space of <i>owl:real</i></td><td>the set of all numbers <i>x</i> from the value space of <i>DT</i> such that <i>x</i> = <i>v</i> or <i>x</i> &gt; <i>v</i></td></tr><tr><td>( <i>xsd:maxInclusive</i> , <i>v</i> )<br>where <i>v</i> is from the value space of <i>owl:real</i></td><td>the set of all numbers <i>x</i> from the value space of <i>DT</i> such that <i>x</i> = <i>v</i> or <i>x</i> &lt; <i>v</i></td></tr><tr><td>( <i>xsd:minExclusive</i> , <i>v</i> )<br>where <i>v</i> is from the value space of <i>owl:real</i></td><td>the set of all numbers <i>x</i> from the value space of <i>DT</i> such that <i>x</i> &gt; <i>v</i></td></tr><tr><td>( <i>xsd:maxExclusive</i> , <i>v</i> )<br>where <i>v</i> is from the value space of <i>owl:real</i></td><td>the set of all numbers <i>x</i> from the value space of <i>DT</i> such that <i>x</i> &lt; <i>v</i></td></tr><tr><td colspan="2"><b>Note.</b> <i>DT</i> is either <i>owl:real</i> or <i>owl:rational</i>.</td></tr></tbody></table>

### 4.2 Floating-Point Numbers

The OWL 2 datatype map supports the following datatypes for the representation of floating-point numbers:

-   _xsd:double_
-   _xsd:float_

As specified in XML Schema \[[XML Schema Datatypes](#ref-xml-schema-datatypes)\], the value spaces of _xsd:double_, _xsd:float_, and _xsd:decimal_ are pairwise disjoint. In accordance with this principle, the value space of _owl:real_ is defined as being disjoint with the value spaces of _xsd:double_ and _xsd:float_ as well. The normative constraining facets for these datatypes are _xsd:minInclusive_, _xsd:maxInclusive_, _xsd:minExclusive_, and _xsd:maxExclusive_.

Although floating-point values are numbers, they are not contained in the value space of _owl:real_. Thus, the value spaces of _xsd:double_ and _xsd:float_ can be understood as containing "fresh copies" of the appropriate subsets of the value space of _owl:real_. To understand how this impacts the consequences of OWL 2 ontologies, consider the following example.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>DataPropertyRange( <i>a:hasAge</i> <i>xsd:integer</i> )</td><td>The range of the <i>a:hasAge</i> property is <i>xsd:integer</i>.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:hasAge</i> <i>a:Meg</i> "17"^^<i>xsd:double</i> )</td><td>Meg is seventeen years old.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasAge</i> <i>rdfs:range</i> <i>xsd:integer</i> .</td><td>The range of the <i>a:hasAge</i> property is <i>xsd:integer</i>.</td></tr><tr valign="top"><td><i>a:Meg</i> <i>a:hasAge</i> "17"^^<i>xsd:double</i> .</td><td>Meg is seventeen years old.</td></tr></tbody></table>

The first axiom states that all values of the _a:hasAge_ property must be in the value space of _xsd:integer_, but the second axiom provides a value for _a:hasAge_ that is equal to the floating-point number 17. Since floating-point numbers are not contained in the value space of _xsd:integer_, the mentioned ontology is inconsistent.

According to XML Schema, the value spaces of _xsd:double_ and _xsd:float_ contain positive and negative zeros. These two objects are equal, but not identical. To understand this distinction, consider the following example ontology:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>DataPropertyAssertion( <i>a:numberOfChildren</i> <i>a:Meg</i> "+0"^^<i>xsd:float</i> )</td><td>The value of <i>a:numberOfChildren</i> for <i>a:Meg</i> is <i>+0</i>.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:numberOfChildren</i> <i>a:Meg</i> "-0"^^<i>xsd:float</i> )</td><td>The value of <i>a:numberOfChildren</i> for <i>a:Meg</i> is <i>-0</i>.</td></tr><tr valign="top"><td>FunctionalDataProperty( <i>a:numberOfChildren</i> )</td><td>An individual can have at most one value for <i>a:numberOfChildren</i>.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Meg</i> <i>a:numberOfChildren</i> "+0"^^<i>xsd:float</i> .</td><td>The value of <i>a:numberOfChildren</i> for <i>a:Meg</i> is <i>+0</i>.</td></tr><tr valign="top"><td><i>a:Meg</i> <i>a:numberOfChildren</i> "-0"^^<i>xsd:float</i> .</td><td>The value of <i>a:numberOfChildren</i> for <i>a:Meg</i> is <i>-0</i>.</td></tr><tr valign="top"><td><i>a:numberOfChildren</i> <i>rdf:type</i> <i>owl:FunctionalProperty</i> .</td><td>An individual can have at most one value for <i>a:numberOfChildren</i>.</td></tr></tbody></table>

The last axiom states that no individual should have more than one distinct value for _a:numberOfChildren_. Since positive and negative zero are not identical, the first two axioms violate the restriction of the last axiom, which makes the ontology inconsistent. In other words, equality of values from the value space of _xsd:double_ and _xsd:float_ has no effect on the semantics of cardinality restrictions of OWL 2; in fact, equality is used only in the definition of facets.

According to XML Schema, the semantics of facets is defined with respect to equality, and positive and negative zeros are equal. Therefore, the subset of the value space of _xsd:double_ between _\-1.0_ and _1.0_ contains both _+0_ and _\-0_.

### 4.3 Strings

The OWL 2 datatype map provides the _rdf:PlainLiteral_ datatype for the representation of strings in a particular language. The definitions of the value space, the lexical space, the facet space, and the necessary mappings are given in \[[RDF:PLAINLITERAL](#ref-rdf-plain-literal)\]. The normative constraining facets for _rdf:PlainLiteral_ are _xsd:length_, _xsd:minLength_, _xsd:maxLength_, _xsd:pattern_, and _rdf:langRange_; furthermore, only _basic language ranges_ \[[BCP 47](#ref-bcp-47)\] are supported in the _rdf:langRange_ constraining facet.

In addition, OWL 2 supports the following datatypes defined in XML Schema \[[XML Schema Datatypes](#ref-xml-schema-datatypes)\]:

-   _xsd:string_
-   _xsd:normalizedString_
-   _xsd:token_
-   _xsd:language_
-   _xsd:Name_
-   _xsd:NCName_
-   _xsd:NMTOKEN_

As explained in \[[RDF:PLAINLITERAL](#ref-rdf-plain-literal)\], the value spaces of all of these datatypes are contained in the value space of _rdf:PlainLiteral_. Furthermore, for each datatype from the above list, the normative constraining facets are _xsd:length_, _xsd:minLength_, _xsd:maxLength_, and _xsd:pattern_.

### 4.4 Boolean Values

The OWL 2 datatype map provides the _xsd:boolean_ XML Schema datatype \[[XML Schema Datatypes](#ref-xml-schema-datatypes)\] for the representation of Boolean values. No constraining facet is normative for this datatype.

### 4.5 Binary Data

The OWL 2 datatype map provides the following XML Schema datatypes \[[XML Schema Datatypes](#ref-xml-schema-datatypes)\] for the representation of binary data:

-   _xsd:hexBinary_
-   _xsd:base64Binary_

As specified in XML Schema \[[XML Schema Datatypes](#ref-xml-schema-datatypes)\], the value spaces of these two datatypes are disjoint. For each datatype from the above list, the normative constraining facets are _xsd:minLength_, _xsd:maxLength_, and _xsd:length_.

According to XML Schema, the value spaces of _xsd:hexBinary_ and _xsd:base64Binary_ are isomorphic copies of the set of all finite sequences of _octets_ — integers between 0 and 255, inclusive. To understand the effect that the disjointness requirement has on the semantics of OWL 2, consider the following example ontology:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>DataPropertyRange( <i>a:personID</i> <i>xsd:base64Binary</i> )</td><td>The range of the <i>a:personID</i> property is <i>xsd:base64Binary</i>.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:personID</i> <i>a:Meg</i> "0203"^^<i>xsd:hexBinary</i> )</td><td>The ID of Meg is the octet sequence consisting of the octets 2 and 3.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:personID</i> <i>rdfs:range</i> <i>xsd:base64Binary</i> .</td><td>The range of the <i>a:personID</i> property is <i>xsd:base64Binary</i>.</td></tr><tr valign="top"><td><i>a:Meg</i> <i>a:personID</i> "0203"^^<i>xsd:hexBinary</i> .</td><td>The ID of Meg is the octet sequence consisting of the octets 2 and 3.</td></tr></tbody></table>

The first axiom states that all values of the _a:personID_ property must be in the value space of _xsd:base64Binary_, but the second axiom provides a value for _a:personID_ that is in the value space of _xsd:hexBinary_. Since the value spaces of _xsd:hexBinary_ and _xsd:base64Binary_ are disjoint, the above ontology is inconsistent.

### 4.6 IRIs

The OWL 2 datatype map provides the _xsd:anyURI_ XML Schema datatype \[[XML Schema Datatypes](#ref-xml-schema-datatypes)\] for the representation of IRIs. As specified in XML Schema \[[XML Schema Datatypes](#ref-xml-schema-datatypes)\], the value spaces of _xsd:anyURI_ and _xsd:string_ are disjoint. The normative constraining facets are _xsd:minLength_, _xsd:maxLength_, _xsd:length_, and _xsd:pattern_.

According to XML Schema, the value space of _xsd:anyURI_ is the set of all IRIs. Although each IRI has a string representation, IRIs are not strings. The value space of _xsd:anyURI_ can therefore be seen as an "isomorphic copy" of a subset of the value space of _xsd:string_.

The lexical forms of _xsd:anyURI_ include relative IRIs. If an OWL 2 syntax employs rules for the resolution of relative IRIs (e.g., the OWL 2 XML Syntax \[[OWL 2 XML Serialization](#ref-owl-2-xml-serialization)\] uses _xml:base_ for that purpose), such rules do not apply to _xsd:anyURI_ lexical forms that represent relative IRIs; that is, the lexical forms representing relative IRIs _MUST_ be parsed as they are.

### 4.7 Time Instants

The OWL 2 datatype map provides the following XML Schema datatypes \[[XML Schema Datatypes](#ref-xml-schema-datatypes)\] for the representation of time instants with and without time zone offsets:

-   _xsd:dateTime_
-   _xsd:dateTimeStamp_

For each datatype from the above list, the normative constraining facets are _xsd:minInclusive_, _xsd:maxInclusive_, _xsd:minExclusive_, and _xsd:maxExclusive_. An OWL 2 implementation _MAY_ support all lexical forms of these datatypes; however, it _MUST_ support at least the lexical forms listed in Section 5.4 of XML Schema Datatypes \[[XML Schema Datatypes](#ref-xml-schema-datatypes)\].

According to XML Schema, two _xsd:dateTime_ values representing the same time instant but with different time zone offsets are equal, but not identical. The consequences of this definition are demonstrated by the following example ontology:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>FunctionalDataProperty( <i>a:birthDate</i> )</td><td>Each object can have at most one birth date.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:birthDate</i> <i>a:Peter</i><br>&nbsp;&nbsp;&nbsp; "1956-06-25T04:00:00-05:00"^^<i>xsd:dateTime</i> )</td><td>Peter was born on June 25th, 1956, at 4am EST.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:birthDate</i> <i>a:Peter</i><br>&nbsp;&nbsp;&nbsp; "1956-06-25T10:00:00+01:00"^^<i>xsd:dateTime</i> )</td><td>Peter was born on June 25th, 1956, at 10am CET.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:birthDate</i> <i>rdf:type</i> <i>owl:FunctionalProperty</i> .</td><td>Each object can have at most one birth date.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:birthDate</i> "1956-06-25T04:00:00-05:00"^^<i>xsd:dateTime</i> .</td><td>Peter was born on June 25th, 1956, at 4am EST.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:birthDate</i> "1956-06-25T10:00:00+01:00"^^<i>xsd:dateTime</i> .</td><td>Peter was born on June 25th, 1956, at 10am CET.</td></tr></tbody></table>

June 25th, 1956, 4am EST and June 25th, 1956, 10am CET denote the same time instants, but have different time zone offsets. Consequently, the two _xsd:dateTime_ literals are mapped to two equal, but nonidentical data values. Consequently, _a:Peter_ is connected by the property _a:birthDate_ to two distinct data values, which violates the functionality requirement on _a:birthDate_ and makes the ontology inconsistent.

The semantics of constraining facets on _xsd:dateTime_ is defined with respect to equality and ordering on time instants. For example, the following datatype restriction contains all time instants that are larger than or equal to the time instant corresponding to the lexical form "1956-01-01T04:00:00-05:00".

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DatatypeRestriction( <i>xsd:dateTime</i> <i>xsd:minInclusive</i> "1956-01-01T04:00:00-05:00"^^<i>xsd:dateTime</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>rdfs:Datatype</i> .<br>_:x <i>owl:onDatatype</i> <i>xsd:dateTime</i> .<br>_:x <i>owl:withRestrictions</i> ( _:y ) .<br>_:y <i>xsd:minInclusive</i> "1956-01-01T04:00:00-05:00"^^<i>xsd:dateTime</i> .</td></tr></tbody></table>

According to XML Schema datatypes \[[XML Schema Datatypes](#ref-xml-schema-datatypes)\], time instants are compared with respect to their _[timeOnTimeline](https://www.w3.org/TR/xmlschema11-2/#vp-dt-timeOnTimeline "http://www.w3.org/TR/xmlschema11-2/#vp-dt-timeOnTimeline")_ value, which roughly corresponds to the number of seconds elapsed from the origin of the proleptic Gregorian calendar. Thus, the above data range contains the time instants corresponding to the lexical forms "1956-06-25T04:00:00-05:00" and "1956-06-25T10:00:00+01:00" despite the fact that the time zone offset of the latter does not match the one used in the datatype restriction.

A time instant might not contain a time zone offset, in which case comparisons are slightly more involved. Let _T1_ and _T2_ be time instants with and without time zone offsets, respectively. Then, _T1_ is not equal to _T2_, and comparisons are defined as follows:

-   _T1_ is smaller than _T2_ if the _[timeOnTimeline](https://www.w3.org/TR/xmlschema11-2/#vp-dt-timeOnTimeline "http://www.w3.org/TR/xmlschema11-2/#vp-dt-timeOnTimeline")_ value of _T1_ is smaller than the _[timeOnTimeline](https://www.w3.org/TR/xmlschema11-2/#vp-dt-timeOnTimeline "http://www.w3.org/TR/xmlschema11-2/#vp-dt-timeOnTimeline")_ value of _T2low_, where _T2low_ is the time instant equal to _T2_ but with the time zone offset equal to "+14:00".
-   _T1_ is greater than _T2_ if the _[timeOnTimeline](https://www.w3.org/TR/xmlschema11-2/#vp-dt-timeOnTimeline "http://www.w3.org/TR/xmlschema11-2/#vp-dt-timeOnTimeline")_ value of _T1_ is greater than the _[timeOnTimeline](https://www.w3.org/TR/xmlschema11-2/#vp-dt-timeOnTimeline "http://www.w3.org/TR/xmlschema11-2/#vp-dt-timeOnTimeline")_ value of _T2high_, where _T2high_ is the time instant equal to _T2_ but with the time zone offset equal to "-14:00".

Thus, for _T1_ to be smaller than _T2_, the _[timeOnTimeline](https://www.w3.org/TR/xmlschema11-2/#vp-dt-timeOnTimeline "http://www.w3.org/TR/xmlschema11-2/#vp-dt-timeOnTimeline")_ value of _T1_ should be smaller than the _[timeOnTimeline](https://www.w3.org/TR/xmlschema11-2/#vp-dt-timeOnTimeline "http://www.w3.org/TR/xmlschema11-2/#vp-dt-timeOnTimeline")_ value of _T2_ even if we substitute the largest positive time zone offset in _T2_; the definition of "greater than" is analogous. Note that, for certain _T1_ and _T2_, it is possible that neither condition holds, in which case _T1_ and _T2_ are incomparable.

According to this definition, the datatype restriction mentioned earlier in this example contains the time instant corresponding to the lexical form "1956-01-01T10:00:00Z", but not the one corresponding to "1956-01-01T10:00:00"; the latter is the case because the time instant corresponding to "1956-01-01T10:00:00+14:00" is not greater than or equal to the one corresponding to "1956-01-01T04:00:00-05:00".

### 4.8 XML Literals

The OWL 2 datatype map provides the _rdf:XMLLiteral_ datatype for the representation of XML content in OWL 2 ontologies. The datatype is defined in Section 5.1 of the RDF specification \[[RDF Concepts](#ref-rdf-concepts)\]. It has no normative constraining facets.

## 5 Entities, Literals, and Anonymous Individuals

Entities are the fundamental building blocks of OWL 2 ontologies, and they define the vocabulary — the named terms — of an ontology. In logic, the set of entities is usually said to constitute the _signature_ of an ontology. Apart from entities, OWL 2 ontologies typically also contain literals, such as strings or integers.

The structure of entities and literals in OWL 2 is shown in Figure 2. Classes, datatypes, object properties, data properties, annotation properties, and named individuals are entities, and they are all uniquely identified by an IRI. Classes represent sets of individuals; datatypes are sets of literals such as strings or integers; object and data properties can be used to represent relationships in the domain; annotation properties can be used to associate nonlogical information with ontologies, axioms, and entities; and named individuals can be used to represent actual objects from the domain. Apart from named individuals, OWL 2 also provides for anonymous individuals — that is, individuals that are analogous to blank nodes in RDF \[[RDF Concepts](#ref-rdf-concepts)\] and that are accessible only from within the ontology they are used in. Finally, OWL 2 provides for literals, which consist of a string called a _lexical form_ and a datatype specifying how to interpret this string.

![The Hierarchy of Entities in OWL 2](C_entities.gif)  
Figure 2. Entities, Literals, and Anonymous Individuals in OWL 2

### 5.1 Classes

_Classes_ can be understood as sets of individuals.

Class := IRI

The classes with the IRIs _owl:Thing_ and _owl:Nothing_ are available in OWL 2 as built-in classes with a predefined semantics:

-   The class with IRI _owl:Thing_ represents the set of all individuals. (In the DL literature this is often called the top concept.)
-   The class with IRI _owl:Nothing_ represents the empty set. (In the DL literature this is often called the bottom concept.)

IRIs from the reserved vocabulary other than _owl:Thing_ and _owl:Nothing_ _MUST NOT_ be used to identify classes in an OWL 2 DL ontology.

Classes _a:Child_ and _a:Person_ can be used to represent the set of all children and persons, respectively, in the application domain, and they can be used in an axiom such as the following one:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>SubClassOf( <i>a:Child</i> <i>a:Person</i> )</td><td>Each child is a person.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Child</i> <i>rdfs:subClassOf</i> <i>a:Person</i> .</td><td>Each child is a person.</td></tr></tbody></table>

### 5.2 Datatypes

_Datatypes_ are entities that refer to sets of data values. Thus, datatypes are analogous to classes, the main difference being that the former contain data values such as strings and numbers, rather than individuals. Datatypes are a kind of data range, which allows them to be used in restrictions. As explained in [Section 7](#Data_Ranges), each data range is associated with an arity; for datatypes, the arity is always one. The built-in datatype _rdfs:Literal_ denotes any set of data values that contains the union of the value spaces of all datatypes.

An IRI used to identify a datatype in an OWL 2 DL ontology _MUST_

-   be _rdfs:Literal_, or
-   identify a datatype in the OWL 2 datatype map (see [Section 4](#Datatype_Maps)), or
-   not be in the reserved vocabulary of OWL 2 (see [Section 2.4](#IRIs)).

The conditions from the previous paragraph and the restrictions on datatypes in [Section 11.2](#The_Restrictions_on_the_Axiom_Closure) require each datatype in an OWL 2 DL ontology to be _rdfs:Literal_, one of the datatypes from [Section 4](#Datatype_Maps), or a datatype defined by means of a datatype definition (see [Section 9.4](#Datatype_Definitions)).

Datatype := IRI

The datatype _xsd:integer_ denotes the set of all integers. It can be used in axioms such as the following one:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>DataPropertyRange( <i>a:hasAge</i> <i>xsd:integer</i> )</td><td>The range of the <i>a:hasAge</i> data property is <i>xsd:integer</i>.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasAge</i> <i>rdfs:range</i> <i>xsd:integer</i> .</td><td>The range of the <i>a:hasAge</i> data property is <i>xsd:integer</i>.</td></tr></tbody></table>

### 5.3 Object Properties

_Object properties_ connect pairs of individuals.

ObjectProperty := IRI

The object properties with the IRIs _owl:topObjectProperty_ and _owl:bottomObjectProperty_ are available in OWL 2 as built-in object properties with a predefined semantics:

-   The object property with IRI _owl:topObjectProperty_ connects all possible pairs of individuals.
-   The object property with IRI _owl:bottomObjectProperty_ does not connect any pair of individuals.

IRIs from the reserved vocabulary other than _owl:topObjectProperty_ and _owl:bottomObjectProperty_ _MUST NOT_ be used to identify object properties in an OWL 2 DL ontology.

The object property _a:parentOf_ can be used to represent the parenthood relationship between individuals. It can be used in axioms such as the following one:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ObjectPropertyAssertion( <i>a:parentOf</i> <i>a:Peter</i> <i>a:Chris</i> )</td><td>Peter is a parent of Chris.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Peter</i> <i>a:parentOf</i> <i>a:Chris</i> .</td><td>Peter is a parent of Chris.</td></tr></tbody></table>

### 5.4 Data Properties

_Data properties_ connect individuals with literals. In some knowledge representation systems, functional data properties are called _attributes_.

DataProperty := IRI

The data properties with the IRIs _owl:topDataProperty_ and _owl:bottomDataProperty_ are available in OWL 2 as built-in data properties with a predefined semantics:

-   The data property with IRI _owl:topDataProperty_ connects all possible individuals with all literals.
-   The data property with IRI _owl:bottomDataProperty_ does not connect any individual with a literal.

IRIs from the reserved vocabulary other than _owl:topDataProperty_ and _owl:bottomDataProperty_ _MUST NOT_ be used to identify data properties in an OWL 2 DL ontology.

The data property _a:hasName_ can be used to associate a name with each person. It can be used in axioms such as the following one:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>DataPropertyAssertion( <i>a:hasName</i> <i>a:Peter</i> "Peter Griffin" )</td><td>Peter's name is <span class="name">"Peter Griffin"</span>.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Peter</i> <i>a:hasName</i> "Peter Griffin" .</td><td>Peter's name is <span class="name">"Peter Griffin"</span>.</td></tr></tbody></table>

### 5.5 Annotation Properties

_Annotation properties_ can be used to provide an annotation for an ontology, axiom, or an IRI. The structure of annotations is further described in [Section 10](#Annotations).

AnnotationProperty := IRI

The annotation properties with the IRIs listed below are available in OWL 2 as built-in annotation properties with a predefined semantics:

-   The _rdfs:label_ annotation property can be used to provide an IRI with a human-readable label.
-   The _rdfs:comment_ annotation property can be used to provide an IRI with a human-readable comment.
-   The _rdfs:seeAlso_ annotation property can be used to provide an IRI with another IRI such that the latter provides additional information about the former.
-   The _rdfs:isDefinedBy_ annotation property can be used to provide an IRI with another IRI such that the latter provides information about the definition of the former; the way in which this information is provided is not described by this specification.
-   An annotation with the _owl:deprecated_ annotation property and the value equal to "true"^^_xsd:boolean_ can be used to specify that an IRI is deprecated.
-   The _owl:versionInfo_ annotation property can be used to provide an IRI with a string that describes the IRI's version.
-   The _owl:priorVersion_ annotation property is described in more detail in [Section 3.5](#Ontology_Annotations).
-   The _owl:backwardCompatibleWith_ annotation property is described in more detail in [Section 3.5](#Ontology_Annotations).
-   The _owl:incompatibleWith_ annotation property is described in more detail in [Section 3.5](#Ontology_Annotations).

IRIs from the reserved vocabulary other than the ones listed above _MUST NOT_ be used to identify annotation properties in an OWL 2 DL ontology.

The comment provided by the following annotation assertion axiom might, for example, be used by an OWL 2 tool to display additional information about the IRI _a:Peter_.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>AnnotationAssertion( <i>rdfs:comment</i> <i>a:Peter</i> "The father of the Griffin family from Quahog." )</td><td>This axiom provides a comment for the IRI <i>a:Peter</i>.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Peter</i> <i>rdfs:comment</i> "The father of the Griffin family from Quahog." .</td><td>This axiom provides a comment for the IRI <i>a:Peter</i>.</td></tr></tbody></table>

### 5.6 Individuals

_Individuals_ in the OWL 2 syntax represent actual objects from the domain. There are two types of individuals in the syntax of OWL 2. _Named individuals_ are given an explicit name that can be used in any ontology to refer to the same object. _Anonymous individuals_ do not have a global name and are thus local to the ontology they are contained in.

Individual := NamedIndividual | AnonymousIndividual

#### 5.6.1 Named Individuals

_Named individuals_ are identified using an IRI. Since they are given an IRI, named individuals are entities.

IRIs from the reserved vocabulary _MUST NOT_ be used to identify named individuals in an OWL 2 DL ontology.

NamedIndividual := IRI

The individual _a:Peter_ can be used to represent a particular person. It can be used in axioms such as the following one:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ClassAssertion( <i>a:Person</i> <i>a:Peter</i> )</td><td>Peter is a person.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Peter</i> <i>rdf:type</i> <i>a:Person</i> .</td><td>Peter is a person.</td></tr></tbody></table>

#### 5.6.2 Anonymous Individuals

If an individual is not expected to be used outside a particular ontology, one can use an _anonymous individual_, which is identified by a local node ID rather than a global IRI. Anonymous individuals are analogous to blank nodes in RDF \[[RDF Concepts](#ref-rdf-concepts)\].

AnonymousIndividual := nodeID

Anonymous individuals can be used, for example, to represent objects whose identity is of no relevance, such as the address of a person.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ObjectPropertyAssertion( <i>a:livesAt</i> <i>a:Peter</i> _:a1 )</td><td>Peter lives at some (unknown) address.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:city</i> _:a1 <i>a:Quahog</i> )</td><td>This unknown address is in the city of Quahog and...</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:state</i> _:a1 <i>a:RI</i> )</td><td>...in the state of Rhode Island.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Peter</i> <i>a:livesAt</i> _:a1 .</td><td>Peter lives at some (unknown) address.</td></tr><tr valign="top"><td>_:a1 <i>a:city</i> <i>a:Quahog</i> .</td><td>This unknown address is in the city of Quahog and...</td></tr><tr valign="top"><td>_:a1 <i>a:state</i> <i>a:RI</i> .</td><td>...in the state of Rhode Island.</td></tr></tbody></table>

Special treatment is required in case anonymous individuals with the same node ID occur in two different ontologies. In particular, these two individuals are structurally equivalent (because they have the same node ID); however, they are not treated as identical in the semantics of OWL 2 (because anonymous individuals are local to an ontology they are used in). The latter is achieved by _standardizing anonymous individuals apart_ when constructing the axiom closure of an ontology _O_: if anonymous individuals with the same node ID occur in two different ontologies in the import closure of _O_, then one of these individuals _MUST_ be replaced in the axiom closure of _O_ with a fresh anonymous individual (i.e., an anonymous individual whose node ID is unique in the import closure of _O_).

Assume that ontologies _O1_ and _O2_ both use _\_:a5_, and that _O1_ imports _O2_. Although they both use the same local node ID, the individual _\_:a5_ in _O1_ may be different from the individual _\_:a5_ in _O2_.

At the level of the structural specification, individual _\_:a5_ in _O1_ is structurally equivalent to individual _\_:a5_ in _O2_. This might be important, for example, for tools that use structural equivalence to define the semantics of axiom retraction.

In order to ensure that these individuals are treated differently by the semantics they are standardized apart when computing the axiom closure of _O1_ — either _\_:a5_ in _O1_ is replaced with a fresh anonymous individual, or this is done for _\_:a5_ in _O2_.

### 5.7 Literals

_Literals_ represent data values such as particular strings or integers. They are analogous to typed RDF literals \[[RDF Concepts](#ref-rdf-concepts)\] and can also be understood as individuals denoting data values. Each literal consists of a lexical form, which is a string, and a datatype; the datatypes supported in OWL 2 are described in more detail in [Section 4](#Datatype_Maps). A literal consisting of a lexical form "abc" and a datatype identified by the IRI _datatypeIRI_ is written as "abc"^^_datatypeIRI_. Furthermore, literals whose datatype is _rdf:PlainLiteral_ can be abbreviated in functional-style syntax ontology documents as plain RDF literals \[[RDF Concepts](#ref-rdf-concepts)\]. These abbreviations are purely syntactic shortcuts and are thus not reflected in the structural specification of OWL 2. The observable behavior of OWL 2 implementation _MUST_ be as if these shortcuts were expanded during parsing.

-   Literals of the form "abc@"^^_rdf:PlainLiteral_ _SHOULD_ be abbreviated in functional-style syntax ontology documents to "abc" whenever possible.
-   Literals of the form "abc@langTag"^^_rdf:PlainLiteral_ where "langTag" is not empty _SHOULD_ be abbreviated in functional-style syntax documents to "abc"@langTag whenever possible.

The lexical form of each literal occurring in an OWL 2 DL ontology _MUST_ belong to the lexical space of the literal's datatype.

Literal := typedLiteral | stringLiteralNoLanguage | stringLiteralWithLanguage  
typedLiteral := lexicalForm '^^' Datatype  
lexicalForm := quotedString  
stringLiteralNoLanguage := quotedString  
stringLiteralWithLanguage := quotedString languageTag

"1"^^_xsd:integer_ is a literal that represents the integer 1.

"Family Guy" is an abbreviation for "Family Guy@"^^_rdf:PlainLiteral_ — a literal with the lexical form "Family Guy@" and the datatype _rdf:PlainLiteral_ — which denotes a string "Family Guy" without a language tag.

Furthermore, "Padre de familia"@es is an abbreviation for the literal "Padre de familia@es"^^_rdf:PlainLiteral_, which denotes a pair consisting of the string "Padre de familia" and the language tag es.

Two literals are structurally equivalent if and only if both the lexical form and the datatype are structurally equivalent; that is, literals denoting the same data value are structurally different if either their lexical form or the datatype is different.

Even though literals "1"^^_xsd:integer_ and "+1"^^_xsd:integer_ are interpreted as the integer 1, these two literals are not structurally equivalent because their lexical forms are not identical. Similarly, "1"^^_xsd:integer_ and "1"^^xsd:positiveInteger are not structurally equivalent because their datatypes are not identical.

### 5.8 Entity Declarations and Typing

Each IRI _I_ used in an OWL 2 ontology _O_ can be, and sometimes even needs to be, declared in _O_; roughly speaking, this means that the axiom closure of _O_ must contain an appropriate declaration for _I_. A declaration for _I_ in _O_ serves two purposes:

-   A declaration says that _I_ exists — that is, it says that _I_ is part of the vocabulary of _O_.
-   A declaration associates with _I_ an entity type — that is, it says whether _I_ is used in _O_ as a class, datatype, object property, data property, annotation property, an individual, or a combination thereof.

An ontology might contain a class declaration for the IRI _a:Person_. Such a declaration introduces the class _a:Person_ into the ontology, and it states that the IRI _a:Person_ is used to name a class in the ontology. An ontology editor might use declarations to implement functions such as "Add New Class".

In OWL 2, declarations are a type of axiom; thus, to declare an entity in an ontology, one can simply include the appropriate axiom in the ontology. These axioms are nonlogical in the sense that they do not affect the consequences of an OWL 2 ontology. The structure of entity declarations is shown in Figure 3.

![Entity Declarations in OWL 2](A_declaration.gif)  
Figure 3. Entity Declarations in OWL 2

Declaration := 'Declaration' '(' axiomAnnotations Entity ')'  
Entity :=  
    'Class' '(' Class ')' |  
    'Datatype' '(' Datatype ')' |  
    'ObjectProperty' '(' ObjectProperty ')' |  
    'DataProperty' '(' DataProperty ')' |  
    'AnnotationProperty' '(' AnnotationProperty ')' |  
    'NamedIndividual' '(' NamedIndividual ')'

The following axioms state that the IRI _a:Person_ is used as a class and that the IRI _a:Peter_ is used as an individual.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">Declaration( Class( <i>a:Person</i> ) )</td></tr><tr valign="top"><td colspan="2">Declaration( NamedIndividual( <i>a:Peter</i> ) )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Person</i> <i>rdf:type</i> <i>owl:Class</i> .</td></tr><tr valign="top"><td colspan="2"><i>a:Peter</i> <i>rdf:type</i> <i>owl:NamedIndividual</i> .</td></tr></tbody></table>

Declarations for the built-in entities of OWL 2, listed in Table 5, are implicitly present in every OWL 2 ontology.

<table border="1" class="allname" style="text-align: left"><caption><span class="caption">Table 5.</span> Declarations of Built-In Entities</caption><tbody><tr><td colspan="2">Declaration( Class( <i>owl:Thing</i> ) )</td></tr><tr><td colspan="2">Declaration( Class( <i>owl:Nothing</i> ) )</td></tr><tr><td colspan="2">Declaration( ObjectProperty( <i>owl:topObjectProperty</i> ) )</td></tr><tr><td colspan="2">Declaration( ObjectProperty( <i>owl:bottomObjectProperty</i> ) )</td></tr><tr><td colspan="2">Declaration( DataProperty( <i>owl:topDataProperty</i> ) )</td></tr><tr><td colspan="2">Declaration( DataProperty( <i>owl:bottomDataProperty</i> ) )</td></tr><tr><td colspan="2">Declaration( Datatype( <i>rdfs:Literal</i> ) )</td></tr><tr><td>Declaration( Datatype( <i>I</i> ) )</td><td>for each IRI <i>I</i> of a datatype in the OWL 2 datatype map (see <a href="#Datatype_Maps" title="">Section 4</a>)</td></tr><tr><td>Declaration( AnnotationProperty( <i>I</i> ) )</td><td>for each IRI <i>I</i> of a built-in annotation property listed in <a href="#Annotation_Properties" title="">Section 5.5</a></td></tr></tbody></table>

#### 5.8.1 Typing Constraints of OWL 2 DL

Let _Ax_ be a set of axioms. An IRI _I_ is _declared_ to be of type _T_ in _Ax_ if a declaration axiom of type _T_ for _I_ is contained in _Ax_ or in the set of built-in declarations listed in Table 5. The set _Ax_ satisfies the _typing constraints_ of OWL 2 DL if all of the following conditions are satisfied:

-   Property typing constraints:
    -   If an object property with an IRI _I_ occurs in some axiom in _Ax_, then _I_ is declared in _Ax_ as an object property.
    -   If a data property with an IRI _I_ occurs in some axiom in _Ax_, then _I_ is declared in _Ax_ as a data property.
    -   If an annotation property with an IRI _I_ occurs in some axiom in _Ax_, then _I_ is declared in _Ax_ as an annotation property.
    -   No IRI _I_ is declared in _Ax_ as being of more than one type of property; that is, no _I_ is declared in _Ax_ to be both object and data, object and annotation, or data and annotation property.
-   Class/datatype typing constraints:
    -   If a class with an IRI _I_ occurs in some axiom in _Ax_, then _I_ is declared in _Ax_ as a class.
    -   If a datatype with an IRI _I_ occurs in some axiom in _Ax_, then _I_ is declared in _Ax_ as a datatype.
    -   No IRI _I_ is declared in _ax_ to be both a class and a datatype.

The axiom closure _Ax_ of each OWL 2 DL ontology _O_ _MUST_ satisfy the typing constraints of OWL 2 DL.

The typing constraints thus ensure that the sets of IRIs used as object, data, and annotation properties in _O_ are disjoint and that, similarly, the sets of IRIs used as classes and datatypes in _O_ are disjoint as well. These constraints are used for disambiguating the types of IRIs when reading ontologies from external transfer syntaxes. All other declarations are optional.

An IRI _I_ can be used as an individual in _O_ even if _I_ is not declared as an individual in _O_.

Declarations are often omitted in the examples in this document in cases where the types of entities are clear.

#### 5.8.2 Declaration Consistency

Although declarations are not always required, they can be used to catch obvious errors in ontologies.

The following ontology erroneously refers to the individual _a:Petre_ instead of the individual _a:Peter_.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">Ontology( <i>&lt;http://www.my.example.com/example&gt;</i><br>&nbsp;&nbsp;&nbsp; Declaration( Class( <i>a:Person</i> ) )<br>&nbsp;&nbsp;&nbsp; ClassAssertion( <i>a:Person</i> <i>a:Petre</i> )<br>)</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>&lt;http://www.my.example.com/example&gt;</i> <i>rdf:type</i> <i>owl:Ontology</i> .<br><i>a:Person</i> <i>rdf:type</i> <i>owl:Class</i> .<br><i>a:Petre</i> <i>rdf:type</i> <i>a:Person</i> .</td></tr></tbody></table>

There is no way of telling whether _a:Petre_ was used by mistake. If, in contrast, all individuals in an ontology were by convention required to be declared, this error could be caught by a simple tool.

An ontology _O_ is said to have _consistent declarations_ if each IRI _I_ occurring in the axiom closure of _O_ in position of an entity with a type _T_ is declared in _O_ as having type _T_. OWL 2 ontologies are not required to have consistent declarations: an ontology _MAY_ be used even if its declarations are not consistent.

The ontology from the previous example fails this check: _a:Petre_ is used as an individual but the ontology does not declare _a:Petre_ to be an individual. In contrast, the following ontology satisfies this condition.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">Ontology( <i>&lt;http://www.my.example.com/example&gt;</i><br>&nbsp;&nbsp;&nbsp; Declaration( Class( <i>a:Person</i> ) )<br>&nbsp;&nbsp;&nbsp; Declaration( NamedIndividual( <i>a:Peter</i> ) )<br>&nbsp;&nbsp;&nbsp; ClassAssertion( <i>a:Person</i> <i>a:Peter</i> )<br>)</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>&lt;http://www.my.example.com/example&gt;</i> <i>rdf:type</i> <i>owl:Ontology</i> .<br><i>a:Person</i> <i>rdf:type</i> <i>owl:Class</i> .<br><i>a:Peter</i> <i>rdf:type</i> <i>owl:NamedIndividual</i> .<br><i>a:Peter</i> <i>rdf:type</i> <i>a:Person</i> .</td></tr></tbody></table>

### 5.9 Metamodeling

An IRI _I_ can be used in an OWL 2 ontology to refer to more than one type of entity. Such usage of _I_ is often called _metamodeling_, because it can be used to state facts about classes and properties themselves. In such cases, the entities that share the same IRI _I_ should be understood as different "views" of the same underlying notion identified by the IRI _I_.

Consider the following ontology.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ClassAssertion( <i>a:Dog</i> <i>a:Brian</i> )</td><td>Brian is a dog.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:Species</i> <i>a:Dog</i> )</td><td>Dog is a species.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Brian</i> <i>rdf:type</i> <i>a:Dog</i> .</td><td>Brian is a dog.</td></tr><tr valign="top"><td><i>a:Dog</i> <i>rdf:type</i> <i>a:Species</i> .</td><td>Dog is a species.</td></tr></tbody></table>

In the first axiom, the IRI _a:Dog_ is used as a class, while in the second axiom, it is used as an individual; thus, the class _a:Species_ acts as a metaclass for the class _a:Dog_. The individual _a:Dog_ and the class _a:Dog_ should be understood as two "views" of one and the same IRI — _a:Dog_. Under the OWL 2 Direct Semantics \[[OWL 2 Direct Semantics](#ref-owl-2-direct-semantics)\], these two views are interpreted independently: the class view of _a:Dog_ is interpreted as a unary predicate, while the individual view of _a:Dog_ is interpreted as a constant.

Both metamodeling and annotations provide means to associate additional information with classes and properties. The following rule-of-the-thumb can be used to determine when to use which construct:

-   Metamodeling should be used when the information attached to entities should be considered a part of the domain.
-   Annotations should be used when the information attached to entities should not be considered a part of the domain and when it should not contribute to the logical consequences of an ontology.

Consider the following ontology.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ClassAssertion( <i>a:Dog</i> <i>a:Brian</i> )</td><td>Brian is a dog.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:PetAnimals</i> <i>a:Dog</i> )</td><td>Dogs are pet animals.</td></tr><tr valign="top"><td>AnnotationAssertion( <i>a:addedBy</i> <i>a:Dog</i> "Seth MacFarlane" )</td><td>The IRI <i>a:Dog</i> has been added to the ontology by Seth MacFarlane.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Brian</i> <i>rdf:type</i> <i>a:Dog</i> .</td><td>Brian is a dog.</td></tr><tr valign="top"><td><i>a:Dog</i> <i>rdf:type</i> <i>a:PetAnimals</i> .</td><td>Dogs are pet animals.</td></tr><tr valign="top"><td><i>a:Dog</i> <i>a:addedBy</i> "Seth MacFarlane" .</td><td>The IRI <i>a:Dog</i> has been added to the ontology by Seth MacFarlane.</td></tr></tbody></table>

The facts that Brian is a dog and that dogs are pet animals are statements about the domain. Therefore, these facts are represented in the above ontology via metamodeling. In contrast, the information about who added the IRI _a:Dog_ to the ontology does not describe the actual domain, but might be interesting from a management point of view. Therefore, this information is represented using an annotation.

## 6 Property Expressions

Properties can be used in OWL 2 to form property expressions.

### 6.1 Object Property Expressions

Object properties can by used in OWL 2 to form object property expressions, which represent relationships between pairs of individuals. They are represented in the structural specification of OWL 2 by ObjectPropertyExpression, and their structure is shown in Figure 4.

![Object Property Expressions in OWL 2](C_objectproperty.gif)  
Figure 4. Object Property Expressions in OWL 2

As one can see from the figure, OWL 2 supports only two kinds of object property expressions. Object properties are the simplest form of object property expressions, and inverse object properties allow for bidirectional navigation in class expressions and axioms.

ObjectPropertyExpression := ObjectProperty | InverseObjectProperty

#### 6.1.1 Inverse Object Properties

An inverse object property expression ObjectInverseOf( P ) connects an individual I1 with I2 if and only if the object property P connects I2 with I1.

InverseObjectProperty := 'ObjectInverseOf' '(' ObjectProperty ')'

Consider the ontology consisting of the following assertion.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ObjectPropertyAssertion( <i>a:fatherOf</i> <i>a:Peter</i> <i>a:Stewie</i> )</td><td>Peter is Stewie's father.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Peter</i> <i>a:fatherOf</i> <i>a:Stewie</i> .</td><td>Peter is Stewie's father.</td></tr></tbody></table>

This ontology entails that _a:Stewie_ is connected by the following object property expression to _a:Peter_:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectInverseOf( <i>a:fatherOf</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x owl:inverseOf <i>a:fatherOf</i> .</td></tr></tbody></table>

### 6.2 Data Property Expressions

For symmetry with object property expressions, the structural specification of OWL 2 also introduces data property expressions, which represent relationships between an individual and a literal. The structure of data property expressions is shown in Figure 5. The only allowed data property expression is a data property; thus, DataPropertyExpression in the structural specification of OWL 2 can be seen as a place-holder for possible future extensions.

![Data Property Expressions in OWL 2](C_dataproperty.gif)  
Figure 5. Data Property Expressions in OWL 2

DataPropertyExpression := DataProperty

## 7 Data Ranges

Datatypes, such as _xsd:string_ or _xsd:integer_, and literals such as "1"^^_xsd:integer_, can be used to express data ranges — sets of tuples of literals, where tuples consisting of only one literal are identified with the literal itself. Each data range is associated with a positive arity, which determines the size of the tuples in the data range. All datatypes have arity one. This specification currently does not define data ranges of arity more than one; however, by allowing for _n_\-ary data ranges, the syntax of OWL 2 provides a "hook" allowing implementations to introduce extensions such as comparisons and arithmetic.

Data ranges can be used in restrictions on data properties, as discussed in Sections [8.4](#Data_Property_Restrictions) and [8.5](#Data_Property_Cardinality_Restrictions). The structure of data ranges in OWL 2 is shown in Figure 6. The simplest data ranges are datatypes. The DataIntersectionOf, DataUnionOf, and DataComplementOf data ranges provide for the standard set-theoretic operations on data ranges; in logical languages these are usually called conjunction, disjunction, and negation, respectively. The DataOneOf data range consists of exactly the specified set of literals. Finally, the DatatypeRestriction data range restricts the value space of a datatype by a constraining facet.

![Data Ranges in OWL 2](C_datarange.gif)  
Figure 6. Data Ranges in OWL 2

DataRange :=  
    Datatype |  
    DataIntersectionOf |  
    DataUnionOf |  
    DataComplementOf |  
    DataOneOf |  
    DatatypeRestriction

### 7.1 Intersection of Data Ranges

An intersection data range DataIntersectionOf( DR1 ... DRn ) contains all tuples of literals that are contained in each data range DRi for 1 ≤ i ≤ n. All data ranges DRi _MUST_ be of the same arity, and the resulting data range is of that arity as well.

DataIntersectionOf := 'DataIntersectionOf' '(' DataRange DataRange { DataRange } ')'

The following data range contains exactly the integer 0:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DataIntersectionOf( <i>xsd:nonNegativeInteger</i> <i>xsd:nonPositiveInteger</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>rdfs:Datatype</i> .<br>_:x <i>owl:intersectionOf</i> ( <i>xsd:nonNegativeInteger</i> <i>xsd:nonPositiveInteger</i> ) .</td></tr></tbody></table>

### 7.2 Union of Data Ranges

A union data range DataUnionOf( DR1 ... DRn ) contains all tuples of literals that are contained in the at least one data range DRi for 1 ≤ i ≤ n. All data ranges DRi _MUST_ be of the same arity, and the resulting data range is of that arity as well.

DataUnionOf := 'DataUnionOf' '(' DataRange DataRange { DataRange } ')'

The following data range contains all strings and all integers:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DataUnionOf( <i>xsd:string</i> <i>xsd:integer</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>rdfs:Datatype</i> .<br>_:x <i>owl:unionOf</i> ( <i>xsd:string</i> <i>xsd:integer</i> ) .</td></tr></tbody></table>

### 7.3 Complement of Data Ranges

A complement data range DataComplementOf( DR ) contains all tuples of literals that are not contained in the data range DR. The resulting data range has the arity equal to the arity of DR.

DataComplementOf := 'DataComplementOf' '(' DataRange ')'

The following complement data range contains literals that are not positive integers:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DataComplementOf( <i>xsd:positiveInteger</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>rdfs:Datatype</i> .<br>_:x <i>owl:complementOf</i> <i>xsd:positiveInteger</i> .</td></tr></tbody></table>

In particular, this data range contains the integer zero and all negative integers; however, it also contains all strings (since strings are not positive integers).

### 7.4 Enumeration of Literals

An enumeration of literals DataOneOf( lt1 ... ltn ) contains exactly the explicitly specified literals lti with 1 ≤ i ≤ n. The resulting data range has arity one.

DataOneOf := 'DataOneOf' '(' Literal { Literal } ')'

The following data range contains exactly two literals: the string "Peter" and the integer one.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DataOneOf( "Peter" "1"^^<i>xsd:integer</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>rdfs:Datatype</i> .<br>_:x <i>owl:oneOf</i> ( "Peter" "1"^^<i>xsd:integer</i> ) .</td></tr></tbody></table>

### 7.5 Datatype Restrictions

A datatype restriction DatatypeRestriction( DT F1 lt1 ... Fn ltn ) consists of a unary datatype DT and n pairs ( Fi , lti ). The resulting data range is unary and is obtained by restricting the value space of DT according to the semantics of all ( Fi , vi ) (multiple pairs are interpreted conjunctively), where vi are the data values of the literals lti.

In an OWL 2 DL ontology, each pair ( Fi , vi ) _MUST_ be contained in the facet space of DT (see [Section 4](#Datatype_Maps)).

DatatypeRestriction := 'DatatypeRestriction' '(' Datatype constrainingFacet restrictionValue { constrainingFacet restrictionValue } ')'  
constrainingFacet := IRI  
restrictionValue := Literal

The following data range contains exactly the integers 5, 6, 7, 8, and 9:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DatatypeRestriction( <i>xsd:integer</i> <i>xsd:minInclusive</i> "5"^^<i>xsd:integer</i> <i>xsd:maxExclusive</i> "10"^^<i>xsd:integer</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>rdfs:Datatype</i> .<br>_:x <i>owl:onDatatype</i> <i>xsd:integer</i> .<br>_:x <i>owl:withRestrictions</i> ( _:y _:z ) .<br>_:y <i>xsd:minInclusive</i> "5"^^<i>xsd:integer</i> .<br>_:z <i>xsd:maxExclusive</i> "10"^^<i>xsd:integer</i> .</td></tr></tbody></table>

## 8 Class Expressions

In OWL 2, classes and property expressions are used to construct _class expressions_, sometimes also called _descriptions_, and, in the description logic literature, _complex concepts_. Class expressions represent sets of individuals by formally specifying conditions on the individuals' properties; individuals satisfying these conditions are said to be _instances_ of the respective class expressions. In the structural specification of OWL 2, class expressions are represented by ClassExpression.

A class expression can be used to represent the set of "people that have at least one child". If an ontology additionally contains statements that "Peter is a person" and that "Peter has child Chris", then Peter can be classified as an instance of the mentioned class expression.

OWL 2 provides a rich set of primitives that can be used to construct class expressions. In particular, it provides the well known Boolean connectives _and_, _or_, and _not_; a restricted form of universal and existential quantification; number restrictions; enumeration of individuals; and a special _self_\-restriction.

As shown in Figure 2, classes are the simplest form of class expressions. The other, complex, class expressions, are described in the following sections.

ClassExpression :=  
    Class |  
    ObjectIntersectionOf | ObjectUnionOf | ObjectComplementOf | ObjectOneOf |  
    ObjectSomeValuesFrom | ObjectAllValuesFrom | ObjectHasValue | ObjectHasSelf |  
    ObjectMinCardinality | ObjectMaxCardinality | ObjectExactCardinality |  
    DataSomeValuesFrom | DataAllValuesFrom | DataHasValue |  
    DataMinCardinality | DataMaxCardinality | DataExactCardinality

### 8.1 Propositional Connectives and Enumeration of Individuals

OWL 2 provides for enumeration of individuals and all standard Boolean connectives, as shown in Figure 7. The ObjectIntersectionOf, ObjectUnionOf, and ObjectComplementOf class expressions provide for the standard set-theoretic operations on class expressions; in logical languages these are usually called conjunction, disjunction, and negation, respectively. The ObjectOneOf class expression contains exactly the specified individuals.

![Propositional Connectives and Enumeration of Individuals in OWL 2](C_propositional.gif)  
Figure 7. Propositional Connectives and Enumeration of Individuals in OWL 2

#### 8.1.1 Intersection of Class Expressions

An intersection class expression ObjectIntersectionOf( CE1 ... CEn ) contains all individuals that are instances of all class expressions CEi for 1 ≤ i ≤ n.

ObjectIntersectionOf := 'ObjectIntersectionOf' '(' ClassExpression ClassExpression { ClassExpression } ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ClassAssertion( <i>a:Dog</i> <i>a:Brian</i> )</td><td>Brian is a dog.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:CanTalk</i> <i>a:Brian</i> )</td><td>Brian can talk.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Brian</i> <i>rdf:type</i> <i>a:Dog</i> .</td><td>Brian is a dog.</td></tr><tr valign="top"><td><i>a:Brian</i> <i>rdf:type</i> <i>a:CanTalk</i> .</td><td>Brian can talk.</td></tr></tbody></table>

The following class expression describes all dogs that can talk; furthermore, _a:Brian_ is classified as its instance.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectIntersectionOf( <i>a:Dog</i> <i>a:CanTalk</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>owl:Class</i> .<br>_:x <i>owl:intersectionOf</i> ( <i>a:Dog</i> <i>a:CanTalk</i> ) .</td></tr></tbody></table>

#### 8.1.2 Union of Class Expressions

A union class expression ObjectUnionOf( CE1 ... CEn ) contains all individuals that are instances of at least one class expression CEi for 1 ≤ i ≤ n.

ObjectUnionOf := 'ObjectUnionOf' '(' ClassExpression ClassExpression { ClassExpression } ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ClassAssertion( <i>a:Man</i> <i>a:Peter</i> )</td><td>Peter is a man.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:Woman</i> <i>a:Lois</i> )</td><td>Lois is a woman.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Peter</i> <i>rdf:type</i> <i>a:Man</i> .</td><td>Peter is a man.</td></tr><tr valign="top"><td><i>a:Lois</i> <i>rdf:type</i> <i>a:Woman</i> .</td><td>Lois is a woman.</td></tr></tbody></table>

The following class expression describes all individuals that are instances of either _a:Man_ or _a:Woman_; furthermore, both _a:Peter_ and _a:Lois_ are classified as its instances:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectUnionOf( <i>a:Man</i> <i>a:Woman</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>owl:Class</i> .<br>_:x <i>owl:unionOf</i> ( <i>a:Man</i> <i>a:Woman</i> ) .</td></tr></tbody></table>

#### 8.1.3 Complement of Class Expressions

A complement class expression ObjectComplementOf( CE ) contains all individuals that are not instances of the class expression CE.

ObjectComplementOf := 'ObjectComplementOf' '(' ClassExpression ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>DisjointClasses( <i>a:Man</i> <i>a:Woman</i> )</td><td>Nothing can be both a man and a woman.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:Woman</i> <i>a:Lois</i> )</td><td>Lois is a woman.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Man</i> <i>owl:disjointWith</i> <i>a:Woman</i> .</td><td>Nothing can be both a man and a woman.</td></tr><tr valign="top"><td><i>a:Lois</i> <i>rdf:type</i> <i>a:Woman</i> .</td><td>Lois is a woman.</td></tr></tbody></table>

The following class expression describes all things that are not instances of _a:Man_:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectComplementOf( <i>a:Man</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>owl:Class</i> .<br>_:x <i>owl:complementOf</i> <i>a:Man</i> .</td></tr></tbody></table>

Since _a:Lois_ is known to be a woman and nothing can be both a man and a woman, then _a:Lois_ is necessarily not a _a:Man_; therefore, _a:Lois_ is classified as an instance of this complement class expression.

OWL 2 has _open-world_ semantics, so negation in OWL 2 is the same as in classical (first-order) logic. To understand open-world semantics, consider the ontology consisting of the following assertion.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ClassAssertion( <i>a:Dog</i> <i>a:Brian</i> )</td><td>Brian is a dog.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Brian</i> <i>rdf:type</i> <i>a:Dog</i> .</td><td>Brian is a dog.</td></tr></tbody></table>

One might expect _a:Brian_ to be classified as an instance of the following class expression:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectComplementOf( <i>a:Bird</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>owl:Class</i> .<br>_:x <i>owl:complementOf</i> <i>a:Bird</i> .</td></tr></tbody></table>

Intuitively, the ontology does not explicitly state that _a:Brian_ is an instance of _a:Bird_, so this statement seems to be false. In OWL 2, however, this is not the case: it is true that the ontology does not state that _a:Brian_ is an instance of _a:Bird_; however, the ontology does not state the opposite either. In other words, this ontology simply does not contain enough information to answer the question whether _a:Brian_ is an instance of _a:Bird_ or not: it is perfectly possible that the information to that effect is actually true but it has not been included in the ontology.

The ontology from the previous example (in which _a:Lois_ has been classified as _a:Man_), however, contains sufficient information to draw the expected conclusion. In particular, we know for sure that _a:Lois_ is an instance of _a:Woman_ and that _a:Man_ and _a:Woman_ do not share instances. Therefore, any additional information that does not lead to inconsistency cannot lead to a conclusion that _a:Lois_ is an instance of _a:Man_; furthermore, if one were to explicitly state that _a:Lois_ is an instance of _a:Man_, the ontology would be inconsistent and, by definition, it then entails all possible conclusions.

#### 8.1.4 Enumeration of Individuals

An enumeration of individuals ObjectOneOf( a1 ... an ) contains exactly the individuals ai with 1 ≤ i ≤ n.

ObjectOneOf := 'ObjectOneOf' '(' Individual { Individual }')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>EquivalentClasses( <i>a:GriffinFamilyMember</i><br>&nbsp;&nbsp;&nbsp; ObjectOneOf( <i>a:Peter</i> <i>a:Lois</i> <i>a:Stewie</i> <i>a:Meg</i> <i>a:Chris</i> <i>a:Brian</i> )<br>)</td><td>The Griffin family consists exactly of Peter, Lois, Stewie, Meg, Chris, and Brian.</td></tr><tr valign="top"><td>DifferentIndividuals( <i>a:Quagmire</i> <i>a:Peter</i> <i>a:Lois</i> <i>a:Stewie</i> <i>a:Meg</i> <i>a:Chris</i> <i>a:Brian</i> )</td><td>Quagmire, Peter, Lois, Stewie, Meg, Chris, and Brian are all different from each other.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:GriffinFamilyMember</i> <i>owl:equivalentClass</i> _:x .<br>_:x <i>rdf:type</i> <i>owl:Class</i> .<br>_:x <i>owl:oneOf</i> ( <i>a:Peter</i> <i>a:Lois</i> <i>a:Stewie</i> <i>a:Meg</i> <i>a:Chris</i> <i>a:Brian</i> ) .</td><td>The Griffin family consists exactly of Peter, Lois, Stewie, Meg, and Brian.</td></tr><tr valign="top"><td>_:y <i>rdf:type</i> <i>owl:AllDifferent</i> .<br>_:y <i>owl:members</i> ( <i>a:Quagmire</i> <i>a:Peter</i> <i>a:Lois</i> <i>a:Stewie</i> <i>a:Meg</i> <i>a:Chris</i> <i>a:Brian</i> ) .</td><td>Quagmire, Peter, Lois, Stewie, Meg, Chris, and Brian are all different from each other.</td></tr></tbody></table>

The class _a:GriffinFamilyMember_ now contains exactly the six explicitly listed individuals. Since we also know that _a:Quagmire_ is different from these six individuals, this individual is classified as an instance of the following class expression:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectComplementOf( <i>a:GriffinFamilyMember</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:z <i>rdf:type</i> <i>owl:Class</i> .<br>_:z <i>owl:complementOf</i> <i>a:GriffinFamilyMember</i> .</td></tr></tbody></table>

The last axiom in the ontology is necessary to derive the mentioned conclusion; without it, the open-world semantics of OWL 2 would allow for situations where _a:Quagmire_ is the same as _a:Peter_, _a:Lois_, _a:Stewie_, _a:Meg_, _a:Chris_, or _a:Brian_.

To understand how the open-world semantics affects enumerations of individuals, consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ClassAssertion( <i>a:GriffinFamilyMember</i> <i>a:Peter</i> )</td><td>Peter is a member of the Griffin Family.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:GriffinFamilyMember</i> <i>a:Lois</i> )</td><td>Lois is a member of the Griffin Family.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:GriffinFamilyMember</i> <i>a:Stewie</i> )</td><td>Stewie is a member of the Griffin Family.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:GriffinFamilyMember</i> <i>a:Meg</i> )</td><td>Meg is a member of the Griffin Family.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:GriffinFamilyMember</i> <i>a:Chris</i> )</td><td>Chris is a member of the Griffin Family.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:GriffinFamilyMember</i> <i>a:Brian</i> )</td><td>Brian is a member of the Griffin Family.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Peter</i> <i>rdf:type</i> <i>a:GriffinFamilyMember</i> .</td><td>Peter is a member of the Griffin Family.</td></tr><tr valign="top"><td><i>a:Lois</i> <i>rdf:type</i> <i>a:GriffinFamilyMember</i> .</td><td>Lois is a member of the Griffin Family.</td></tr><tr valign="top"><td><i>a:Stewie</i> <i>rdf:type</i> <i>a:GriffinFamilyMember</i> .</td><td>Stewie is a member of the Griffin Family.</td></tr><tr valign="top"><td><i>a:Meg</i> <i>rdf:type</i> <i>a:GriffinFamilyMember</i> .</td><td>Meg is a member of the Griffin Family.</td></tr><tr valign="top"><td><i>a:Chris</i> <i>rdf:type</i> <i>a:GriffinFamilyMember</i> .</td><td>Chris is a member of the Griffin Family.</td></tr><tr valign="top"><td><i>a:Brian</i> <i>rdf:type</i> <i>a:GriffinFamilyMember</i> .</td><td>Brian is a member of the Griffin Family.</td></tr></tbody></table>

The class _a:GriffinFamilyMember_ now also contains the mentioned six individuals, just as in the previous example. The main difference to the previous example, however, is that the extension of _a:GriffinFamilyMember_ is not closed: the semantics of OWL 2 assumes that information about a potential instance of _a:GriffinFamilyMember_ may be missing. Therefore, _a:Quagmire_ is now not classified as an instance of the following class expression, and this does not change even if we add the axiom stating that all of these six individuals are different from each other:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectComplementOf( <i>a:GriffinFamilyMember</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>owl:Class</i> .<br>_:x <i>owl:complementOf</i> <i>a:GriffinFamilyMember</i> .</td></tr></tbody></table>

### 8.2 Object Property Restrictions

Class expressions in OWL 2 can be formed by placing restrictions on object property expressions, as shown in Figure 8. The ObjectSomeValuesFrom class expression allows for existential quantification over an object property expression, and it contains those individuals that are connected through an object property expression to at least one instance of a given class expression. The ObjectAllValuesFrom class expression allows for universal quantification over an object property expression, and it contains those individuals that are connected through an object property expression only to instances of a given class expression. The ObjectHasValue class expression contains those individuals that are connected by an object property expression to a particular individual. Finally, the ObjectHasSelf class expression contains those individuals that are connected by an object property expression to themselves.

![Restricting Object Property Expressions in OWL 2](C_objectmodal.gif)  
Figure 8. Restricting Object Property Expressions in OWL 2

#### 8.2.1 Existential Quantification

An existential class expression ObjectSomeValuesFrom( OPE CE ) consists of an object property expression OPE and a class expression CE, and it contains all those individuals that are connected by OPE to an individual that is an instance of CE. Provided that OPE is _simple_ according to the definition in [Section 11](#Global_Restrictions_on_Axioms_in_OWL_2_DL), such a class expression can be seen as a syntactic shortcut for the class expression ObjectMinCardinality( 1 OPE CE ).

ObjectSomeValuesFrom := 'ObjectSomeValuesFrom' '(' ObjectPropertyExpression ClassExpression ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ObjectPropertyAssertion( <i>a:fatherOf</i> <i>a:Peter</i> <i>a:Stewie</i> )</td><td>Peter is Stewie's father.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:Man</i> <i>a:Stewie</i> )</td><td>Stewie is a man.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Peter</i> <i>a:fatherOf</i> <i>a:Stewie</i> .</td><td>Peter is Stewie's father.</td></tr><tr valign="top"><td><i>a:Stewie</i> <i>rdf:type</i> <i>a:Man</i> .</td><td>Stewie is a man.</td></tr></tbody></table>

The following existential expression contains those individuals that are connected by the _a:fatherOf_ property to individuals that are instances of _a:Man_; furthermore, _a:Peter_ is classified as its instance:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectSomeValuesFrom( <i>a:fatherOf</i> <i>a:Man</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:x <i>owl:onProperty</i> <i>a:fatherOf</i> .<br>_:x <i>owl:someValuesFrom</i> <i>a:Man</i> .</td></tr></tbody></table>

#### 8.2.2 Universal Quantification

A universal class expression ObjectAllValuesFrom( OPE CE ) consists of an object property expression OPE and a class expression CE, and it contains all those individuals that are connected by OPE only to individuals that are instances of CE. Provided that OPE is _simple_ according to the definition in [Section 11](#Global_Restrictions_on_Axioms_in_OWL_2_DL), such a class expression can be seen as a syntactic shortcut for the class expression ObjectMaxCardinality( 0 OPE ObjectComplementOf( CE ) ).

ObjectAllValuesFrom := 'ObjectAllValuesFrom' '(' ObjectPropertyExpression ClassExpression ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasPet</i> <i>a:Peter</i> <i>a:Brian</i> )</td><td>Brian is a pet of Peter.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:Dog</i> <i>a:Brian</i> )</td><td>Brian is a dog.</td></tr><tr valign="top"><td>ClassAssertion( ObjectMaxCardinality( 1 <i>a:hasPet</i> ) <i>a:Peter</i> )</td><td>Peter has at most one pet.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Peter</i> <i>a:hasPet</i> <i>a:Brian</i> .</td><td>Brian is a pet of Peter.</td></tr><tr valign="top"><td><i>a:Brian</i> <i>rdf:type</i> <i>a:Dog</i> .</td><td>Brian is a dog.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>rdf:type</i> _:x .<br>_:x <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:x <i>owl:maxCardinality</i> "1"^^<i>xsd:nonNegativeInteger</i> .<br>_:x <i>owl:onProperty</i> <i>a:hasPet</i> .</td><td>Peter has at most one pet.</td></tr></tbody></table>

The following universal expression contains those individuals that are connected through the _a:hasPet_ property only with individuals that are instances of _a:Dog_ — that is, it contains individuals that have only dogs as pets:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectAllValuesFrom( <i>a:hasPet</i> <i>a:Dog</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:y <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:y <i>owl:onProperty</i> <i>a:hasPet</i> .<br>_:y <i>owl:allValuesFrom</i> <i>a:Dog</i> .</td></tr></tbody></table>

The ontology axioms clearly state that _a:Peter_ is connected by _a:hasPet_ only to instances of _a:Dog_: it is impossible to connect _a:Peter_ by _a:hasPet_ to an individual different from _a:Brian_ without making the ontology inconsistent. Therefore, _a:Peter_ is classified as an instance of the mentioned class expression.

The last axiom — that is, the one stating that _a:Peter_ has at most one pet — is critical for the inference from the previous paragraph due to the open-world semantics of OWL 2. Without this axiom, the ontology might not have listed all the individuals to which _a:Peter_ is connected by _a:hasPet_. In such a case _a:Peter_ would not be classified as an instance of the mentioned class expression.

#### 8.2.3 Individual Value Restriction

A has-value class expression ObjectHasValue( OPE a ) consists of an object property expression OPE and an individual a, and it contains all those individuals that are connected by OPE to a. Each such class expression can be seen as a syntactic shortcut for the class expression ObjectSomeValuesFrom( OPE ObjectOneOf( a ) ).

ObjectHasValue := 'ObjectHasValue' '(' ObjectPropertyExpression Individual ')'

Consider the ontology consisting of the following axiom.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ObjectPropertyAssertion( <i>a:fatherOf</i> <i>a:Peter</i> <i>a:Stewie</i> )</td><td>Peter is Stewie's father.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Peter</i> <i>a:fatherOf</i> <i>a:Stewie</i> .</td><td>Peter is Stewie's father.</td></tr></tbody></table>

The following has-value class expression contains those individuals that are connected through the _a:fatherOf_ property with the individual _a:Stewie_; furthermore, _a:Peter_ is classified as its instance:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectHasValue( <i>a:fatherOf</i> <i>a:Stewie</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:x <i>owl:onProperty</i> <i>a:fatherOf</i> .<br>_:x <i>owl:hasValue</i> <i>a:Stewie</i> .</td></tr></tbody></table>

#### 8.2.4 Self-Restriction

A self-restriction ObjectHasSelf( OPE ) consists of an object property expression OPE, and it contains all those individuals that are connected by OPE to themselves.

ObjectHasSelf := 'ObjectHasSelf' '(' ObjectPropertyExpression ')'

Consider the ontology consisting of the following axiom.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ObjectPropertyAssertion( <i>a:likes</i> <i>a:Peter</i> <i>a:Peter</i> )</td><td>Peter likes Peter.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Peter</i> <i>a:likes</i> <i>a:Peter</i> .</td><td>Peter likes Peter.</td></tr></tbody></table>

The following self-restriction contains those individuals that like themselves; furthermore, _a:Peter_ is classified as its instance:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectHasSelf( <i>a:likes</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:x <i>owl:onProperty</i> <i>a:likes</i> .<br>_:x <i>owl:hasSelf</i> "true"^^<i>xsd:boolean</i> .</td></tr></tbody></table>

### 8.3 Object Property Cardinality Restrictions

Class expressions in OWL 2 can be formed by placing restrictions on the cardinality of object property expressions, as shown in Figure 9. All cardinality restrictions can be qualified or unqualified: in the former case, the cardinality restriction only applies to individuals that are connected by the object property expression and are instances of the qualifying class expression; in the latter case the restriction applies to all individuals that are connected by the object property expression (this is equivalent to the qualified case with the qualifying class expression equal to _owl:Thing_). The class expressions ObjectMinCardinality, ObjectMaxCardinality, and ObjectExactCardinality contain those individuals that are connected by an object property expression to at least, at most, and exactly a given number of instances of a specified class expression, respectively.

![Restricting the Cardinality of Object Property Expressions in OWL 2](C_objectcardinality.gif)  
Figure 9. Restricting the Cardinality of Object Property Expressions in OWL 2

#### 8.3.1 Minimum Cardinality

A minimum cardinality expression ObjectMinCardinality( n OPE CE ) consists of a nonnegative integer n, an object property expression OPE, and a class expression CE, and it contains all those individuals that are connected by OPE to at least n different individuals that are instances of CE. If CE is missing, it is taken to be _owl:Thing_.

ObjectMinCardinality := 'ObjectMinCardinality' '(' nonNegativeInteger ObjectPropertyExpression \[ ClassExpression \] ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ObjectPropertyAssertion( <i>a:fatherOf</i> <i>a:Peter</i> <i>a:Stewie</i> )</td><td>Peter is Stewie's father.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:Man</i> <i>a:Stewie</i> )</td><td>Stewie is a man.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:fatherOf</i> <i>a:Peter</i> <i>a:Chris</i> )</td><td>Peter is Chris's father.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:Man</i> <i>a:Chris</i> )</td><td>Chris is a man.</td></tr><tr valign="top"><td>DifferentIndividuals( <i>a:Chris</i> <i>a:Stewie</i> )</td><td>Chris and Stewie are different from each other.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Peter</i> <i>a:fatherOf</i> <i>a:Stewie</i> .</td><td>Peter is Stewie's father.</td></tr><tr valign="top"><td><i>a:Stewie</i> <i>rdf:type</i> <i>a:Man</i> .</td><td>Stewie is a man.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:fatherOf</i> <i>a:Chris</i> .</td><td>Peter is Chris's father.</td></tr><tr valign="top"><td><i>a:Chris</i> <i>rdf:type</i> <i>a:Man</i> .</td><td>Chris is a man.</td></tr><tr valign="top"><td><i>a:Chris</i> <i>owl:differentFrom</i> <i>a:Stewie</i> .</td><td>Chris and Stewie are different from each other.</td></tr></tbody></table>

The following minimum cardinality expression contains those individuals that are connected by _a:fatherOf_ to at least two different instances of _a:Man_:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectMinCardinality( 2 <i>a:fatherOf</i> <i>a:Man</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:x <i>owl:minQualifiedCardinality</i> "2"^^<i>xsd:nonNegativeInteger</i> .<br>_:x <i>owl:onProperty</i> <i>a:fatherOf</i> .<br>_:x <i>owl:onClass</i> <i>a:Man</i> .</td></tr></tbody></table>

Since _a:Stewie_ and _a:Chris_ are both instances of _a:Man_ and are different from each other, _a:Peter_ is classified as an instance of this class expression.

Due to the open-world semantics, the last axiom — the one stating that _a:Chris_ and _a:Stewie_ are different from each other — is necessary for this inference: without this axiom, it is possible that _a:Chris_ and _a:Stewie_ are actually the same individual.

#### 8.3.2 Maximum Cardinality

A maximum cardinality expression ObjectMaxCardinality( n OPE CE ) consists of a nonnegative integer n, an object property expression OPE, and a class expression CE, and it contains all those individuals that are connected by OPE to at most n different individuals that are instances of CE. If CE is missing, it is taken to be _owl:Thing_.

ObjectMaxCardinality := 'ObjectMaxCardinality' '(' nonNegativeInteger ObjectPropertyExpression \[ ClassExpression \] ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasPet</i> <i>a:Peter</i> <i>a:Brian</i> )</td><td>Brian is a pet of Peter.</td></tr><tr valign="top"><td>ClassAssertion( ObjectMaxCardinality( 1 <i>a:hasPet</i> ) <i>a:Peter</i> )</td><td>Peter has at most one pet.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Peter</i> <i>a:hasPet</i> <i>a:Brian</i> .</td><td>Brian is a pet of Peter.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>rdf:type</i> _:x .<br>_:x <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:x <i>owl:maxCardinality</i> "1"^^<i>xsd:nonNegativeInteger</i> .<br>_:x <i>owl:onProperty</i> <i>a:hasPet</i> .</td><td>Peter has at most one pet.</td></tr></tbody></table>

The following maximum cardinality expression contains those individuals that are connected by _a:hasPet_ to at most two individuals:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectMaxCardinality( 2 <i>a:hasPet</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:y <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:y <i>owl:maxCardinality</i> "2"^^<i>xsd:nonNegativeInteger</i> .<br>_:y <i>owl:onProperty</i> <i>a:hasPet</i> .</td></tr></tbody></table>

Since _a:Peter_ is known to be connected by _a:hasPet_ to at most one individual, it is certainly also connected by _a:hasPet_ to at most two individuals so, consequently, _a:Peter_ is classified as an instance of this class expression.

The example ontology explicitly names only _a:Brian_ as being connected by _a:hasPet_ from _a:Peter_, so one might expect _a:Peter_ to be classified as an instance of the mentioned class expression even without the second axiom. This, however, is not the case due to the open-world semantics. Without the last axiom, it is possible that _a:Peter_ is connected by _a:hasPet_ to other individuals. The second axiom closes the set of individuals that _a:Peter_ is connected to by _a:hasPet_.

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasDaughter</i> <i>a:Peter</i> <i>a:Meg</i> )</td><td>Meg is a daughter of Peter.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasDaughter</i> <i>a:Peter</i> <i>a:Megan</i> )</td><td>Megan is a daughter of Peter.</td></tr><tr valign="top"><td>ClassAssertion( ObjectMaxCardinality( 1 <i>a:hasDaughter</i> ) <i>a:Peter</i> )</td><td>Peter has at most one daughter.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Peter</i> <i>a:hasDaughter</i> <i>a:Meg</i> .</td><td>Meg is a daughter of Peter.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:hasDaughter</i> <i>a:Megan</i> .</td><td>Megan is a daughter of Peter.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>rdf:type</i> _:x .<br>_:x <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:x <i>owl:maxCardinality</i> "1"^^<i>xsd:nonNegativeInteger</i> .<br>_:x <i>owl:onProperty</i> <i>a:hasDaughter</i> .</td><td>Peter has at most one daughter.</td></tr></tbody></table>

One might expect this ontology to be inconsistent: on the one hand, it says that _a:Meg_ and _a:Megan_ are connected to _a:Peter_ by _a:hasDaughter_, but, on the other hand, it says that _a:Peter_ is connected by _a:hasDaughter_ to at most one individual. This ontology, however, is not inconsistent because the semantics of OWL 2 does not make the _unique name assumption_ — that is, it does not assume distinct individuals to be necessarily different. For example, the ontology does not explicitly say that _a:Meg_ and _a:Megan_ are different individuals; therefore, since _a:Peter_ can be connected by _a:hasDaughter_ to at most one distinct individual, _a:Meg_ and _a:Megan_ must be the same. This example ontology thus entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">SameIndividual( <i>a:Meg</i> <i>a:Megan</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Meg</i> <i>owl:sameAs</i> <i>a:Megan</i> .</td></tr></tbody></table>

One can axiomatize the unique name assumption in OWL 2 by explicitly stating that all individuals are different from each other. This can be done by adding the following axiom, which makes the example ontology inconsistent.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>DifferentIndividuals( <i>a:Peter</i> <i>a:Meg</i> <i>a:Megan</i> )</td><td>Peter, Meg, and Megan are all different from each other.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td>_:y <i>rdf:type</i> <i>owl:AllDifferent</i> .<br>_:y <i>owl:members</i> ( <i>a:Peter</i> <i>a:Meg</i> <i>a:Megan</i> ) .</td><td>Peter, Meg, and Megan are all different from each other.</td></tr></tbody></table>

#### 8.3.3 Exact Cardinality

An exact cardinality expression ObjectExactCardinality( n OPE CE ) consists of a nonnegative integer n, an object property expression OPE, and a class expression CE, and it contains all those individuals that are connected by OPE to exactly n different individuals that are instances of CE. If CE is missing, it is taken to be _owl:Thing_. Such an expression is actually equivalent to the expression

ObjectIntersectionOf( ObjectMinCardinality( n OPE CE ) ObjectMaxCardinality( n OPE CE ) ).

ObjectExactCardinality := 'ObjectExactCardinality' '(' nonNegativeInteger ObjectPropertyExpression \[ ClassExpression \] ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasPet</i> <i>a:Peter</i> <i>a:Brian</i> )</td><td>Brian is a pet of Peter.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:Dog</i> <i>a:Brian</i> )</td><td>Brian is a dog.</td></tr><tr valign="top"><td>ClassAssertion(<br>&nbsp;&nbsp;&nbsp; ObjectAllValuesFrom( <i>a:hasPet</i><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ObjectUnionOf(<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ObjectOneOf( <i>a:Brian</i> )<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ObjectComplementOf( <i>a:Dog</i> )<br>&nbsp;&nbsp;&nbsp; &nbsp;&nbsp;&nbsp; )<br>&nbsp;&nbsp;&nbsp; )<br>&nbsp;&nbsp;&nbsp; <i>a:Peter</i><br>)</td><td>Each pet of Peter is either Brian or it is not a dog.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Peter</i> <i>a:hasPet</i> <i>a:Brian</i> .</td><td>Brian is a pet of Peter.</td></tr><tr valign="top"><td><i>a:Brian</i> <i>rdf:type</i> <i>a:Dog</i> .</td><td>Brian is a dog.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>rdf:type</i> _:x .<br>_:x <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:x <i>owl:onProperty</i> <i>a:hasPet</i> .<br>_:x <i>owl:allValuesFrom</i> _:y .<br>_:y <i>rdf:type</i> <i>owl:Class</i> .<br>_:y <i>owl:unionOf</i> ( _:z1 _:z2 ) .<br>_:z1 <i>rdf:type</i> <i>owl:Class</i> .<br>_:z1 <i>owl:oneOf</i> ( <i>a:Brian</i> ) .<br>_:z2 <i>rdf:type</i> <i>owl:Class</i> .<br>_:z2 <i>owl:complementOf</i> <i>a:Dog</i> .</td><td>Each pet of Peter is either Brian or it is not a dog.</td></tr></tbody></table>

The following exact cardinality expression contains those individuals that are connected by _a:hasPet_ to exactly one instance of _a:Dog_; furthermore, _a:Peter_ is classified as its instance:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectExactCardinality( 1 <i>a:hasPet</i> <i>a:Dog</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:w <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:w <i>owl:qualifiedCardinality</i> "1"^^<i>xsd:nonNegativeInteger</i> .<br>_:w <i>owl:onProperty</i> <i>a:hasPet</i> .<br>_:w <i>owl:onClass</i> <i>a:Dog</i> .</td></tr></tbody></table>

This is because the first two axioms say that _a:Peter_ is connected to _a:Brian_ by _a:hasPet_ and that _a:Brian_ is an instance of _a:Dog_, and the last axiom says that any individual different from _a:Brian_ that is connected to _a:Peter_ by _a:hasPet_ is not an instance of _a:Dog_; hence, _a:Peter_ is connected to exactly one instance of _a:Dog_ by _a:hasPet_.

### 8.4 Data Property Restrictions

Class expressions in OWL 2 can be formed by placing restrictions on data property expressions, as shown in Figure 10. These are similar to the restrictions on object property expressions, the main difference being that the expressions for existential and universal quantification allow for _n_\-ary data ranges. All data ranges explicitly supported by this specification are unary; however, the provision of _n_\-ary data ranges in existential and universal quantification allows OWL 2 tools to support extensions such as value comparisons and, consequently, class expressions such as "individuals whose width is greater than their height". Thus, the DataSomeValuesFrom class expression allows for a restricted existential quantification over a list of data property expressions, and it contains those individuals that are connected through the data property expressions to at least one literal in the given data range. The DataAllValuesFrom class expression allows for a restricted universal quantification over a list of data property expressions, and it contains those individuals that are connected through the data property expressions only to literals in the given data range. Finally, the DataHasValue class expression contains those individuals that are connected by a data property expression to a particular literal.

![Restricting Data Property Expressions in OWL 2](C_datamodal.gif)  
Figure 10. Restricting Data Property Expressions in OWL 2

#### 8.4.1 Existential Quantification

An existential class expression DataSomeValuesFrom( DPE1 ... DPEn DR ) consists of n data property expressions DPEi, 1 ≤ i ≤ n, and a data range DR whose arity _MUST_ be n. Such a class expression contains all those individuals that are connected by DPEi to literals lti, 1 ≤ i ≤ n, such that the tuple ( lt1 , ..., ltn ) is in DR. A class expression of the form DataSomeValuesFrom( DPE DR ) can be seen as a syntactic shortcut for the class expression DataMinCardinality( 1 DPE DR ).

DataSomeValuesFrom := 'DataSomeValuesFrom' '(' DataPropertyExpression { DataPropertyExpression } DataRange ')'

Consider the ontology consisting of the following axiom.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>DataPropertyAssertion( <i>a:hasAge</i> <i>a:Meg</i> "17"^^<i>xsd:integer</i> )</td><td>Meg is seventeen years old.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Meg</i> <i>a:hasAge</i> "17"^^<i>xsd:integer</i> .</td><td>Meg is seventeen years old.</td></tr></tbody></table>

The following existential class expression contains all individuals that are connected by _a:hasAge_ to an integer strictly less than 20 so; furthermore, _a:Meg_ is classified as its instance:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DataSomeValuesFrom( <i>a:hasAge</i> DatatypeRestriction( <i>xsd:integer</i> <i>xsd:maxExclusive</i> "20"^^<i>xsd:integer</i> ) )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:x <i>owl:onProperty</i> <i>a:hasAge</i> .<br>_:x <i>owl:someValuesFrom</i> _:y .<br>_:y rdf:type rdfs:Datatype .<br>_:y <i>owl:onDatatype</i> <i>xsd:integer</i> .<br>_:y <i>owl:withRestrictions</i> ( _:z ) .<br>_:z xsd:maxExclusive "20"^^xsd:integer .</td></tr></tbody></table>

#### 8.4.2 Universal Quantification

A universal class expression DataAllValuesFrom( DPE1 ... DPEn DR ) consists of n data property expressions DPEi, 1 ≤ i ≤ n, and a data range DR whose arity _MUST_ be n. Such a class expression contains all those individuals that are connected by DPEi only to literals lti, 1 ≤ i ≤ n, such that each tuple ( lt1 , ..., ltn ) is in DR. A class expression of the form DataAllValuesFrom( DPE DR ) can be seen as a syntactic shortcut for the class expression DataMaxCardinality( 0 DPE DataComplementOf( DR ) ).

DataAllValuesFrom := 'DataAllValuesFrom' '(' DataPropertyExpression { DataPropertyExpression } DataRange ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>DataPropertyAssertion( <i>a:hasZIP</i> _:a1 "02903"^^<i>xsd:integer</i> )</td><td>The ZIP code of _:a1 is the integer 02903.</td></tr><tr valign="top"><td>FunctionalDataProperty( <i>a:hasZIP</i> )</td><td>Each object can have at most one ZIP code.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td>_:a1 <i>a:hasZIP</i> "02903"^^<i>xsd:integer</i></td><td>The ZIP code of _:a1 is the integer 02903.</td></tr><tr valign="top"><td><i>a:hasZIP</i> <i>rdf:type</i> <i>owl:FunctionalProperty</i> .</td><td>Each object can have at most one ZIP code.</td></tr></tbody></table>

In United Kingdom and Canada, ZIP codes are strings (i.e., they can contain characters and not just numbers). Hence, one might use the following universal expression to identify those individuals that have only integer ZIP codes (and therefore have non-UK and non-Canadian addresses):

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DataAllValuesFrom( <i>a:hasZIP</i> <i>xsd:integer</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:x <i>owl:onProperty</i> <i>a:hasZIP</i> .<br>_:x <i>owl:allValuesFrom</i> <i>xsd:integer</i> .</td></tr></tbody></table>

The anonymous individual \_:a1 is by the first axiom connected by _a:hasZIP_ to an integer, and the second axiom ensures that \_:a1 is not connected by _a:hasZIP_ to other literals; therefore, \_:a1 is classified as an instance of the mentioned class expression.

The last axiom — the one stating that _a:hasZIP_ is functional — is critical for the inference from the previous paragraph due to the open-world semantics of OWL 2. Without this axiom, the ontology is not guaranteed to list all literals that \_:a1 is connected to by _a:hasZIP_; hence, without this axiom \_:a1 would not be classified as an instance of the mentioned class expression.

#### 8.4.3 Literal Value Restriction

A has-value class expression DataHasValue( DPE lt ) consists of a data property expression DPE and a literal lt, and it contains all those individuals that are connected by DPE to lt. Each such class expression can be seen as a syntactic shortcut for the class expression DataSomeValuesFrom( DPE DataOneOf( lt ) ).

DataHasValue := 'DataHasValue' '(' DataPropertyExpression Literal ')'

Consider the ontology consisting of the following axiom.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>DataPropertyAssertion( <i>a:hasAge</i> <i>a:Meg</i> "17"^^<i>xsd:integer</i> )</td><td>Meg is seventeen years old.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Meg</i> <i>a:hasAge</i> "17"^^<i>xsd:integer</i> .</td><td>Meg is seventeen years old.</td></tr></tbody></table>

The following has-value expression contains all individuals that are connected by _a:hasAge_ to the integer 17; furthermore, _a:Meg_ is classified as its instance:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DataHasValue( <i>a:hasAge</i> "17"^^<i>xsd:integer</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:x <i>owl:onProperty</i> <i>a:hasAge</i> .<br>_:x <i>owl:hasValue</i> "17"^^<i>xsd:integer</i> .</td></tr></tbody></table>

### 8.5 Data Property Cardinality Restrictions

Class expressions in OWL 2 can be formed by placing restrictions on the cardinality of data property expressions, as shown in Figure 11. These are similar to the restrictions on the cardinality of object property expressions. All cardinality restrictions can be qualified or unqualified: in the former case, the cardinality restriction only applies to literals that are connected by the data property expression and are in the qualifying data range; in the latter case it applies to all literals that are connected by the data property expression (this is equivalent to the qualified case with the qualifying data range equal to _rdfs:Literal_). The class expressions DataMinCardinality, DataMaxCardinality, and DataExactCardinality contain those individuals that are connected by a data property expression to at least, at most, and exactly a given number of literals in the specified data range, respectively.

![Restricting the Cardinality of Data Property Expressions in OWL 2](C_datacardinality.gif)  
Figure 11. Restricting the Cardinality of Data Property Expressions in OWL 2

#### 8.5.1 Minimum Cardinality

A minimum cardinality expression DataMinCardinality( n DPE DR ) consists of a nonnegative integer n, a data property expression DPE, and a unary data range DR, and it contains all those individuals that are connected by DPE to at least n different literals in DR. If DR is not present, it is taken to be _rdfs:Literal_.

DataMinCardinality := 'DataMinCardinality' '(' nonNegativeInteger DataPropertyExpression \[ DataRange \] ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>DataPropertyAssertion( <i>a:hasName</i> <i>a:Meg</i> "Meg Griffin" )</td><td>Meg's name is <span class="name">"Meg Griffin"</span>.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:hasName</i> <i>a:Meg</i> "Megan Griffin" )</td><td>Meg's name is <span class="name">"Megan Griffin"</span>.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Meg</i> <i>a:hasName</i> "Meg Griffin" .</td><td>Meg's name is <span class="name">"Meg Griffin"</span>.</td></tr><tr valign="top"><td><i>a:Meg</i> <i>a:hasName</i> "Megan Griffin" .</td><td>Meg's name is <span class="name">"Megan Griffin"</span>.</td></tr></tbody></table>

The following minimum cardinality expression contains those individuals that are connected by _a:hasName_ to at least two different literals:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DataMinCardinality( 2 <i>a:hasName</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:x <i>owl:minCardinality</i> "2"^^<i>xsd:nonNegativeInteger</i> .<br>_:x <i>owl:onProperty</i> <i>a:hasName</i> .</td></tr></tbody></table>

Different string literals are distinct, so "Meg Griffin" and "Megan Griffin" are different; thus, the individual _a:Meg_ is classified as an instance of the mentioned class expression.

Note that some datatypes from the OWL 2 datatype map distinguish between equal and identical data values, and that the semantics of cardinality restrictions in OWL 2 is defined with respect to the latter. For an example demonstrating the effects such such a definition, please refer to [Section 9.3.6](#Functional_Data_Properties).

#### 8.5.2 Maximum Cardinality

A maximum cardinality expression DataMaxCardinality( n DPE DR ) consists of a nonnegative integer n, a data property expression DPE, and a unary data range DR, and it contains all those individuals that are connected by DPE to at most n different literals in DR. If DR is not present, it is taken to be _rdfs:Literal_.

DataMaxCardinality := 'DataMaxCardinality' '(' nonNegativeInteger DataPropertyExpression \[ DataRange \] ')'

Consider the ontology consisting of the following axiom.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>FunctionalDataProperty( <i>a:hasName</i> )</td><td>Each object can have at most one name.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasName</i> <i>rdf:type</i> <i>owl:FunctionalProperty</i> .</td><td>Each object can have at most one name.</td></tr></tbody></table>

The following maximum cardinality expression contains those individuals that are connected by _a:hasName_ to at most two different literals:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DataMaxCardinality( 2 <i>a:hasName</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:x <i>owl:maxCardinality</i> "2"^^<i>xsd:nonNegativeInteger</i> .<br>_:x <i>owl:onProperty</i> <i>a:hasName</i> .</td></tr></tbody></table>

Since the ontology axiom restricts _a:hasName_ to be functional, all individuals in the ontology are instances of this class expression.

Note that some datatypes from the OWL 2 datatype map distinguish between equal and identical data values, and that the semantics of cardinality restrictions in OWL 2 is defined with respect to the latter. For an example demonstrating the effects such such a definition, please refer to [Section 9.3.6](#Functional_Data_Properties).

#### 8.5.3 Exact Cardinality

An exact cardinality expression DataExactCardinality( n DPE DR ) consists of a nonnegative integer n, a data property expression DPE, and a unary data range DR, and it contains all those individuals that are connected by DPE to exactly n different literals in DR. If DR is not present, it is taken to be _rdfs:Literal_.

DataExactCardinality := 'DataExactCardinality' '(' nonNegativeInteger DataPropertyExpression \[ DataRange \] ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>DataPropertyAssertion( <i>a:hasName</i> <i>a:Brian</i> "Brian Griffin" )</td><td>Brian's name is <span class="name">"Brian Griffin"</span>.</td></tr><tr valign="top"><td>FunctionalDataProperty( <i>a:hasName</i> )</td><td>Each object can have at most one name.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Brian</i> <i>a:hasName</i> "Brian Griffin" .</td><td>Brian's name is <span class="name">"Brian Griffin"</span>.</td></tr><tr valign="top"><td><i>a:hasName</i> <i>rdf:type</i> <i>owl:FunctionalProperty</i> .</td><td>Each object can have at most one name.</td></tr></tbody></table>

The following exact cardinality expression contains those individuals that are connected by _a:hasName_ to exactly one literal:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DataExactCardinality( 1 <i>a:hasName</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:x <i>owl:cardinality</i> "1"^^<i>xsd:nonNegativeInteger</i> .<br>_:x <i>owl:onProperty</i> <i>a:hasName</i> .</td></tr></tbody></table>

Since the ontology axiom restricts _a:hasName_ to be functional and _a:Brian_ is connected by _a:hasName_ to "Brian Griffin", it is classified as an instance of this class expression.

Note that some datatypes from the OWL 2 datatype map distinguish between equal and identical data values, and that the semantics of cardinality restrictions in OWL 2 is defined with respect to the latter. For an example demonstrating the effects such such a definition, please refer to [Section 9.3.6](#Functional_Data_Properties).

## 9 Axioms

The main component of an OWL 2 ontology is a set of _axioms_ — statements that say what is true in the domain. OWL 2 provides an extensive set of axioms, all of which extend the Axiom class in the structural specification. As shown in Figure 12, axioms in OWL 2 can be declarations, axioms about classes, axioms about object or data properties, datatype definitions, keys, assertions (sometimes also called _facts_), and axioms about annotations.

![The Axioms of OWL 2](Axioms.gif)  
Figure 12. The Axioms of OWL 2

Axiom := Declaration | ClassAxiom | ObjectPropertyAxiom | DataPropertyAxiom | DatatypeDefinition | HasKey | Assertion | AnnotationAxiom  
  
axiomAnnotations := { Annotation }

As shown in Figure 1, OWL 2 axioms can contain axiom annotations, the structure of which is defined in [Section 10](#Annotations). Axiom annotations have no effect on the semantics of axioms — that is, they do not affect the logical consequences of OWL 2 ontologies. In contrast, axiom annotations do affect structural equivalence: axioms will not be structurally equivalent if their axiom annotations are not structurally equivalent.

The following axiom contains a comment that explains the purpose of the axiom.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">SubClassOf( Annotation( <i>rdfs:comment</i> "Male people are people." ) <i>a:Man</i> <i>a:Person</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Man</i> <i>rdfs:subClassOf</i> <i>a:Person</i><br>_:x <i>rdf:type</i> <i>owl:Annotation</i> .<br>_:x <i>owl:annotatedSource</i> <i>a:Man</i> .<br>_:x <i>owl:annotatedProperty</i> <i>rdfs:subClassOf</i> .<br>_:x <i>owl:annotatedTarget</i> <i>a:Person</i> .<br>_:x <i>rdfs:comment</i> "Male people are people." .</td></tr></tbody></table>

Since annotations affect structural equivalence between axioms, the previous axiom is not structurally equivalent with the following axiom, even though these two axioms are semantically equivalent.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">SubClassOf( <i>a:Man</i> <i>a:Person</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Man</i> <i>rdfs:subClassOf</i> <i>a:Person</i> .</td></tr></tbody></table>

### 9.1 Class Expression Axioms

OWL 2 provides axioms that allow relationships to be established between class expressions, as shown in Figure 13. The SubClassOf axiom allows one to state that each instance of one class expression is also an instance of another class expression, and thus to construct a hierarchy of classes. The EquivalentClasses axiom allows one to state that several class expressions are equivalent to each other. The DisjointClasses axiom allows one to state that several class expressions are pairwise disjoint — that is, that they have no instances in common. Finally, the DisjointUnion class expression allows one to define a class as a disjoint union of several class expressions and thus to express covering constraints.

![The Class Axioms of OWL 2](A_classes.gif)  
Figure 13. The Class Axioms of OWL 2

ClassAxiom := SubClassOf | EquivalentClasses | DisjointClasses | DisjointUnion

#### 9.1.1 Subclass Axioms

A subclass axiom SubClassOf( CE1 CE2 ) states that the class expression CE1 is a subclass of the class expression CE2. Roughly speaking, this states that CE1 is more specific than CE2. Subclass axioms are a fundamental type of axioms in OWL 2 and can be used to construct a class hierarchy. Other kinds of class expression axiom can be seen as syntactic shortcuts for one or more subclass axioms.

SubClassOf := 'SubClassOf' '(' axiomAnnotations subClassExpression superClassExpression ')'  
subClassExpression := ClassExpression  
superClassExpression := ClassExpression

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>SubClassOf( <i>a:Baby</i> <i>a:Child</i> )</td><td>Each baby is a child.</td></tr><tr valign="top"><td>SubClassOf( <i>a:Child</i> <i>a:Person</i> )</td><td>Each child is a person.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:Baby</i> <i>a:Stewie</i> )</td><td>Stewie is a baby.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Baby</i> <i>rdfs:subClassOf</i> <i>a:Child</i> .</td><td>Each baby is a child.</td></tr><tr valign="top"><td><i>a:Child</i> <i>rdfs:subClassOf</i> <i>a:Person</i> .</td><td>Each child is a person.</td></tr><tr valign="top"><td><i>a:Stewie</i> <i>rdf:type</i> <i>a:Baby</i> .</td><td>Stewie is a baby.</td></tr></tbody></table>

Since _a:Stewie_ is an instance of _a:Baby_, by the first subclass axiom _a:Stewie_ is classified as an instance of _a:Child_ as well. Similarly, by the second subclass axiom _a:Stewie_ is classified as an instance of _a:Person_. This style of reasoning can be applied to any instance of _a:Baby_ and not just _a:Stewie_; therefore, one can conclude that _a:Baby_ is a subclass of _a:Person_. In other words, this ontology entails the following axiom:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">SubClassOf( <i>a:Baby</i> <i>a:Person</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Baby</i> <i>rdfs:subClassOf</i> <i>a:Person</i> .</td></tr></tbody></table>

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>SubClassOf( <i>a:PersonWithChild</i><br>&nbsp;&nbsp;&nbsp; ObjectSomeValuesFrom( <i>a:hasChild</i> ObjectUnionOf( <i>a:Boy</i> <i>a:Girl</i> ) )<br>)</td><td>A person that has a child has either at least one boy or a girl.</td></tr><tr valign="top"><td>SubClassOf( <i>a:Boy</i> <i>a:Child</i> )</td><td>Each boy is a child.</td></tr><tr valign="top"><td>SubClassOf( <i>a:Girl</i> <i>a:Child</i> )</td><td>Each girl is a child.</td></tr><tr valign="top"><td>SubClassOf( ObjectSomeValuesFrom( <i>a:hasChild</i> <i>a:Child</i> ) <i>a:Parent</i> )</td><td>If some object has a child, then this object is a parent.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:PersonWithChild</i> <i>rdfs:subClassOf</i> _:x .<br>_:x <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:x <i>owl:onProperty</i> <i>a:hasChild</i> .<br>_:x <i>owl:someValuesFrom</i> _:y .<br>_:y <i>rdf:type</i> <i>owl:Class</i> .<br>_:y <i>owl:unionOf</i> ( <i>a:Boy</i> <i>a:Girl</i> ) .</td><td>A person that has a child has either at least one boy or a girl.</td></tr><tr valign="top"><td><i>a:Boy</i> <i>rdfs:subClassOf</i> <i>a:Child</i> .</td><td>Each boy is a child.</td></tr><tr valign="top"><td><i>a:Girl</i> <i>rdfs:subClassOf</i> <i>a:Child</i> .</td><td>Each girl is a child.</td></tr><tr valign="top"><td>_:z <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:z <i>owl:onProperty</i> <i>a:hasChild</i> .<br>_:z <i>owl:someValuesFrom</i> <i>a:Child</i> .<br>_:z <i>rdfs:subClassOf</i> <i>a:Parent</i> .</td><td>If some object has a child, then this object is a parent.</td></tr></tbody></table>

The first axiom states that each instance of _a:PersonWithChild_ is connected to an individual that is an instance of either _a:Boy_ or _a:Girl_. (Because of the open-world semantics of OWL 2, this does not mean that there must be only one such individual or that all such individuals must be instances of either _a:Boy_ or of _a:Girl_.) Furthermore, each instance of _a:Boy_ or _a:Girl_ is an instance of _a:Child_. Finally, the last axiom says that all individuals that are connected by _a:hasChild_ to an instance of _a:Child_ are instances of _a:Parent_. Since this reasoning holds for each instance of _a:PersonWithChild_, each such instance is also an instance of _a:Parent_. In other words, this ontology entails the following axiom:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">SubClassOf( <i>a:PersonWithChild</i> <i>a:Parent</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:PersonWithChild</i> <i>rdfs:subClassOf</i> <i>a:Parent</i> .</td></tr></tbody></table>

#### 9.1.2 Equivalent Classes

An equivalent classes axiom EquivalentClasses( CE1 ... CEn ) states that all of the class expressions CEi, 1 ≤ i ≤ n, are semantically equivalent to each other. This axiom allows one to use each CEi as a synonym for each CEj — that is, in any expression in the ontology containing such an axiom, CEi can be replaced with CEj without affecting the meaning of the ontology. An axiom EquivalentClasses( CE1 CE2 ) is equivalent to the following two axioms:

SubClassOf( CE1 CE2 )  
SubClassOf( CE2 CE1 )

Axioms of the form EquivalentClasses( C CE ), where C is a class and CE is a class expression, are often called _definitions_, because they define the class C in terms of the class expression CE.

EquivalentClasses := 'EquivalentClasses' '(' axiomAnnotations ClassExpression ClassExpression { ClassExpression } ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>EquivalentClasses( <i>a:Boy</i> ObjectIntersectionOf( <i>a:Child</i> <i>a:Man</i> ) )</td><td>A boy is a male child.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:Child</i> <i>a:Chris</i> )</td><td>Chris is a child.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:Man</i> <i>a:Chris</i> )</td><td>Chris is a man.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:Boy</i> <i>a:Stewie</i> )</td><td>Stewie is a boy.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Boy</i> <i>owl:equivalentClass</i> _:x .<br>_:x <i>rdf:type</i> <i>owl:Class</i> .<br>_:x <i>owl:intersectionOf</i> ( <i>a:Child</i> <i>a:Man</i> ) .</td><td>A boy is a male child.</td></tr><tr valign="top"><td><i>a:Chris</i> <i>rdf:type</i> <i>a:Child</i> .</td><td>Chris is a child.</td></tr><tr valign="top"><td><i>a:Chris</i> <i>rdf:type</i> <i>a:Man</i> .</td><td>Chris is a man.</td></tr><tr valign="top"><td><i>a:Stewie</i> <i>rdf:type</i> <i>a:Boy</i> .</td><td>Stewie is a boy.</td></tr></tbody></table>

The first axiom defines the class _a:Boy_ as an intersection of the classes _a:Child_ and _a:Man_; thus, the instances of _a:Boy_ are exactly those instances that are both an instance of _a:Child_ and an instance of _a:Man_. Such a definition consists of two directions. The first direction implies that each instance of _a:Child_ and _a:Man_ is an instance of _a:Boy_; since _a:Chris_ satisfies these two conditions, it is classified as an instance of _a:Boy_. The second direction implies that each _a:Boy_ is an instance of _a:Child_ and of _a:Man_; thus, _a:Stewie_ is classified as an instance of _a:Man_ and of _a:Boy_.

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>EquivalentClasses( <i>a:MongrelOwner</i> ObjectSomeValuesFrom( <i>a:hasPet</i> <i>a:Mongrel</i> ) )</td><td>A mongrel owner has a pet that is a mongrel.</td></tr><tr valign="top"><td>EquivalentClasses( <i>a:DogOwner</i> ObjectSomeValuesFrom( <i>a:hasPet</i> <i>a:Dog</i> ) )</td><td>A dog owner has a pet that is a dog.</td></tr><tr valign="top"><td>SubClassOf( <i>a:Mongrel</i> <i>a:Dog</i> )</td><td>Each mongrel is a dog.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:MongrelOwner</i> <i>a:Peter</i> )</td><td>Peter is a mongrel owner.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:MongrelOwner</i> <i>owl:equivalentClass</i> _:x .<br>_:x <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:x <i>owl:onProperty</i> <i>a:hasPet</i> .<br>_:x <i>owl:someValuesFrom</i> <i>a:Mongrel</i> .</td><td>A mongrel owner has a pet that is a mongrel.</td></tr><tr valign="top"><td><i>a:DogOwner</i> <i>owl:equivalentClass</i> _:y .<br>_:y <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:y <i>owl:onProperty</i> <i>a:hasPet</i> .<br>_:y <i>owl:someValuesFrom</i> <i>a:Dog</i> .</td><td>A dog owner has a pet that is a dog.</td></tr><tr valign="top"><td><i>a:Mongrel</i> <i>rdfs:subClassOf</i> <i>a:Dog</i> .</td><td>Each mongrel is a dog.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>rdf:type</i> <i>a:MongrelOwner</i> .</td><td>Peter is a mongrel owner.</td></tr></tbody></table>

By the first axiom, each instance x of _a:MongrelOwner_ must be connected via _a:hasPet_ to an instance of _a:Mongrel_; by the third axiom, this individual is an instance of _a:Dog_; thus, by the second axiom, x is an instance of _a:DogOwner_. In other words, this ontology entails the following axiom:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">SubClassOf( <i>a:MongrelOwner</i> <i>a:DogOwner</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:MongrelOwner</i> <i>rdfs:subClassOf</i> <i>a:DogOwner</i> .</td></tr></tbody></table>

By the fourth axiom, _a:Peter_ is then classified as an instance of _a:DogOwner_.

#### 9.1.3 Disjoint Classes

A disjoint classes axiom DisjointClasses( CE1 ... CEn ) states that all of the class expressions CEi, 1 ≤ i ≤ n, are pairwise disjoint; that is, no individual can be at the same time an instance of both CEi and CEj for i ≠ j. An axiom DisjointClasses( CE1 CE2 ) is equivalent to the following axiom:

SubClassOf( CE1 ObjectComplementOf( CE2 ) )

DisjointClasses := 'DisjointClasses' '(' axiomAnnotations ClassExpression ClassExpression { ClassExpression } ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>DisjointClasses( <i>a:Boy</i> <i>a:Girl</i> )</td><td>Nothing can be both a boy and a girl.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:Boy</i> <i>a:Stewie</i> )</td><td>Stewie is a boy.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Boy</i> <i>owl:disjointWith</i> <i>a:Girl</i> .</td><td>Nothing can be both a boy and a girl.</td></tr><tr valign="top"><td><i>a:Stewie</i> <i>rdf:type</i> <i>a:Boy</i> .</td><td>Stewie is a boy.</td></tr></tbody></table>

The axioms in this ontology imply that _a:Stewie_ can be classified as an instance of the following class expression:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectComplementOf( <i>a:Girl</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:x <i>rdf:type</i> <i>owl:Class</i> .<br>_:x <i>owl:complementOf</i> <i>a:Girl</i> .</td></tr></tbody></table>

Furthermore, if the ontology were extended with the following assertion, the ontology would become inconsistent:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ClassAssertion( <i>a:Girl</i> <i>a:Stewie</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Stewie</i> <i>rdf:type</i> <i>a:Girl</i> .</td></tr></tbody></table>

#### 9.1.4 Disjoint Union of Class Expressions

A disjoint union axiom DisjointUnion( C CE1 ... CEn ) states that a class C is a disjoint union of the class expressions CEi, 1 ≤ i ≤ n, all of which are pairwise disjoint. Such axioms are sometimes referred to as _covering_ axioms, as they state that the extensions of all CEi exactly cover the extension of C. Thus, each instance of C is an instance of exactly one CEi, and each instance of CEi is an instance of C. Each such axiom can be seen as a syntactic shortcut for the following two axioms:

EquivalentClasses( C ObjectUnionOf( CE1 ... CEn ) )  
DisjointClasses( CE1 ... CEn )

DisjointUnion := 'DisjointUnion' '(' axiomAnnotations Class disjointClassExpressions ')'  
disjointClassExpressions := ClassExpression ClassExpression { ClassExpression }

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>DisjointUnion( <i>a:Child</i> <i>a:Boy</i> <i>a:Girl</i> )</td><td>Each child is either a boy or a girl, each boy is a child, each girl is a child, and nothing can be both a boy and a girl.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:Child</i> <i>a:Stewie</i> )</td><td>Stewie is a child.</td></tr><tr valign="top"><td>ClassAssertion( ObjectComplementOf( <i>a:Girl</i> ) <i>a:Stewie</i> )</td><td>Stewie is not a girl.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Child</i> <i>owl:disjointUnionOf</i> ( <i>a:Boy</i> <i>a:Girl</i> ) .</td><td>Each child is either a boy or a girl, each boy is a child, each girl is a child, and nothing can be both a boy and a girl.</td></tr><tr valign="top"><td><i>a:Stewie</i> <i>rdf:type</i> <i>a:Child</i> .</td><td>Stewie is a child.</td></tr><tr valign="top"><td><i>a:Stewie</i> <i>rdf:type</i> _:x .<br>_:x <i>rdf:type</i> <i>owl:Class</i> .<br>_:x <i>owl:complementOf</i> <i>a:Girl</i> .</td><td>Stewie is not a girl.</td></tr></tbody></table>

By the first two axioms, _a:Stewie_ is either an instance of _a:Boy_ or _a:Girl_. The last assertion eliminates the second possibility, so _a:Stewie_ is classified as an instance of _a:Boy_.

### 9.2 Object Property Axioms

OWL 2 provides axioms that can be used to characterize and establish relationships between object property expressions. For clarity, the structure of these axioms is shown in two separate figures, Figure 14 and Figure 15. The SubObjectPropertyOf axiom allows one to state that the extension of one object property expression is included in the extension of another object property expression. The EquivalentObjectProperties axiom allows one to state that the extensions of several object property expressions are the same. The DisjointObjectProperties axiom allows one to state that the extensions of several object property expressions are pairwise disjoint — that is, that they do not share pairs of connected individuals. The InverseObjectProperties axiom can be used to state that two object property expressions are the inverse of each other. The ObjectPropertyDomain and ObjectPropertyRange axioms can be used to restrict the first and the second individual, respectively, connected by an object property expression to be instances of the specified class expression.

![Object Property Axioms in OWL 2, Part I](A_objectproperty1.gif)  
Figure 14. Object Property Axioms in OWL 2, Part I

The FunctionalObjectProperty axiom allows one to state that an object property expression is functional — that is, that each individual can have at most one outgoing connection of the specified object property expression. The InverseFunctionalObjectProperty axiom allows one to state that an object property expression is inverse-functional — that is, that each individual can have at most one incoming connection of the specified object property expression. Finally, the ReflexiveObjectProperty, IrreflexiveObjectProperty, SymmetricObjectProperty, AsymmetricObjectProperty, and TransitiveObjectProperty axioms allow one to state that an object property expression is reflexive, irreflexive, symmetric, asymmetric, or transitive, respectively.

![Axioms Defining Characteristics of Object Properties in OWL 2, Part II](A_objectproperty2.gif)  
Figure 15. Axioms Defining Characteristics of Object Properties in OWL 2, Part II

ObjectPropertyAxiom :=  
    SubObjectPropertyOf | EquivalentObjectProperties |  
    DisjointObjectProperties | InverseObjectProperties |  
    ObjectPropertyDomain | ObjectPropertyRange |  
    FunctionalObjectProperty | InverseFunctionalObjectProperty |  
    ReflexiveObjectProperty | IrreflexiveObjectProperty |  
    SymmetricObjectProperty | AsymmetricObjectProperty |  
    TransitiveObjectProperty

#### 9.2.1 Object Subproperties

Object subproperty axioms are analogous to subclass axioms, and they come in two forms.

The basic form is SubObjectPropertyOf( OPE1 OPE2 ). This axiom states that the object property expression OPE1 is a subproperty of the object property expression OPE2 — that is, if an individual x is connected by OPE1 to an individual y, then x is also connected by OPE2 to y.

The more complex form is SubObjectPropertyOf( ObjectPropertyChain( OPE1 ... OPEn ) OPE ). This axiom states that, if an individual x is connected by a sequence of object property expressions OPE1, ..., OPEn with an individual y, then x is also connected with y by the object property expression OPE. Such axioms are also known as _complex role inclusions_ \[[SROIQ](#ref-sroiq)\].

SubObjectPropertyOf := 'SubObjectPropertyOf' '(' axiomAnnotations subObjectPropertyExpression superObjectPropertyExpression ')'  
subObjectPropertyExpression := ObjectPropertyExpression | propertyExpressionChain  
propertyExpressionChain := 'ObjectPropertyChain' '(' ObjectPropertyExpression ObjectPropertyExpression { ObjectPropertyExpression } ')'  
superObjectPropertyExpression := ObjectPropertyExpression

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>SubObjectPropertyOf( <i>a:hasDog</i> <i>a:hasPet</i> )</td><td>Having a dog implies having a pet.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasDog</i> <i>a:Peter</i> <i>a:Brian</i> )</td><td>Brian is a dog of Peter.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasDog</i> <i>rdfs:subPropertyOf</i> <i>a:hasPet</i> .</td><td>Having a dog implies having a pet.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:hasDog</i> <i>a:Brian</i> .</td><td>Brian is a dog of Peter.</td></tr></tbody></table>

Since _a:hasDog_ is a subproperty of _a:hasPet_, each tuple of individuals connected by the former property expression is also connected by the latter property expression. Therefore, this ontology entails that _a:Peter_ is connected to _a:Brian_ by _a:hasPet_; that is, the ontology entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectPropertyAssertion( <i>a:hasPet</i> <i>a:Peter</i> <i>a:Brian</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Peter</i> <i>a:hasPet</i> <i>a:Brian</i> .</td></tr></tbody></table>

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>SubObjectPropertyOf( ObjectPropertyChain( <i>a:hasMother</i> <i>a:hasSister</i> ) <i>a:hasAunt</i> )</td><td>The sister of someone's mother is that person's aunt.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasMother</i> <i>a:Stewie</i> <i>a:Lois</i> )</td><td>Lois is the mother of Stewie.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasSister</i> <i>a:Lois</i> <i>a:Carol</i> )</td><td>Carol is a sister of Lois.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasAunt</i> <i>owl:propertyChainAxiom</i> ( <i>a:hasMother</i> <i>a:hasSister</i> ) .</td><td>The sister of someone's mother is that person's aunt.</td></tr><tr valign="top"><td><i>a:Stewie</i> <i>a:hasMother</i> <i>a:Lois</i> .</td><td>Lois is the mother of Stewie.</td></tr><tr valign="top"><td><i>a:Lois</i> <i>a:hasSister</i> <i>a:Carol</i> .</td><td>Carol is a sister of Lois.</td></tr></tbody></table>

The axioms in this ontology imply that _a:Stewie_ is connected by _a:hasAunt_ with _a:Carol_; that is, the ontology entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectPropertyAssertion( <i>a:hasAunt</i> <i>a:Stewie</i> <i>a:Carol</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Stewie</i> <i>a:hasAunt</i> <i>a:Carol</i> .</td></tr></tbody></table>

#### 9.2.2 Equivalent Object Properties

An equivalent object properties axiom EquivalentObjectProperties( OPE1 ... OPEn ) states that all of the object property expressions OPEi, 1 ≤ i ≤ n, are semantically equivalent to each other. This axiom allows one to use each OPEi as a synonym for each OPEj — that is, in any expression in the ontology containing such an axiom, OPEi can be replaced with OPEj without affecting the meaning of the ontology. The axiom EquivalentObjectProperties( OPE1 OPE2 ) is equivalent to the following two axioms:

SubObjectPropertyOf( OPE1 OPE2 )  
SubObjectPropertyOf( OPE2 OPE1 )

EquivalentObjectProperties := 'EquivalentObjectProperties' '(' axiomAnnotations ObjectPropertyExpression ObjectPropertyExpression { ObjectPropertyExpression } ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>EquivalentObjectProperties( <i>a:hasBrother</i> <i>a:hasMaleSibling</i> )</td><td>Having a brother is the same as having a male sibling.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasBrother</i> <i>a:Chris</i> <i>a:Stewie</i> )</td><td>Stewie is a brother of Chris.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasMaleSibling</i> <i>a:Stewie</i> <i>a:Chris</i> )</td><td>Chris is a male sibling of Stewie.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasBrother</i> <i>owl:equivalentProperty</i> <i>a:hasMaleSibling</i> .</td><td>Having a brother is the same as having a male sibling.</td></tr><tr valign="top"><td><i>a:Chris</i> <i>a:hasBrother</i> <i>a:Stewie</i> .</td><td>Stewie is a brother of Chris.</td></tr><tr valign="top"><td><i>a:Stewie</i> <i>a:hasMaleSibling</i> <i>a:Chris</i> .</td><td>Chris is a male sibling of Stewie.</td></tr></tbody></table>

Since _a:hasBrother_ and _a:hasMaleSibling_ are equivalent properties, this ontology entails that _a:Chris_ is connected by _a:hasMaleSibling_ with _a:Stewie_ — that is, it entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectPropertyAssertion( <i>a:hasMaleSibling</i> <i>a:Chris</i> <i>a:Stewie</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Chris</i> <i>a:hasMaleSibling</i> <i>a:Stewie</i> .</td></tr></tbody></table>

Furthermore, the ontology also entails that that _a:Stewie_ is connected by _a:hasBrother_ with _a:Chris_ — that is, it entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectPropertyAssertion( <i>a:hasBrother</i> <i>a:Stewie</i> <i>a:Chris</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Stewie</i> <i>a:hasBrother</i> <i>a:Chris</i> .</td></tr></tbody></table>

#### 9.2.3 Disjoint Object Properties

A disjoint object properties axiom DisjointObjectProperties( OPE1 ... OPEn ) states that all of the object property expressions OPEi, 1 ≤ i ≤ n, are pairwise disjoint; that is, no individual x can be connected to an individual y by both OPEi and OPEj for i ≠ j.

DisjointObjectProperties := 'DisjointObjectProperties' '(' axiomAnnotations ObjectPropertyExpression ObjectPropertyExpression { ObjectPropertyExpression } ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>DisjointObjectProperties( <i>a:hasFather</i> <i>a:hasMother</i> )</td><td>Fatherhood is disjoint with motherhood.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasFather</i> <i>a:Stewie</i> <i>a:Peter</i> )</td><td>Peter is Stewie's father.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasMother</i> <i>a:Stewie</i> <i>a:Lois</i> )</td><td>Lois is the mother of Stewie.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasFather</i> <i>owl:propertyDisjointWith</i> <i>a:hasMother</i> .</td><td>Fatherhood is disjoint with motherhood.</td></tr><tr valign="top"><td><i>a:Stewie</i> <i>a:hasFather</i> <i>a:Peter</i> .</td><td>Peter is Stewie's father.</td></tr><tr valign="top"><td><i>a:Stewie</i> <i>a:hasMother</i> <i>a:Lois</i> .</td><td>Lois is the mother of Stewie.</td></tr></tbody></table>

In this ontology, the disjointness axiom is satisfied. If, however, one were to add the following assertion, the disjointness axiom would be invalidated and the ontology would become inconsistent:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectPropertyAssertion( <i>a:hasMother</i> <i>a:Stewie</i> <i>a:Peter</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Stewie</i> <i>a:hasMother</i> <i>a:Peter</i> .</td></tr></tbody></table>

#### 9.2.4 Inverse Object Properties

An inverse object properties axiom InverseObjectProperties( OPE1 OPE2 ) states that the object property expression OPE1 is an inverse of the object property expression OPE2. Thus, if an individual x is connected by OPE1 to an individual y, then y is also connected by OPE2 to x, and vice versa. Each such axiom can be seen as a syntactic shortcut for the following axiom:

EquivalentObjectProperties( OPE1 ObjectInverseOf( OPE2 ) )

InverseObjectProperties := 'InverseObjectProperties' '(' axiomAnnotations ObjectPropertyExpression ObjectPropertyExpression ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>InverseObjectProperties( <i>a:hasFather</i> <i>a:fatherOf</i> )</td><td>Having a father is the opposite of being a father of someone.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasFather</i> <i>a:Stewie</i> <i>a:Peter</i> )</td><td>Peter is Stewie's father.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:fatherOf</i> <i>a:Peter</i> <i>a:Chris</i> )</td><td>Peter is Chris's father.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasFather</i> <i>owl:inverseOf</i> <i>a:fatherOf</i> .</td><td>Having a father is the opposite of being a father of someone.</td></tr><tr valign="top"><td><i>a:Stewie</i> <i>a:hasFather</i> <i>a:Peter</i> .</td><td>Peter is Stewie's father.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:fatherOf</i> <i>a:Chris</i> .</td><td>Peter is Chris's father.</td></tr></tbody></table>

This ontology entails that _a:Peter_ is connected by _a:fatherOf_ with _a:Stewie_ — that is, it entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectPropertyAssertion( <i>a:fatherOf</i> <i>a:Peter</i> <i>a:Stewie</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Peter</i> <i>a:fatherOf</i> <i>a:Stewie</i> .</td></tr></tbody></table>

Furthermore, the ontology also entails that _a:Chris_ is connected by _a:hasFather_ with _a:Peter_ — that is, it entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectPropertyAssertion( <i>a:hasFather</i> <i>a:Chris</i> <i>a:Peter</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Chris</i> <i>a:hasFather</i> <i>a:Peter</i> .</td></tr></tbody></table>

#### 9.2.5 Object Property Domain

An object property domain axiom ObjectPropertyDomain( OPE CE ) states that the domain of the object property expression OPE is the class expression CE — that is, if an individual x is connected by OPE with some other individual, then x is an instance of CE. Each such axiom can be seen as a syntactic shortcut for the following axiom:

SubClassOf( ObjectSomeValuesFrom( OPE _owl:Thing_ ) CE )

ObjectPropertyDomain := 'ObjectPropertyDomain' '(' axiomAnnotations ObjectPropertyExpression ClassExpression ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ObjectPropertyDomain( <i>a:hasDog</i> <i>a:Person</i> )</td><td>Only people can own dogs.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasDog</i> <i>a:Peter</i> <i>a:Brian</i> )</td><td>Brian is a dog of Peter.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasDog</i> <i>rdfs:domain</i> <i>a:Person</i> .</td><td>Only people can own dogs.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:hasDog</i> <i>a:Brian</i> .</td><td>Brian is a dog of Peter.</td></tr></tbody></table>

By the first axiom, each individual that has an outgoing _a:hasDog_ connection must be an instance of _a:Person_. Therefore, _a:Peter_ can be classified as an instance of _a:Person_; that is, this ontology entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ClassAssertion( <i>a:Person</i> <i>a:Peter</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Peter</i> <i>rdf:type</i> <i>a:Person</i> .</td></tr></tbody></table>

Domain axioms in OWL 2 have a standard first-order semantics that is somewhat different from the semantics of such axioms in databases and object-oriented systems, where such axioms are interpreted as checks. The domain axiom from the example ontology would in such systems be interpreted as a _constraint_ saying that _a:hasDog_ can point only from individuals that are known to be instances of _a:Person_; furthermore, since the example ontology does not explicitly state that _a:Peter_ is an instance of _a:Person_, one might expect the domain constraint to be invalidated. This, however, is not the case in OWL 2: as shown in the previous paragraph, the missing type is _inferred_ from the domain constraint.

#### 9.2.6 Object Property Range

An object property range axiom ObjectPropertyRange( OPE CE ) states that the range of the object property expression OPE is the class expression CE — that is, if some individual is connected by OPE with an individual x, then x is an instance of CE. Each such axiom can be seen as a syntactic shortcut for the following axiom:

SubClassOf( _owl:Thing_ ObjectAllValuesFrom( OPE CE ) )

ObjectPropertyRange := 'ObjectPropertyRange' '(' axiomAnnotations ObjectPropertyExpression ClassExpression ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ObjectPropertyRange( <i>a:hasDog</i> <i>a:Dog</i> )</td><td>The range of the <i>a:hasDog</i> property is the class <i>a:Dog</i>.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasDog</i> <i>a:Peter</i> <i>a:Brian</i> )</td><td>Brian is a dog of Peter.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasDog</i> <i>rdfs:range</i> <i>a:Dog</i> .</td><td>The range of the <i>a:hasDog</i> property is the class <i>a:Dog</i>.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:hasDog</i> <i>a:Brian</i> .</td><td>Brian is a dog of Peter.</td></tr></tbody></table>

By the first axiom, each individual that has an incoming _a:hasDog_ connection must be an instance of _a:Dog_. Therefore, _a:Brian_ can be classified as an instance of _a:Dog_; that is, this ontology entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ClassAssertion( <i>a:Dog</i> <i>a:Brian</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Brian</i> <i>rdf:type</i> <i>a:Dog</i> .</td></tr></tbody></table>

Range axioms in OWL 2 have a standard first-order semantics that is somewhat different from the semantics of such axioms in databases and object-oriented systems, where such axioms are interpreted as checks. The range axiom from the example ontology would in such systems be interpreted as a _constraint_ saying that _a:hasDog_ can point only to individuals that are known to be instances of _a:Dog_; furthermore, since the example ontology does not explicitly state that _a:Brian_ is an instance of _a:Dog_, one might expect the range constraint to be invalidated. This, however, is not the case in OWL 2: as shown in the previous paragraph, the missing type is _inferred_ from the range constraint.

#### 9.2.7 Functional Object Properties

An object property functionality axiom FunctionalObjectProperty( OPE ) states that the object property expression OPE is functional — that is, for each individual x, there can be at most one distinct individual y such that x is connected by OPE to y. Each such axiom can be seen as a syntactic shortcut for the following axiom:

SubClassOf( _owl:Thing_ ObjectMaxCardinality( 1 OPE ) )

FunctionalObjectProperty := 'FunctionalObjectProperty' '(' axiomAnnotations ObjectPropertyExpression ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>FunctionalObjectProperty( <i>a:hasFather</i> )</td><td>Each object can have at most one father.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasFather</i> <i>a:Stewie</i> <i>a:Peter</i> )</td><td>Peter is Stewie's father.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasFather</i> <i>a:Stewie</i> <i>a:Peter_Griffin</i> )</td><td>Peter Griffin is Stewie's father.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasFather</i> <i>rdf:type</i> <i>owl:FunctionalProperty</i> .</td><td>Each object can have at most one father.</td></tr><tr valign="top"><td><i>a:Stewie</i> <i>a:hasFather</i> <i>a:Peter</i> .</td><td>Peter is Stewie's father.</td></tr><tr valign="top"><td><i>a:Stewie</i> <i>a:hasFather</i> <i>a:Peter_Griffin</i> .</td><td>Peter Griffin is Stewie's father.</td></tr></tbody></table>

By the first axiom, _a:hasFather_ can point from _a:Stewie_ to at most one distinct individual, so _a:Peter_ and _a:Peter\_Griffin_ must be equal; that is, this ontology entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">SameIndividual( <i>a:Peter</i> <i>a:Peter_Griffin</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Peter_Griffin</i> <i>owl:sameAs</i> <i>a:Peter</i> .</td></tr></tbody></table>

One might expect the previous ontology to be inconsistent, since the _a:hasFather_ property points to two different values for _a:Stewie_. OWL 2, however, does not make the unique name assumption, so _a:Peter_ and _a:Peter\_Griffin_ are not necessarily distinct individuals. If the ontology were extended with the following assertion, then it would indeed become inconsistent:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DifferentIndividuals( <i>a:Peter</i> <i>a:Peter_Griffin</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Peter</i> <i>owl:differentFrom</i> <i>a:Peter_Griffin</i> .</td></tr></tbody></table>

#### 9.2.8 Inverse-Functional Object Properties

An object property inverse functionality axiom InverseFunctionalObjectProperty( OPE ) states that the object property expression OPE is inverse-functional — that is, for each individual x, there can be at most one individual y such that y is connected by OPE with x. Each such axiom can be seen as a syntactic shortcut for the following axiom:

SubClassOf( _owl:Thing_ ObjectMaxCardinality( 1 ObjectInverseOf( OPE ) ) )

InverseFunctionalObjectProperty := 'InverseFunctionalObjectProperty' '(' axiomAnnotations ObjectPropertyExpression ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>InverseFunctionalObjectProperty( <i>a:fatherOf</i> )</td><td>Each object can have at most one father.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:fatherOf</i> <i>a:Peter</i> <i>a:Stewie</i> )</td><td>Peter is Stewie's father.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:fatherOf</i> <i>a:Peter_Griffin</i> <i>a:Stewie</i> )</td><td>Peter Griffin is Stewie's father.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:fatherOf</i> <i>rdf:type</i> <i>owl:InverseFunctionalProperty</i> .</td><td>Each object can have at most one father.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:fatherOf</i> <i>a:Stewie</i> .</td><td>Peter is Stewie's father.</td></tr><tr valign="top"><td><i>a:Peter_Griffin</i> <i>a:fatherOf</i> <i>a:Stewie</i> .</td><td>Peter Griffin is Stewie's father.</td></tr></tbody></table>

By the first axiom, at most one distinct individual can point by _a:fatherOf_ to _a:Stewie_, so _a:Peter_ and _a:Peter\_Griffin_ must be equal; that is, this ontology entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">SameIndividual( <i>a:Peter</i> <i>a:Peter_Griffin</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Peter</i> <i>owl:sameAs</i> <i>a:Peter_Griffin</i> .</td></tr></tbody></table>

One might expect the previous ontology to be inconsistent, since there are two individuals that _a:Stewie_ is connected to by _a:fatherOf_. OWL 2, however, does not make the unique name assumption, so _a:Peter_ and _a:Peter\_Griffin_ are not necessarily distinct individuals. If the ontology were extended with the following assertion, then it would indeed become inconsistent:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DifferentIndividuals( <i>a:Peter</i> <i>a:Peter_Griffin</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Peter</i> <i>owl:differentFrom</i> <i>a:Peter_Griffin</i> .</td></tr></tbody></table>

#### 9.2.9 Reflexive Object Properties

An object property reflexivity axiom ReflexiveObjectProperty( OPE ) states that the object property expression OPE is reflexive — that is, each individual is connected by OPE to itself. Each such axiom can be seen as a syntactic shortcut for the following axiom:

SubClassOf( _owl:Thing_ ObjectHasSelf( OPE ) )

ReflexiveObjectProperty := 'ReflexiveObjectProperty' '(' axiomAnnotations ObjectPropertyExpression ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ReflexiveObjectProperty( <i>a:knows</i> )</td><td>Everybody knows themselves.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:Person</i> <i>a:Peter</i> )</td><td>Peter is a person.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:knows</i> <i>rdf:type</i> <i>owl:ReflexiveProperty</i> .</td><td>Everybody knows themselves.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>rdf:type</i> <i>a:Person</i> .</td><td>Peter is a person.</td></tr></tbody></table>

By the first axiom, _a:Peter_ must be connected by _a:knows_ to itself; that is, this ontology entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectPropertyAssertion( <i>a:knows</i> <i>a:Peter</i> <i>a:Peter</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Peter</i> <i>a:knows</i> <i>a:Peter</i> .</td></tr></tbody></table>

#### 9.2.10 Irreflexive Object Properties

An object property irreflexivity axiom IrreflexiveObjectProperty( OPE ) states that the object property expression OPE is irreflexive — that is, no individual is connected by OPE to itself. Each such axiom can be seen as a syntactic shortcut for the following axiom:

SubClassOf( ObjectHasSelf( OPE ) _owl:Nothing_ )

IrreflexiveObjectProperty := 'IrreflexiveObjectProperty' '(' axiomAnnotations ObjectPropertyExpression ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>IrreflexiveObjectProperty( <i>a:marriedTo</i> )</td><td>Nobody can be married to themselves.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:marriedTo</i> <i>rdf:type</i> <i>owl:IrreflexiveProperty</i> .</td><td>Nobody can be married to themselves.</td></tr></tbody></table>

If this ontology were extended with the following assertion, the irreflexivity axiom would be contradicted and the ontology would become inconsistent:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectPropertyAssertion( <i>a:marriedTo</i> <i>a:Peter</i> <i>a:Peter</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Peter</i> <i>a:marriedTo</i> <i>a:Peter</i> .</td></tr></tbody></table>

#### 9.2.11 Symmetric Object Properties

An object property symmetry axiom SymmetricObjectProperty( OPE ) states that the object property expression OPE is symmetric — that is, if an individual x is connected by OPE to an individual y, then y is also connected by OPE to x. Each such axiom can be seen as a syntactic shortcut for the following axiom:

SubObjectPropertyOf( OPE ObjectInverseOf( OPE ) )

SymmetricObjectProperty := 'SymmetricObjectProperty' '(' axiomAnnotations ObjectPropertyExpression ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>SymmetricObjectProperty( <i>a:friend</i> )</td><td>If x is a friend of y, then y is a friend of x.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:friend</i> <i>a:Peter</i> <i>a:Brian</i> )</td><td>Brian is a friend of Peter.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:friend</i> <i>rdf:type</i> <i>owl:SymmetricProperty</i> .</td><td>If x is a friend of y, then y is a friend of x.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:friend</i> <i>a:Brian</i> .</td><td>Brian is a friend of Peter.</td></tr></tbody></table>

Since _a:friend_ is symmetric, _a:Peter_ must be connected by _a:friend_ to _a:Brian_; that is, this ontology entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectPropertyAssertion( <i>a:friend</i> <i>a:Brian</i> <i>a:Peter</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Brian</i> <i>a:friend</i> <i>a:Peter</i> .</td></tr></tbody></table>

#### 9.2.12 Asymmetric Object Properties

An object property asymmetry axiom AsymmetricObjectProperty( OPE ) states that the object property expression OPE is asymmetric — that is, if an individual x is connected by OPE to an individual y, then y cannot be connected by OPE to x.

AsymmetricObjectProperty := 'AsymmetricObjectProperty' '(' axiomAnnotations ObjectPropertyExpression ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>AsymmetricObjectProperty( <i>a:parentOf</i> )</td><td>If x is a parent of y, then y is not a parent of x.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:parentOf</i> <i>a:Peter</i> <i>a:Stewie</i> )</td><td>Peter is a parent of Stewie.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:parentOf</i> <i>rdf:type</i> <i>rdf:AsymmetricProperty</i> .</td><td>If x is a parent of y, then y is not a parent of x.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:parentOf</i> <i>a:Stewie</i> .</td><td>Peter is a parent of Stewie.</td></tr></tbody></table>

If this ontology were extended with the following assertion, the asymmetry axiom would be invalidated and the ontology would become inconsistent:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectPropertyAssertion( <i>a:parentOf</i> <i>a:Stewie</i> <i>a:Peter</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Stewie</i> <i>a:parentOf</i> <i>a:Peter</i> .</td></tr></tbody></table>

#### 9.2.13 Transitive Object Properties

An object property transitivity axiom TransitiveObjectProperty( OPE ) states that the object property expression OPE is transitive — that is, if an individual x is connected by OPE to an individual y that is connected by OPE to an individual z, then x is also connected by OPE to z. Each such axiom can be seen as a syntactic shortcut for the following axiom:

SubObjectPropertyOf( ObjectPropertyChain( OPE OPE ) OPE )

TransitiveObjectProperty := 'TransitiveObjectProperty' '(' axiomAnnotations ObjectPropertyExpression ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>TransitiveObjectProperty( <i>a:ancestorOf</i> )</td><td>If x is an ancestor of y and y is an ancestor of z, then x is an ancestor of z.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:ancestorOf</i> <i>a:Carter</i> <i>a:Lois</i> )</td><td>Carter is an ancestor of Lois.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:ancestorOf</i> <i>a:Lois</i> <i>a:Meg</i> )</td><td>Lois is an ancestor of Meg.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:ancestorOf</i> <i>rdf:type</i> <i>owl:TransitiveProperty</i> .</td><td>If x is an ancestor of y and y is an ancestor of z, then x is an ancestor of z.</td></tr><tr valign="top"><td><i>a:Carter</i> <i>a:ancestorOf</i> <i>a:Lois</i> .</td><td>Carter is an ancestor of Lois.</td></tr><tr valign="top"><td><i>a:Lois</i> <i>a:ancestorOf</i> <i>a:Meg</i> .</td><td>Lois is an ancestor of Meg.</td></tr></tbody></table>

Since _a:ancestorOf_ is transitive, _a:Carter_ must be connected by _a:ancestorOf_ to _a:Meg_ — that is, this ontology entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectPropertyAssertion( <i>a:ancestorOf</i> <i>a:Carter</i> <i>a:Meg</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Carter</i> <i>a:ancestorOf</i> <i>a:Meg</i> .</td></tr></tbody></table>

### 9.3 Data Property Axioms

OWL 2 also provides for data property axioms. Their structure is similar to object property axioms, as shown in Figure 16. The SubDataPropertyOf axiom allows one to state that the extension of one data property expression is included in the extension of another data property expression. The EquivalentDataProperties allows one to state that several data property expressions have the same extension. The DisjointDataProperties axiom allows one to state that the extensions of several data property expressions are disjoint with each other — that is, they do not share individual–literal pairs. The DataPropertyDomain axiom can be used to restrict individuals connected by a property expression to be instances of the specified class; similarly, the DataPropertyRange axiom can be used to restrict the literals pointed to by a property expression to be in the specified unary data range. Finally, the FunctionalDataProperty axiom allows one to state that a data property expression is functional — that is, that each individual can have at most one outgoing connection of the specified data property expression.

![Data Property Axioms of OWL 2](A_dataproperty.gif)  
Figure 16. Data Property Axioms of OWL 2

DataPropertyAxiom :=  
    SubDataPropertyOf | EquivalentDataProperties | DisjointDataProperties |  
    DataPropertyDomain | DataPropertyRange | FunctionalDataProperty

#### 9.3.1 Data Subproperties

A data subproperty axiom SubDataPropertyOf( DPE1 DPE2 ) states that the data property expression DPE1 is a subproperty of the data property expression DPE2 — that is, if an individual x is connected by DPE1 to a literal y, then x is connected by DPE2 to y as well.

SubDataPropertyOf := 'SubDataPropertyOf' '(' axiomAnnotations subDataPropertyExpression superDataPropertyExpression ')'  
subDataPropertyExpression := DataPropertyExpression  
superDataPropertyExpression := DataPropertyExpression

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>SubDataPropertyOf( <i>a:hasLastName</i> <i>a:hasName</i> )</td><td>A last name of someone is his/her name as well.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:hasLastName</i> <i>a:Peter</i> "Griffin" )</td><td>Peter's last name is <span class="name">"Griffin"</span>.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasLastName</i> <i>rdfs:subPropertyOf</i> <i>a:hasName</i> .</td><td>A last name of someone is his/her name as well.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:hasLastName</i> "Griffin" .</td><td>Peter's last name is <span class="name">"Griffin"</span>.</td></tr></tbody></table>

Since _a:hasLastName_ is a subproperty of _a:hasName_, each individual connected by the former property to a literal is also connected by the latter property to the same literal. Therefore, this ontology entails that _a:Peter_ is connected to "Griffin" through _a:hasName_; that is, the ontology entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DataPropertyAssertion( <i>a:hasName</i> <i>a:Peter</i> "Griffin" )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Peter</i> <i>a:hasName</i> "Griffin" .</td></tr></tbody></table>

#### 9.3.2 Equivalent Data Properties

An equivalent data properties axiom EquivalentDataProperties( DPE1 ... DPEn ) states that all the data property expressions DPEi, 1 ≤ i ≤ n, are semantically equivalent to each other. This axiom allows one to use each DPEi as a synonym for each DPEj — that is, in any expression in the ontology containing such an axiom, DPEi can be replaced with DPEj without affecting the meaning of the ontology. The axiom EquivalentDataProperties( DPE1 DPE2 ) can be seen as a syntactic shortcut for the following axiom:

SubDataPropertyOf( DPE1 DPE2 )  
SubDataPropertyOf( DPE2 DPE1 )

EquivalentDataProperties := 'EquivalentDataProperties' '(' axiomAnnotations DataPropertyExpression DataPropertyExpression { DataPropertyExpression } ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>EquivalentDataProperties( <i>a:hasName</i> <i>a:seLlama</i> )</td><td><i>a:hasName</i> and <i>a:seLlama</i> (in Spanish) are synonyms.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:hasName</i> <i>a:Meg</i> "Meg Griffin" )</td><td>Meg's name is <span class="name">"Meg Griffin"</span>.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:seLlama</i> <i>a:Meg</i> "Megan Griffin" )</td><td>Meg's name is <span class="name">"Megan Griffin"</span>.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasName</i> <i>owl:equivalentProperty</i> <i>a:seLlama</i> .</td><td><i>a:hasName</i> and <i>a:seLlama</i> (in Spanish) are synonyms.</td></tr><tr valign="top"><td><i>a:Meg</i> <i>a:hasName</i> "Meg Griffin" .</td><td>Meg's name is <span class="name">"Meg Griffin"</span>.</td></tr><tr valign="top"><td><i>a:Meg</i> <i>a:seLlama</i> "Megan Griffin" .</td><td>Meg's name is <span class="name">"Megan Griffin"</span>.</td></tr></tbody></table>

Since _a:hasName_ and _a:seLlama_ are equivalent properties, this ontology entails that _a:Meg_ is connected by _a:seLlama_ with "Meg Griffin" — that is, it entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DataPropertyAssertion( <i>a:seLlama</i> <i>a:Meg</i> "Meg Griffin" )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Meg</i> <i>a:seLlama</i> "Meg Griffin" .</td></tr></tbody></table>

Furthermore, the ontology also entails that _a:Meg_ is also connected by _a:hasName_ with "Megan Griffin" — that is, it entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DataPropertyAssertion( <i>a:hasName</i> <i>a:Meg</i> "Megan Griffin" )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Meg</i> <i>a:hasName</i> "Megan Griffin" .</td></tr></tbody></table>

#### 9.3.3 Disjoint Data Properties

A disjoint data properties axiom DisjointDataProperties( DPE1 ... DPEn ) states that all of the data property expressions DPEi, 1 ≤ i ≤ n, are pairwise disjoint; that is, no individual x can be connected to a literal y by both DPEi and DPEj for i ≠ j.

DisjointDataProperties := 'DisjointDataProperties' '(' axiomAnnotations DataPropertyExpression DataPropertyExpression { DataPropertyExpression } ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>DisjointDataProperties( <i>a:hasName</i> <i>a:hasAddress</i> )</td><td>Someone's name must be different from his address.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:hasName</i> <i>a:Peter</i> "Peter Griffin" )</td><td>Peter's name is <span class="name">"Peter Griffin"</span>.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:hasAddress</i> <i>a:Peter</i> "Quahog, Rhode Island" )</td><td>Peter's address is <span class="name">"Quahog, Rhode Island"</span>.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasName</i> <i>owl:propertyDisjointWith</i> <i>a:hasAddress</i> .</td><td>Someone's name must be different from his address.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:hasName</i> "Peter Griffin" .</td><td>Peter's name is <span class="name">"Peter Griffin"</span>.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:hasAddress</i> "Quahog, Rhode Island" .</td><td>Peter's address is <span class="name">"Quahog, Rhode Island"</span>.</td></tr></tbody></table>

In this ontology, the disjointness axiom is satisfied. If, however, one were to add the following assertion, the disjointness axiom would be invalidated and the ontology would become inconsistent:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DataPropertyAssertion( <i>a:hasAddress</i> <i>a:Peter</i> "Peter Griffin" )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Peter</i> <i>a:hasAddress</i> "Peter Griffin" .</td></tr></tbody></table>

#### 9.3.4 Data Property Domain

A data property domain axiom DataPropertyDomain( DPE CE ) states that the domain of the data property expression DPE is the class expression CE — that is, if an individual x is connected by DPE with some literal, then x is an instance of CE. Each such axiom can be seen as a syntactic shortcut for the following axiom:

SubClassOf( DataSomeValuesFrom( DPE _rdfs:Literal_) CE )

DataPropertyDomain := 'DataPropertyDomain' '(' axiomAnnotations DataPropertyExpression ClassExpression ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>DataPropertyDomain( <i>a:hasName</i> <i>a:Person</i> )</td><td>Only people can have names.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:hasName</i> <i>a:Peter</i> "Peter Griffin" )</td><td>Peter's name is <span class="name">"Peter Griffin"</span>.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasName</i> <i>rdfs:domain</i> <i>a:Person</i> .</td><td>Only people can have names.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:hasName</i> "Peter Griffin" .</td><td>Peter's name is <span class="name">"Peter Griffin"</span>.</td></tr></tbody></table>

By the first axiom, each individual that has an outgoing _a:hasName_ connection must be an instance of _a:Person_. Therefore, _a:Peter_ can be classified as an instance of _a:Person_ — that is, this ontology entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ClassAssertion( <i>a:Person</i> <i>a:Peter</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Peter</i> <i>rdf:type</i> <i>a:Person</i> .</td></tr></tbody></table>

Domain axioms in OWL 2 have a standard first-order semantics that is somewhat different from the semantics of such axioms in databases and object-oriented systems, where such axioms are interpreted as checks. Thus, the domain axiom from the example ontology would in such systems be interpreted as a _constraint_ saying that _a:hasName_ can point only from individuals that are known to be instances of _a:Person_; furthermore, since the example ontology does not explicitly state that _a:Peter_ is an instance of _a:Person_, one might expect the domain constraint to be invalidated. This, however, is not the case in OWL 2: as shown in the previous paragraph, the missing type is _inferred_ from the domain constraint.

#### 9.3.5 Data Property Range

A data property range axiom DataPropertyRange( DPE DR ) states that the range of the data property expression DPE is the data range DR — that is, if some individual is connected by DPE with a literal x, then x is in DR. The arity of DR _MUST_ be one. Each such axiom can be seen as a syntactic shortcut for the following axiom:

SubClassOf( _owl:Thing_ DataAllValuesFrom( DPE DR ) )

DataPropertyRange := 'DataPropertyRange' '(' axiomAnnotations DataPropertyExpression DataRange ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>DataPropertyRange( <i>a:hasName</i> <i>xsd:string</i> )</td><td>The range of the <i>a:hasName</i> property is <i>xsd:string</i>.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:hasName</i> <i>a:Peter</i> "Peter Griffin" )</td><td>Peter's name is <span class="name">"Peter Griffin"</span>.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasName</i> <i>rdfs:range</i> <i>xsd:string</i> .</td><td>The range of the <i>a:hasName</i> property is <i>xsd:string</i>.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:hasName</i> "Peter Griffin" .</td><td>Peter's name is <span class="name">"Peter Griffin"</span>.</td></tr></tbody></table>

By the first axiom, each literal that has an incoming _a:hasName_ link must be in _xsd:string_. In the example ontology, this axiom is satisfied. If, however, the ontology were extended with the following assertion, then the range axiom would imply that the literal "42"^^_xsd:integer_ is in _xsd:string_, which is a contradiction and the ontology would become inconsistent:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DataPropertyAssertion( <i>a:hasName</i> <i>a:Peter</i> "42"^^<i>xsd:integer</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Peter</i> <i>a:hasName</i> "42"^^<i>xsd:integer</i> .</td></tr></tbody></table>

#### 9.3.6 Functional Data Properties

A data property functionality axiom FunctionalDataProperty( DPE ) states that the data property expression DPE is functional — that is, for each individual x, there can be at most one distinct literal y such that x is connected by DPE with y. Each such axiom can be seen as a syntactic shortcut for the following axiom:

SubClassOf( _owl:Thing_ DataMaxCardinality( 1 DPE ) )

FunctionalDataProperty := 'FunctionalDataProperty' '(' axiomAnnotations DataPropertyExpression ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>FunctionalDataProperty( <i>a:hasAge</i> )</td><td>Each object can have at most one age.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:hasAge</i> <i>a:Meg</i> "17"^^<i>xsd:integer</i> )</td><td>Meg is seventeen years old.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasAge</i> <i>rdf:type</i> <i>owl:FunctionalProperty</i> .</td><td>Each object can have at most one age.</td></tr><tr valign="top"><td><i>a:Meg</i> <i>a:hasAge</i> "17"^^<i>xsd:integer</i> .</td><td>Meg is seventeen years old.</td></tr></tbody></table>

By the first axiom, _a:hasAge_ can point from _a:Meg_ to at most one distinct literal. In this example ontology, this axiom is satisfied. If, however, the ontology were extended with the following assertion, the semantics of functionality axioms would imply that "15"^^_xsd:integer_ is equal to "17"^^_xsd:integer_, which is a contradiction and the ontology would become inconsistent:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DataPropertyAssertion( <i>a:hasAge</i> <i>a:Meg</i> "15"^^<i>xsd:integer</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Meg</i> <i>a:hasAge</i> "15"^^<i>xsd:integer</i> .</td></tr></tbody></table>

Note that some datatypes from the OWL 2 datatype map distinguish between equal and identical data values, and that the semantics of cardinality restrictions and functional data properties in OWL 2 is defined with respect to the latter. Consider the following example:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>FunctionalDataProperty( <i>a:hasAge</i> )</td><td>Each object can have at most one age.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:hasAge</i> <i>a:Meg</i> "17"^^<i>xsd:integer</i> )</td><td>Meg is seventeen years old.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:hasAge</i> <i>a:Meg</i> "17.0"^^<i>xsd:decimal</i> )</td><td>Meg is seventeen years old.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:hasAge</i> <i>a:Meg</i> "+17"^^<i>xsd:int</i> )</td><td>Meg is seventeen years old.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasAge</i> <i>rdf:type</i> <i>owl:FunctionalProperty</i> .</td><td>Each object can have at most one age.</td></tr><tr valign="top"><td><i>a:Meg</i> <i>a:hasAge</i> "17"^^<i>xsd:integer</i> .</td><td>Meg is seventeen years old.</td></tr><tr valign="top"><td><i>a:Meg</i> <i>a:hasAge</i> "17.0"^^<i>xsd:decimal</i> .</td><td>Meg is seventeen years old.</td></tr><tr valign="top"><td><i>a:Meg</i> <i>a:hasAge</i> "+17"^^<i>xsd:int</i> .</td><td>Meg is seventeen years old.</td></tr></tbody></table>

Literals "17"^^_xsd:integer_, "17.0"^^_xsd:decimal_, and "+17"^^_xsd:int_ are all mapped to the identical data value — the integer 17. Therefore, the individual _a:Meg_ is connected by the _a:hasAge_ property to one distinct data value, so this ontology is satisfiable.

In contrast, consider the following ontology:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>FunctionalDataProperty( <i>a:numberOfChildren</i> )</td><td>An individual can have at most one value for <i>a:numberOfChildren</i>.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:numberOfChildren</i> <i>a:Meg</i> "+0"^^<i>xsd:float</i> )</td><td>The value of <i>a:numberOfChildren</i> for <i>a:Meg</i> is <i>+0</i>.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:numberOfChildren</i> <i>a:Meg</i> "-0"^^<i>xsd:float</i> )</td><td>The value of <i>a:numberOfChildren</i> for <i>a:Meg</i> is <i>-0</i>.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:numberOfChildren</i> <i>rdf:type</i> <i>owl:FunctionalProperty</i> .</td><td>An individual can have at most one value for <i>a:numberOfChildren</i>.</td></tr><tr valign="top"><td><i>a:Meg</i> <i>a:numberOfChildren</i> "+0"^^<i>xsd:float</i> .</td><td>The value of <i>a:numberOfChildren</i> for <i>a:Meg</i> is <i>+0</i>.</td></tr><tr valign="top"><td><i>a:Meg</i> <i>a:numberOfChildren</i> "-0"^^<i>xsd:float</i> .</td><td>The value of <i>a:numberOfChildren</i> for <i>a:Meg</i> is <i>-0</i>.</td></tr></tbody></table>

Literals "+0"^^_xsd:float_ and "-0"^^_xsd:float_ are mapped to distinct data values _+0_ and _\-0_ in the value space of _xsf:float_; these data values are equal, but not identical. Therefore, the individual _a:Meg_ is connected by the _a:numberOfChildren_ property to two distinct data values, which violates the functionality restriction on _a:numberOfChildren_ and makes the ontology unsatisfiable.

### 9.4 Datatype Definitions

A datatype definition DatatypeDefinition( DT DR ) defines a new datatype DT as being semantically equivalent to the data range DR; the latter _MUST_ be a unary data range. This axiom allows one to use the _defined_ datatype DT as a synonym for DR — that is, in any expression in the ontology containing such an axiom, DT can be replaced with DR without affecting the meaning of the ontology. The structure of such axiom is shown in Figure 17.

![Datatype Definitions in OWL 2](A_datatypedefinition.gif)  
Figure 17. Datatype Definitions in OWL 2

DatatypeDefinition := 'DatatypeDefinition' '(' axiomAnnotations Datatype DataRange ')'

The datatypes defined by datatype definition axioms support no facets so they _MUST NOT_ occur in datatype restrictions. Furthermore, such datatypes have empty lexical spaces and therefore they _MUST NOT_ occur in literals. Finally, datatype definitions are not substitutes for declarations: if an OWL 2 ontology is to satisfy the typing constraints of OWL 2 DL from [Section 5.8.1](#Typing_Constraints_of_OWL_2_DL), it _MUST_ explicitly declare all datatypes that occur in datatype definitions.

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>Declaration( Datatype( <i>a:SSN</i> ) )</td><td><i>a:SSN</i> is a datatype.</td></tr><tr valign="top"><td>DatatypeDefinition(<br>&nbsp;&nbsp;&nbsp; <i>a:SSN</i><br>&nbsp;&nbsp;&nbsp; DatatypeRestriction( <i>xsd:string</i> <i>xsd:pattern</i> "[0-9]{3}-[0-9]{2}-[0-9]{4}" )<br>)</td><td>A social security number is a string that matches the given regular expression.</td></tr><tr valign="top"><td>DataPropertyRange( <i>a:hasSSN</i> <i>a:SSN</i> )</td><td>The range of the <i>a:hasSSN</i> property is <i>a:SSN</i>.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:SSN</i> <i>rdf:type</i> <i>rdfs:Datatype</i> .</td><td><i>a:SSN</i> is a datatype.</td></tr><tr valign="top"><td><i>a:SSN</i> <i>owl:equivalentClass</i> _:x .<br>_:x <i>rdf:type</i> <i>rdfs:Datatype</i> .<br>_:x <i>owl:onDatatype</i> <i>xsd:string</i> .<br><i>_:x owl:withRestrictions</i> ( _:y ) .<br>_:y <i>xsd:pattern</i> "[0-9]{3}-[0-9]{2}-[0-9]{4}" .</td><td>A social security number is a string that matches the given regular expression.</td></tr><tr valign="top"><td><i>a:hasSSN</i> <i>rdfs:range</i> <i>a:SSN</i> .</td><td>The range of the <i>a:hasSSN</i> property is <i>a:SSN</i>.</td></tr></tbody></table>

The second axiom defines _a:SSN_ as an abbreviation for a datatype restriction on _xsd:string_. In order to satisfy the typing restrictions from [Section 5.8.1](#Typing_Constraints_of_OWL_2_DL), the first axiom explicitly declares _a:SSN_ to be a datatype. The datatype _a:SSN_ can be used just like any other datatype; for example, it is used in the third axiom to define the range of the _a:hasSSN_ property. The only restriction is that _a:SSN_ supports no facets and therefore cannot be used in datatype restrictions, and that there can be no literals of datatype _a:SSN_.

### 9.5 Keys

A key axiom HasKey( CE ( OPE1 ... OPEm ) ( DPE1 ... DPEn ) ) states that each (named) instance of the class expression CE is uniquely identified by the object property expressions OPEi and/or the data property experssions DPEj — that is, no two distinct (named) instances of CE can coincide on the values of all object property expressions OPEi and all data property expressions DPEj. In each such axiom in an OWL ontology, m or n (or both) _MUST_ be larger than zero. A key axiom of the form HasKey( _owl:Thing_ ( OPE ) () ) is similar to the axiom InverseFunctionalObjectProperty( OPE ), the main differences being that the former axiom is applicable only to individuals that are explicitly named in an ontology, while the latter axiom is also applicable to anonymous individuals and individuals whose existence is implied by existential quantification. The structure of such axiom is shown in Figure 18.

![Key Axioms in OWL 2](A_keys.gif)  
Figure 18. Key Axioms in OWL 2

HasKey := 'HasKey' '(' axiomAnnotations ClassExpression '(' { ObjectPropertyExpression } ')' '(' { DataPropertyExpression } ')' ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>HasKey( <i>owl:Thing</i> () ( <i>a:hasSSN</i> ) )</td><td>Each object is uniquely identified by its social security number.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:hasSSN</i> <i>a:Peter</i> "123-45-6789" )</td><td>Peter's social security number is <span class="name">"123-45-6789"</span>.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:hasSSN</i> <i>a:Peter_Griffin</i> "123-45-6789" )</td><td>Peter Griffin's social security number is <span class="name">"123-45-6789"</span>.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>owl:Thing</i> <i>owl:hasKey</i> ( <i>a:hasSSN</i> ) .</td><td>Each object is uniquely identified by its social security number.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:hasSSN</i> "123-45-6789" .</td><td>Peter's social security number is <span class="name">"123-45-6789"</span>.</td></tr><tr valign="top"><td><i>a:Peter_Griffin</i> <i>a:hasSSN</i> "123-45-6789" .</td><td>Peter Griffin's social security number is <span class="name">"123-45-6789"</span>.</td></tr></tbody></table>

The first axiom makes _a:hasSSN_ the key for instances of the _owl:Thing_ class; thus, only one individual can have a particular value for _a:hasSSN_. Since the values of _a:hasSSN_ are the same for the individuals _a:Peter_ and _a:Peter\_Griffin_, these two individuals are equal — that is, this ontology entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">SameIndividual( <i>a:Peter</i> <i>a:Peter_Griffin</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Peter</i> <i>owl:sameAs</i> <i>a:Peter_Griffin</i> .</td></tr></tbody></table>

One might expect the previous ontology to be inconsistent, since the _a:hasSSN_ has the same value for two individuals _a:Peter_ and _a:Peter\_Griffin_. However, OWL 2 does not make the unique name assumption, so _a:Peter_ and _a:Peter\_Griffin_ are not necessarily distinct individuals. If the ontology were extended with the following assertion, then it would indeed become inconsistent:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DifferentIndividuals( <i>a:Peter</i> <i>a:Peter_Griffin</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Peter</i> <i>owl:differentFrom</i> <i>a:Peter_Griffin</i> .</td></tr></tbody></table>

The effect of a key axiom can be "localized" to instances of a particular class expression. Consider the following example:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>HasKey( <i>a:GriffinFamilyMember</i> () ( <i>a:hasName</i> ) )</td><td>Each member of the Griffin family is uniquely identified by its name.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:hasName</i> <i>a:Peter</i> "Peter" )</td><td>Peter's name is <span class="name">"Peter"</span>.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:GriffinFamilyMember</i> <i>a:Peter</i> )</td><td>Peter is a member of the Griffin family.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:hasName</i> <i>a:Peter_Griffin</i> "Peter" )</td><td>Peter Griffin's name is <span class="name">"Peter"</span>.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:GriffinFamilyMember</i> <i>a:Peter_Griffin</i> )</td><td>Peter Griffin is a member of the Griffin family.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:hasName</i> <i>a:StPeter</i> "Peter" )</td><td>St. Peter's name is <span class="name">"Peter"</span>.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:GriffinFamilyMember</i> <i>owl:hasKey</i> ( <i>a:hasName</i> ) .</td><td>Each member of the Griffin family is uniquely identified by its name.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:hasName</i> "Peter" .</td><td>Peter's name is <span class="name">"Peter"</span>.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>rdf:type</i> <i>a:GriffinFamilyMember</i> .</td><td>Peter is a member of the Griffin family.</td></tr><tr valign="top"><td><i>a:Peter_Griffin</i> <i>a:hasName</i> "Peter" .</td><td>Peter Griffin's name is <span class="name">"Peter"</span>.</td></tr><tr valign="top"><td><i>a:Peter_Griffin</i> <i>rdf:type</i> <i>a:GriffinFamilyMember</i> .</td><td>Peter Griffin is a member of the Griffin family.</td></tr><tr valign="top"><td><i>a:StPeter</i> <i>a:hasName</i> "Peter" .</td><td>St. Peter's name is <span class="name">"Peter"</span>.</td></tr></tbody></table>

The effects of the first key axiom are "localized" to the class _a:GriffinFamilyMember_ — that is, the data property _a:hasName_ uniquely identifies only instances of that class. The individuals _a:Peter_ and _a:Peter\_Griffin_ are instances of _a:GriffinFamilyMember_, so the key axiom implies that _a:Peter_ and _a:Peter\_Griffin_ are the same individuals — that is, the ontology implies the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">SameIndividual( <i>a:Peter</i> <i>a:Peter_Griffin</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Peter</i> <i>owl:sameAs</i> <i>a:Peter_Griffin</i> .</td></tr></tbody></table>

The individual _a:StPeter_, however, is not an instance of _a:GriffinFamilyMember_, so the key axiom is not applicable to it. Therefore, the ontology implies neither that _a:Peter_ and _a:StPeter_ are the same individuals, nor does it imply that _a:Peter\_Griffin_ and _a:StPeter_ are the same. Keys can be made global by "localizing" them to the _owl:Thing_ class, as shown in the previous example.

A key axiom does not make all the properties used in it functional. Consider the following example:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>HasKey( <i>a:GriffinFamilyMember</i> () ( <i>a:hasName</i> ) )</td><td>Each member of the Griffin family is uniquely identified by its name.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:hasName</i> <i>a:Peter</i> "Peter" )</td><td>Peter's name is <span class="name">"Peter"</span>.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:hasName</i> <i>a:Peter</i> "Kichwa-Tembo" )</td><td>Peter's name is <span class="name">"Kichwa-Tembo"</span>.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:GriffinFamilyMember</i> <i>a:Peter</i> )</td><td>Peter is a member of the Griffin family.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:GriffinFamilyMember</i> <i>owl:hasKey</i> ( <i>a:hasName</i> ) .</td><td>Each member of the Griffin family is uniquely identified by its name.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:hasName</i> "Peter" .</td><td>Peter's name is <span class="name">"Peter"</span>.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:hasName</i> "Kichwa-Tembo" .</td><td>Peter's name is <span class="name">"Kichwa-Tembo"</span>.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>rdf:type</i> <i>a:GriffinFamilyMember</i> .</td><td>Peter is a member of the Griffin family.</td></tr></tbody></table>

This ontology is consistent — that is, the fact that the individual _a:Peter_ has two distinct values for _a:hasName_ does not cause an inconsistency since the _a:hasName_ data property is not necessarily functional.

If desired, the properties used in a key axiom can always be made functional explicitly. Thus, if the example ontology were extended with the following axiom, it would become inconsistent.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">FunctionalDataProperty( <i>a:hasName</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:hasName</i> <i>rdf:type</i> <i>owl:FunctionalProperty</i> .</td></tr></tbody></table>

The semantics of key axioms is specific in that these axioms apply only to individuals explicitly introduced in the ontology by name, and not to unnamed individuals (i.e., the individuals whose existence is implied by existential quantification). This makes key axioms equivalent to a variant of DL-safe rules [DL-Safe](#ref-dl-safe)\]. Thus, key axioms will typically not affect class-based inferences such as the computation of the subsumption hierarchy, but they will play a role in answering queries about individuals.

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>HasKey( <i>a:Person</i> () ( <i>a:hasSSN</i> ) )</td><td>Each person is uniquely identified by their social security number.</td></tr><tr valign="top"><td>DataPropertyAssertion( <i>a:hasSSN</i> <i>a:Peter</i> "123-45-6789" )</td><td>Peter's social security number is <span class="name">"123-45-6789"</span>.</td></tr><tr valign="top"><td>ClassAssertion( <i>a:Person</i> <i>a:Peter</i> )</td><td>Peter is a person.</td></tr><tr valign="top"><td>ClassAssertion(<br>&nbsp;&nbsp;&nbsp; ObjectSomeValuesFrom(<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <i>a:marriedTo</i><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ObjectIntersectionOf( <i>a:Man</i> DataHasValue( <i>a:hasSSN</i> "123-45-6789" ) )<br>&nbsp;&nbsp;&nbsp; )<br>&nbsp;&nbsp;&nbsp; <i>a:Lois</i><br>)</td><td>Lois is married to some man whose social security number is <span class="name">"123-45-6789"</span>.</td></tr><tr valign="top"><td>SubClassOf( <i>a:Man</i> <i>a:Person</i> )</td><td>Each man is a person.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Person</i> <i>owl:hasKey</i> ( <i>a:hasSSN</i> ) .</td><td>Each person is uniquely identified by their social security number.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:hasSSN</i> "123-45-6789" .</td><td>Peter's social security number is <span class="name">"123-45-6789"</span>.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>rdf:type</i> <i>a:Person</i> .</td><td>Peter is a person.</td></tr><tr valign="top"><td><i>a:Lois</i> <i>rdf:type</i> _:x .<br>_:x <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:x <i>owl:onProperty</i> <i>a:marriedTo</i> .<br>_:x <i>owl:someValuesFrom</i> _:y .<br>_:y <i>rdf:type</i> <i>owl:Class</i> .<br>_:y <i>owl:intersectionOf</i> SEQ( <i>a:Man</i> _:z ) .<br>_:z <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:z <i>owl:onProperty</i> <i>a:hasSSN</i> .<br>_:z <i>owl:hasValue</i> "123-45-6789" .</td><td>Lois is married to some man whose social security number is <span class="name">"123-45-6789"</span>.</td></tr><tr valign="top"><td><i>a:Man</i> <i>rdfs:subClassOf</i> <i>a:Person</i> .</td><td>Each man is a person.</td></tr></tbody></table>

The fourth axiom implies existence of some individual x that is an instance of _a:Man_ and whose value for the _a:hasSSN_ data property is "123-45-6789"; by the fifth axiom, x is an instance of _a:Person_ as well. Furthermore, the second and the third axiom say that _a:Peter_ is an instance of _a:Person_ and that the value of _a:hasSSN_ for _a:Peter_ is "123-45-6789". Finally, the first axiom says that _a:hasSSN_ is a key property for instances of _a:Person_. Thus, one might expect x to be equal to _a:Peter_, and for the ontology to entail the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ClassAssertion( <i>a:Man</i> <i>a:Peter</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Peter</i> <i>rdf:type</i> <i>a:Man</i> .</td></tr></tbody></table>

The inferences in the previous paragraph, however, cannot be drawn because of the DL-safe semantics of key axioms: x is an individual that has not been explicitly named in the ontology; therefore, the semantics of key axioms does not apply to x. Therefore, this OWL 2 ontology does not entail the mentioned assertion.

### 9.6 Assertions

OWL 2 supports a rich set of axioms for stating _assertions_ — axioms about individuals that are often also called _facts_. For clarity, different types of assertions are shown in three separate figures, Figure 19, 20, and 21. The SameIndividual assertion allows one to state that several individuals are all equal to each other, while the DifferentIndividuals assertion allows for the opposite — that is, to state that several individuals are all different from each other. (More precisely, that the several different individuals in the syntax are also semantically different.) The ClassAssertion axiom allows one to state that an individual is an instance of a particular class.

![Class and Individual (In)Equality Assertions in OWL 2](A_abox1.gif)  
Figure 19. Class and Individual (In)Equality Assertions in OWL 2

The ObjectPropertyAssertion axiom allows one to state that an individual is connected by an object property expression to an individual, while NegativeObjectPropertyAssertion allows for the opposite — that is, to state that an individual is not connected by an object property expression to an individual.

![Object Property Assertions in OWL 2](A_abox2.gif)  
Figure 20. Object Property Assertions in OWL 2

The DataPropertyAssertion axiom allows one to state that an individual is connected by a data property expression to a literal, while NegativeDataPropertyAssertion allows for the opposite — that is, to state that an individual is not connected by a data property expression to a literal.

![Data Property Assertions in OWL 2](A_abox3.gif)  
Figure 21. Data Property Assertions in OWL 2

Assertion :=  
    SameIndividual | DifferentIndividuals | ClassAssertion |  
    ObjectPropertyAssertion | NegativeObjectPropertyAssertion |  
    DataPropertyAssertion | NegativeDataPropertyAssertion  
  
sourceIndividual := Individual  
targetIndividual := Individual  
targetValue := Literal

#### 9.6.1 Individual Equality

An individual equality axiom SameIndividual( a1 ... an ) states that all of the individuals ai, 1 ≤ i ≤ n, are equal to each other. This axiom allows one to use each ai as a synonym for each aj — that is, in any expression in the ontology containing such an axiom, ai can be replaced with aj without affecting the meaning of the ontology.

SameIndividual := 'SameIndividual' '(' axiomAnnotations Individual Individual { Individual } ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>SameIndividual( <i>a:Meg</i> <i>a:Megan</i> )</td><td>Meg and Megan are the same objects.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasBrother</i> <i>a:Meg</i> <i>a:Stewie</i> )</td><td>Meg has a brother Stewie.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Meg</i> <i>owl:sameAs</i> <i>a:Megan</i> .</td><td>Meg and Megan are the same objects.</td></tr><tr valign="top"><td><i>a:Meg</i> <i>a:hasBrother</i> <i>a:Stewie</i> .</td><td>Meg has a brother Stewie.</td></tr></tbody></table>

Since _a:Meg_ and _a:Megan_ are equal, one individual can always be replaced with the other one. Therefore, this ontology entails that _a:Megan_ is connected by _a:hasBrother_ with _a:Stewie_ — that is, the ontology entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectPropertyAssertion( <i>a:hasBrother</i> <i>a:Megan</i> <i>a:Stewie</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Megan</i> <i>a:hasBrother</i> <i>a:Stewie</i> .</td></tr></tbody></table>

#### 9.6.2 Individual Inequality

An individual inequality axiom DifferentIndividuals( a1 ... an ) states that all of the individuals ai, 1 ≤ i ≤ n, are different from each other; that is, no individuals ai and aj with i ≠ j can be derived to be equal. This axiom can be used to axiomatize the _unique name assumption_ — the assumption that all different individual names denote different individuals.

DifferentIndividuals := 'DifferentIndividuals' '(' axiomAnnotations Individual Individual { Individual } ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ObjectPropertyAssertion( <i>a:fatherOf</i> <i>a:Peter</i> <i>a:Meg</i> )</td><td>Peter is Meg's father.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:fatherOf</i> <i>a:Peter</i> <i>a:Chris</i> )</td><td>Peter is Chris's father.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:fatherOf</i> <i>a:Peter</i> <i>a:Stewie</i> )</td><td>Peter is Stewie's father.</td></tr><tr valign="top"><td>DifferentIndividuals( <i>a:Peter</i> <i>a:Meg</i> <i>a:Chris</i> <i>a:Stewie</i> )</td><td>Peter, Meg, Chris, and Stewie are all different from each other.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Peter</i> <i>a:fatherOf</i> <i>a:Meg</i> .</td><td>Peter is Meg's father.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:fatherOf</i> <i>a:Chris</i> .</td><td>Peter is Chris's father.</td></tr><tr valign="top"><td><i>a:Peter</i> <i>a:fatherOf</i> <i>a:Stewie</i> .</td><td>Peter is Stewie's father.</td></tr><tr valign="top"><td>_:x <i>rdf:type</i> <i>owl:AllDifferent</i> .<br>_:x <i>owl:members</i> ( <i>a:Peter</i> <i>a:Meg</i> <i>a:Chris</i> <i>a:Stewie</i> ) .</td><td>Peter, Meg, Chris, and Stewie are all different from each other.</td></tr></tbody></table>

The last axiom in this example ontology axiomatizes the unique name assumption (but only for the four names in the axiom). If the ontology were extended with the following axiom stating that _a:fatherOf_ is functional, then this axiom would imply that _a:Meg_, _a:Chris_, and _a:Stewie_ are all equal, thus invalidating the unique name assumption and making the ontology inconsistent.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">FunctionalObjectProperty( <i>a:fatherOf</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:fatherOf</i> <i>rdf:type</i> <i>owl:FunctionalProperty</i> .</td></tr></tbody></table>

#### 9.6.3 Class Assertions

A class assertion ClassAssertion( CE a ) states that the individual a is an instance of the class expression CE.

ClassAssertion := 'ClassAssertion' '(' axiomAnnotations ClassExpression Individual ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ClassAssertion( <i>a:Dog</i> <i>a:Brian</i> )</td><td>Brian is a dog.</td></tr><tr valign="top"><td>SubClassOf( <i>a:Dog</i> <i>a:Mammal</i> )</td><td>Each dog is a mammal.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Brian</i> <i>rdf:type</i> <i>a:Dog</i> .</td><td>Brian is a dog.</td></tr><tr valign="top"><td><i>a:Dog</i> <i>rdfs:subClassOf</i> <i>a:Mammal</i> .</td><td>Each dog is a mammal.</td></tr></tbody></table>

The first axiom states that _a:Brian_ is an instance of the class _a:Dog_. By the second axiom, each instance of _a:Dog_ is an instance of _a:Mammal_. Therefore, this ontology entails that _a:Brian_ is an instance of _a:Mammal_ — that is, the ontology entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ClassAssertion( <i>a:Mammal</i> <i>a:Brian</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Brian</i> <i>rdf:type</i> <i>a:Mammal</i> .</td></tr></tbody></table>

#### 9.6.4 Positive Object Property Assertions

A positive object property assertion ObjectPropertyAssertion( OPE a1 a2 ) states that the individual a1 is connected by the object property expression OPE to the individual a2.

ObjectPropertyAssertion := 'ObjectPropertyAssertion' '(' axiomAnnotations ObjectPropertyExpression sourceIndividual targetIndividual ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasDog</i> <i>a:Peter</i> <i>a:Brian</i> )</td><td>Brian is a dog of Peter.</td></tr><tr valign="top"><td>SubClassOf( ObjectSomeValuesFrom( <i>a:hasDog</i> <i>owl:Thing</i> ) <i>a:DogOwner</i> )</td><td>Objects that have a dog are dog owners.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Peter</i> <i>a:hasDog</i> <i>a:Brian</i> .</td><td>Brian is a dog of Peter.</td></tr><tr valign="top"><td>_:x <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:x <i>owl:onProperty</i> <i>a:hasDog</i> .<br>_:x <i>owl:someValuesFrom</i> <i>owl:Thing</i> .<br>_:x <i>rdfs:subClassOf</i> <i>a:DogOwner</i> .</td><td>Objects that have a dog are dog owners.</td></tr></tbody></table>

The first axiom states that _a:Peter_ is connected by _a:hasDog_ to _a:Brian_. By the second axiom, each individual connected by _a:hasDog_ to an individual is an instance of _a:DogOwner_. Therefore, this ontology entails that _a:Peter_ is an instance of _a:DogOwner_ — that is, the ontology entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ClassAssertion( <i>a:DogOwner</i> <i>a:Peter</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Peter</i> <i>rdf:type</i> <i>a:DogOwner</i> .</td></tr></tbody></table>

#### 9.6.5 Negative Object Property Assertions

A negative object property assertion NegativeObjectPropertyAssertion( OPE a1 a2 ) states that the individual a1 is not connected by the object property expression OPE to the individual a2.

NegativeObjectPropertyAssertion := 'NegativeObjectPropertyAssertion' '(' axiomAnnotations ObjectPropertyExpression sourceIndividual targetIndividual ')'

Consider the ontology consisting of the following axiom.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>NegativeObjectPropertyAssertion( <i>a:hasSon</i> <i>a:Peter</i> <i>a:Meg</i> )</td><td>Meg is not a son of Peter.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td>_:x <i>rdf:type</i> <i>owl:NegativePropertyAssertion</i> .<br>_:x <i>owl:sourceIndividual</i> <i>a:Peter</i> .<br>_:x <i>owl:assertionProperty</i> <i>a:hasSon</i> .<br>_:x <i>owl:targetIndividual</i> <i>a:Meg</i> .</td><td>Meg is not a son of Peter.</td></tr></tbody></table>

The ontology would become inconsistent if it were extended with the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectPropertyAssertion( <i>a:hasSon</i> <i>a:Peter</i> <i>a:Meg</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Peter</i> <i>a:hasSon</i> <i>a:Meg</i> .</td></tr></tbody></table>

#### 9.6.6 Positive Data Property Assertions

A positive data property assertion DataPropertyAssertion( DPE a lt ) states that the individual a is connected by the data property expression DPE to the literal lt.

DataPropertyAssertion := 'DataPropertyAssertion' '(' axiomAnnotations DataPropertyExpression sourceIndividual targetValue ')'

Consider the ontology consisting of the following axioms.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>DataPropertyAssertion( <i>a:hasAge</i> <i>a:Meg</i> "17"^^<i>xsd:integer</i> )</td><td>Meg is seventeen years old.</td></tr><tr valign="top"><td>SubClassOf(<br>&nbsp;&nbsp;&nbsp; DataSomeValuesFrom( <i>a:hasAge</i><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; DatatypeRestriction( <i>xsd:integer</i><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <i>xsd:minInclusive</i> "13"^^<i>xsd:integer</i><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <i>xsd:maxInclusive</i> "19"^^<i>xsd:integer</i><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )<br>&nbsp;&nbsp;&nbsp; )<br>&nbsp;&nbsp;&nbsp; <i>a:Teenager</i><br>)</td><td>Objects that are older than 13 and younger than 19 (both inclusive) are teenagers.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Meg</i> <i>a:hasAge</i> "17"^^<i>xsd:integer</i> .</td><td>Meg is seventeen years old.</td></tr><tr valign="top"><td>_:x <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:x <i>owl:onProperty</i> <i>a:hasAge</i> .<br>_:x <i>owl:someValuesFrom</i> _:y .<br>_:y <i>rdf:type</i> <i>rdfs:Datatype</i> .<br>_:y <i>owl:onDatatype</i> <i>xsd:intege</i>r .<br>_:y <i>owl:withRestrictions</i> ( _:z _:w ) .<br>_:z <i>xsd:minInclusive</i> "13"^^<i>xsd:integer</i> .<br>_:w <i>xsd:maxInclusive</i> "19"^^<i>xsd:integer</i> .<br>_:x <i>rdfs:subClassOf</i> <i>a:Teenager</i> .</td><td>Objects that are often than 13 and younger than 19 (both inclusive) are teenagers.</td></tr></tbody></table>

The first axiom states that _a:Meg_ is connected by _a:hasAge_ to the literal "17"^^_xsd:integer_. By the second axiom, each individual connected by _a:hasAge_ to an integer between 13 and 19 is an instance of _a:Teenager_. Therefore, this ontology entails that _a:Meg_ is an instance of _a:Teenager_ — that is, the ontology entails the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ClassAssertion( <i>a:Teenager</i> <i>a:Meg</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Meg</i> <i>rdf:type</i> <i>a:Teenager</i> .</td></tr></tbody></table>

#### 9.6.7 Negative Data Property Assertions

A negative data property assertion NegativeDataPropertyAssertion( DPE a lt ) states that the individual a is not connected by the data property expression DPE to the literal lt.

NegativeDataPropertyAssertion := 'NegativeDataPropertyAssertion' '(' axiomAnnotations DataPropertyExpression sourceIndividual targetValue ')'

Consider the ontology consisting of the following axiom.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>NegativeDataPropertyAssertion( <i>a:hasAge</i> <i>a:Meg</i> "5"^^<i>xsd:integer</i> )</td><td>Meg is not five years old.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td>_:x <i>rdf:type</i> <i>owl:NegativePropertyAssertion</i> .<br>_:x <i>owl:sourceIndividual</i> <i>a:Meg</i> .<br>_:x <i>owl:assertionProperty</i> <i>a:hasAge</i> .<br>_:x <i>owl:targetValue</i> "5"^^<i>xsd:integer</i> .</td><td>Meg is not five years old.</td></tr></tbody></table>

The ontology would become inconsistent if it were extended with the following assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">DataPropertyAssertion( <i>a:hasAge</i> <i>a:Meg</i> "5"^^<i>xsd:integer</i> )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Meg</i> <i>a:hasAge</i> "5"^^<i>xsd:integer</i> .</td></tr></tbody></table>

## 10 Annotations

OWL 2 applications often need ways to associate additional information with ontologies, entities, and axioms. To this end, OWL 2 provides for _annotations_ on ontologies, axioms, and entities.

One might want to associate human-readable labels with IRIs and use them when visualizing an ontology. To this end, one might use the _rdfs:label_ annotation property to associate such labels with ontology IRIs.

Various OWL 2 syntaxes, such as the functional-style syntax, provide a mechanism for embedding comments into ontology documents. The structure of such comments is, however, dependent on the syntax, so these are simply discarded during parsing. In contrast, annotations are "first-class citizens" in the structural specification of OWL 2, and their structure is independent of the underlying syntax.

Since it is based on XML, the OWL 2 XML Syntax \[[OWL 2 XML Serialization](#ref-owl-2-xml-serialization)\] allows the embedding of the standard XML comments into ontology documents. Such comments are not represented in the structural specification of OWL 2 and, consequently, they should be ignored during document parsing.

### 10.1 Annotations of Ontologies, Axioms, and other Annotations

Ontologies, axioms, and annotations themselves can be annotated using annotations shown in Figure 22. As shown in the figure, such annotations consist of an annotation property and an annotation value, where the latter can be anonymous individuals, IRIs, and literals.

![Annotations of Ontologies and Axioms in OWL 2](Annotations.gif)  
Figure 22. Annotations of Ontologies and Axioms in OWL 2

Annotation := 'Annotation' '(' annotationAnnotations AnnotationProperty AnnotationValue ')'  
annotationAnnotations  := { Annotation }  
AnnotationValue := AnonymousIndividual | IRI | Literal

### 10.2 Annotation Axioms

OWL 2 provides means to state several types of axioms about annotation properties, as shown in Figure 23. These statements are treated as axioms only in order to simplify the structural specification of OWL 2.

![Annotations of IRIs and Anonymous Individuals in OWL 2](A_annotation.gif)  
Figure 23. Annotations of IRIs and Anonymous Individuals in OWL 2

AnnotationAxiom := AnnotationAssertion | SubAnnotationPropertyOf | AnnotationPropertyDomain | AnnotationPropertyRange

#### 10.2.1 Annotation Assertion

An annotation assertion AnnotationAssertion( AP as av ) states that the annotation subject as — an IRI or an anonymous individual — is annotated with the annotation property AP and the annotation value av.

AnnotationAssertion := 'AnnotationAssertion' '(' axiomAnnotations AnnotationProperty AnnotationSubject AnnotationValue ')'  
AnnotationSubject := IRI | AnonymousIndividual

The following axiom assigns a human-readable comment to the IRI _a:Person_.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">AnnotationAssertion( <i>rdfs:label</i> <i>a:Person</i> "Represents the set of all people." )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Person</i> <i>rdfs:label</i> "Represents the set of all people." .</td></tr></tbody></table>

Since the annotation is assigned to an IRI, it applies to all entities with the given IRI. Thus, if an ontology contains both a class and an individual _a:Person_, the above comment applies to both entities.

#### 10.2.2 Annotation Subproperties

An annotation subproperty axiom SubAnnotationPropertyOf( AP1 AP2 ) states that the annotation property AP1 is a subproperty of the annotation property AP2.

SubAnnotationPropertyOf := 'SubAnnotationPropertyOf' '(' axiomAnnotations subAnnotationProperty superAnnotationProperty ')'  
subAnnotationProperty := AnnotationProperty  
superAnnotationProperty := AnnotationProperty

#### 10.2.3 Annotation Property Domain

An annotation property domain axiom AnnotationPropertyDomain( AP U ) states that the domain of the annotation property AP is the IRI U.

AnnotationPropertyDomain := 'AnnotationPropertyDomain' '(' axiomAnnotations AnnotationProperty IRI ')'

#### 10.2.4 Annotation Property Range

An annotation property range axiom AnnotationPropertyRange( AP U ) states that the range of the annotation property AP is the IRI U.

AnnotationPropertyRange := 'AnnotationPropertyRange' '(' axiomAnnotations AnnotationProperty IRI ')'

## 11 Global Restrictions on Axioms in OWL 2 DL

The axiom closure _Ax_ (with anonymous individuals standardized apart as explained in [Section 5.6.2](#Anonymous_Individuals)) of each OWL 2 DL ontology _O_ _MUST_ satisfy the _global restrictions_ defined in this section. As explained in the literature \[[SROIQ](#ref-sroiq)\], this restriction is necessary in order to obtain a decidable language. The formal definition of these conditions is rather technical, so it is split into two parts. [Section 11.1](#Property_Hierarchy_and_Simple_Object_Property_Expressions) first introduces the notions of a property hierarchy and of _simple_ object property expressions. These notions are then used in [Section 11.2](#The_Restrictions_on_the_Axiom_Closure) to define the actual conditions on _Ax_.

### 11.1 Property Hierarchy and Simple Object Property Expressions

For an object property expression OPE, the _inverse property expression_ INV(OPE) is defined as follows:

-   If OPE is an object property OP, then INV(OPE) = ObjectInverseOf( OP ).
-   if OPE is of the form ObjectInverseOf( OP ) for OP an object property, then INV(OPE) = OP.

The set _AllOPE(Ax)_ of all object property expressions w.r.t. _Ax_ is the smallest set containing OP and INV(OP) for each object property OP occurring in _Ax_.

An object property expression OPE is _composite_ in the set of axioms _Ax_ if

-   OPE is equal to _owl:topObjectProperty_ or _owl:bottomObjectProperty_, or
-   _Ax_ contains an axiom of the form
    -   SubObjectPropertyOf( ObjectPropertyChain( OPE1 ... OPEn ) OPE ) with n > 1, or
    -   SubObjectPropertyOf( ObjectPropertyChain( OPE1 ... OPEn ) INV(OPE) ) with n > 1, or
    -   TransitiveObjectProperty( OPE ), or
    -   TransitiveObjectProperty( INV(OPE) ).

The relation → is the smallest relation on _AllOPE(Ax)_ for which the following conditions hold (A → B means that → holds for A and B):

-   if _Ax_ contains an axiom SubObjectPropertyOf( OPE1 OPE2 ), then OPE1 → OPE2 holds; and
-   if _Ax_ contains an axiom EquivalentObjectProperties( OPE1 OPE2 ), then OPE1 → OPE2 and OPE2 → OPE1 hold; and
-   if _Ax_ contains an axiom InverseObjectProperties( OPE1 OPE2 ), then OPE1 → INV(OPE2) and INV(OPE2) → OPE1 hold; and
-   if _Ax_ contains an axiom SymmetricObjectProperty(OPE), then OPE → INV(OPE) holds; and
-   if OPE1 → OPE2 holds, then INV(OPE1) → INV(OPE2) holds as well.

The _property hierarchy_ relation →\* is the reflexive-transitive closure of →.

An object property expression OPE is _simple_ in _Ax_ if, for each object property expression OPE' such that OPE' →\* OPE holds, OPE' is not composite.

Roughly speaking, a simple object property expression has no direct or indirect subproperties that are either transitive or are defined by means of property chains, where the notion of indirect subproperties is captured by the property hierarchy. Consider the following axioms:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>SubObjectPropertyOf( ObjectPropertyChain( <i>a:hasFather</i> <i>a:hasBrother</i> ) <i>a:hasUncle</i> )</td><td>The brother of someone's father is that person's uncle.</td></tr><tr valign="top"><td>SubObjectPropertyOf( <i>a:hasUncle</i> <i>a:hasRelative</i> )</td><td>Having an uncle implies having a relative.</td></tr><tr valign="top"><td>SubObjectPropertyOf( <i>a:hasBiologicalFather</i> <i>a:hasFather</i> )</td><td>Having a biological father implies having a father.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasUncle</i> <i>owl:propertyChainAxiom</i> ( <i>a:hasFather</i> <i>a:hasBrother</i> ) .</td><td>The brother of someone's father is that person's uncle.</td></tr><tr valign="top"><td><i>a:hasUncle</i> <i>rdfs:subPropertyOf</i> <i>a:hasRelative</i> .</td><td>Having an uncle implies having a relative.</td></tr><tr valign="top"><td><i>a:hasBiologicalFather</i> <i>rdfs:subPropertyOf</i> <i>a:hasFather</i> .</td><td>Having a biological father implies having a father.</td></tr></tbody></table>

The object property _a:hasUncle_ occurs in an object subproperty axiom involving a property chain, so it is not simple. Consequently, the object property _a:hasRelative_ is not simple either, because _a:hasUncle_ is a subproperty of _a:hasRelative_ and _a:hasUncle_ is not simple. In contrast, the object property _a:hasBiologicalFather_ is simple, and so is _a:hasFather_.

### 11.2 The Restrictions on the Axiom Closure

The set of axioms _Ax_ satisfies the _global restrictions_ of OWL 2 DL if all of the following conditions hold.

**Restriction on _owl:topDataProperty_.** The _owl:topDataProperty_ property occurs in _Ax_ only in the superDataPropertyExpression part of SubDataPropertyOf axioms.

Without this restriction, _owl:topDataProperty_ could be used to write axioms about datatypes, which would invalidate Theorem DS1 from the OWL 2 Direct Semantics \[[OWL 2 Direct Semantics](#ref-owl-2-direct-semantics)\]. That is, the consequences of an ontology would then not necessarily depend only on the datatypes used in the ontology, but would also depend on the datatypes selected in the OWL 2 datatype map. Thus, if an implementation or a future revision of OWL decided to extend the set of supported datatypes, it would run the risk of possibly changing the consequences of certain ontologies.

**Restrictions on Datatypes.**

-   Each datatype occurring in _Ax_ satisfies exactly one of the following conditions: it is _rdfs:Literal_, or it is contained in the OWL 2 datatype map, or it is defined by a single datatype definition axiom in _Ax_.
-   A strict partial order (i.e., an irreflexive and transitive relation) < on the set of all datatypes in _Ax_ exists such that, for each axiom of the form DatatypeDefinition( DT DR ) and each datatype DT1 occurring in DR, we have DT1 < DT.

The first condition ensures that all datatypes in _Ax_ are given a well-defined interpretation and that datatype definitions do not redefine the datatypes from the OWL 2 datatype map. The second condition ensures that datatype definitions are acyclic — that is, if a datatype DT1 is used in a definition of DT, then DT is not allowed to be used in the definition of DT1 — and it is illustrated by the following example:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>Declaration( Datatype( <i>a:SSN</i> ) )</td><td><i>a:SSN</i> is a datatype.</td></tr><tr valign="top"><td>Declaration( Datatype( <i>a:TIN</i> ) )</td><td><i>a:TIN</i> is a datatype.</td></tr><tr valign="top"><td>Declaration( Datatype( <i>a:TaxNumber</i> ) )</td><td><i>a:TaxNumber</i> is a datatype.</td></tr><tr valign="top"><td>DatatypeDefinition(<br>&nbsp;&nbsp;&nbsp; <i>a:SSN</i><br>&nbsp;&nbsp;&nbsp; DatatypeRestriction( <i>xsd:string</i> <i>xsd:pattern</i> "[0-9]{3}-[0-9]{2}-[0-9]{4}" )<br>)</td><td>A social security number is a string that matches the given regular expression.</td></tr><tr valign="top"><td>DatatypeDefinition(<br>&nbsp;&nbsp;&nbsp; <i>a:TIN</i><br>&nbsp;&nbsp;&nbsp; DatatypeRestriction( <i>xsd:string</i> <i>xsd:pattern</i> "[0-9]{11}" )<br>)</td><td>A TIN — a tax identification number used in Germany — is a string consisting of 11 digits.</td></tr><tr valign="top"><td>DatatypeDefinition( <i>a:TaxNumber</i> DataUnionOf( <i>a:SSN</i> <i>a:TIN</i> ) )</td><td>A tax number is either a social security number of a TIN.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:SSN</i> <i>rdf:type</i> <i>rdfs:Datatype</i> .</td><td><i>a:SSN</i> is a datatype.</td></tr><tr valign="top"><td><i>a:TIN</i> <i>rdf:type</i> <i>rdfs:Datatype</i> .</td><td><i>a:TIN</i> is a datatype.</td></tr><tr valign="top"><td><i>a:TaxNumber</i> <i>rdf:type</i> <i>rdfs:Datatype</i> .</td><td><i>a:TaxNumber</i> is a datatype.</td></tr><tr valign="top"><td><i>a:SSN</i> <i>owl:equivalentClass</i> _:x1 .<br>_:x1 <i>rdf:type</i> <i>rdfs:Datatype</i> .<br>_:x1 <i>owl:onDatatype</i> <i>xsd:string</i> .<br><i>_:x1 owl:withRestrictions</i> ( _:x2 ) .<br>_:x2 <i>xsd:pattern</i> "[0-9]{3}-[0-9]{2}-[0-9]{4}" .</td><td>A social security number is a string that matches the given regular expression.</td></tr><tr valign="top"><td><i>a:TIN</i> <i>owl:equivalentClass</i> _:y1 .<br>_:y1 <i>rdf:type</i> <i>rdfs:Datatype</i> .<br>_:y1 <i>owl:onDatatype</i> <i>xsd:string</i> .<br><i>_:y1 owl:withRestrictions</i> ( _:y2 ) .<br>_:y2 <i>xsd:pattern</i> "[0-9]{11}" .</td><td>A TIN — a tax identification number used in Germany — is a string consisting of 11 digits.</td></tr><tr valign="top"><td><i>a:TaxNumber</i> <i>owl:equivalentClass</i> _:z .<br>_:z <i>rdf:type</i> <i>rdfs:Datatype</i> .<br>_:z <i>owl:unionOf</i> ( <i>a:SSN</i> <i>a:TIN</i> ) .</td><td>A tax number is either a social security number of a TIN.</td></tr></tbody></table>

These datatype definitions are acyclic: _a:SSN_ and _a:TIN_ are defined in terms of _xsd:string_, and _a:TaxNumber_ is defined in terms of _a:SSN_ and _a:TIN_. To verify this condition formally, it suffices to find one strict partial order < on these datatypes such that each datatype is defined only in terms of the datatypes that are smaller w.r.t. <. For example, it can be readily verified that the partial order < given below fulfills the above conditions.

_xsd:string_   <   _a:SSN_   <   _a:TaxNumber_  
_xsd:string_   <   _a:TIN_   <   _a:TaxNumber_

Note that order < is allowed to be partial — that is, some datatypes can be incomparable under <. In the above example, datatypes _a:SSN_ and _a:TIN_ are incomparable under <. Since neither of these two datatypes is defined in terms of the other datatype, the order between the two datatypes is irrelevant.

The restriction on datatypes is necessary to ensure validity of Theorem DS1 from the OWL 2 Direct Semantics \[[OWL 2 Direct Semantics](#ref-owl-2-direct-semantics)\]. Furthermore, the restriction is natural given that data ranges describe the set of values exactly. For example, if an axiom defining _a:SSN_ in terms of _a:TIN_ and _a:TaxNumber_ were added to the above axioms, then datatypes _a:SSN_, _a:TIN_, and _a:TaxNumber_ could not be simply "unfolded", which is contrary to the intended meaning of these datatypes. This situation, however, is disallowed since no ordering < satisfying the mentioned restrictions exists for the extended axiom set.

**Restriction on Simple Roles.** Each class expression and each axiom in _Ax_ of type from the following two lists contains only simple object properties.

-   ObjectMinCardinality, ObjectMaxCardinality, ObjectExactCardinality, and ObjectHasSelf .
-   FunctionalObjectProperty, InverseFunctionalObjectProperty, IrreflexiveObjectProperty, AsymmetricObjectProperty, and DisjointObjectProperties.

This restriction is necessary in order to guarantee decidability of the basic reasoning problems for OWL 2 DL \[[Description Logics](#ref-description-logics)\].

**Restriction on the Property Hierarchy.** A strict partial order (i.e., an irreflexive and transitive relation) < on _AllOPE(Ax)_ exists that fulfills the following conditions:

-   OP1 < OP2 if and only if INV(OP1) < OP2 for all object properties OP1 and OP2 occurring in _AllOPE(Ax)_.
-   If OPE1 < OPE2 holds, then OPE2 →\* OPE1 does not hold;
-   Each axiom in _Ax_ of the form SubObjectPropertyOf( ObjectPropertyChain( OPE1 ... OPEn ) OPE ) with n ≥ 2 fulfills the following conditions:
    -   OPE is equal to _owl:topObjectProperty_, or
    -   n = 2 and OPE1 = OPE2 = OPE, or
    -   OPEi < OPE for each 1 ≤ i ≤ n, or
    -   OPE1 = OPE and OPEi < OPE for each 2 ≤ i ≤ n, or
    -   OPEn = OPE and OPEi < OPE for each 1 ≤ i ≤ n-1.

This restriction is necessary in order to guarantee decidability of the basic reasoning problems for OWL 2 DL \[[Description Logics](#ref-description-logics)\].

The main goal of this restriction is to prevent cyclic definitions involving object subproperty axioms with property chains. Consider the following ontology:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>SubObjectPropertyOf( ObjectPropertyChain( <i>a:hasFather</i> <i>a:hasBrother</i> ) <i>a:hasUncle</i> )</td><td>The brother of someone's father is that person's uncle.</td></tr><tr valign="top"><td>SubObjectPropertyOf( ObjectPropertyChain( <i>a:hasUncle</i> <i>a:hasWife</i> ) <i>a:hasAuntInLaw</i> )</td><td>The wife of someone's uncle is that person's aunt-in-law.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasUncle</i> <i>owl:propertyChainAxiom</i> ( <i>a:hasFather</i> <i>a:hasBrother</i> ) .</td><td>The brother of someone's father is that person's uncle.</td></tr><tr valign="top"><td><i>a:hasAuntInLaw</i> <i>owl:propertyChainAxiom</i> ( <i>a:hasUncle</i> <i>a:hasWife</i> ) .</td><td>The wife of someone's uncle is that person's aunt-in-law.</td></tr></tbody></table>

The first axiom defines _a:hasUncle_ in terms of _a:hasFather_ and _a:hasBrother_, and the second axiom defines _a:hasAuntInLaw_ in terms of _a:hasUncle_ and _a:hasWife_. The second axiom depends on the first one, but not vice versa; hence, these axioms are not cyclic and can occur together in the axiom closure of an OWL 2 DL ontology. To verify this condition formally, it suffices to find one strict partial order < on object properties such that each property is defined only in terms of the properties that are smaller w.r.t. <. For example, it can be readily verified that the partial order < given below fulfills the above conditions.

_a:hasFather_   <   _a:hasUncle_  
_a:hasBrother_   <   _a:hasUncle_  
_a:hasUncle_   <   _a:hasAuntInLaw_  
_a:hasWife_   <   _a:hasAuntInLaw_

The first two conditions on < are needed to satisfy the first axiom, while the remaining two conditions on < are needed to satisfy the second axiom from the example OWL 2 DL ontology.

In contrast to the previous example, the following axioms are cyclic and do not satisfy the restriction on the property hierarchy.

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>SubObjectPropertyOf( ObjectPropertyChain( <i>a:hasFather</i> <i>a:hasBrother</i> ) <i>a:hasUncle</i> )</td><td>The brother of someone's father is that person's uncle.</td></tr><tr valign="top"><td>SubObjectPropertyOf( ObjectPropertyChain( <i>a:hasChild</i> <i>a:hasUncle</i> ) <i>a:hasBrother</i> )</td><td>The uncle of someone's child is that person's brother.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasUncle</i> <i>owl:propertyChainAxiom</i> ( <i>a:hasFather</i> <i>a:hasBrother</i> ) .</td><td>The brother of someone's father is that person's uncle.</td></tr><tr valign="top"><td><i>a:hasBrother</i> <i>owl:propertyChainAxiom</i> ( <i>a:hasChild</i> <i>a:hasUncle</i> ) .</td><td>The uncle of someone's child is that person's brother.</td></tr></tbody></table>

The first axiom defines _a:hasUncle_ in terms of _a:hasBrother_, while the second axiom defines _a:hasBrother_ in terms of _a:hasUncle_; these two definitions are thus cyclic and cannot occur together in the axiom closure of an OWL 2 DL ontology. To verify this condition formally, note that, for < to satisfy the third subcondition of the third condition, we need _a:hasBrother_ < _a:hasUncle_ (due to the first axiom) and _a:hasUncle_ < _a:hasBrother_ (due to the second axiom); by transitivity of < we then have _a:hasUncle_ < _a:hasUncle_ and _a:hasBrother_ < _a:hasBrother_; however, this contradicts the requirement that < is irreflexive. Thus, an order < satisfying all the required conditions does not exist.

A particular kind of cyclic definitions is known not to lead to decidability problems. Consider the following ontology:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>SubObjectPropertyOf( ObjectPropertyChain( <i>a:hasChild</i> <i>a:hasSibling</i> ) <i>a:hasChild</i> )</td><td>The sibling of someone's child is that person's child.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:hasChild</i> <i>owl:propertyChainAxiom</i> ( <i>a:hasChild</i> <i>a:hasSibling</i> ) .</td><td>The sibling of someone's child is that person's child.</td></tr></tbody></table>

The above definition is cyclic, since the object property _a:hasChild_ occurs in both the subproperty chain and as a superproperty. As per the fourth and the fifth subcondition of the third condition, however, axioms of this form do not violate the restriction on the property hierarchy.

**Restrictions on the Usage of Anonymous Individuals.**

-   No anonymous individual occurs in _Ax_ in an axiom of type from the following list:
    -   SameIndividual, DifferentIndividuals, NegativeObjectPropertyAssertion, or NegativeDataPropertyAssertion.
-   No anonymous individual occurs in _Ax_ in a class expression of type from the following list:
    -   ObjectOneOf or ObjectHasValue.
-   The _anonymous individual graph_ for _Ax_ is the undirected graph _F_ whose vertices are anonymous individuals occurring in _Ax_, and that contains an (undirected) edge between each pair of anonymous individuals \_:x and \_:y for each assertion in _Ax_ of the form ObjectPropertyAssertion( OPE \_:x \_:y ). Such _F_ is required to satisfy all of the following conditions:
    -   _F_ is a forest — that is, it should be possible to partition _F_ into zero or more disjoint undirected trees;
    -   for each pair of anonymous individuals \_:x and \_:y connected by an edge in _F_, the set _Ax_ contains at most one assertion of the form ObjectPropertyAssertion( OPE \_:x \_:y ) or ObjectPropertyAssertion( OPE \_:y \_:x ); and
    -   each tree in _F_ contains at least one anonymous individual \_:x such that the set _Ax_ contains at most one assertion of the form ObjectPropertyAssertion( OPE \_:x a ) or ObjectPropertyAssertion( OPE a \_:x ) with a a named individual.

These restrictions ensure that each OWL 2 DL ontology with anonymous individuals can be transformed to an equivalent ontology without anonymous individuals. Roughly speaking, this is possible if property assertions connect anonymous individuals in a tree-like way. Consider the following ontology:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasChild</i> <i>a:Francis</i> _:a1 )</td><td>Francis has some (unknown) child.</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasChild</i> _:a1 <i>a:Meg</i> )</td><td>This unknown child has Meg...</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasChild</i> _:a1 <i>a:Chris</i> )</td><td>...Chris...</td></tr><tr valign="top"><td>ObjectPropertyAssertion( <i>a:hasChild</i> _:a1 <i>a:Stewie</i> )</td><td>...and Stewie as children.</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td><i>a:Francis</i> <i>a:hasChild</i> _:a1 .</td><td>Francis has some (unknown) child.</td></tr><tr valign="top"><td>_:a1 <i>a:hasChild</i> <i>a:Meg</i> .</td><td>This unknown child has Meg...</td></tr><tr valign="top"><td>_:a1 <i>a:hasChild</i> <i>a:Chris</i> .</td><td>...Chris...</td></tr><tr valign="top"><td>_:a1 <i>a:hasChild</i> <i>a:Stewie</i> .</td><td>...and Stewie as children.</td></tr></tbody></table>

The connections between individuals _a:Francis_, _a:Meg_, _a:Chris_, and _a:Stewie_ can be understood as a tree that contains \_:a1 as its root. Because of that, the anonymous individuals can be "rolled up"; that is, these four assertions can be replaced by the following equivalent assertion:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ClassAssertion(<br>&nbsp;&nbsp;&nbsp; ObjectSomeValuesFrom( <i>a:hasChild</i><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ObjectIntersectionOf(<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ObjectHasValue( <i>a:hasChild</i> <i>a:Meg</i> )<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ObjectHasValue( <i>a:hasChild</i> <i>a:Chris</i> )<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ObjectHasValue( <i>a:hasChild</i> <i>a:Stewie</i> )<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )<br>&nbsp;&nbsp;&nbsp; )<br>&nbsp;&nbsp;&nbsp; <i>a:Francis</i><br>)</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2"><i>a:Francis</i> <i>rdf:type</i> _:x .<br>_:x <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:x <i>owl:onProperty</i> <i>a:hasChild</i> .<br>_:x <i>owl:someValuesFrom</i> _:y .<br>_:y <i>rdf:type</i> <i>owl:Class</i> .<br>_:y <i>owl:intersectionOf</i> ( _:z1 _:z2 _:z3 ) .<br>_:z1 <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:z1 <i>owl:onProperty</i> <i>a:hasChild</i> .<br>_:z1 <i>owl:hasValue</i> <i>a:Meg</i> .<br>_:z2 <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:z2 <i>owl:onProperty</i> <i>a:hasChild</i> .<br>_:z2 <i>owl:hasValue</i> <i>a:Chris</i> .<br>_:z3 <i>rdf:type</i> <i>owl:Restriction</i> .<br>_:z3 <i>owl:onProperty</i> <i>a:hasChild</i> .<br>_:z3 <i>owl:hasValue</i> <i>a:Stewie</i> .</td></tr></tbody></table>

Unlike in the previous example, the following ontology does not satisfy the restrictions on the usage of anonymous individuals:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectPropertyAssertion( <i>a:hasSibling</i> _:b1 _:b2 )</td></tr><tr valign="top"><td colspan="2">ObjectPropertyAssertion( <i>a:hasSibling</i> _:b2 _:b3 )</td></tr><tr valign="top"><td colspan="2">ObjectPropertyAssertion( <i>a:hasSibling</i> _:b3 _:b1 )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:b1 <i>a:hasSibling</i> _:b2 .</td></tr><tr valign="top"><td colspan="2">_:b2 <i>a:hasSibling</i> _:b3 .</td></tr><tr valign="top"><td colspan="2">_:b3 <i>a:hasSibling</i> _:b1 .</td></tr></tbody></table>

The following ontology does not satisfy these restrictions either:

<table class="fss"><caption class="fss" style="display: none">Functional-Style Syntax:</caption><tbody><tr valign="top"><td colspan="2">ObjectPropertyAssertion( <i>a:hasChild</i> _:b1 _:b2 )</td></tr><tr valign="top"><td colspan="2">ObjectPropertyAssertion( <i>a:hasDaughter</i> _:b1 _:b2 )</td></tr></tbody></table>

<table class="rdf" style="display: none"><caption class="rdf">RDF:</caption><tbody><tr valign="top"><td colspan="2">_:b1 <i>a:hasChild</i> _:b2 .</td></tr><tr valign="top"><td colspan="2">_:b1 <i>a:hasDaughter</i> _:b2 .</td></tr></tbody></table>

In both of these examples, the anonymous individuals are connected by property assertions in a non-tree-like way. These assertions can therefore not be replaced with class expressions, which can lead to the undecidability of the basic reasoning problems.

## 12 Appendix: Internet Media Type, File Extension, and Macintosh File Type

Contact

Ivan Herman / Sandro Hawke

See also

How to Register a Media Type for a W3C Specification \[[Register MIME](#ref-register-mime)\] and Internet Media Type registration, consistency of use \[[MIME Consistency](#ref-mime-consistency)\].

The Internet Media Type / MIME Type for the OWL functional-style Syntax is text/owl-functional.

It is recommended that OWL functional-style Syntax files have the extension .ofn (all lowercase) on all platforms.

It is recommended that OWL functional-style Syntax files stored on Macintosh HFS file systems be given a file type of TEXT.

The information that follows will be submitted to the IESG for review, approval, and registration with IANA.

Type name

text

Subtype name

owl-functional

Required parameters

None

Optional parameters

charset This parameter may be required when transfering non-ASCII data across some protocols. If present, the value of charset should be UTF-8.

Encoding considerations

The syntax of the OWL functional-style Syntax is expressed over code points in Unicode \[[UNICODE](#ref-unicode)\]. The encoding should be UTF-8 \[[RFC 3629](#ref-rfc-3629)\], but other encodings are allowed.

Security considerations

The OWL functional-style Syntax uses IRIs as term identifiers. Applications interpreting data expressed in the OWL functional-style Syntax should address the security issues of Internationalized Resource Identifiers (IRIs) \[[RFC3987](#ref-rfc-3987)\] Section 8, as well as Uniform Resource Identifiers (URI): Generic Syntax \[[RFC 3986](#ref-rfc-3986)\] Section 7. Multiple IRIs may have the same appearance. Characters in different scripts may look similar (a Cyrillic "o" may appear similar to a Latin "o"). A character followed by combining characters may have the same visual representation as another character (LATIN SMALL LETTER E followed by COMBINING ACUTE ACCENT has the same visual representation as LATIN SMALL LETTER E WITH ACUTE). Any person or application that is writing or interpreting data in the OWL functional-style Syntax must take care to use the IRI that matches the intended semantics, and avoid IRIs that may look similar. Further information about matching of similar characters can be found in Unicode Security Considerations \[[UNISEC](#ref-unisec)\] and Internationalized Resource Identifiers (IRIs) \[[RFC3987](#ref-rfc-3987)\] Section 8.

Interoperability considerations

There are no known interoperability issues.

Published specification

This specification.

Applications which use this media type

No widely deployed applications are known to currently use this media type. It is expected that OWL tools will use this media type in the future.

Additional information

None.

Magic number(s)

OWL functional-style Syntax documents may have the strings "Prefix" or "Ontology" (case dependent) near the beginning of the document.

File extension(s)

".ofn"

Base IRI

There are no constructs in the OWL functional-style Syntax to change the Base IRI.

Macintosh file type code(s)

"TEXT"

Person & email address to contact for further information

Ivan Herman, ivan@w3.org / Sandro Hawke, sandro@w3.org. Please send technical comments and questions about OWL to public-owl-comments@w3.org, a mailing list with a public archive at [http://lists.w3.org/Archives/Public/public-owl-comments/](http://lists.w3.org/Archives/Public/public-owl-comments/ "http://lists.w3.org/Archives/Public/public-owl-comments/")

Intended usage

COMMON

Restrictions on usage

None

Author/Change controller

The OWL functional-style Syntax is the product of the W3C OWL Working Group; W3C reserves change control over this specification.

## 13 Appendix: Complete Grammar (Normative)

This section contains the complete grammar of the functional-style syntax defined in this specification document. For easier reference, the grammar has been split into two parts.

### 13.1 General Definitions

nonNegativeInteger := _a nonempty finite sequence of digits between 0 and 9_  
quotedString := _a finite sequence of characters in which " (U+22) and \\ (U+5C) occur only in pairs of the form \\" (U+5C, U+22) and \\\\ (U+5C, U+5C), enclosed in a pair of " (U+22) characters_  
languageTag := _@ (U+40) followed a nonempty sequence of characters matching the langtag production from \[[BCP 47](#ref-bcp-47)\]_  
nodeID := _a finite sequence of characters matching the BLANK\_NODE\_LABEL production of \[[SPARQL](#ref-sparql)\]_  
  
  
  
fullIRI := _an IRI as defined in \[[RFC3987](#ref-rfc-3987)\], enclosed in a pair of < (U+3C) and > (U+3E) characters_  
prefixName := _a finite sequence of characters matching the as PNAME\_NS production of \[[SPARQL](#ref-sparql)\]_  
abbreviatedIRI := _a finite sequence of characters matching the PNAME\_LN production of \[[SPARQL](#ref-sparql)\]  
_IRI := fullIRI | abbreviatedIRI  
  
  
  
ontologyDocument := { prefixDeclaration } Ontology  
prefixDeclaration := 'Prefix' '(' prefixName '=' fullIRI ')'  
Ontology :=  
    'Ontology' '(' \[ ontologyIRI \[ versionIRI \] \]  
       directlyImportsDocuments  
       ontologyAnnotations  
       axioms  
    ')'  
ontologyIRI := IRI  
versionIRI := IRI  
directlyImportsDocuments := { 'Import' '(' IRI ')' }  
ontologyAnnotations := { Annotation }  
axioms := { Axiom }  
  
  
  
Declaration := 'Declaration' '(' axiomAnnotations Entity ')'  
Entity :=  
    'Class' '(' Class ')' |  
    'Datatype' '(' Datatype ')' |  
    'ObjectProperty' '(' ObjectProperty ')' |  
    'DataProperty' '(' DataProperty ')' |  
    'AnnotationProperty' '(' AnnotationProperty ')' |  
    'NamedIndividual' '(' NamedIndividual ')'  
  
  
  
AnnotationSubject := IRI | AnonymousIndividual  
AnnotationValue := AnonymousIndividual | IRI | Literal  
axiomAnnotations := { Annotation }  
  
Annotation := 'Annotation' '(' annotationAnnotations AnnotationProperty AnnotationValue ')'  
annotationAnnotations  := { Annotation }  
  
AnnotationAxiom := AnnotationAssertion | SubAnnotationPropertyOf | AnnotationPropertyDomain | AnnotationPropertyRange  
  
AnnotationAssertion := 'AnnotationAssertion' '(' axiomAnnotations AnnotationProperty AnnotationSubject AnnotationValue ')'  
  
SubAnnotationPropertyOf := 'SubAnnotationPropertyOf' '(' axiomAnnotations subAnnotationProperty superAnnotationProperty ')'  
subAnnotationProperty := AnnotationProperty  
superAnnotationProperty := AnnotationProperty  
  
AnnotationPropertyDomain := 'AnnotationPropertyDomain' '(' axiomAnnotations AnnotationProperty IRI ')'  
  
AnnotationPropertyRange := 'AnnotationPropertyRange' '(' axiomAnnotations AnnotationProperty IRI ')'

### 13.2 Definitions of OWL 2 Constructs

Class := IRI  
  
Datatype := IRI  
  
ObjectProperty := IRI  
  
DataProperty := IRI  
  
AnnotationProperty := IRI  
  
Individual := NamedIndividual | AnonymousIndividual  
  
NamedIndividual := IRI  
  
AnonymousIndividual := nodeID  
  
Literal := typedLiteral | stringLiteralNoLanguage | stringLiteralWithLanguage  
typedLiteral := lexicalForm '^^' Datatype  
lexicalForm := quotedString  
stringLiteralNoLanguage := quotedString  
stringLiteralWithLanguage := quotedString languageTag  
  
  
  
ObjectPropertyExpression := ObjectProperty | InverseObjectProperty  
  
InverseObjectProperty := 'ObjectInverseOf' '(' ObjectProperty ')'  
  
DataPropertyExpression := DataProperty  
  
  
  
DataRange :=  
    Datatype |  
    DataIntersectionOf |  
    DataUnionOf |  
    DataComplementOf |  
    DataOneOf |  
    DatatypeRestriction  
  
DataIntersectionOf := 'DataIntersectionOf' '(' DataRange DataRange { DataRange } ')'  
  
DataUnionOf := 'DataUnionOf' '(' DataRange DataRange { DataRange } ')'  
  
DataComplementOf := 'DataComplementOf' '(' DataRange ')'  
  
DataOneOf := 'DataOneOf' '(' Literal { Literal } ')'  
  
DatatypeRestriction := 'DatatypeRestriction' '(' Datatype constrainingFacet restrictionValue { constrainingFacet restrictionValue } ')'  
constrainingFacet := IRI  
restrictionValue := Literal  
  
  
  
ClassExpression :=  
    Class |  
    ObjectIntersectionOf | ObjectUnionOf | ObjectComplementOf | ObjectOneOf |  
    ObjectSomeValuesFrom | ObjectAllValuesFrom | ObjectHasValue | ObjectHasSelf |  
    ObjectMinCardinality | ObjectMaxCardinality | ObjectExactCardinality |  
    DataSomeValuesFrom | DataAllValuesFrom | DataHasValue |  
    DataMinCardinality | DataMaxCardinality | DataExactCardinality  
  
ObjectIntersectionOf := 'ObjectIntersectionOf' '(' ClassExpression ClassExpression { ClassExpression } ')'  
  
ObjectUnionOf := 'ObjectUnionOf' '(' ClassExpression ClassExpression { ClassExpression } ')'  
  
ObjectComplementOf := 'ObjectComplementOf' '(' ClassExpression ')'  
  
ObjectOneOf := 'ObjectOneOf' '(' Individual { Individual }')'  
  
ObjectSomeValuesFrom := 'ObjectSomeValuesFrom' '(' ObjectPropertyExpression ClassExpression ')'  
  
ObjectAllValuesFrom := 'ObjectAllValuesFrom' '(' ObjectPropertyExpression ClassExpression ')'  
  
ObjectHasValue := 'ObjectHasValue' '(' ObjectPropertyExpression Individual ')'  
  
ObjectHasSelf := 'ObjectHasSelf' '(' ObjectPropertyExpression ')'  
  
ObjectMinCardinality := 'ObjectMinCardinality' '(' nonNegativeInteger ObjectPropertyExpression \[ ClassExpression \] ')'  
  
ObjectMaxCardinality := 'ObjectMaxCardinality' '(' nonNegativeInteger ObjectPropertyExpression \[ ClassExpression \] ')'  
  
ObjectExactCardinality := 'ObjectExactCardinality' '(' nonNegativeInteger ObjectPropertyExpression \[ ClassExpression \] ')'  
  
DataSomeValuesFrom := 'DataSomeValuesFrom' '(' DataPropertyExpression { DataPropertyExpression } DataRange ')'  
  
DataAllValuesFrom := 'DataAllValuesFrom' '(' DataPropertyExpression { DataPropertyExpression } DataRange ')'  
  
DataHasValue := 'DataHasValue' '(' DataPropertyExpression Literal ')'  
  
DataMinCardinality := 'DataMinCardinality' '(' nonNegativeInteger DataPropertyExpression \[ DataRange \] ')'  
  
DataMaxCardinality := 'DataMaxCardinality' '(' nonNegativeInteger DataPropertyExpression \[ DataRange \] ')'  
  
DataExactCardinality := 'DataExactCardinality' '(' nonNegativeInteger DataPropertyExpression \[ DataRange \] ')'  
  
  
  
Axiom := Declaration | ClassAxiom | ObjectPropertyAxiom | DataPropertyAxiom | DatatypeDefinition | HasKey | Assertion | AnnotationAxiom  
  
  
  
ClassAxiom := SubClassOf | EquivalentClasses | DisjointClasses | DisjointUnion  
  
SubClassOf := 'SubClassOf' '(' axiomAnnotations subClassExpression superClassExpression ')'  
subClassExpression := ClassExpression  
superClassExpression := ClassExpression  
  
EquivalentClasses := 'EquivalentClasses' '(' axiomAnnotations ClassExpression ClassExpression { ClassExpression } ')'  
  
DisjointClasses := 'DisjointClasses' '(' axiomAnnotations ClassExpression ClassExpression { ClassExpression } ')'  
  
DisjointUnion := 'DisjointUnion' '(' axiomAnnotations Class disjointClassExpressions ')'  
disjointClassExpressions := ClassExpression ClassExpression { ClassExpression }  
  
  
  
ObjectPropertyAxiom :=  
    SubObjectPropertyOf | EquivalentObjectProperties |  
    DisjointObjectProperties | InverseObjectProperties |  
    ObjectPropertyDomain | ObjectPropertyRange |  
    FunctionalObjectProperty | InverseFunctionalObjectProperty |  
    ReflexiveObjectProperty | IrreflexiveObjectProperty |  
    SymmetricObjectProperty | AsymmetricObjectProperty |  
    TransitiveObjectProperty  
  
SubObjectPropertyOf := 'SubObjectPropertyOf' '(' axiomAnnotations subObjectPropertyExpression superObjectPropertyExpression ')'  
subObjectPropertyExpression := ObjectPropertyExpression | propertyExpressionChain  
propertyExpressionChain := 'ObjectPropertyChain' '(' ObjectPropertyExpression ObjectPropertyExpression { ObjectPropertyExpression } ')'  
superObjectPropertyExpression := ObjectPropertyExpression  
  
EquivalentObjectProperties := 'EquivalentObjectProperties' '(' axiomAnnotations ObjectPropertyExpression ObjectPropertyExpression { ObjectPropertyExpression } ')'  
  
DisjointObjectProperties := 'DisjointObjectProperties' '(' axiomAnnotations ObjectPropertyExpression ObjectPropertyExpression { ObjectPropertyExpression } ')'  
  
ObjectPropertyDomain := 'ObjectPropertyDomain' '(' axiomAnnotations ObjectPropertyExpression ClassExpression ')'  
  
ObjectPropertyRange := 'ObjectPropertyRange' '(' axiomAnnotations ObjectPropertyExpression ClassExpression ')'  
  
InverseObjectProperties := 'InverseObjectProperties' '(' axiomAnnotations ObjectPropertyExpression ObjectPropertyExpression ')'  
  
FunctionalObjectProperty := 'FunctionalObjectProperty' '(' axiomAnnotations ObjectPropertyExpression ')'  
  
InverseFunctionalObjectProperty := 'InverseFunctionalObjectProperty' '(' axiomAnnotations ObjectPropertyExpression ')'  
  
ReflexiveObjectProperty := 'ReflexiveObjectProperty' '(' axiomAnnotations ObjectPropertyExpression ')'  
  
IrreflexiveObjectProperty := 'IrreflexiveObjectProperty' '(' axiomAnnotations ObjectPropertyExpression ')'  
  
SymmetricObjectProperty := 'SymmetricObjectProperty' '(' axiomAnnotations ObjectPropertyExpression ')'  
  
AsymmetricObjectProperty := 'AsymmetricObjectProperty' '(' axiomAnnotations ObjectPropertyExpression ')'  
  
TransitiveObjectProperty := 'TransitiveObjectProperty' '(' axiomAnnotations ObjectPropertyExpression ')'  
  
  
  
DataPropertyAxiom :=  
    SubDataPropertyOf | EquivalentDataProperties | DisjointDataProperties |  
    DataPropertyDomain | DataPropertyRange | FunctionalDataProperty  
  
SubDataPropertyOf := 'SubDataPropertyOf' '(' axiomAnnotations subDataPropertyExpression superDataPropertyExpression ')'  
subDataPropertyExpression := DataPropertyExpression  
superDataPropertyExpression := DataPropertyExpression  
  
EquivalentDataProperties := 'EquivalentDataProperties' '(' axiomAnnotations DataPropertyExpression DataPropertyExpression { DataPropertyExpression } ')'  
  
DisjointDataProperties := 'DisjointDataProperties' '(' axiomAnnotations DataPropertyExpression DataPropertyExpression { DataPropertyExpression } ')'  
  
DataPropertyDomain := 'DataPropertyDomain' '(' axiomAnnotations DataPropertyExpression ClassExpression ')'  
  
DataPropertyRange := 'DataPropertyRange' '(' axiomAnnotations DataPropertyExpression DataRange ')'  
  
FunctionalDataProperty := 'FunctionalDataProperty' '(' axiomAnnotations DataPropertyExpression ')'  
  
  
  
DatatypeDefinition := 'DatatypeDefinition' '(' axiomAnnotations Datatype DataRange ')'  
  
  
  
HasKey := 'HasKey' '(' axiomAnnotations ClassExpression '(' { ObjectPropertyExpression } ')' '(' { DataPropertyExpression } ')' ')'  
  
  
  
Assertion :=  
    SameIndividual | DifferentIndividuals | ClassAssertion |  
    ObjectPropertyAssertion | NegativeObjectPropertyAssertion |  
    DataPropertyAssertion | NegativeDataPropertyAssertion  
  
sourceIndividual := Individual  
targetIndividual := Individual  
targetValue := Literal  
  
SameIndividual := 'SameIndividual' '(' axiomAnnotations Individual Individual { Individual } ')'  
  
DifferentIndividuals := 'DifferentIndividuals' '(' axiomAnnotations Individual Individual { Individual } ')'  
  
ClassAssertion := 'ClassAssertion' '(' axiomAnnotations ClassExpression Individual ')'  
  
ObjectPropertyAssertion := 'ObjectPropertyAssertion' '(' axiomAnnotations ObjectPropertyExpression sourceIndividual targetIndividual ')'  
  
NegativeObjectPropertyAssertion := 'NegativeObjectPropertyAssertion' '(' axiomAnnotations ObjectPropertyExpression sourceIndividual targetIndividual ')'  
  
DataPropertyAssertion := 'DataPropertyAssertion' '(' axiomAnnotations DataPropertyExpression sourceIndividual targetValue ')'  
  
NegativeDataPropertyAssertion := 'NegativeDataPropertyAssertion' '(' axiomAnnotations DataPropertyExpression sourceIndividual targetValue ')'

## 14 Appendix: Change Log (Informative)

### 14.1 Changes Since Recommendation

This section summarizes the changes to this document since the [Recommendation of 27 October 2009](https://www.w3.org/TR/2009/REC-owl2-syntax-20091027/ "http://www.w3.org/TR/2009/REC-owl2-syntax-20091027/").

-   With the publication of the XML Schema Definition Language (XSD) 1.1 Part 2: Datatypes [Recommendation of 5 April 2012](https://www.w3.org/TR/2012/REC-xmlschema11-2-20120405/ "http://www.w3.org/TR/2012/REC-xmlschema11-2-20120405/"), the elements of OWL 2 which are based on XSD 1.1 are now considered required, and the note detailing the optional dependency on the XSD 1.1 [Candidate Recommendation of 30 April, 2009](https://www.w3.org/TR/2009/CR-xmlschema11-2-20090430/ "http://www.w3.org/TR/2009/CR-xmlschema11-2-20090430/") has been removed from the "Status of this Document" section.
-   References to and dependencies on the XML Schema Definition Language (XSD) 1.1 Part 2: Datatypes [Candidate Recommendation of 30 April, 2009](https://www.w3.org/TR/2009/CR-xmlschema11-2-20090430/ "http://www.w3.org/TR/2009/CR-xmlschema11-2-20090430/") were amended to reflect the XML Schema Definition Language (XSD) 1.1 Part 2: Datatypes [Recommendation of 5 April 2012](https://www.w3.org/TR/2012/REC-xmlschema11-2-20120405/ "http://www.w3.org/TR/2012/REC-xmlschema11-2-20120405/").
-   The document parsing specification in [Section 2.2](#BNF_Notation) was made more precise by the addition of a canonical process (showing how a sequence of characters should be converted into a sequence of terminal symbols) and several examples.
-   The restrictions on the axiom closure specified in [Section 11.2](#The_Restrictions_on_the_Axiom_Closure) were explained in more detail.
-   Minor typographical errors were corrected as detailed on the [OWL 2 Errata](https://www.w3.org/2007/OWL/wiki/Errata "http://www.w3.org/2007/OWL/wiki/Errata") page.

### 14.2 Changes Since Proposed Recommendation

This section summarizes the changes to this document since the [Proposed Recommendation of 22 September, 2009](https://www.w3.org/TR/2009/PR-owl2-syntax-20090922/ "http://www.w3.org/TR/2009/PR-owl2-syntax-20090922/").

-   Some minor editorial changes were made.

### 14.3 Changes Since Candidate Recommendation

This section summarizes the changes to this document since the [Candidate Recommendation of 11 June, 2009](https://www.w3.org/TR/2009/CR-owl2-syntax-20090611/ "http://www.w3.org/TR/2009/CR-owl2-syntax-20090611/").

-   The "Feature At Risk" warnings w.r.t. the owl:rational and rdf:XMLLiteral datatypes were removed: implementation support has been adequately demonstrated, and the features are no longer considered at risk (see [Resolution 5](https://www.w3.org/2007/OWL/meeting/2009-08-05#resolution_5 "http://www.w3.org/2007/OWL/meeting/2009-08-05#resolution_5") and [Resolution 6](https://www.w3.org/2007/OWL/meeting/2009-08-05#resolution_6 "http://www.w3.org/2007/OWL/meeting/2009-08-05#resolution_6"), 05 August 2009).
-   The definition of the OWL 2 datatype map was strengthened so as to make it clear that OWL 2 DL ontologies can include only the specified datatypes, facets and values.
-   The definition of HasKey axioms was fixed to make it clear that each such axiom must involve at least one property.
-   The restrictions in [Section 5.2](#Datatypes) on the usage of datatypes in an OWL 2 DL ontology were clarified.
-   The restrictions in [Section 5.7](#Literals) on the allowed lexical forms of literals were weakened to apply to OWL 2 DL ontologies only.
-   The restrictions in [Section 7.5](#Datatype_Restrictions) on the allowed facets in facet restrictions were weakened to apply to OWL 2 DL ontologies only.
-   The restrictions in [Section 11.2](#The_Restrictions_on_the_Axiom_Closure) on the usage of datatypes were rephrased for clarity.
-   The restrictions in [Section 11.2](#The_Restrictions_on_the_Axiom_Closure) on the usage of anonymous individuals were rephrased for clarity.
-   Sundry small editorial changes were made.

### 14.4 Changes Since Last Call

This section summarizes the changes to this document since the [Last Call Working Draft of 21 April, 2009](https://www.w3.org/TR/2009/WD-owl2-syntax-20090421/ "http://www.w3.org/TR/2009/WD-owl2-syntax-20090421/").

-   Per the warning in an "at-risk" comment, the name of _owl:dateTime_ was changed to _xsd:dateTime_ to conform to the name that will be part of XML Schema.
-   The name of rdf:text was changed to rdf:PlainLiteral.
-   Two of the examples were fixed.
-   Some minor editorial changes were made.

## 15 Acknowledgments

The starting point for the development of OWL 2 was the [OWL1.1 member submission](https://www.w3.org/Submission/2006/10/ "http://www.w3.org/Submission/2006/10/"), itself a result of user and developer feedback, and in particular of information gathered during the [OWL Experiences and Directions (OWLED) Workshop series](http://www.webont.org/owled/ "http://www.webont.org/owled/"). The working group also considered [postponed issues](https://www.w3.org/2001/sw/WebOnt/webont-issues.html "http://www.w3.org/2001/sw/WebOnt/webont-issues.html") from the [WebOnt Working Group](https://www.w3.org/2004/OWL/ "http://www.w3.org/2004/OWL/").

This document has been produced by the OWL Working Group (see below), and its contents reflect extensive discussions within the Working Group as a whole. The editors extend special thanks to Bernardo Cuenca Grau (Oxford University Computing Laboratory), Ivan Herman (W3C/ERCIM), Mike Smith (Clark & Parsia) and Vojtech Svatek (K-Space) for their thorough reviews.

The regular attendees at meetings of the OWL Working Group at the time of publication of this document were: Jie Bao (RPI), Diego Calvanese (Free University of Bozen-Bolzano), Bernardo Cuenca Grau (Oxford University Computing Laboratory), Martin Dzbor (Open University), Achille Fokoue (IBM Corporation), Christine Golbreich (Université de Versailles St-Quentin and LIRMM), Sandro Hawke (W3C/MIT), Ivan Herman (W3C/ERCIM), Rinke Hoekstra (University of Amsterdam), Ian Horrocks (Oxford University Computing Laboratory), Elisa Kendall (Sandpiper Software), Markus Krötzsch (FZI), Carsten Lutz (Universität Bremen), Deborah L. McGuinness (RPI), Boris Motik (Oxford University Computing Laboratory), Jeff Pan (University of Aberdeen), Bijan Parsia (University of Manchester), Peter F. Patel-Schneider (Bell Labs Research, Alcatel-Lucent), Sebastian Rudolph (FZI), Alan Ruttenberg (Science Commons), Uli Sattler (University of Manchester), Michael Schneider (FZI), Mike Smith (Clark & Parsia), Evan Wallace (NIST), Zhe Wu (Oracle Corporation), and Antoine Zimmermann (DERI Galway). We would also like to thank past members of the working group: Jeremy Carroll, Jim Hendler, and Vipul Kashyap.

## 16 References

### 16.1 Normative References

\[BCP 47\]

[BCP 47 - Tags for Identifying Languages](http://www.rfc-editor.org/rfc/bcp/bcp47.txt "http://www.rfc-editor.org/rfc/bcp/bcp47.txt"). A. Phillips and M. Davis, eds. IETF, September 2006. http://www.rfc-editor.org/rfc/bcp/bcp47.txt

\[ISO 8601:2004\]

ISO 8601:2004. Representations of dates and times. ISO (International Organization for Standardization).

\[ISO/IEC 10646\]

ISO/IEC 10646-1:2000. Information technology — Universal Multiple-Octet Coded Character Set (UCS) — Part 1: Architecture and Basic Multilingual Plane and ISO/IEC 10646-2:2001. Information technology — Universal Multiple-Octet Coded Character Set (UCS) — Part 2: Supplementary Planes, as, from time to time, amended, replaced by a new edition or expanded by the addition of new parts. \[Geneva\]: International Organization for Standardization. ISO (International Organization for Standardization).

\[RFC 2119\]

[RFC 2119: Key words for use in RFCs to Indicate Requirement Levels](http://www.ietf.org/rfc/rfc2119.txt "http://www.ietf.org/rfc/rfc2119.txt"). Network Working Group, S. Bradner. IETF, March 1997, http://www.ietf.org/rfc/rfc2119.txt

\[[RFC 3629](http://tools.ietf.org/html/rfc3629 "http://tools.ietf.org/html/rfc3629")\]

[RFC 3629: UTF-8, a transformation format of ISO 10646](http://www.ietf.org/rfc/rfc3629.txt "http://www.ietf.org/rfc/rfc3629.txt"). F. Yergeau. IETF, November 2003, http://www.ietf.org/rfc/rfc3629.txt

\[RFC 3987\]

[RFC 3987: Internationalized Resource Identifiers (IRIs)](http://www.ietf.org/rfc/rfc3987.txt "http://www.ietf.org/rfc/rfc3987.txt"). M. Duerst and M. Suignard. IETF, January 2005, http://www.ietf.org/rfc/rfc3987.txt

\[RDF Concepts\]

[Resource Description Framework (RDF): Concepts and Abstract Syntax](https://www.w3.org/TR/2004/REC-rdf-concepts-20040210/ "http://www.w3.org/TR/2004/REC-rdf-concepts-20040210/"). Graham Klyne and Jeremy J. Carroll, eds. W3C Recommendation, 10 February 2004, http://www.w3.org/TR/2004/REC-rdf-concepts-20040210/. Latest version available as http://www.w3.org/TR/rdf-concepts/.

\[RDF Test Cases\]

[RDF Test Cases](https://www.w3.org/TR/2004/REC-rdf-testcases-20040210/ "http://www.w3.org/TR/2004/REC-rdf-testcases-20040210/"). Jan Grant and Dave Beckett, eds. W3C Recommendation, 10 February 2004, http://www.w3.org/TR/2004/REC-rdf-testcases-20040210/. Latest version available as http://www.w3.org/TR/rdf-testcases/.

\[RDF:PLAINLITERAL\]

[rdf:PlainLiteral: A Datatype for RDF Plain Literals (Second Edition)](https://www.w3.org/TR/2012/REC-rdf-plain-literal-20121211/) Jie Bao, Sandro Hawke, Boris Motik, Peter F. Patel-Schneider, Axel Polleres, eds. W3C Recommendation, 11 December 2012, [http://www.w3.org/TR/2012/REC-rdf-plain-literal-20121211/](https://www.w3.org/TR/2012/REC-rdf-plain-literal-20121211/). Latest version available at [http://www.w3.org/TR/rdf-plain-literal-1/](https://www.w3.org/TR/rdf-plain-literal-1/).

\[SPARQL\]

[SPARQL Query Language for RDF](https://www.w3.org/TR/2008/REC-rdf-sparql-query-20080115/ "http://www.w3.org/TR/2008/REC-rdf-sparql-query-20080115/"). Eric Prud'hommeaux and Andy Seaborne, eds. W3C Recommendation, 15 January 2008, http://www.w3.org/TR/2008/REC-rdf-sparql-query-20080115/. Latest version available as http://www.w3.org/TR/rdf-sparql-query/.

\[UML\]

[OMG Unified Modeling Language (OMG UML), Infrastructure, V2.1.2](http://www.omg.org/spec/UML/2.1.2/Infrastructure/PDF/ "http://www.omg.org/spec/UML/2.1.2/Infrastructure/PDF/"). Object Management Group, OMG Available Specification, November 2007, http://www.omg.org/spec/UML/2.1.2/Infrastructure/PDF/.

\[UNICODE\]

[The Unicode Standard](http://www.unicode.org/unicode/standard/ "http://www.unicode.org/unicode/standard/"). The Unicode Consortium, Version 5.1.0, [ISBN 0-321-48091-0](https://www.w3.org/2007/OWL/wiki/Special:BookSources/0321480910), as updated from time to time by the publication of new versions. (See [http://www.unicode.org/unicode/standard/versions/](http://www.unicode.org/unicode/standard/versions/ "http://www.unicode.org/unicode/standard/versions/") for the latest version and additional information on versions of the standard and of the Unicode Character Database).

\[XML\]

[Extensible Markup Language (XML) 1.0 (Fifth Edition)](https://www.w3.org/TR/2008/REC-xml-20081126/ "http://www.w3.org/TR/2008/REC-xml-20081126/"). Tim Bray, Jean Paoli, C. M. Sperberg-McQueen, Eve Maler, and François Yergeau, eds. W3C Recommendation, 26 November 2008, http://www.w3.org/TR/2008/REC-xml-20081126/. Latest version available as http://www.w3.org/TR/xml/.

\[XML Schema Datatypes\]

[W3C XML Schema Definition Language (XSD) 1.1 Part 2: Datatypes](https://www.w3.org/TR/2012/REC-xmlschema11-2-20120405/ "http://www.w3.org/TR/2012/REC-xmlschema11-2-20120405/"). David Peterson, Shudi (Sandy) Gao, Ashok Malhotra, C. M. Sperberg-McQueen, and Henry S. Thompson, eds. (Version 1.1) and Paul V. Biron, and Ashok Malhotra, eds. (Version 1.0). W3C Recommendation, 5 April 2012, [http://www.w3.org/TR/2012/REC-xmlschema11-2-20120405/](https://www.w3.org/TR/2012/REC-xmlschema11-2-20120405/ "http://www.w3.org/TR/2012/REC-xmlschema11-2-20120405/"). Latest version available as [http://www.w3.org/TR/xmlschema11-2/](https://www.w3.org/TR/xmlschema11-2/ "http://www.w3.org/TR/xmlschema11-2/").

### 16.2 Nonnormative References

\[Description Logics\]

[The Description Logic Handbook: Theory, Implementation, and Applications, second edition](http://www.cambridge.org/uk/catalogue/catalogue.asp?isbn=9780521876254 "http://www.cambridge.org/uk/catalogue/catalogue.asp?isbn=9780521876254"). Franz Baader, Diego Calvanese, Deborah L. McGuinness, Daniele Nardi, and Peter F. Patel-Schneider, eds. Cambridge University Press, 2007. Also see the [Description Logics Home Page](http://dl.kr.org/ "http://dl.kr.org/").

\[DL-Safe\]

[Query Answering for OWL-DL with Rules](http://www.websemanticsjournal.org/index.php/ps/article/view/63 "http://www.websemanticsjournal.org/index.php/ps/article/view/63"). Boris Motik, Ulrike Sattler and Rudi Studer. Journal of Web Semantics: Science, Services and Agents on the World Wide Web, 3(1):41–60, 2005.

\[MIME Consistency\]

[Internet Media Type registration, consistency of use](https://www.w3.org/2001/tag/2004/0430-mime "http://www.w3.org/2001/tag/2004/0430-mime"). Tim Bray, ed. W3C TAG Finding, 30 April 2004.

\[MOF\]

[Meta Object Facility (MOF) Core Specification, version 2.0](http://www.omg.org/spec/MOF/2.0/PDF/ "http://www.omg.org/spec/MOF/2.0/PDF/"). Object Management Group, OMG Available Specification January 2006, http://www.omg.org/spec/MOF/2.0/PDF/.

\[OWL 2 RDF Mapping\]

[OWL 2 Web Ontology Language: Mapping to RDF Graphs (Second Edition)](https://www.w3.org/TR/2012/REC-owl2-mapping-to-rdf-20121211/) Peter F. Patel-Schneider, Boris Motik, eds. W3C Recommendation, 11 December 2012, [http://www.w3.org/TR/2012/REC-owl2-mapping-to-rdf-20121211/](https://www.w3.org/TR/2012/REC-owl2-mapping-to-rdf-20121211/). Latest version available at [http://www.w3.org/TR/owl2-mapping-to-rdf/](https://www.w3.org/TR/owl2-mapping-to-rdf/).

\[OWL 2 Direct Semantics\]

[OWL 2 Web Ontology Language: Direct Semantics (Second Edition)](https://www.w3.org/TR/2012/REC-owl2-direct-semantics-20121211/) Boris Motik, Peter F. Patel-Schneider, Bernardo Cuenca Grau, eds. W3C Recommendation, 11 December 2012, [http://www.w3.org/TR/2012/REC-owl2-direct-semantics-20121211/](https://www.w3.org/TR/2012/REC-owl2-direct-semantics-20121211/). Latest version available at [http://www.w3.org/TR/owl2-direct-semantics/](https://www.w3.org/TR/owl2-direct-semantics/).

\[OWL 2 RDF-Based Semantics\]

[OWL 2 Web Ontology Language: RDF-Based Semantics (Second Edition)](https://www.w3.org/TR/2012/REC-owl2-rdf-based-semantics-20121211/) Michael Schneider, editor. W3C Recommendation, 11 December 2012, [http://www.w3.org/TR/2012/REC-owl2-rdf-based-semantics-20121211/](https://www.w3.org/TR/2012/REC-owl2-rdf-based-semantics-20121211/). Latest version available at [http://www.w3.org/TR/owl2-rdf-based-semantics/](https://www.w3.org/TR/owl2-rdf-based-semantics/).

\[OWL 2 Conformance\]

[OWL 2 Web Ontology Language: Conformance (Second Edition)](https://www.w3.org/TR/2012/REC-owl2-conformance-20121211/) Michael Smith, Ian Horrocks, Markus Krötzsch, Birte Glimm, eds. W3C Recommendation, 11 December 2012, [http://www.w3.org/TR/2012/REC-owl2-conformance-20121211/](https://www.w3.org/TR/2012/REC-owl2-conformance-20121211/). Latest version available at [http://www.w3.org/TR/owl2-conformance/](https://www.w3.org/TR/owl2-conformance/).

\[OWL 2 XML Serialization\]

[OWL 2 Web Ontology Language: XML Serialization (Second Edition)](https://www.w3.org/TR/2012/REC-owl2-xml-serialization-20121211/) Boris Motik, Bijan Parsia, Peter F. Patel-Schneider, eds. W3C Recommendation, 11 December 2012, [http://www.w3.org/TR/2012/REC-owl2-xml-serialization-20121211/](https://www.w3.org/TR/2012/REC-owl2-xml-serialization-20121211/). Latest version available at [http://www.w3.org/TR/owl2-xml-serialization/](https://www.w3.org/TR/owl2-xml-serialization/).

\[RDF Syntax\]

[RDF/XML Syntax Specification (Revised)](https://www.w3.org/TR/2004/REC-rdf-syntax-grammar-20040210/ "http://www.w3.org/TR/2004/REC-rdf-syntax-grammar-20040210/"). Dave Beckett, ed. W3C Recommendation, 10 February 2004, http://www.w3.org/TR/2004/REC-rdf-syntax-grammar-20040210/. Latest version available as http://www.w3.org/TR/rdf-syntax-grammar/.

\[Register MIME\]

[Register an Internet Media Type for a W3C Spec](https://www.w3.org/2002/06/registering-mediatype "http://www.w3.org/2002/06/registering-mediatype"). Philippe Le Hégaret, ed. W3C Guidebook.

\[[RFC 3986](http://tools.ietf.org/html/rfc3986 "http://tools.ietf.org/html/rfc3986")\]

[RFC 3986: Uniform Resource Identifier (URI): Generic Syntax](http://www.ietf.org/rfc/rfc3986.txt "http://www.ietf.org/rfc/rfc3986.txt"). T. Berners-Lee, R. Fielding, and L. Masinter. IETF, January 2005, http://www.ietf.org/rfc/rfc3986.txt

\[SROIQ\]

[The Even More Irresistible SROIQ](http://www.cs.man.ac.uk/~sattler/publications/sroiq-TR.pdf "http://www.cs.man.ac.uk/~sattler/publications/sroiq-TR.pdf"). Ian Horrocks, Oliver Kutz, and Uli Sattler. In Proc. of the 10th Int. Conf. on Principles of Knowledge Representation and Reasoning (KR 2006). AAAI Press, 2006.

\[UNISEC\]

[Unicode Security Considerations](http://www.unicode.org/reports/tr36/tr36-7.html "http://www.unicode.org/reports/tr36/tr36-7.html"). Mark Davis and Michel Suignard. Unicode technical report 36, 23 July 2008, http://www.unicode.org/reports/tr36/tr36-7.html. Latest version available as http://www.unicode.org/reports/tr36/.

\[XML Namespaces\]

[Namespaces in XML 1.0 (Second Edition)](https://www.w3.org/TR/2006/REC-xml-names-20060816/ "http://www.w3.org/TR/2006/REC-xml-names-20060816/"). Tim Bray, Dave Hollander, Andrew Layman, and Richard Tobin, eds. W3C Recommendation, 16 August 2006, http://www.w3.org/TR/2006/REC-xml-names-20060816/. Latest version available as http://www.w3.org/TR/REC-xml-names/.
