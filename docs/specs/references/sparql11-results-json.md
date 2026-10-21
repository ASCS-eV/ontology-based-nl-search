<!--
  ⚠ THIRD-PARTY SPECIFICATION — NOT AN ORIGINAL WORK OF THIS PROJECT.
  Title:     SPARQL 1.1 Query Results JSON Format
  Source:    https://www.w3.org/TR/sparql11-results-json/
  Publisher: W3C
  License:   W3C Document License 2023 (https://www.w3.org/copyright/document-license-2023/)
  Retrieved: 2026-10-21
  Reproduced verbatim for offline reference and AI-agent context. The
  publisher's original copyright and license apply. Do not hand-edit —
  refresh from source (see docs/specs/references/README.md).
-->

> **Third-party specification — reproduced for offline reference and AI-agent context.**
> **Title:** SPARQL 1.1 Query Results JSON Format  
> **Status:** W3C Recommendation  
> **Source:** <https://www.w3.org/TR/sparql11-results-json/>  
> **Publisher:** W3C  
> **License:** W3C Document License 2023 — <https://www.w3.org/copyright/document-license-2023/>  
> **Retrieved:** 2026-10-21  
> The publisher's original copyright and license apply. Do not hand-edit;
> refresh from source — see [README](./README.md).

---

[![W3C](https://www.w3.org/Icons/w3c_home)](https://www.w3.org/)

# SPARQL 1.1 Query Results JSON Format

## W3C Recommendation 21 March 2013

This version:

[http://www.w3.org/TR/2013/REC-sparql11-results-json-20130321/](https://www.w3.org/TR/2013/REC-sparql11-results-json-20130321/)

Latest version:

[http://www.w3.org/TR/sparql11-results-json/](https://www.w3.org/TR/sparql11-results-json/)

Previous version:

[http://www.w3.org/TR/2012/PR-sparql11-results-json-20121108/](https://www.w3.org/TR/2012/PR-sparql11-results-json-20121108/)

Editor:

Andy Seaborne, The Apache Software Foundation

Previous Editors:

Kendall Grant Clark, UMD Mindswap

Lee Feigenbaum, IBM

Elias Torres, IBM

Please refer to the [**errata**](https://www.w3.org/2013/sparql-errata#sparql11-results-json) for this document, which may include some normative corrections.

See also [**translations**](https://www.w3.org/2003/03/Translations/byTechnology?technology=sparql11-results-json).

[Copyright](https://www.w3.org/Consortium/Legal/ipr-notice#Copyright) © 2013 [W3C](https://www.w3.org/)® ([MIT](http://www.csail.mit.edu/), [ERCIM](http://www.ercim.eu/), [Keio](http://www.keio.ac.jp/), [Beihang](http://ev.buaa.edu.cn/)), All Rights Reserved. W3C [liability](https://www.w3.org/Consortium/Legal/ipr-notice#Legal_Disclaimer), [trademark](https://www.w3.org/Consortium/Legal/ipr-notice#W3C_Trademarks) and [document use](https://www.w3.org/Consortium/Legal/copyright-documents) rules apply.

* * *

## Abstract

[SPARQL](https://www.w3.org/TR/sparql11-query/) is a set of standards for the query and update of RDF data, along with ways to access such data over the web. This document describes the representation of SELECT and ASK query results using [JSON](http://www.ietf.org/rfc/rfc4627.txt).

## Status of This Document

#### May Be Superseded

_This section describes the status of this document at the time of its publication. Other documents may supersede this document. A list of current W3C publications and the latest revision of this technical report can be found in the [W3C technical reports index](https://www.w3.org/TR/) at http://www.w3.org/TR/._

#### Set of Documents

This document is one of eleven SPARQL 1.1 Recommendations produced by the [SPARQL Working Group](https://www.w3.org/2001/sw/DataAccess/):

1.  [SPARQL 1.1 Overview](https://www.w3.org/TR/2013/REC-sparql11-overview-20130321)
2.  [SPARQL 1.1 Query Language](https://www.w3.org/TR/2013/REC-sparql11-query-20130321)
3.  [SPARQL 1.1 Update](https://www.w3.org/TR/2013/REC-sparql11-update-20130321)
4.  [SPARQL1.1 Service Description](https://www.w3.org/TR/2013/REC-sparql11-service-description-20130321)
5.  [SPARQL 1.1 Federated Query](https://www.w3.org/TR/2013/REC-sparql11-federated-query-20130321)
6.  [SPARQL 1.1 Query Results JSON Format](https://www.w3.org/TR/2013/REC-sparql11-results-json-20130321) (this document)
7.  [SPARQL 1.1 Query Results CSV and TSV Formats](https://www.w3.org/TR/2013/REC-sparql11-results-csv-tsv-20130321)
8.  [SPARQL Query Results XML Format (Second Edition)](https://www.w3.org/TR/2013/REC-rdf-sparql-XMLres-20130321)
9.  [SPARQL 1.1 Entailment Regimes](https://www.w3.org/TR/2013/REC-sparql11-entailment-20130321)
10.  [SPARQL 1.1 Protocol](https://www.w3.org/TR/2013/REC-sparql11-protocol-20130321)
11.  [SPARQL 1.1 Graph Store HTTP Protocol](https://www.w3.org/TR/2013/REC-sparql11-http-rdf-update-20130321)

#### No Substantive Changes

There have been no substantive changes to this document since the [previous version](https://www.w3.org/TR/2012/PR-sparql11-results-json-20121108/). Minor editorial changes, if any, are detailed in the [change log](#changes-since-pr) and visible in the [color-coded diff](diff).

#### Please Send Comments

Please send any comments to [public-rdf-dawg-comments@w3.org](mailto:public-rdf-dawg-comments@w3.org) ([public archive](http://lists.w3.org/Archives/Public/public-rdf-dawg-comments/)). Although work on this document by the [SPARQL Working Group](https://www.w3.org/2009/sparql/) is complete, comments may be addressed in the [errata](https://www.w3.org/2013/sparql-errata) or in future revisions. Open discussion is welcome at [public-sparql-dev@w3.org](mailto:public-sparql-dev@w3.org) ([public archive](http://lists.w3.org/Archives/Public/public-sparql-dev/)).

#### Endorsed By W3C

_This document has been reviewed by W3C Members, by software developers, and by other W3C groups and interested parties, and is endorsed by the Director as a W3C Recommendation. It is a stable document and may be used as reference material or cited from another document. W3C's role in making the Recommendation is to draw attention to the specification and to promote its widespread deployment. This enhances the functionality and interoperability of the Web._

#### Patents

_This document was produced by a group operating under the [5 February 2004 W3C Patent Policy](https://www.w3.org/Consortium/Patent-Policy-20040205/). W3C maintains a [public list of any patent disclosures](https://www.w3.org/2004/01/pp-impl/35463/status) made in connection with the deliverables of the group; that page also includes instructions for disclosing a patent. An individual who has actual knowledge of a patent which the individual believes contains [Essential Claim(s)](https://www.w3.org/Consortium/Patent-Policy-20040205/#def-essential) must disclose the information in accordance with [section 6 of the W3C Patent Policy](https://www.w3.org/Consortium/Patent-Policy-20040205/#sec-Disclosure)._

## Table of Contents

1 **[Introduction](#introduction)**  
2 **[JSON Results Object](#json-result-object)**  
3 **[Variable Binding Results](#select-results-form)**  
    3.1 ["head"](#select-head)  
        3.1.1 ["vars"](#select-vars)  
        3.1.2 ["link"](#select-link)  
    3.2 ["results"](#select-results)  
        3.2.1 ["bindings"](#select-bindings)  
        3.2.2 [Encoding RDF terms](#select-encode-terms)  
4 **[Boolean Results](#ask-result-form)**  
    4.1 ["head"](#ask-head)  
        4.1.1 ["link"](#ask-link)  
    4.2 ["boolean"](#ask-boolean)  
5 **[Example](#example)**  
6 **[Internet Media Type, File Extension and Macintosh File Type](#content-type)**  

### Appendix

A **[References](#sec-bibliography)**  
    A.1 [Normative References](#sec-normative-refs)  
    A.2 [Other References](#sec-non-normative-refs)  

* * *

## 1 Introduction

This document describes how to serialize SPARQL results (SELECT and ASK query forms) in a [JSON](http://www.ietf.org/rfc/rfc4627.txt) format. The format is designed to be a complete representation of the information in the query results. The results of a SELECT query are serilialized as an array, where each array element is one "row" of the query results; the results of an ASK query give the boolean value of the query result.

An Internet Media Type is provied for `application/sparql-results+json`.

There is also a [SPARQL Query Results XML Format](https://www.w3.org/TR/rdf-sparql-XMLres/) \[[SRX](#SRX)\] which follows a similar design pattern but uses XML as the serialization.

Unless otherwise noted in the section heading, all sections and appendices in this document are normative.

## 2 JSON Results Object

The results of a SPARQL Query are serialized in JSON as a single top-level JSON object. This object has a `"head"` member and either a `"results"` member or a `"boolean"` member, depending on the query form.

This example shows the results of a `SELECT` query. The query solutions are represented in an array which is the value of the `"bindings"` key, in turn part of an object that is the value of the `"results"` key:

{
  "head": { "vars": \[ "book" , "title" \]
  } ,
  "results": { 
    "bindings": \[
      {
        "book": { "type": "uri" , "value": "http://example.org/book/book6" } ,
        "title": { "type": "literal" , "value": "Harry Potter and the Half-Blood Prince" }
      } ,
      {
        "book": { "type": "uri" , "value": "http://example.org/book/book7" } ,
        "title": { "type": "literal" , "value": "Harry Potter and the Deathly Hallows" }
      } ,
      {
        "book": { "type": "uri" , "value": "http://example.org/book/book5" } ,
        "title": { "type": "literal" , "value": "Harry Potter and the Order of the Phoenix" }
      } ,
      {
        "book": { "type": "uri" , "value": "http://example.org/book/book4" } ,
        "title": { "type": "literal" , "value": "Harry Potter and the Goblet of Fire" }
      } ,
      {
        "book": { "type": "uri" , "value": "http://example.org/book/book2" } ,
        "title": { "type": "literal" , "value": "Harry Potter and the Chamber of Secrets" }
      } ,
      {
        "book": { "type": "uri" , "value": "http://example.org/book/book3" } ,
        "title": { "type": "literal" , "value": "Harry Potter and the Prisoner Of Azkaban" }
      } ,
      {
        "book": { "type": "uri" , "value": "http://example.org/book/book1" } ,
        "title": { "type": "literal" , "value": "Harry Potter and the Philosopher's Stone" }
      }
    \]
  }
}

This example shows the result from an `ASK` query:

{ 
  "head" : { } ,
  "boolean" : true
}

Other keys, with different names, may be present in the JSON Results Object but are not defined by this specification.

## 3 Variable Binding Results

The results of a SPARQL `SELECT` query are serialized as an array of bindings of variables. The value of the `"head"` key is an array of all variables projected in the query's `SELECT` clause.

### 3.1 "head"

The `"head"` member gives the variables mentioned in the results and may contain a `"link"` member.

{
"head" { 
   "vars" : \[ ... \] ,
   "link" : \[ ... \] }

#### 3.1.1 "vars"

The `"vars"` member is an array giving the names of the variables used in the results. These are the projected variables from the query. A variable is not necessarily given a value in every query solution of the results.

"vars" : \[ "book" , "title" \] 

The order of variable names should correspond to the variables in the SELECT clause of the query, unless the query is of the form `SELECT *` in which case order is not significant.

#### 3.1.2 "link"

The optional `"link"` member gives an array of URIs, as strings, to refer for further information. The format and content of these link references is not defined by this document.

"link" : \[ "http://example/dataset/metadata.ttl" \] 

### 3.2 "results"

The value of the `"results"` member is an object with a single key, `"bindings"`.

#### 3.2.1 "bindings"

The value of the `"bindings"` member is an array with zero or more elements, one element per query solution. Each query solution is a JSON object. Each key of this object is a variable name from the query solution. The value for a given variable name is a JSON object that [encodes the variable's bound value, an RDF term.](#select-encode-terms) There are zero elements in the array if the query returned an empty solution sequence. Variables names do not include the initial "?" or "$" character. Each variable name that appears as a key within the `"bindings"` array will have appeared in the [`"vars"`](#select-vars) array in the results header.

A variable does not appear in an array element if it is not bound in that particular query solution.

The order of elements in the bindings array reflects the order, if any, of the query solution sequence.

"bindings" : \[
               {
                 "a" : { ... } ,
                 "b" : { ... } 
               } ,
               {
                 "a" : { ... } ,
                 "b" : { ... } 
               }
             \]

If the query returns no solutions, an empty array is used.

"bindings" : \[\]

#### 3.2.2 Encoding RDF terms

An RDF term (IRI, literal or blank node) is encoded as a JSON object. All aspects of the RDF term are represented. The JSON object has a `"type"` member and other members depending on the specific kind of RDF term.

RDF Term

JSON form

IRI _**I**_

`{"type": "uri", "value": "_**I**_"}`

Literal _**S**_

`{"type": "literal","value": "_**S**_"}`

Literal _**S**_ with language tag _**L**_

`{ "type": "literal", "value": "_**S**_", "xml:lang": "_**L**_"}`

Literal _**S**_ with datatype IRI _**D**_

`{ "type": "literal", "value": "_**S**_", "datatype": "_**D**_"}`

Blank node, label _**B**_

`{"type": "bnode", "value": "_**B**_"}`

The blank node label is scoped to the results object. That is, two blank nodes with the same label in a single SPARQL Results JSON object are the same blank node. This is not an indication of any internal system identifier the SPARQL processor may use. Use of the same label in another SPARQL Results JSON object does not imply it is the same blank node.

## 4 Boolean Results

The results of a SPARQL `ASK` query are serialized as a boolean value, giving the result of the query evaluation.

### 4.1 "head"

#### 4.1.1 "link"

The `"link"` member has the same format as the [SELECT `"link"`](#select-link) member.

### 4.2 "boolean"

The result of an `ASK` query form are encoded by the `"boolean"` member, which takes either the JSON value `true` or the JSON value `false`.

"boolean" : true 

## 5 Example

This section is not normative.

The following JSON is a serialization of the XML document [output.srx](https://www.w3.org/TR/rdf-sparql-XMLres/output.srx):

{
   "head": {
       "link": \[
           "http://www.w3.org/TR/rdf-sparql-XMLres/example.rq"
           \],
       "vars": \[
           "x",
           "hpage",
           "name",
           "mbox",
           "age",
           "blurb",
           "friend"
           \]
       },
   "results": {
       "bindings": \[
               {
                   "x" : { "type": "bnode", "value": "r1" },

                   "hpage" : { "type": "uri", "value": "http://work.example.org/alice/" },

                   "name" : {  "type": "literal", "value": "Alice" } ,
                   
		   "mbox" : {  "type": "literal", "value": "" } ,

                   "blurb" : {
                     "datatype": "http://www.w3.org/1999/02/22-rdf-syntax-ns#XMLLiteral",
                     "type": "literal",
                     "value": "<p xmlns=\\"http://www.w3.org/1999/xhtml\\">My name is <b>alice</b></p>"
                   },

                   "friend" : { "type": "bnode", "value": "r2" }
               },
               {
                   "x" : { "type": "bnode", "value": "r2" },
                   
                   "hpage" : { "type": "uri", "value": "http://work.example.org/bob/" },
                   
                   "name" : { "type": "literal", "value": "Bob", "xml:lang": "en" },

                   "mbox" : { "type": "uri", "value": "mailto:bob@work.example.org" },

                   "friend" : { "type": "bnode", "value": "r1" }
               }
           \]
       }
}

## 6 Internet Media Type, File Extension and Macintosh File Type

The Internet Media Type / MIME Type for the SPARQL Query Results JSON Format is "application/sparql-results+json".

It is recommended that SPARQL Query Results JSON Format files have the extension ".srj" (all lowercase) on all platforms.

It is recommended that SPARQL Query Results JSON Format files stored on Macintosh HFS file systems be given a file type of "TEXT".

This information that follows is intended to be submitted to the IESG for review, approval, and registration with IANA.

Type name:

application

Subtype name:

sparql-results+json

Required parameters:

None

Optional parameters:

None

Encoding considerations:

The encoding considerations of the SPARQL Query Results JSON Format is identical to those of the "application/json" as specified in \[[JSON-RFC](#JSON-RFC)\].

Security considerations:

SPARQL query results uses URIs. See Section 7 of \[[RFC3986](#RFC3986)\].  
SPARQL query results uses IRIs. See Section 8 of \[[RFC3987](#RFC3987)\].  
The security considerations of the SPARQL Query Results JSON Format is identical to those of the "application/json" as specified in \[[JSON-RFC](#JSON-RFC)\].

Interoperability considerations:

There are no known interoperability issues.

Published specification:

http://www.w3.org/TR/sparql11-results-json/

Applications which use this media type:

No known applications currently use this media type.

Additional information:

Magic number(s):

n/a

File extension(s):

".srj"

Macintosh file type code(s):

"TEXT"

Person & email address to contact for further information:

Andy Seaborne <public-rdf-dawg-comments@w3.org>

Intended usage:

COMMON

Restrictions on usage:

None

Author/Change controller:

The SPARQL specification is a work product of the World Wide Web Consortium's SPARQL Working Group. The W3C has change control over these specifications.

## A References

### A.1 Normative References

\[JSON-RFC\]

[RFC 4627](http://www.ietf.org/rfc/rfc4627.txt),  
The application/json Media Type for JavaScript Object Notation (JSON),  
D. Crockford,  
[http://www.ietf.org/rfc/rfc4627.txt](http://www.ietf.org/rfc/rfc4627.txt)

\[RFC3986\]

[RFC 3986](http://www.ietf.org/rfc/rfc3986.txt),  
Uniform Resource Identifier (URI): Generic Syntax,  
T. Berners-Lee, R. Fielding, L. Masinter,  
[http://www.ietf.org/rfc/rfc3986.txt](http://www.ietf.org/rfc/rfc3986.txt)

\[RFC3987\]

[RFC 3987](http://www.ietf.org/rfc/rfc3987.txt),  
Internationalized Resource Identifiers (IRIs),  
M. Dürst, M. Suignard,  
[http://www.ietf.org/rfc/rfc3987.txt](http://www.ietf.org/rfc/rfc3987.txt)

### A.2 Other References

\[SRX\]

[SPARQL Query Results XML Format (Second Edition)](https://www.w3.org/TR/2013/REC-rdf-sparql-XMLres-20130321), D. Beckett, J. Broekstra, Editors, W3C Recommendation, 21 March 2013, http://www.w3.org/TR/2013/REC-rdf-sparql-XMLres-20130321. [Latest version](https://www.w3.org/TR/rdf-sparql-XMLres/ "Latest version of SPARQL Query Results XML Format (Second Edition)") available at http://www.w3.org/TR/rdf-sparql-XMLres.

## Change Log

### Changes since Proposed Recommendation

-   None

### Changes since Last Call

-   Fix typo in example.
-   Update references
