<!--
  ⚠ THIRD-PARTY SPECIFICATION — NOT AN ORIGINAL WORK OF THIS PROJECT.
  Title:     GraphQL Specification (Draft)
  Source:    https://spec.graphql.org/draft/
  Publisher: GraphQL Foundation (Linux Foundation)
  License:   Open Web Foundation Agreement 1.0 (OWFa 1.0) (https://spec.graphql.org/LICENSE)
  Retrieved: 2026-06-16
  Reproduced verbatim for offline reference and AI-agent context. The
  publisher's original copyright and license apply. Do not hand-edit —
  refresh from source (see docs/specs/references/README.md).
-->

> **Third-party specification — reproduced for offline reference and AI-agent context.**
> **Title:** GraphQL Specification (Draft)  
> **Status:** GraphQL Foundation Working Draft  
> **Source:** <https://spec.graphql.org/draft/>  
> **Publisher:** GraphQL Foundation (Linux Foundation)  
> **License:** Open Web Foundation Agreement 1.0 (OWFa 1.0) — <https://spec.graphql.org/LICENSE>  
> **Retrieved:** 2026-06-16  
> The publisher's original copyright and license apply. Do not hand-edit;
> refresh from source — see [README](./README.md).

---

GraphQL

# GraphQL

_Current Working Draft_

###### [Introduction](#sec-Introduction "link to this subsection")

This is the specification for GraphQL, a query language and execution engine for describing and performing the capabilities and requirements of data models for client-server applications.

A conforming implementation of GraphQL must fulfill all normative requirements described in this specification (see [Conformance](#sec-Appendix-Conformance)). The GraphQL specification is provided under the OWFa 1.0 license (see [Copyright and Licensing](#sec-Appendix-Copyright-and-Licensing)).

GraphQL was originally created in 2012 and the development of this open standard started in 2015. It is a deliverable of the [GraphQL Specification Project](https://graphql.org/community/), established in 2019 with the [Joint Development Foundation](https://www.jointdevelopment.org/).

The [GraphQL Foundation](https://graphql.org/foundation/) was formed in 2019 as a neutral focal point for organizations who support development of the GraphQL ecosystem. If your organization benefits from GraphQL, please consider [becoming a member](https://graphql.org/foundation/join/#graphql-foundation).

This specification is developed on GitHub at [graphql/graphql-spec](https://github.com/graphql/graphql-spec/). Contributions are managed by the [GraphQL Working Group](https://github.com/graphql/graphql-wg), hosted by the [GraphQL Technical Steering Committee](https://github.com/graphql/graphql-wg/blob/main/GraphQL-TSC.md). To learn more see the [contribution guide](https://github.com/graphql/graphql-spec/blob/main/CONTRIBUTING.md).

GraphQL has evolved and may continue to evolve in future editions of this specification. Previous editions of the GraphQL specification can be found at permalinks that match their [release tag](https://github.com/graphql/graphql-spec/releases). The latest working draft release can be found at [https://spec.graphql.org/draft](https://spec.graphql.org/draft).

Contents

1.  [1Overview](#sec-Overview)
2.  [2Language](#sec-Language)
    1.  [2.1Source Text](#sec-Language.Source-Text)
        1.  [2.1.1White Space](#sec-White-Space)
        2.  [2.1.2Line Terminators](#sec-Line-Terminators)
        3.  [2.1.3Comments](#sec-Comments)
        4.  [2.1.4Insignificant Commas](#sec-Insignificant-Commas)
        5.  [2.1.5Lexical Tokens](#sec-Language.Source-Text.Lexical-Tokens)
        6.  [2.1.6Ignored Tokens](#sec-Language.Source-Text.Ignored-Tokens)
        7.  [2.1.7Punctuators](#sec-Punctuators)
        8.  [2.1.8Names](#sec-Names)
    2.  [2.2Descriptions](#sec-Descriptions)
    3.  [2.3Document](#sec-Document)
    4.  [2.4Operations](#sec-Language.Operations)
    5.  [2.5Selection Sets](#sec-Selection-Sets)
    6.  [2.6Fields](#sec-Language.Fields)
    7.  [2.7Arguments](#sec-Language.Arguments)
    8.  [2.8Field Alias](#sec-Field-Alias)
    9.  [2.9Fragments](#sec-Language.Fragments)
        1.  [2.9.1Type Conditions](#sec-Type-Conditions)
        2.  [2.9.2Inline Fragments](#sec-Inline-Fragments)
    10.  [2.10Input Values](#sec-Input-Values)
         1.  [2.10.1Int Value](#sec-Int-Value)
         2.  [2.10.2Float Value](#sec-Float-Value)
         3.  [2.10.3Boolean Value](#sec-Boolean-Value)
         4.  [2.10.4String Value](#sec-String-Value)
         5.  [2.10.5Null Value](#sec-Null-Value)
         6.  [2.10.6Enum Value](#sec-Enum-Value)
         7.  [2.10.7List Value](#sec-List-Value)
         8.  [2.10.8Input Object Values](#sec-Input-Object-Values)
    11.  [2.11Variables](#sec-Language.Variables)
    12.  [2.12Type References](#sec-Type-References)
    13.  [2.13Directives](#sec-Language.Directives)
    14.  [2.14Schema Coordinates](#sec-Schema-Coordinates)
3.  [3Type System](#sec-Type-System)
    1.  [3.1Type System Extensions](#sec-Type-System-Extensions)
    2.  [3.2Type System Descriptions](#sec-Type-System-Descriptions)
    3.  [3.3Schema](#sec-Schema)
        1.  [3.3.1Root Operation Types](#sec-Root-Operation-Types)
        2.  [3.3.2Schema Extension](#sec-Schema-Extension)
    4.  [3.4Types](#sec-Types)
        1.  [3.4.1Wrapping Types](#sec-Wrapping-Types)
        2.  [3.4.2Input and Output Types](#sec-Input-and-Output-Types)
        3.  [3.4.3Type Extensions](#sec-Type-Extensions)
    5.  [3.5Scalars](#sec-Scalars)
        1.  [3.5.1Int](#sec-Int)
        2.  [3.5.2Float](#sec-Float)
        3.  [3.5.3String](#sec-String)
        4.  [3.5.4Boolean](#sec-Boolean)
        5.  [3.5.5ID](#sec-ID)
        6.  [3.5.6Scalar Extensions](#sec-Scalar-Extensions)
    6.  [3.6Objects](#sec-Objects)
        1.  [3.6.1Field Arguments](#sec-Field-Arguments)
        2.  [3.6.2Field Deprecation](#sec-Field-Deprecation)
        3.  [3.6.3Object Extensions](#sec-Object-Extensions)
    7.  [3.7Interfaces](#sec-Interfaces)
        1.  [3.7.1Interface Extensions](#sec-Interface-Extensions)
    8.  [3.8Unions](#sec-Unions)
        1.  [3.8.1Union Extensions](#sec-Union-Extensions)
    9.  [3.9Enums](#sec-Enums)
        1.  [3.9.1Enum Extensions](#sec-Enum-Extensions)
    10.  [3.10Input Objects](#sec-Input-Objects)
         1.  [3.10.1OneOf Input Objects](#sec-OneOf-Input-Objects)
         2.  [3.10.2Input Object Extensions](#sec-Input-Object-Extensions)
    11.  [3.11List](#sec-List)
    12.  [3.12Non-Null](#sec-Non-Null)
         1.  [3.12.1Combining List and Non-Null](#sec-Combining-List-and-Non-Null)
    13.  [3.13Directives](#sec-Type-System.Directives)
         1.  [3.13.1@skip](#sec--skip)
         2.  [3.13.2@include](#sec--include)
         3.  [3.13.3@deprecated](#sec--deprecated)
         4.  [3.13.4@specifiedBy](#sec--specifiedBy)
         5.  [3.13.5@oneOf](#sec--oneOf)
         6.  [3.13.6Directive Extensions](#sec-Directive-Extensions)
4.  [4Introspection](#sec-Introspection)
    1.  [4.1Type Name Introspection](#sec-Type-Name-Introspection)
    2.  [4.2Schema Introspection](#sec-Schema-Introspection)
        1.  [4.2.1The \_\_Schema Type](#sec-The-__Schema-Type)
        2.  [4.2.2The \_\_Type Type](#sec-The-__Type-Type)
        3.  [4.2.3The \_\_Field Type](#sec-The-__Field-Type)
        4.  [4.2.4The \_\_InputValue Type](#sec-The-__InputValue-Type)
        5.  [4.2.5The \_\_EnumValue Type](#sec-The-__EnumValue-Type)
        6.  [4.2.6The \_\_Directive Type](#sec-The-__Directive-Type)
5.  [5Validation](#sec-Validation)
    1.  [5.1Documents](#sec-Documents)
        1.  [5.1.1Executable Definitions](#sec-Executable-Definitions)
    2.  [5.2Operations](#sec-Validation.Operations)
        1.  [5.2.1All Operation Definitions](#sec-All-Operation-Definitions)
            1.  [5.2.1.1Operation Type Existence](#sec-Operation-Type-Existence)
        2.  [5.2.2Named Operation Definitions](#sec-Named-Operation-Definitions)
            1.  [5.2.2.1Operation Name Uniqueness](#sec-Operation-Name-Uniqueness)
        3.  [5.2.3Anonymous Operation Definitions](#sec-Anonymous-Operation-Definitions)
            1.  [5.2.3.1Lone Anonymous Operation](#sec-Lone-Anonymous-Operation)
        4.  [5.2.4Subscription Operation Definitions](#sec-Subscription-Operation-Definitions)
            1.  [5.2.4.1Single Root Field](#sec-Single-Root-Field)
    3.  [5.3Fields](#sec-Validation.Fields)
        1.  [5.3.1Field Selections](#sec-Field-Selections)
        2.  [5.3.2Field Selection Merging](#sec-Field-Selection-Merging)
        3.  [5.3.3Leaf Field Selections](#sec-Leaf-Field-Selections)
    4.  [5.4Arguments](#sec-Validation.Arguments)
        1.  [5.4.1Argument Names](#sec-Argument-Names)
        2.  [5.4.2Argument Uniqueness](#sec-Argument-Uniqueness)
        3.  [5.4.3Required Arguments](#sec-Required-Arguments)
    5.  [5.5Fragments](#sec-Validation.Fragments)
        1.  [5.5.1Fragment Declarations](#sec-Fragment-Declarations)
            1.  [5.5.1.1Fragment Name Uniqueness](#sec-Fragment-Name-Uniqueness)
            2.  [5.5.1.2Fragment Spread Type Existence](#sec-Fragment-Spread-Type-Existence)
            3.  [5.5.1.3Fragments on Object, Interface or Union Types](#sec-Fragments-on-Object-Interface-or-Union-Types)
            4.  [5.5.1.4Fragments Must Be Used](#sec-Fragments-Must-Be-Used)
        2.  [5.5.2Fragment Spreads](#sec-Fragment-Spreads)
            1.  [5.5.2.1Fragment Spread Target Defined](#sec-Fragment-Spread-Target-Defined)
            2.  [5.5.2.2Fragment Spreads Must Not Form Cycles](#sec-Fragment-Spreads-Must-Not-Form-Cycles)
            3.  [5.5.2.3Fragment Spread Is Possible](#sec-Fragment-Spread-Is-Possible)
                1.  [5.5.2.3.1Object Spreads in Object Scope](#sec-Object-Spreads-in-Object-Scope)
                2.  [5.5.2.3.2Abstract Spreads in Object Scope](#sec-Abstract-Spreads-in-Object-Scope)
                3.  [5.5.2.3.3Object Spreads in Abstract Scope](#sec-Object-Spreads-in-Abstract-Scope)
                4.  [5.5.2.3.4Abstract Spreads in Abstract Scope](#sec-Abstract-Spreads-in-Abstract-Scope)
    6.  [5.6Values](#sec-Values)
        1.  [5.6.1Values of Correct Type](#sec-Values-of-Correct-Type)
        2.  [5.6.2Input Object Field Names](#sec-Input-Object-Field-Names)
        3.  [5.6.3Input Object Field Uniqueness](#sec-Input-Object-Field-Uniqueness)
        4.  [5.6.4Input Object Required Fields](#sec-Input-Object-Required-Fields)
    7.  [5.7Directives](#sec-Validation.Directives)
        1.  [5.7.1Directives Are Defined](#sec-Directives-Are-Defined)
        2.  [5.7.2Directives Are in Valid Locations](#sec-Directives-Are-in-Valid-Locations)
        3.  [5.7.3Directives Are Unique per Location](#sec-Directives-Are-Unique-per-Location)
    8.  [5.8Variables](#sec-Validation.Variables)
        1.  [5.8.1Variable Uniqueness](#sec-Variable-Uniqueness)
        2.  [5.8.2Variables Are Input Types](#sec-Variables-Are-Input-Types)
        3.  [5.8.3All Variable Uses Defined](#sec-All-Variable-Uses-Defined)
        4.  [5.8.4All Variables Used](#sec-All-Variables-Used)
        5.  [5.8.5All Variable Usages Are Allowed](#sec-All-Variable-Usages-Are-Allowed)
6.  [6Execution](#sec-Execution)
    1.  [6.1Executing Requests](#sec-Executing-Requests)
        1.  [6.1.1Validating Requests](#sec-Validating-Requests)
        2.  [6.1.2Coercing Variable Values](#sec-Coercing-Variable-Values)
    2.  [6.2Executing Operations](#sec-Executing-Operations)
        1.  [6.2.1Query](#sec-Query)
        2.  [6.2.2Mutation](#sec-Mutation)
        3.  [6.2.3Subscription](#sec-Subscription)
            1.  [6.2.3.1Source Stream](#sec-Source-Stream)
            2.  [6.2.3.2Response Stream](#sec-Subscription.Response-Stream)
            3.  [6.2.3.3Unsubscribe](#sec-Unsubscribe)
    3.  [6.3Executing Selection Sets](#sec-Executing-Selection-Sets)
        1.  [6.3.1Executing the Root Selection Set](#sec-Executing-the-Root-Selection-Set)
        2.  [6.3.2Field Collection](#sec-Field-Collection)
        3.  [6.3.3Executing Collected Fields](#sec-Executing-Collected-Fields)
        4.  [6.3.4Normal and Serial Execution](#sec-Normal-and-Serial-Execution)
    4.  [6.4Executing Fields](#sec-Executing-Fields)
        1.  [6.4.1Coercing Field Arguments](#sec-Coercing-Field-Arguments)
        2.  [6.4.2Value Resolution](#sec-Value-Resolution)
        3.  [6.4.3Value Completion](#sec-Value-Completion)
        4.  [6.4.4Handling Execution Errors](#sec-Handling-Execution-Errors)
7.  [7Response](#sec-Response)
    1.  [7.1Response Format](#sec-Response-Format)
        1.  [7.1.1Execution Result](#sec-Execution-Result)
        2.  [7.1.2Response Stream](#sec-Response-Format.Response-Stream)
        3.  [7.1.3Request Error Result](#sec-Request-Error-Result)
        4.  [7.1.4Response Position](#sec-Response-Position)
        5.  [7.1.5Data](#sec-Data)
        6.  [7.1.6Errors](#sec-Errors)
        7.  [7.1.7Extensions](#sec-Extensions)
        8.  [7.1.8Additional Entries](#sec-Additional-Entries)
    2.  [7.2Serialization Format](#sec-Serialization-Format)
        1.  [7.2.1JSON Serialization](#sec-JSON-Serialization)
        2.  [7.2.2Serialized Map Ordering](#sec-Serialized-Map-Ordering)
8.  [AAppendix: Conformance](#sec-Appendix-Conformance)
9.  [BAppendix: Notation Conventions](#sec-Appendix-Notation-Conventions)
    1.  [B.1Context-Free Grammar](#sec-Context-Free-Grammar)
    2.  [B.2Lexical and Syntactic Grammar](#sec-Lexical-and-Syntactic-Grammar)
    3.  [B.3Grammar Notation](#sec-Grammar-Notation)
    4.  [B.4Grammar Semantics](#sec-Grammar-Semantics)
    5.  [B.5Algorithms](#sec-Algorithms)
    6.  [B.6Data Collections](#sec-Data-Collections)
10.  [CAppendix: Grammar Summary](#sec-Appendix-Grammar-Summary)
     1.  [C.1Source Text](#sec-Appendix-Grammar-Summary.Source-Text)
     2.  [C.2Ignored Tokens](#sec-Appendix-Grammar-Summary.Ignored-Tokens)
     3.  [C.3Lexical Tokens](#sec-Appendix-Grammar-Summary.Lexical-Tokens)
     4.  [C.4Document Syntax](#sec-Document-Syntax)
     5.  [C.5Schema Coordinate Syntax](#sec-Schema-Coordinate-Syntax)
11.  [DAppendix: Type System Definitions](#sec-Appendix-Type-System-Definitions)
12.  [EAppendix: Copyright and Licensing](#sec-Appendix-Copyright-and-Licensing)
13.  [§Index](#index)

# [1](#sec-Overview)Overview

GraphQL is a query language designed to build client applications by providing an intuitive and flexible syntax and system for describing their data requirements and interactions.

For example, this GraphQL [request](#request) will receive the name of the user with id 4 from the Facebook implementation of GraphQL.

[Example № 1](#example-85684)`{   user(id: 4) {     name   } }`

Which produces the resulting data (in JSON):

[Example № 2](#example-90fe6)`{   "user": {     "name": "Mark Zuckerberg"   } }`

GraphQL is not a programming language capable of arbitrary computation, but is instead a language used to make requests to application services that have capabilities defined in this specification. GraphQL does not mandate a particular programming language or storage system for application services that implement it. Instead, application services take their capabilities and map them to a uniform language, type system, and philosophy that GraphQL encodes. This provides a unified interface friendly to product development and a powerful platform for tool-building.

GraphQL has a number of design principles:

-   **Product-centric**: GraphQL is unapologetically driven by the requirements of views and the front-end engineers that write them. GraphQL starts with their way of thinking and requirements and builds the language and runtime necessary to enable that.
-   **Hierarchical**: Most product development today involves the creation and manipulation of view hierarchies. To achieve congruence with the structure of these applications, a GraphQL request itself is structured hierarchically. The request is shaped just like the data in its response. It is a natural way for clients to describe data requirements.
-   **Strong-typing**: Every GraphQL service defines an application-specific type system. Requests are executed within the context of that type system. Given a GraphQL operation, tools can ensure that it is both syntactically correct and valid within that type system before execution, i.e. at development time, and the service can make certain guarantees about the shape and nature of the response.
-   **Client-specified response**: Through its type system, a GraphQL service publishes the capabilities that its clients are allowed to consume. It is the client that is responsible for specifying exactly how it will consume those published capabilities. These requests are specified at field-level granularity. In the majority of client-server applications written without GraphQL, the service determines the shape of data returned from its various endpoints. A GraphQL response, on the other hand, contains exactly what a client asks for and no more.
-   **Self-describing**: GraphQL is self-describing and introspective. A GraphQL service’s type system can be queryable by the GraphQL language itself, which includes readable documentation. GraphQL introspection serves as a powerful platform for building common developer tools and client software libraries.

Because of these principles, GraphQL is a powerful and productive environment for building client applications. Product developers and designers building applications against working GraphQL services—supported with quality tools—can quickly become productive without reading extensive documentation and with little or no formal training. To enable that experience, there must be those that build those services and tools.

The following formal specification serves as a reference for those builders. It describes the language and its grammar, the type system and the introspection system used to query it, and the execution and validation engines with the algorithms to power them. The goal of this specification is to provide a foundation and framework for an ecosystem of GraphQL tools, client libraries, and service implementations—spanning both organizations and platforms—that has yet to be built. We look forward to working with the community in order to do that.

# [2](#sec-Language)Language

Clients use the GraphQL query language to make requests to a GraphQL service. We refer to these [request](#request) sources as documents. A document may contain operations (queries, mutations, and subscriptions) as well as fragments, a common unit of composition allowing for data requirement reuse.

A GraphQL document is defined as a syntactic grammar where terminal symbols are tokens (indivisible lexical units). These tokens are defined in a lexical grammar which matches patterns of source characters. In this document, syntactic grammar productions are distinguished with a colon `:` while lexical grammar productions are distinguished with a double-colon `::`.

The source text of a GraphQL document must be a sequence of [SourceCharacter](#SourceCharacter). The character sequence must be described by a sequence of [Token](#Token) and [Ignored](#Ignored) lexical grammars. The lexical token sequence, omitting [Ignored](#Ignored), must be described by a single [Document](#Document) syntactic grammar.

[Note](#note-e800c) See [Appendix A](#sec-Appendix-Notation-Conventions) for more information about the lexical and syntactic grammar and other notational conventions used throughout this document.

###### [Lexical Analysis & Syntactic Parse](#sec-Language.Lexical-Analysis-Syntactic-Parse "link to this subsection")

The source text of a GraphQL document is first converted into a sequence of lexical tokens ([Token](#Token)) and ignored tokens ([Ignored](#Ignored)). The source text is scanned from left to right, repeatedly taking the next possible sequence of code points allowed by the lexical grammar productions as the next token. This sequence of lexical tokens is then scanned from left to right to produce an abstract syntax tree (AST) according to the [Document](#Document) syntactic grammar.

Lexical grammar productions in this document use _lookahead restrictions_ to remove ambiguity and ensure a single valid lexical analysis. A lexical token is only valid if not followed by a character in its lookahead restriction.

For example, an [IntValue](#IntValue) has the restriction [Digit](#Digit), so cannot be followed by a [Digit](#Digit). Because of this, the sequence 123 cannot represent the tokens (12, 3) since 12 is followed by the [Digit](#Digit) 3 and so must only represent a single token. Use [Whitespace](#Whitespace) or other [Ignored](#Ignored) between characters to represent multiple tokens.

[Note](#note-ba22f) This typically has the same behavior as a “[maximal munch](https://en.wikipedia.org/wiki/Maximal_munch)” longest possible match, however some lookahead restrictions include additional constraints.

## [2.1](#sec-Language.Source-Text)Source Text

[SourceCharacter](#SourceCharacter)

Any Unicode scalar value

GraphQL documents are interpreted from a source text, which is a sequence of [SourceCharacter](#SourceCharacter), each [SourceCharacter](#SourceCharacter) being a [Unicode scalar value](https://www.unicode.org/glossary#unicode_scalar_value) which may be any Unicode code point from U+0000 to U+D7FF or U+E000 to U+10FFFF (informally referred to as _“characters”_ through most of this specification).

A GraphQL document may be expressed only in the ASCII range to be as widely compatible with as many existing tools, languages, and serialization formats as possible and avoid display issues in text editors and source control. Non-ASCII Unicode scalar values may appear within [StringValue](#StringValue) and [Comment](#Comment).

[Note](#note-018c1) An implementation which uses [UTF-16](https://www.unicode.org/glossary#UTF_16) to represent GraphQL documents in memory (for example, JavaScript or Java) may encounter a [surrogate pair](https://www.unicode.org/glossary#surrogate_pair). This encodes one [supplementary code point](https://www.unicode.org/glossary#supplementary_code_point) and is a single valid source character, however an unpaired [surrogate code point](https://www.unicode.org/glossary#surrogate_code_point) is not a valid source character.

### [2.1.1](#sec-White-Space)White Space

[Whitespace](#Whitespace)

Horizontal Tab (U+0009)

Space (U+0020)

Whitespace is used to improve legibility of source text and separates other tokens. Any amount of whitespace may appear before or after any token. Whitespace between tokens is not significant to the semantic meaning of a GraphQL document, however whitespace characters may appear within a String or [Comment](#Comment) token.

[Note](#note-c0461) GraphQL intentionally does not consider Unicode “Zs” category characters as whitespace, avoiding misinterpretation by text editors and source control tools.

### [2.1.2](#sec-Line-Terminators)Line Terminators

[LineTerminator](#LineTerminator)

New Line (U+000A)

Carriage Return (U+000D)New Line (U+000A)

Carriage Return (U+000D)New Line (U+000A)

Like whitespace, line terminators are used to improve the legibility of source text and separate lexical tokens, any amount may appear before or after any other token and have no significance to the semantic meaning of a GraphQL Document.

[Note](#note-2b19e) Any error reporting which provides the line number in the source of the offending syntax should use the preceding amount of [LineTerminator](#LineTerminator) to produce the line number.

### [2.1.3](#sec-Comments)Comments

[Comment](#Comment)

#[CommentChar](#CommentChar)listopt[CommentChar](#CommentChar)

[CommentChar](#CommentChar)

[SourceCharacter](#SourceCharacter)[LineTerminator](#LineTerminator)

GraphQL source documents may contain single-line comments, starting with the # marker.

A comment may contain any [SourceCharacter](#SourceCharacter) except [LineTerminator](#LineTerminator) so a comment always consists of all [SourceCharacter](#SourceCharacter) starting with the # character up to but not including the [LineTerminator](#LineTerminator) (or end of the source).

Comments are [Ignored](#Ignored) like whitespace and may appear after any token, or before a [LineTerminator](#LineTerminator), and have no significance to the semantic meaning of a GraphQL document.

### [2.1.4](#sec-Insignificant-Commas)Insignificant Commas

[Comma](#Comma)

,

Similar to whitespace and line terminators, commas (,) are used to improve the legibility of source text and separate lexical tokens but are otherwise syntactically and semantically insignificant within GraphQL documents.

Non-significant comma characters ensure that the absence or presence of a comma does not meaningfully alter the interpreted syntax of the document, as this can be a common user error in other languages. It also allows for the stylistic use of either trailing commas or line terminators as list delimiters which are both often desired for legibility and maintainability of source code.

### [2.1.5](#sec-Language.Source-Text.Lexical-Tokens)Lexical Tokens

[Token](#Token)

[Punctuator](#Punctuator)

[Name](#Name)

[IntValue](#IntValue)

[FloatValue](#FloatValue)

[StringValue](#StringValue)

A GraphQL document is composed of several kinds of indivisible lexical tokens defined here in a lexical grammar by patterns of source Unicode characters. Lexical tokens may be separated by [Ignored](#Ignored) tokens.

Tokens are later used as terminal symbols in GraphQL syntactic grammar rules.

### [2.1.6](#sec-Language.Source-Text.Ignored-Tokens)Ignored Tokens

[Ignored](#Ignored)

[UnicodeBOM](#UnicodeBOM)

[Whitespace](#Whitespace)

[LineTerminator](#LineTerminator)

[Comment](#Comment)

[Comma](#Comma)

[Ignored](#Ignored) tokens are used to improve readability and provide separation between lexical tokens, but are otherwise insignificant and not referenced in syntactic grammar productions.

Any amount of [Ignored](#Ignored) may appear before and after every lexical token. No ignored regions of a source document are significant, however [SourceCharacter](#SourceCharacter) which appear in [Ignored](#Ignored) may also appear within a lexical [Token](#Token) in a significant way, for example a [StringValue](#StringValue) may contain whitespace characters. No [Ignored](#Ignored) may appear _within_ a [Token](#Token), for example no whitespace characters are permitted between the characters defining a [FloatValue](#FloatValue).

###### [Byte Order Mark](#sec-Language.Source-Text.Ignored-Tokens.Byte-Order-Mark "link to this subsection")

[UnicodeBOM](#UnicodeBOM)

Byte Order Mark (U+FEFF)

The [Byte Order Mark](https://www.unicode.org/glossary#byte_order_mark) is a special Unicode code point which may appear at the beginning of a file which programs may use to determine the fact that the text stream is Unicode, and what specific encoding has been used. As files are often concatenated, a [Byte Order Mark](https://www.unicode.org/glossary#byte_order_mark) may appear before or after any lexical token and is [Ignored](#Ignored).

### [2.1.7](#sec-Punctuators)Punctuators

[Punctuator](#Punctuator)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">!</span></td><td class="spec-rhs"><span class="spec-t">$</span></td><td class="spec-rhs"><span class="spec-t">&amp;</span></td><td class="spec-rhs"><span class="spec-t">(</span></td><td class="spec-rhs"><span class="spec-t">)</span></td><td class="spec-rhs"><span class="spec-t">...</span></td><td class="spec-rhs"><span class="spec-t">:</span></td><td class="spec-rhs"><span class="spec-t">=</span></td><td class="spec-rhs"><span class="spec-t">@</span></td><td class="spec-rhs"><span class="spec-t">[</span></td><td class="spec-rhs"><span class="spec-t">]</span></td><td class="spec-rhs"><span class="spec-t">{</span></td><td class="spec-rhs"><span class="spec-t">|</span></td><td class="spec-rhs"><span class="spec-t">}</span></td></tr></tbody></table>

GraphQL documents include punctuation in order to describe structure. GraphQL is a data description language and not a programming language; therefore, GraphQL lacks the punctuation often used to describe mathematical expressions.

### [2.1.8](#sec-Names)Names

[Name](#Name)

[NameStart](#NameStart)[NameContinue](#NameContinue)listopt[NameContinue](#NameContinue)

[NameStart](#NameStart)

[Letter](#Letter)

\_

[NameContinue](#NameContinue)

[Letter](#Letter)

[Digit](#Digit)

\_

[Letter](#Letter)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">A</span></td><td class="spec-rhs"><span class="spec-t">B</span></td><td class="spec-rhs"><span class="spec-t">C</span></td><td class="spec-rhs"><span class="spec-t">D</span></td><td class="spec-rhs"><span class="spec-t">E</span></td><td class="spec-rhs"><span class="spec-t">F</span></td><td class="spec-rhs"><span class="spec-t">G</span></td><td class="spec-rhs"><span class="spec-t">H</span></td><td class="spec-rhs"><span class="spec-t">I</span></td><td class="spec-rhs"><span class="spec-t">J</span></td><td class="spec-rhs"><span class="spec-t">K</span></td><td class="spec-rhs"><span class="spec-t">L</span></td><td class="spec-rhs"><span class="spec-t">M</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">N</span></td><td class="spec-rhs"><span class="spec-t">O</span></td><td class="spec-rhs"><span class="spec-t">P</span></td><td class="spec-rhs"><span class="spec-t">Q</span></td><td class="spec-rhs"><span class="spec-t">R</span></td><td class="spec-rhs"><span class="spec-t">S</span></td><td class="spec-rhs"><span class="spec-t">T</span></td><td class="spec-rhs"><span class="spec-t">U</span></td><td class="spec-rhs"><span class="spec-t">V</span></td><td class="spec-rhs"><span class="spec-t">W</span></td><td class="spec-rhs"><span class="spec-t">X</span></td><td class="spec-rhs"><span class="spec-t">Y</span></td><td class="spec-rhs"><span class="spec-t">Z</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">a</span></td><td class="spec-rhs"><span class="spec-t">b</span></td><td class="spec-rhs"><span class="spec-t">c</span></td><td class="spec-rhs"><span class="spec-t">d</span></td><td class="spec-rhs"><span class="spec-t">e</span></td><td class="spec-rhs"><span class="spec-t">f</span></td><td class="spec-rhs"><span class="spec-t">g</span></td><td class="spec-rhs"><span class="spec-t">h</span></td><td class="spec-rhs"><span class="spec-t">i</span></td><td class="spec-rhs"><span class="spec-t">j</span></td><td class="spec-rhs"><span class="spec-t">k</span></td><td class="spec-rhs"><span class="spec-t">l</span></td><td class="spec-rhs"><span class="spec-t">m</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">n</span></td><td class="spec-rhs"><span class="spec-t">o</span></td><td class="spec-rhs"><span class="spec-t">p</span></td><td class="spec-rhs"><span class="spec-t">q</span></td><td class="spec-rhs"><span class="spec-t">r</span></td><td class="spec-rhs"><span class="spec-t">s</span></td><td class="spec-rhs"><span class="spec-t">t</span></td><td class="spec-rhs"><span class="spec-t">u</span></td><td class="spec-rhs"><span class="spec-t">v</span></td><td class="spec-rhs"><span class="spec-t">w</span></td><td class="spec-rhs"><span class="spec-t">x</span></td><td class="spec-rhs"><span class="spec-t">y</span></td><td class="spec-rhs"><span class="spec-t">z</span></td></tr></tbody></table>

[Digit](#Digit)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">0</span></td><td class="spec-rhs"><span class="spec-t">1</span></td><td class="spec-rhs"><span class="spec-t">2</span></td><td class="spec-rhs"><span class="spec-t">3</span></td><td class="spec-rhs"><span class="spec-t">4</span></td><td class="spec-rhs"><span class="spec-t">5</span></td><td class="spec-rhs"><span class="spec-t">6</span></td><td class="spec-rhs"><span class="spec-t">7</span></td><td class="spec-rhs"><span class="spec-t">8</span></td><td class="spec-rhs"><span class="spec-t">9</span></td></tr></tbody></table>

GraphQL documents are full of named things: operations, fields, arguments, types, directives, fragments, and variables. All names must follow the same grammatical form.

Names in GraphQL are case-sensitive. That is to say `name`, `Name`, and `NAME` all refer to different names. Underscores are significant, which means `other_name` and `othername` are two different names.

A [Name](#Name) must not be followed by a [NameContinue](#NameContinue). In other words, a [Name](#Name) token is always the longest possible valid sequence. The source characters a1 cannot be interpreted as two tokens since a is followed by the [NameContinue](#NameContinue) 1.

[Note](#note-46408) Names in GraphQL are limited to the Latin ASCII subset of [SourceCharacter](#SourceCharacter) in order to support interoperation with as many other systems as possible.

###### [Reserved Names](#sec-Names.Reserved-Names "link to this subsection")

Any [Name](#Name) within a GraphQL type system must not start with two underscores "\_\_" unless it is part of the [introspection system](#sec-Introspection) as defined by this specification.

## [2.2](#sec-Descriptions)Descriptions

[Description](#Description)

[StringValue](#StringValue)

Documentation is a first-class feature of GraphQL by including written descriptions on all named definitions in executable [Document](#Document) and GraphQL type systems, which is also made available via introspection ensuring the documentation of a GraphQL service remains consistent with its capabilities (see [Type System Descriptions](#sec-Type-System-Descriptions)).

GraphQL descriptions are provided as Markdown (as specified by [CommonMark](https://commonmark.org/)). Description strings (often [BlockString](#BlockString)) occur immediately before the definition they describe.

Descriptions in GraphQL executable documents are purely for documentation purposes. They MUST NOT affect the execution, validation, or response of a GraphQL document. It is safe to remove all descriptions and comments from executable documents without changing their behavior or results.

This is an example of a well-described operation:

[Example № 3](#example-d3650)`""" Request the current status of a time machine and its operator. You can also check the status for a particular year. **Warning:** certain years may trigger an anomaly in the space-time continuum. """ query GetTimeMachineStatus(   "The unique serial number of the time machine to inspect."   $machineId: ID!   "The year to check the status for."   $year: Int ) {   timeMachine(id: $machineId) {     ...TimeMachineDetails     status(year: $year)   } }  "Details about a time machine and its operator." fragment TimeMachineDetails on TimeMachine {   id   model   lastMaintenance   operator {     name     licenseLevel   } }`

## [2.3](#sec-Document)Document

[Document](#Document)

[Definition](#Definition)list

[Definition](#Definition)

[ExecutableDefinition](#ExecutableDefinition)

[TypeSystemDefinitionOrExtension](#TypeSystemDefinitionOrExtension)

[ExecutableDocument](#ExecutableDocument)

[ExecutableDefinition](#ExecutableDefinition)list

[ExecutableDefinition](#ExecutableDefinition)

[OperationDefinition](#OperationDefinition)

[FragmentDefinition](#FragmentDefinition)

A GraphQL document describes a complete file or request string operated on by a GraphQL service or client. A document contains multiple definitions, either executable or representative of a GraphQL type system.

Documents are only executable by a GraphQL service if they are [ExecutableDocument](#ExecutableDocument) and contain at least one [OperationDefinition](#OperationDefinition). A Document which contains [TypeSystemDefinitionOrExtension](#TypeSystemDefinitionOrExtension) must not be executed; GraphQL execution services which receive a Document containing these should return a descriptive error.

GraphQL services which only seek to execute GraphQL requests and not construct a new GraphQL schema may choose to only permit [ExecutableDocument](#ExecutableDocument).

Documents which do not contain [OperationDefinition](#OperationDefinition) or do contain [TypeSystemDefinitionOrExtension](#TypeSystemDefinitionOrExtension) may still be parsed and validated to allow client tools to represent many GraphQL uses which may appear across many individual files.

If a Document contains only one operation, that operation may be unnamed. If that operation is a query without variables or directives then it may also be represented in the shorthand form, omitting both the query keyword as well as the operation name. Otherwise, if a GraphQL document contains multiple operations, each operation must be named. When submitting a Document with multiple operations to a GraphQL service, the name of the desired operation to be executed must also be provided.

## [2.4](#sec-Language.Operations)Operations

[OperationDefinition](#OperationDefinition)

[Description](#Description)opt[OperationType](#OperationType)[Name](#Name)opt[VariablesDefinition](#VariablesDefinition)opt[Directives](#Directives)opt[SelectionSet](#SelectionSet)

[SelectionSet](#SelectionSet)

[OperationType](#OperationType)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">query</span></td><td class="spec-rhs"><span class="spec-t">mutation</span></td><td class="spec-rhs"><span class="spec-t">subscription</span></td></tr></tbody></table>

There are three types of operations that GraphQL models:

-   query – a read-only fetch.
-   mutation – a write followed by a fetch.
-   subscription – a long-lived request that fetches data in response to a sequence of events over time.

Each operation is represented by an optional operation name and a [selection set](#selection-set).

For example, this mutation operation might “like” a story and then retrieve the new number of likes:

[Example № 4](#example-187fe)`""" Mark story 12345 as "liked" and return the updated number of likes on the story """ mutation {   likeStory(storyID: 12345) {     story {       likeCount     }   } }`

###### [Query Shorthand](#sec-Language.Operations.Query-Shorthand "link to this subsection")

If a document contains only one operation and that operation is a query which defines no variables and has no directives applied to it then that operation may be represented in a shorthand form which omits the query keyword and operation name.

For example, this unnamed query operation is written via query shorthand.

[Example № 5](#example-63b18)`{   field }`

Descriptions are not permitted on query shorthand.

[Note](#note-a89a8) many examples below will use the query shorthand syntax.

## [2.5](#sec-Selection-Sets)Selection Sets

[SelectionSet](#SelectionSet)

{[Selection](#Selection)list}

[Selection](#Selection)

[Field](#Field)

[FragmentSpread](#FragmentSpread)

[InlineFragment](#InlineFragment)

An operation selects the set of information it needs, and will receive exactly that information and nothing more, avoiding over-fetching and under-fetching data.

A [selection set](#selection-set) defines an ordered set of selections (fields, fragment spreads and inline fragments) against an object, union or interface type.

[Example № 6](#example-21649)`{   id   firstName   lastName }`

In this query operation, the `id`, `firstName`, and `lastName` fields form a [selection set](#selection-set). Selection sets may also contain fragment references.

## [2.6](#sec-Language.Fields)Fields

[Field](#Field)

[Alias](#Alias)opt[Name](#Name)[Arguments](#Arguments)opt[Directives](#Directives)opt[SelectionSet](#SelectionSet)opt

A [selection set](#selection-set) is primarily composed of fields. A field describes one discrete piece of information available to request within a selection set.

Some fields describe complex data or relationships to other data. In order to further explore this data, a field may itself contain a selection set, allowing for deeply nested requests. All GraphQL operations must specify their selections down to _leaf fields_ to ensure an unambiguously shaped response.

For example, this operation selects fields of complex data and relationships down to scalar values.

[Example № 7](#example-100a3)`{   me {     id     firstName     lastName     birthday {       month       day     }     friends {       name     }   } }`

Fields in the top-level [selection set](#selection-set) of an operation often represent some information that is globally accessible to your application and its current viewer. Some typical examples of these top fields include references to a current logged-in viewer, or accessing certain types of data referenced by a unique identifier.

[Example № 8](#example-e1984)``# `me` could represent the currently logged in viewer. {   me {     name   } }  # `user` represents one of many users in a graph of data, referred to by a # unique identifier. {   user(id: 4) {     name   } }``

## [2.7](#sec-Language.Arguments)Arguments

[Arguments](#Arguments)Const

([Argument](#Argument)Constlist)

[Argument](#Argument)Const

[Name](#Name):[Value](#Value)Const

Fields are conceptually functions which return values, and occasionally accept arguments which alter their behavior. These arguments often map directly to function arguments within a GraphQL service’s implementation.

In this example, we want to query a specific user (requested via the `id` argument) and their profile picture of a specific `size`:

[Example № 9](#example-1a865)`{   user(id: 4) {     id     name     profilePic(size: 100)   } }`

Many arguments can exist for a given field:

[Example № 10](#example-34b2d)`{   user(id: 4) {     id     name     profilePic(width: 100, height: 50)   } }`

###### [Arguments Are Unordered](#sec-Language.Arguments.Arguments-Are-Unordered "link to this subsection")

Arguments may be provided in any syntactic order and maintain identical semantic meaning.

These two operations are semantically identical:

[Example № 11](#example-7eba7)`{   picture(width: 200, height: 100) }`

[Example № 12](#example-c93a3)`{   picture(height: 100, width: 200) }`

## [2.8](#sec-Field-Alias)Field Alias

[Alias](#Alias)

[Name](#Name):

A [response name](#response-name) is the key in the response object which correlates with a field’s result. By default the response name will use the field’s name; however, you can define a different response name by specifying an alias.

In this example, we can fetch two profile pictures of different sizes and ensure the resulting response object will not have duplicate keys:

[Example № 13](#example-34435)`{   user(id: 4) {     id     name     smallPic: profilePic(size: 64)     bigPic: profilePic(size: 1024)   } }`

which returns the result:

[Example № 14](#example-6e98a)`{   "user": {     "id": 4,     "name": "Mark Zuckerberg",     "smallPic": "https://cdn.site.io/pic-4-64.jpg",     "bigPic": "https://cdn.site.io/pic-4-1024.jpg"   } }`

The fields at the top level of an operation can also be given an alias:

[Example № 15](#example-27d2f)`{   zuck: user(id: 4) {     id     name   } }`

which returns the result:

[Example № 16](#example-768a2)`{   "zuck": {     "id": 4,     "name": "Mark Zuckerberg"   } }`

## [2.9](#sec-Language.Fragments)Fragments

[FragmentSpread](#FragmentSpread)

...[FragmentName](#FragmentName)[Directives](#Directives)opt

[FragmentDefinition](#FragmentDefinition)

[Description](#Description)optfragment[FragmentName](#FragmentName)[TypeCondition](#TypeCondition)[Directives](#Directives)opt[SelectionSet](#SelectionSet)

[FragmentName](#FragmentName)

[Name](#Name)on

Fragments are the primary unit of composition in GraphQL.

Each data-consuming component (function, class, UI element, and so on) of a client application should declare its data needs in a dedicated fragment. These fragments may then be composed, following the usage of the components themselves, to form a GraphQL operation to issue to the server.

For example, if we have some logic that requires `id`, `name`, and `profilePic` to render a profile, and we want to apply that logic to the friends and mutual friends of a user:

[Example № 17](#example-bcf38)`query noFragments {   user(id: 4) {     friends(first: 10) {       id       name       profilePic(size: 50)     }     mutualFriends(first: 10) {       id       name       profilePic(size: 50)     }   } }`

The fields required to render a profile can be extracted into a fragment and composed by a parent fragment or operation.

[Example № 18](#example-b3c35)`query withFragments {   user(id: 4) {     friends(first: 10) {       ...friendProfile     }     mutualFriends(first: 10) {       ...friendProfile     }   } }`

[Example № 19](#example-52b22)`"Fields required to render a friend's profile" fragment friendProfile on User {   id   name   profilePic(size: 50) }`

If the profile rendering logic no longer needs `name`, the `name` field can be removed from the `friendProfile` fragment and it will no longer be fetched in both locations the fragment is consumed.

Fragments are consumed by using the spread operator (`...`). All fields selected by the fragment will be added to the field selection at the same level as the fragment invocation. This happens through multiple levels of fragment spreads.

For example:

[Example № 20](#example-fb6c3)`query withNestedFragments {   user(id: 4) {     friends(first: 10) {       ...friendFields     }     mutualFriends(first: 10) {       ...friendFields     }   } }  fragment friendFields on User {   id   name   ...standardProfilePic }  fragment standardProfilePic on User {   profilePic(size: 50) }`

The operations `noFragments`, `withFragments`, and `withNestedFragments` all produce the same response object.

### [2.9.1](#sec-Type-Conditions)Type Conditions

[TypeCondition](#TypeCondition)

on[NamedType](#NamedType)

Fragments must specify the type they apply to. In this example, `friendFields` can be used in the context of querying a `User`.

Fragments cannot be specified on any input value (scalar, enumeration, or input object).

Fragments can be specified on object types, interfaces, and unions.

Selections within fragments only return values when the concrete type of the object it is operating on matches the type of the fragment.

For example in this operation using the Facebook data model:

[Example № 21](#example-80138)`query FragmentTyping {   profiles(handles: ["zuck", "coca-cola"]) {     handle     ...userFragment     ...pageFragment   } }  fragment userFragment on User {   friends {     count   } }  fragment pageFragment on Page {   likers {     count   } }`

The `profiles` root field returns a list where each element could be a `Page` or a `User`. When the object in the `profiles` result is a `User`, `friends` will be present and `likers` will not. Conversely when the result is a `Page`, `likers` will be present and `friends` will not.

[Example № 22](#example-883a1)`{   "profiles": [     {       "handle": "zuck",       "friends": { "count": 1234 }     },     {       "handle": "coca-cola",       "likers": { "count": 90234512 }     }   ] }`

### [2.9.2](#sec-Inline-Fragments)Inline Fragments

[InlineFragment](#InlineFragment)

...[TypeCondition](#TypeCondition)opt[Directives](#Directives)opt[SelectionSet](#SelectionSet)

Fragments can also be defined inline within a [selection set](#selection-set). This is useful for conditionally including fields based on a type condition or applying a directive to a selection set.

This feature of standard fragment inclusion was demonstrated in the `query FragmentTyping` example above. We could accomplish the same thing using inline fragments.

[Example № 23](#example-10b94)`query inlineFragmentTyping {   profiles(handles: ["zuck", "coca-cola"]) {     handle     ... on User {       friends {         count       }     }     ... on Page {       likers {         count       }     }   } }`

Inline fragments may also be used to apply a directive to a group of fields. If the TypeCondition is omitted, an inline fragment is considered to be of the same type as the enclosing context.

[Example № 24](#example-77377)`query inlineFragmentNoType($expandedInfo: Boolean) {   user(handle: "zuck") {     id     name     ... @include(if: $expandedInfo) {       firstName       lastName       birthday     }   } }`

## [2.10](#sec-Input-Values)Input Values

[Value](#Value)Const

Const[Variable](#Variable)

[IntValue](#IntValue)

[FloatValue](#FloatValue)

[StringValue](#StringValue)

[BooleanValue](#BooleanValue)

[NullValue](#NullValue)

[EnumValue](#EnumValue)

[ListValue](#ListValue)Const

[ObjectValue](#ObjectValue)Const

Field and directive arguments accept input values of various literal primitives; input values can be scalars, enumeration values, lists, or input objects.

If not defined as constant (for example, in [DefaultValue](#DefaultValue)), input values can be specified as a variable. List and inputs objects may also contain variables (unless defined to be constant).

### [2.10.1](#sec-Int-Value)Int Value

[IntValue](#IntValue)

[IntegerPart](#IntegerPart)[Digit](#Digit).[NameStart](#NameStart)

[IntegerPart](#IntegerPart)

[NegativeSign](#NegativeSign)opt0

[NegativeSign](#NegativeSign)opt[NonZeroDigit](#NonZeroDigit)[Digit](#Digit)listopt

[NegativeSign](#NegativeSign)

\-

[NonZeroDigit](#NonZeroDigit)

[Digit](#Digit)0

An [IntValue](#IntValue) is specified without a decimal point or exponent but may be negative (e.g. \-123). It must not have any leading 0.

An [IntValue](#IntValue) must not be followed by a [Digit](#Digit). In other words, an [IntValue](#IntValue) token is always the longest possible valid sequence. The source characters 12 cannot be interpreted as two tokens since 1 is followed by the [Digit](#Digit) 2. This also means the source 00 is invalid since it can neither be interpreted as a single token nor two 0 tokens.

An [IntValue](#IntValue) must not be followed by a . or [NameStart](#NameStart). If either . or [ExponentIndicator](#ExponentIndicator) follows then the token must only be interpreted as a possible [FloatValue](#FloatValue). No other [NameStart](#NameStart) character can follow. For example the sequences `0x123` and `123L` have no valid lexical representations.

### [2.10.2](#sec-Float-Value)Float Value

[FloatValue](#FloatValue)

[IntegerPart](#IntegerPart)[FractionalPart](#FractionalPart)[ExponentPart](#ExponentPart)[Digit](#Digit).[NameStart](#NameStart)

[IntegerPart](#IntegerPart)[FractionalPart](#FractionalPart)[Digit](#Digit).[NameStart](#NameStart)

[IntegerPart](#IntegerPart)[ExponentPart](#ExponentPart)[Digit](#Digit).[NameStart](#NameStart)

[FractionalPart](#FractionalPart)

.[Digit](#Digit)list

[ExponentPart](#ExponentPart)

[ExponentIndicator](#ExponentIndicator)[Sign](#Sign)opt[Digit](#Digit)list

[ExponentIndicator](#ExponentIndicator)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">e</span></td><td class="spec-rhs"><span class="spec-t">E</span></td></tr></tbody></table>

[Sign](#Sign)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">+</span></td><td class="spec-rhs"><span class="spec-t">-</span></td></tr></tbody></table>

A [FloatValue](#FloatValue) includes either a decimal point (e.g. 1.0) or an exponent (e.g. 1e50) or both (e.g. 6.0221413e23) and may be negative. Like [IntValue](#IntValue), it also must not have any leading 0.

A [FloatValue](#FloatValue) must not be followed by a [Digit](#Digit). In other words, a [FloatValue](#FloatValue) token is always the longest possible valid sequence. The source characters 1.23 cannot be interpreted as two tokens since 1.2 is followed by the [Digit](#Digit) 3.

A [FloatValue](#FloatValue) must not be followed by a .. For example, the sequence 1.23.4 cannot be interpreted as two tokens (1.2, 3.4).

A [FloatValue](#FloatValue) must not be followed by a [NameStart](#NameStart). For example the sequence `0x1.2p3` has no valid lexical representation.

[Note](#note-dea61) The numeric literals [IntValue](#IntValue) and [FloatValue](#FloatValue) both restrict being immediately followed by a letter (or other [NameStart](#NameStart)) to reduce confusion or unexpected behavior since GraphQL only supports decimal numbers.

### [2.10.3](#sec-Boolean-Value)Boolean Value

[BooleanValue](#BooleanValue)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">true</span></td><td class="spec-rhs"><span class="spec-t">false</span></td></tr></tbody></table>

The two keywords `true` and `false` represent the two boolean values.

### [2.10.4](#sec-String-Value)String Value

[StringValue](#StringValue)

"""

"[StringCharacter](#StringCharacter)list"

[BlockString](#BlockString)

[StringCharacter](#StringCharacter)

[SourceCharacter](#SourceCharacter)"\\[LineTerminator](#LineTerminator)

\\u[EscapedUnicode](#EscapedUnicode)

\\[EscapedCharacter](#EscapedCharacter)

[EscapedUnicode](#EscapedUnicode)

{[HexDigit](#HexDigit)list}

[HexDigit](#HexDigit)[HexDigit](#HexDigit)[HexDigit](#HexDigit)[HexDigit](#HexDigit)

[HexDigit](#HexDigit)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">0</span></td><td class="spec-rhs"><span class="spec-t">1</span></td><td class="spec-rhs"><span class="spec-t">2</span></td><td class="spec-rhs"><span class="spec-t">3</span></td><td class="spec-rhs"><span class="spec-t">4</span></td><td class="spec-rhs"><span class="spec-t">5</span></td><td class="spec-rhs"><span class="spec-t">6</span></td><td class="spec-rhs"><span class="spec-t">7</span></td><td class="spec-rhs"><span class="spec-t">8</span></td><td class="spec-rhs"><span class="spec-t">9</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">A</span></td><td class="spec-rhs"><span class="spec-t">B</span></td><td class="spec-rhs"><span class="spec-t">C</span></td><td class="spec-rhs"><span class="spec-t">D</span></td><td class="spec-rhs"><span class="spec-t">E</span></td><td class="spec-rhs"><span class="spec-t">F</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">a</span></td><td class="spec-rhs"><span class="spec-t">b</span></td><td class="spec-rhs"><span class="spec-t">c</span></td><td class="spec-rhs"><span class="spec-t">d</span></td><td class="spec-rhs"><span class="spec-t">e</span></td><td class="spec-rhs"><span class="spec-t">f</span></td></tr></tbody></table>

[EscapedCharacter](#EscapedCharacter)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">"</span></td><td class="spec-rhs"><span class="spec-t">\</span></td><td class="spec-rhs"><span class="spec-t">/</span></td><td class="spec-rhs"><span class="spec-t">b</span></td><td class="spec-rhs"><span class="spec-t">f</span></td><td class="spec-rhs"><span class="spec-t">n</span></td><td class="spec-rhs"><span class="spec-t">r</span></td><td class="spec-rhs"><span class="spec-t">t</span></td></tr></tbody></table>

[BlockString](#BlockString)

"""[BlockStringCharacter](#BlockStringCharacter)listopt"""

[BlockStringCharacter](#BlockStringCharacter)

[SourceCharacter](#SourceCharacter)"""\\"""

\\"""

A [StringValue](#StringValue) is evaluated to a [Unicode text](#unicode-text) value, a sequence of [Unicode scalar value](https://www.unicode.org/glossary#unicode_scalar_value), by interpreting all escape sequences using the static semantics defined below. Whitespace and other characters ignored between lexical tokens are significant within a string value.

The empty string "" must not be followed by another " otherwise it would be interpreted as the beginning of a block string. As an example, the source """""" can only be interpreted as a single empty block string and not three empty strings.

###### [Escape Sequences](#sec-String-Value.Escape-Sequences "link to this subsection")

In a single-quoted [StringValue](#StringValue), any [Unicode scalar value](https://www.unicode.org/glossary#unicode_scalar_value) may be expressed using an escape sequence. GraphQL strings allow both C-style escape sequences (for example `\n`) and two forms of Unicode escape sequences: one with a fixed-width of 4 hexadecimal digits (for example `\u000A`) and one with a variable-width most useful for representing a [supplementary character](https://www.unicode.org/glossary#supplementary_character) such as an Emoji (for example `\u{1F4A9}`).

The hexadecimal number encoded by a Unicode escape sequence must describe a [Unicode scalar value](https://www.unicode.org/glossary#unicode_scalar_value), otherwise must result in a parse error. For example both sources `"\uDEAD"` and `"\u{110000}"` should not be considered valid [StringValue](#StringValue).

Escape sequences are only meaningful within a single-quoted string. Within a block string, they are simply that sequence of characters (for example `"""\n"""` represents the [Unicode text](#unicode-text) \[U+005C, U+006E\]). Within a comment an escape sequence is not a significant sequence of characters. They may not appear elsewhere in a GraphQL document.

Since [StringCharacter](#StringCharacter) must not contain some code points directly (for example, a [LineTerminator](#LineTerminator)), escape sequences must be used to represent them. All other escape sequences are optional and unescaped non-ASCII Unicode characters are allowed within strings. If using GraphQL within a system which only supports ASCII, then escape sequences may be used to represent all Unicode characters outside of the ASCII range.

For legacy reasons, a [supplementary character](https://www.unicode.org/glossary#supplementary_character) may be escaped by two fixed-width unicode escape sequences forming a [surrogate pair](https://www.unicode.org/glossary#surrogate_pair). For example the input `"\uD83D\uDCA9"` is a valid [StringValue](#StringValue) which represents the same [Unicode text](#unicode-text) as `"\u{1F4A9}"`. While this legacy form is allowed, it should be avoided as a variable-width unicode escape sequence is a clearer way to encode such code points.

When producing a [StringValue](#StringValue), implementations should use escape sequences to represent non-printable control characters (U+0000 to U+001F and U+007F to U+009F). Other escape sequences are not necessary, however an implementation may use escape sequences to represent any other range of code points (for example, when producing ASCII-only output). If an implementation chooses to escape a [supplementary character](https://www.unicode.org/glossary#supplementary_character), it should only use a variable-width unicode escape sequence.

###### [Block Strings](#sec-String-Value.Block-Strings "link to this subsection")

Block strings are sequences of characters wrapped in triple-quotes (`"""`). Whitespace, line terminators, quote, and backslash characters may all be used unescaped to enable verbatim text. Characters must all be valid [SourceCharacter](#SourceCharacter).

Since block strings represent freeform text often used in indented positions, the string value semantics of a block string excludes uniform indentation and blank initial and trailing lines via [BlockStringValue](#BlockStringValue\(\))().

For example, the following operation containing a block string:

[Example № 25](#example-fe73f)`mutation {   sendEmail(message: """     Hello,       World!      Yours,       GraphQL.   """) }`

Is identical to the standard quoted string:

[Example № 26](#example-c6521)`mutation {   sendEmail(message: "Hello,\n  World!\n\nYours,\n  GraphQL.") }`

Since block string values strip leading and trailing empty lines, there is no single canonical printed block string for a given value. Because block strings typically represent freeform text, it is considered easier to read if they begin and end with an empty line.

[Example № 27](#example-8e831)`""" This starts with and ends with an empty line, which makes it easier to read. """`

[Counter Example № 28](#example-b874e)`"""This does not start with or end with any empty lines, which makes it a little harder to read."""`

[Note](#note-65771) If non-printable ASCII characters are needed in a string value, a standard quoted string with appropriate escape sequences must be used instead of a block string.

###### [Static Semantics](#sec-String-Value.Static-Semantics "link to this subsection")

A [StringValue](#StringValue) describes a [Unicode text](#unicode-text) value, which is a sequence of [Unicode scalar value](https://www.unicode.org/glossary#unicode_scalar_value).

These semantics describe how to apply the [StringValue](#StringValue) grammar to a source text to evaluate a [Unicode text](#unicode-text). Errors encountered during this evaluation are considered a failure to apply the [StringValue](#StringValue) grammar to a source and must result in a parsing error.

[StringValue](#StringValue)

""

1.  Return an empty sequence.

[StringValue](#StringValue)

"[StringCharacter](#StringCharacter)list"

1.  Return the [Unicode text](#unicode-text) by concatenating the evaluation of all [StringCharacter](#StringCharacter).

[StringCharacter](#StringCharacter)

[SourceCharacter](#SourceCharacter)"\\[LineTerminator](#LineTerminator)

1.  Return the [Unicode scalar value](https://www.unicode.org/glossary#unicode_scalar_value) [SourceCharacter](#SourceCharacter).

[StringCharacter](#StringCharacter)

\\u[EscapedUnicode](#EscapedUnicode)

1.  Let value be the hexadecimal value represented by the sequence of [HexDigit](#HexDigit) within [EscapedUnicode](#EscapedUnicode).
2.  Assert: value is a within the [Unicode scalar value](https://www.unicode.org/glossary#unicode_scalar_value) range (≥ 0x0000 and ≤ 0xD7FF or ≥ 0xE000 and ≤ 0x10FFFF).
3.  Return the [Unicode scalar value](https://www.unicode.org/glossary#unicode_scalar_value) value.

[StringCharacter](#StringCharacter)

\\u[HexDigit](#HexDigit)[HexDigit](#HexDigit)[HexDigit](#HexDigit)[HexDigit](#HexDigit)\\u[HexDigit](#HexDigit)[HexDigit](#HexDigit)[HexDigit](#HexDigit)[HexDigit](#HexDigit)

1.  Let leadingValue be the hexadecimal value represented by the first sequence of [HexDigit](#HexDigit).
2.  Let trailingValue be the hexadecimal value represented by the second sequence of [HexDigit](#HexDigit).
3.  If leadingValue is ≥ 0xD800 and ≤ 0xDBFF (a [Leading Surrogate](https://www.unicode.org/glossary#leading_surrogate)):
    1.  Assert: trailingValue is ≥ 0xDC00 and ≤ 0xDFFF (a [Trailing Surrogate](https://www.unicode.org/glossary#trailing_surrogate)).
    2.  Return (leadingValue - 0xD800) × 0x400 + (trailingValue - 0xDC00) + 0x10000.
4.  Otherwise:
    1.  Assert: leadingValue is within the [Unicode scalar value](https://www.unicode.org/glossary#unicode_scalar_value) range.
    2.  Assert: trailingValue is within the [Unicode scalar value](https://www.unicode.org/glossary#unicode_scalar_value) range.
    3.  Return the sequence of the [Unicode scalar value](https://www.unicode.org/glossary#unicode_scalar_value) leadingValue followed by the [Unicode scalar value](https://www.unicode.org/glossary#unicode_scalar_value) trailingValue.

[Note](#note-97840) If both escape sequences encode a [Unicode scalar value](https://www.unicode.org/glossary#unicode_scalar_value), then this semantic is identical to applying the prior semantic on each fixed-width escape sequence. A variable-width escape sequence must only encode a [Unicode scalar value](https://www.unicode.org/glossary#unicode_scalar_value).

[StringCharacter](#StringCharacter)

\\[EscapedCharacter](#EscapedCharacter)

1.  Return the [Unicode scalar value](https://www.unicode.org/glossary#unicode_scalar_value) represented by [EscapedCharacter](#EscapedCharacter) according to the table below.

| Escaped Character | Scalar Value | Character Name |
| --- | --- | --- |
| " | U+0022 | double quote |
| \\ | U+005C | reverse solidus (back slash) |
| / | U+002F | solidus (forward slash) |
| b | U+0008 | backspace |
| f | U+000C | form feed |
| n | U+000A | line feed (new line) |
| r | U+000D | carriage return |
| t | U+0009 | horizontal tab |

[StringValue](#StringValue)

[BlockString](#BlockString)

1.  Return the [Unicode text](#unicode-text) by evaluating the [BlockString](#BlockString).

[BlockString](#BlockString)

"""[BlockStringCharacter](#BlockStringCharacter)listopt"""

1.  Let rawValue be the [Unicode text](#unicode-text) by concatenating the evaluation of all [BlockStringCharacter](#BlockStringCharacter) (which may be an empty sequence).
2.  Return the result of [BlockStringValue](#BlockStringValue\(\))(rawValue).

[BlockStringCharacter](#BlockStringCharacter)

[SourceCharacter](#SourceCharacter)"""\\"""

1.  Return the [Unicode scalar value](https://www.unicode.org/glossary#unicode_scalar_value) [SourceCharacter](#SourceCharacter).

[BlockStringCharacter](#BlockStringCharacter)

\\"""

1.  Return the character sequence `"""`.

[BlockStringValue](#BlockStringValue\(\))(rawValue)

1.  Let lines be the result of splitting rawValue by [LineTerminator](#LineTerminator).
2.  Let commonIndent be null.
3.  For each line in lines:
    1.  If line is the first item in lines, continue to the next line.
    2.  Let length be the number of characters in line.
    3.  Let indent be the number of leading consecutive [Whitespace](#Whitespace) characters in line.
    4.  If indent is less than length:
        1.  If commonIndent is null or indent is less than commonIndent:
            1.  Let commonIndent be indent.
4.  If commonIndent is not null:
    1.  For each line in lines:
        1.  If line is the first item in lines, continue to the next line.
        2.  Remove commonIndent characters from the beginning of line.
5.  While the first item line in lines contains only [Whitespace](#Whitespace):
    1.  Remove the first item from lines.
6.  While the last item line in lines contains only [Whitespace](#Whitespace):
    1.  Remove the last item from lines.
7.  Let formatted be the empty character sequence.
8.  For each line in lines:
    1.  If line is the first item in lines:
        1.  Append formatted with line.
    2.  Otherwise:
        1.  Append formatted with a line feed character (U+000A).
        2.  Append formatted with line.
9.  Return formatted.

### [2.10.5](#sec-Null-Value)Null Value

[NullValue](#NullValue)

null

Null values are represented as the keyword null.

GraphQL has two semantically different ways to represent the lack of a value:

-   Explicitly providing the literal value: null.
-   Implicitly not providing a value at all.

For example, these two field calls are similar, but are not identical:

[Example № 29](#example-1c7eb)`{   field(arg: null)   field }`

The first has explicitly provided null to the argument “arg”, while the second has implicitly not provided a value to the argument “arg”. These two forms may be interpreted differently. For example, a mutation representing deleting a field vs not altering a field, respectively. Neither form may be used for an input expecting a Non-Null type.

[Note](#note-eab9b) The same two methods of representing the lack of a value are possible via variables by either providing the variable value as null or not providing a variable value at all.

### [2.10.6](#sec-Enum-Value)Enum Value

[EnumValue](#EnumValue)

[Name](#Name)truefalsenull

Enum values are represented as unquoted names (e.g. `MOBILE_WEB`). It is recommended that Enum values be “all caps”. Enum values are only used in contexts where the precise enumeration type is known. Therefore it is not necessary to supply an enumeration type name in the literal.

### [2.10.7](#sec-List-Value)List Value

[ListValue](#ListValue)Const

\[\]

\[[Value](#Value)Constlist\]

Lists are ordered sequences of values wrapped in square brackets `[ ]`. The values of a List literal may be any value literal or variable (e.g. `[1, 2, 3]`).

Commas are optional throughout GraphQL so trailing commas are allowed and repeated commas do not represent missing values.

###### [Semantics](#sec-List-Value.Semantics "link to this subsection")

[ListValue](#ListValue)

\[\]

1.  Return a new empty list value.

[ListValue](#ListValue)

\[[Value](#Value)list\]

1.  Let inputList be a new empty list value.
2.  For each [Value](#Value)list:
    1.  Let value be the result of evaluating [Value](#Value).
    2.  Append value to inputList.
3.  Return inputList.

### [2.10.8](#sec-Input-Object-Values)Input Object Values

[ObjectValue](#ObjectValue)Const

{}

{[ObjectField](#ObjectField)Constlist}

[ObjectField](#ObjectField)Const

[Name](#Name):[Value](#Value)Const

Input object literal values are unordered lists of keyed input values wrapped in curly braces `{ }`. The values of an object literal may be any input value literal or variable (e.g. `{ name: "Hello world", score: 1.0 }`). We refer to literal representation of input objects as “object literals.”

###### [Input Object Fields Are Unordered](#sec-Input-Object-Values.Input-Object-Fields-Are-Unordered "link to this subsection")

Input object fields may be provided in any syntactic order and maintain identical semantic meaning.

These two operations are semantically identical:

[Example № 30](#example-09646)`{   nearestThing(location: { lon: 12.43, lat: -53.211 }) }`

[Example № 31](#example-6ebee)`{   nearestThing(location: { lat: -53.211, lon: 12.43 }) }`

###### [Semantics](#sec-Input-Object-Values.Semantics "link to this subsection")

[ObjectValue](#ObjectValue)

{}

1.  Return a new input object value with no fields.

[ObjectValue](#ObjectValue)

{[ObjectField](#ObjectField)list}

1.  Let inputObject be a new input object value with no fields.
2.  For each field in [ObjectField](#ObjectField)list:
    1.  Let name be [Name](#Name) in field.
    2.  Let value be the result of evaluating [Value](#Value) in field.
    3.  Add a field to inputObject of name name containing value value.
3.  Return inputObject.

## [2.11](#sec-Language.Variables)Variables

[Variable](#Variable)

$[Name](#Name)

[VariablesDefinition](#VariablesDefinition)

([VariableDefinition](#VariableDefinition)list)

[VariableDefinition](#VariableDefinition)

[Description](#Description)opt[Variable](#Variable):[Type](#Type)[DefaultValue](#DefaultValue)opt[Directives](#Directives)Constopt

[DefaultValue](#DefaultValue)

\=[Value](#Value)Const

A GraphQL operation can be parameterized with variables, maximizing reuse, and avoiding costly string building in clients at runtime.

If not defined as constant (for example, in [DefaultValue](#DefaultValue)), a [Variable](#Variable) can be supplied for an input value.

Variables must be defined at the top of an operation and are in scope throughout the execution of that operation. Values for those variables are provided to a GraphQL service as part of a request so they may be substituted in during execution.

In this example, we want to fetch a profile picture size based on the size of a particular device:

[Example № 32](#example-893e8)`query getZuckProfile(   "The size of the profile picture to fetch."   $devicePicSize: Int ) {   user(id: 4) {     id     name     profilePic(size: $devicePicSize)   } }`

If providing JSON for the variables’ values, we could request a `profilePic` of size `60`:

[Example № 33](#example-98958)`{   "devicePicSize": 60 }`

###### [Variable Use Within Fragments](#sec-Language.Variables.Variable-Use-Within-Fragments "link to this subsection")

Variables can be used within fragments. Variables have global scope with a given operation, so a variable used within a fragment must be declared in any top-level operation that transitively consumes that fragment. If a variable is referenced in a fragment and is included by an operation that does not define that variable, that operation is invalid (see [All Variable Uses Defined](#sec-All-Variable-Uses-Defined)).

## [2.12](#sec-Type-References)Type References

[Type](#Type)

[NamedType](#NamedType)

[ListType](#ListType)

[NonNullType](#NonNullType)

[NamedType](#NamedType)

[Name](#Name)

[ListType](#ListType)

\[[Type](#Type)\]

[NonNullType](#NonNullType)

[NamedType](#NamedType)!

[ListType](#ListType)!

GraphQL describes the types of data expected by arguments and variables. Input types may be lists of another input type, or a non-null variant of any other input type.

###### [Semantics](#sec-Type-References.Semantics "link to this subsection")

[Type](#Type)

[Name](#Name)

1.  Let name be the string value of [Name](#Name).
2.  Let type be the type defined in the Schema named name.
3.  type must exist.
4.  Return type.

[Type](#Type)

\[[Type](#Type)\]

1.  Let itemType be the result of evaluating [Type](#Type).
2.  Let type be a List type where itemType is the contained type.
3.  Return type.

[Type](#Type)

[Type](#Type)!

1.  Let nullableType be the result of evaluating [Type](#Type).
2.  Let type be a Non-Null type where nullableType is the contained type.
3.  Return type.

## [2.13](#sec-Language.Directives)Directives

[Directives](#Directives)Const

[Directive](#Directive)Constlist

[Directive](#Directive)Const

@[Name](#Name)[Arguments](#Arguments)Constopt

Directives provide a way to describe alternate runtime execution and type validation behavior in a GraphQL document.

In some cases, you need to provide options to alter GraphQL’s execution behavior in ways field arguments will not suffice, such as conditionally including or skipping a field. Directives provide this by describing additional information to the executor.

Directives have a name along with a list of arguments which may accept values of any input type.

Directives can be used to describe additional information for types, fields, fragments and operations.

As future versions of GraphQL adopt new configurable execution capabilities, they may be exposed via directives. GraphQL services and tools may also provide any additional [custom directive](#custom-directive) beyond those described here.

###### [Directive Order Is Significant](#sec-Language.Directives.Directive-Order-Is-Significant "link to this subsection")

Directives may be provided in a specific syntactic order which may have semantic interpretation.

These two type definitions may have different semantic meaning:

[Example № 34](#example-2a4f9)`type Person   @addExternalFields(source: "profiles")   @excludeField(name: "photo") {   name: String }`

[Example № 35](#example-c1f24)`type Person   @excludeField(name: "photo")   @addExternalFields(source: "profiles") {   name: String }`

## [2.14](#sec-Schema-Coordinates)Schema Coordinates

[SchemaCoordinate](#SchemaCoordinate)

[TypeCoordinate](#TypeCoordinate)

[MemberCoordinate](#MemberCoordinate)

[ArgumentCoordinate](#ArgumentCoordinate)

[DirectiveCoordinate](#DirectiveCoordinate)

[DirectiveArgumentCoordinate](#DirectiveArgumentCoordinate)

[TypeCoordinate](#TypeCoordinate)

[Name](#Name)

[MemberCoordinate](#MemberCoordinate)

[Name](#Name).[Name](#Name)

[ArgumentCoordinate](#ArgumentCoordinate)

[Name](#Name).[Name](#Name)([Name](#Name):)

[DirectiveCoordinate](#DirectiveCoordinate)

@[Name](#Name)

[DirectiveArgumentCoordinate](#DirectiveArgumentCoordinate)

@[Name](#Name)([Name](#Name):)

A [schema coordinate](#schema-coordinate) is a human readable string that uniquely identifies a [schema element](#schema-element) within a GraphQL Schema, intended to be used by tools to reference types, fields, and other [schema element](#schema-element). Examples include: references within documentation to refer to types and fields in a schema, a lookup key that can be used in logging tools to track how often particular fields are queried in production.

A [schema element](#schema-element) can be a named type, a field, an input field, an enum value, a field argument, a directive, or a directive argument defined within a schema (including built-in types and directives).

[Note](#note-62a0f) Meta-fields are not defined within a schema, and thus are not [schema element](#schema-element). By extension, an introspection type is not a [schema element](#schema-element).

The [containing element](#containing-element) of a [schema element](#schema-element) is the schema element with one fewer [Name](#Name) token that syntactically contains it. Specifically:

-   The containing element of an [ArgumentCoordinate](#ArgumentCoordinate) is a [MemberCoordinate](#MemberCoordinate).
-   The containing element of a [MemberCoordinate](#MemberCoordinate) is a [TypeCoordinate](#TypeCoordinate).
-   The containing element of a [DirectiveArgumentCoordinate](#DirectiveArgumentCoordinate) is a [DirectiveCoordinate](#DirectiveCoordinate).
-   [TypeCoordinate](#TypeCoordinate) and [DirectiveCoordinate](#DirectiveCoordinate) have no containing element.

A [schema coordinate](#schema-coordinate) is always unique. Each [schema element](#schema-element) can be referenced by exactly one possible schema coordinate.

A [schema coordinate](#schema-coordinate) may refer to either a defined or built-in [schema element](#schema-element). For example, `String` and `@deprecated(reason:)` are both valid schema coordinates which refer to built-in schema elements.

[Note](#note-86d54) A union member references a type in the schema. A type in the schema is identified by a [TypeCoordinate](#TypeCoordinate). There is no schema coordinate which indicates a union member; this preserves the uniqueness property of a [schema coordinate](#schema-coordinate) as stated above.

###### [Parsing a Schema Coordinate](#sec-Schema-Coordinates.Parsing-a-Schema-Coordinate "link to this subsection")

[SchemaCoordinateToken](#SchemaCoordinateToken)

[SchemaCoordinatePunctuator](#SchemaCoordinatePunctuator)

[Name](#Name)

[SchemaCoordinatePunctuator](#SchemaCoordinatePunctuator)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">(</span></td><td class="spec-rhs"><span class="spec-t">)</span></td><td class="spec-rhs"><span class="spec-t">.</span></td><td class="spec-rhs"><span class="spec-t">:</span></td><td class="spec-rhs"><span class="spec-t">@</span></td></tr></tbody></table>

A [SchemaCoordinate](#SchemaCoordinate) is a self-contained grammar with its own set of lexical tokens, it is not contained within a [Document](#Document). The source text of a SchemaCoordinate must be a sequence of [SourceCharacter](#SourceCharacter).

Unlike other [GraphQL documents](#sec-Language), [SchemaCoordinate](#SchemaCoordinate) must not contain [Whitespace](#Whitespace) or other [Ignored](#Ignored) grammars within the character sequence. This ensures that every schema coordinates has a single unambiguous and unique lexical form.

###### [Resolving a Schema Coordinate](#sec-Schema-Coordinates.Resolving-a-Schema-Coordinate "link to this subsection")

To refer to a [schema element](#schema-element), a [schema coordinate](#schema-coordinate) must be interpreted in the context of a GraphQL schema.

If the [schema element](#schema-element) cannot be found, the resolve function will not yield a value (without raising an error). However, an error will be raised if any non-leaf nodes within a [schema coordinate](#schema-coordinate) cannot be found in the schema.

[Note](#note-adbab) Although it is syntactically possible to describe a meta-field or element of the introspection schema with a schema coordinate (e.g. `Business.__typename` or `__Type.fields(includeDeprecated:)`), they are not [schema element](#schema-element) and therefore resolving such coordinates does not have a defined behavior.

[TypeCoordinate](#TypeCoordinate)

[Name](#Name)

1.  Let typeName be the value of [Name](#Name).
2.  Return the type in schema named typeName if it exists.

[MemberCoordinate](#MemberCoordinate)

[Name](#Name).[Name](#Name)

1.  Let typeName be the value of the first [Name](#Name).
2.  Let type be the type in schema named typeName.
3.  Assert: type must exist, and must be an Enum, Input Object, Object or Interface type.
4.  If type is an Enum type:
    1.  Let enumValueName be the value of the second [Name](#Name).
    2.  Return the enum value of type named enumValueName if it exists.
5.  Otherwise, if type is an Input Object type:
    1.  Let inputFieldName be the value of the second [Name](#Name).
    2.  Return the input field of type named inputFieldName if it exists.
6.  Otherwise:
    1.  Let fieldName be the value of the second [Name](#Name).
    2.  Return the field of type named fieldName if it exists.

[ArgumentCoordinate](#ArgumentCoordinate)

[Name](#Name).[Name](#Name)([Name](#Name):)

1.  Let typeName be the value of the first [Name](#Name).
2.  Let type be the type in schema named typeName.
3.  Assert: type must exist, and be an Object or Interface type.
4.  Let fieldName be the value of the second [Name](#Name).
5.  Let field be the field of type named fieldName.
6.  Assert: field must exist.
7.  Let fieldArgumentName be the value of the third [Name](#Name).
8.  Return the argument of field named fieldArgumentName if it exists.

[DirectiveCoordinate](#DirectiveCoordinate)

@[Name](#Name)

1.  Let directiveName be the value of [Name](#Name).
2.  Return the directive in schema named directiveName if it exists.

[DirectiveArgumentCoordinate](#DirectiveArgumentCoordinate)

@[Name](#Name)([Name](#Name):)

1.  Let directiveName be the value of the first [Name](#Name).
2.  Let directive be the directive in schema named directiveName.
3.  Assert: directive must exist.
4.  Let directiveArgumentName be the value of the second [Name](#Name).
5.  Return the argument of directive named directiveArgumentName if it exists.

###### [Examples](#sec-Schema-Coordinates.Examples "link to this subsection")

| Element Kind | Schema Coordinate | Schema Element |
| --- | --- | --- |
| Named Type | `Business` | `Business` type |
| Field | `Business.name` | `name` field on the `Business` type |
| Input Field | `SearchCriteria.filter` | `filter` input field on the `SearchCriteria` input object type |
| Enum Value | `SearchFilter.OPEN_NOW` | `OPEN_NOW` value of the `SearchFilter` enum |
| Field Argument | `Query.searchBusiness(criteria:)` | `criteria` argument on the `searchBusiness` field on the `Query` type |
| Directive | `@private` | `@private` directive |
| Directive Argument | `@private(scope:)` | `scope` argument on the `@private` directive |

The table above shows an example of a [schema coordinate](#schema-coordinate) for every kind of [schema element](#schema-element) based on the schema below.

```
type Query {
  searchBusiness(criteria: SearchCriteria!): [Business]
}

input SearchCriteria {
  name: String
  filter: SearchFilter
}

enum SearchFilter {
  OPEN_NOW
  DELIVERS_TAKEOUT
  VEGETARIAN_MENU
}

type Business {
  id: ID
  name: String
  email: String @private(scope: "loggedIn")
}

directive @private(scope: String!) on FIELD_DEFINITION
```

# [3](#sec-Type-System)Type System

The GraphQL Type system describes the capabilities of a GraphQL service and is used to determine if a requested operation is valid, to guarantee the type of response results, and describes the input types of variables to determine if values provided at request time are valid.

[TypeSystemDocument](#TypeSystemDocument)

[TypeSystemDefinition](#TypeSystemDefinition)list

[TypeSystemDefinition](#TypeSystemDefinition)

[SchemaDefinition](#SchemaDefinition)

[TypeDefinition](#TypeDefinition)

[DirectiveDefinition](#DirectiveDefinition)

The GraphQL language includes an [IDL](https://en.wikipedia.org/wiki/Interface_description_language) used to describe a GraphQL service’s type system. Tools may use this definition language to provide utilities such as client code generation or service bootstrapping.

GraphQL tools or services which only seek to execute GraphQL requests and not construct a new GraphQL schema may choose not to allow [TypeSystemDefinition](#TypeSystemDefinition). Tools which only seek to produce schema and not execute requests may choose to only allow [TypeSystemDocument](#TypeSystemDocument) and not allow [ExecutableDefinition](#ExecutableDefinition) or [TypeSystemExtension](#TypeSystemExtension) but should provide a descriptive error if present.

[Note](#note-d5e8e) The type system definition language is used throughout the remainder of this specification document when illustrating example type systems.

## [3.1](#sec-Type-System-Extensions)Type System Extensions

[TypeSystemExtensionDocument](#TypeSystemExtensionDocument)

[TypeSystemDefinitionOrExtension](#TypeSystemDefinitionOrExtension)list

[TypeSystemDefinitionOrExtension](#TypeSystemDefinitionOrExtension)

[TypeSystemDefinition](#TypeSystemDefinition)

[TypeSystemExtension](#TypeSystemExtension)

[TypeSystemExtension](#TypeSystemExtension)

[SchemaExtension](#SchemaExtension)

[TypeExtension](#TypeExtension)

[DirectiveExtension](#DirectiveExtension)

Type system extensions are used to represent a GraphQL type system which has been extended from some previous type system. For example, this might be used by a local service to represent data a GraphQL client only accesses locally, or by a GraphQL service which is itself an extension of another GraphQL service.

Tools which only seek to produce and extend schema and not execute requests may choose to only allow [TypeSystemExtensionDocument](#TypeSystemExtensionDocument) and not allow [ExecutableDefinition](#ExecutableDefinition) but should provide a descriptive error if present.

## [3.2](#sec-Type-System-Descriptions)Type System Descriptions

Documentation is a first-class feature of GraphQL type systems, written immediately alongside definitions in a [TypeSystemDocument](#TypeSystemDocument) and made available via introspection.

[Descriptions](#sec-Descriptions) allow GraphQL service designers to easily provide documentation which remains consistent with the capabilities of a GraphQL service. Descriptions should be provided as Markdown (as specified by [CommonMark](https://commonmark.org/)) for every definition in a type system.

GraphQL schema and all other definitions (e.g. types, fields, arguments, etc.) which can be described should provide a [Description](#Description) unless they are considered self descriptive.

As an example, this simple GraphQL schema is well described:

[Example № 36](#example-916f4)``""" A simple GraphQL schema which is well described. """ schema {   query: Query }  """ Root type for all your query operations """ type Query {   """   Translates a string from a given language into a different language.   """   translate(     "The original language that `text` is provided in."     fromLanguage: Language      "The translated language to be returned."     toLanguage: Language      "The text to be translated."     text: String   ): String }  """ The set of languages supported by `translate`. """ enum Language {   "English"   EN    "French"   FR    "Chinese"   CH }``

## [3.3](#sec-Schema)Schema

[SchemaDefinition](#SchemaDefinition)

[Description](#Description)optschema[Directives](#Directives)Constopt{[RootOperationTypeDefinition](#RootOperationTypeDefinition)list}

[RootOperationTypeDefinition](#RootOperationTypeDefinition)

[OperationType](#OperationType):[NamedType](#NamedType)

A GraphQL service’s collective type system capabilities are referred to as that service’s “schema”. A schema is defined in terms of the types and directives it supports as well as the [root operation type](#root-operation-type) for each kind of operation: query, mutation, and subscription; this determines the place in the type system where those operations begin.

A GraphQL schema must itself be internally valid. This section describes the rules for this validation process where relevant.

All types within a GraphQL schema must have unique names. No two provided types may have the same name. No provided type may have a name which conflicts with any built in types (including Scalar and Introspection types).

All directives within a GraphQL schema must have unique names.

All types and directives defined within a schema must not have a name which begins with "\_\_" (two underscores), as this is used exclusively by GraphQL’s introspection system.

### [3.3.1](#sec-Root-Operation-Types)Root Operation Types

A schema defines the initial [root operation type](#root-operation-type) for each kind of operation it supports: query, mutation, and subscription; this determines the place in the type system where those operations begin.

The query [root operation type](#root-operation-type) must be provided and must be an Object type.

The mutation [root operation type](#root-operation-type) is optional; if it is not provided, the service does not support mutations. If it is provided, it must be an Object type.

Similarly, the subscription [root operation type](#root-operation-type) is also optional; if it is not provided, the service does not support subscriptions. If it is provided, it must be an Object type.

The query, mutation, and subscription root types must all be different types if provided.

The fields on the query [root operation type](#root-operation-type) indicate what fields are available at the top level of a GraphQL query operation.

For example, this example operation:

[Example № 37](#example-081b4)`query {   myName }`

is only valid when the query [root operation type](#root-operation-type) has a field named “myName”:

[Example № 38](#example-50137)`type Query {   myName: String }`

Similarly, the following mutation is only valid if the mutation [root operation type](#root-operation-type) has a field named “setName”.

[Example № 39](#example-d1ed8)`mutation {   setName(name: "Zuck") {     newName   } }`

When using the type system definition language, a document must include at most one schema definition.

In this example, a GraphQL schema is defined with both a query and mutation [root operation type](#root-operation-type):

[Example № 40](#example-e2969)`schema {   query: MyQueryRootType   mutation: MyMutationRootType }  type MyQueryRootType {   someField: String }  type MyMutationRootType {   setSomeField(to: String): String }`

###### [Default Root Operation Type Names](#sec-Root-Operation-Types.Default-Root-Operation-Type-Names "link to this subsection")

The [default root type name](#default-root-type-name) for each query, mutation, and subscription [root operation type](#root-operation-type) are "Query", "Mutation", and "Subscription" respectively.

The type system definition language can omit the schema definition when each [root operation type](#root-operation-type) uses its respective [default root type name](#default-root-type-name), no other type uses any [default root type name](#default-root-type-name), and the schema does not have a description.

Likewise, when representing a GraphQL schema using the type system definition language, a schema definition should be omitted if each [root operation type](#root-operation-type) uses its respective [default root type name](#default-root-type-name), no other type uses any [default root type name](#default-root-type-name), and the schema does not have a description.

This example describes a valid complete GraphQL schema, despite not explicitly including a schema definition. The "Query" type is presumed to be the query [root operation type](#root-operation-type) of the schema.

[Example № 41](#example-9d70f)`type Query {   someField: String }`

This example describes a valid GraphQL schema without a mutation [root operation type](#root-operation-type), even though it contains a type named "Mutation". The schema definition must be included, otherwise the "Mutation" type would be incorrectly presumed to be the mutation [root operation type](#root-operation-type) of the schema.

[Example № 42](#example-70bb5)`schema {   query: Query }  type Query {   latestVirus: Virus }  type Virus {   name: String   mutations: [Mutation] }  type Mutation {   name: String }`

This example describes a valid GraphQL schema with a description and both a query and mutation operation type:

[Example № 43](#example-4f684)`""" Example schema """ schema {   query: Query   mutation: Mutation }  type Query {   someField: String }  type Mutation {   someMutation: String }`

### [3.3.2](#sec-Schema-Extension)Schema Extension

[SchemaExtension](#SchemaExtension)

extendschema[Directives](#Directives)Constopt{[RootOperationTypeDefinition](#RootOperationTypeDefinition)list}

extendschema[Directives](#Directives)Const{

Schema extensions are used to represent a schema which has been extended from a previous schema. For example, this might be used by a GraphQL service which adds additional operation types, or additional directives to an existing schema.

[Note](#note-c9cd2) Schema extensions without additional operation type definitions must not be followed by a { (such as a query shorthand) to avoid parsing ambiguity. The same limitation applies to the type definitions and extensions below.

###### [Schema Validation](#sec-Schema-Extension.Schema-Validation "link to this subsection")

Schema extensions have the potential to be invalid if incorrectly defined.

1.  The Schema must already be defined.
2.  Any non-repeatable directives provided must not already apply to the previous Schema.

## [3.4](#sec-Types)Types

[TypeDefinition](#TypeDefinition)

[ScalarTypeDefinition](#ScalarTypeDefinition)

[ObjectTypeDefinition](#ObjectTypeDefinition)

[InterfaceTypeDefinition](#InterfaceTypeDefinition)

[UnionTypeDefinition](#UnionTypeDefinition)

[EnumTypeDefinition](#EnumTypeDefinition)

[InputObjectTypeDefinition](#InputObjectTypeDefinition)

The fundamental unit of any GraphQL Schema is the type. There are six kinds of named type definitions in GraphQL, and two wrapping types.

The most basic type is a `Scalar`. A scalar represents a primitive value, like a string or an integer. Oftentimes, the possible responses for a scalar field are enumerable. GraphQL offers an `Enum` type in those cases, where the type specifies the space of valid responses.

Scalars and Enums form the leaves in response trees; the intermediate levels are `Object` types, which define a set of fields, where each field is another type in the system, allowing the definition of arbitrary type hierarchies.

GraphQL supports two abstract types: interfaces and unions.

An `Interface` defines a list of fields; `Object` types and other Interface types which implement this Interface are guaranteed to implement those fields. Whenever a field claims it will return an Interface type, it will return a valid implementing Object type during execution.

A `Union` defines a list of possible types; similar to interfaces, whenever the type system claims a union will be returned, one of the possible types will be returned.

Finally, oftentimes it is useful to provide complex structs as inputs to GraphQL field arguments or variables; the `Input Object` type allows the schema to define exactly what data is expected.

### [3.4.1](#sec-Wrapping-Types)Wrapping Types

All of the types so far are assumed to be both nullable and singular: e.g. a scalar string returns either null or a singular string.

A GraphQL schema may describe that a field represents a list of another type; the `List` type is provided for this reason, and wraps another type.

Similarly, the `Non-Null` type wraps another type, and denotes that the resulting value will never be null (and that an [execution error](#execution-error) cannot result in a null value).

These two types are referred to as “wrapping types”; non-wrapping types are referred to as “named types”. A wrapping type has an underlying named type, found by continually unwrapping the type until a named type is found.

### [3.4.2](#sec-Input-and-Output-Types)Input and Output Types

Types are used throughout GraphQL to describe both the values accepted as input to arguments and variables as well as the values output by fields. These two uses categorize types as _input types_ and _output types_. Some kinds of types, like Scalar and Enum types, can be used as both input types and output types; other kinds of types can only be used in one or the other. Input Object types can only be used as input types. Object, Interface, and Union types can only be used as output types. Lists and Non-Null types may be used as input types or output types depending on how the wrapped type may be used.

[IsInputType](#IsInputType\(\))(type)

1.  If type is a List type or Non-Null type:
    1.  Let unwrappedType be the unwrapped type of type.
    2.  Return [IsInputType](#IsInputType\(\))(unwrappedType).
2.  If type is a Scalar, Enum, or Input Object type:
    1.  Return true.
3.  Return false.

[IsOutputType](#IsOutputType\(\))(type)

1.  If type is a List type or Non-Null type:
    1.  Let unwrappedType be the unwrapped type of type.
    2.  Return [IsOutputType](#IsOutputType\(\))(unwrappedType).
2.  If type is a Scalar, Object, Interface, Union, or Enum type:
    1.  Return true.
3.  Return false.

### [3.4.3](#sec-Type-Extensions)Type Extensions

[TypeExtension](#TypeExtension)

[ScalarTypeExtension](#ScalarTypeExtension)

[ObjectTypeExtension](#ObjectTypeExtension)

[InterfaceTypeExtension](#InterfaceTypeExtension)

[UnionTypeExtension](#UnionTypeExtension)

[EnumTypeExtension](#EnumTypeExtension)

[InputObjectTypeExtension](#InputObjectTypeExtension)

Type extensions are used to represent a GraphQL type which has been extended from some previous type. For example, this might be used by a local service to represent additional fields a GraphQL client only accesses locally.

## [3.5](#sec-Scalars)Scalars

[ScalarTypeDefinition](#ScalarTypeDefinition)

[Description](#Description)optscalar[Name](#Name)[Directives](#Directives)Constopt

Scalar types represent primitive leaf values in a GraphQL type system. GraphQL responses take the form of a hierarchical tree; the leaves of this tree are typically GraphQL Scalar types (but may also be Enum types or null values).

GraphQL provides a number of built-in scalars which are fully defined in the sections below, however type systems may also add additional custom scalars to introduce additional semantic meaning.

###### [Built-in Scalars](#sec-Scalars.Built-in-Scalars "link to this subsection")

GraphQL specifies a basic set of well-defined Scalar types: Int, Float, String, Boolean, and ID. A GraphQL framework should support all of these types, and a GraphQL service which provides a type by these names must adhere to the behavior described for them in this document. As an example, a service must not include a type called Int and use it to represent 64-bit numbers, internationalization information, or anything other than what is defined in this document.

When returning the set of types from the `__Schema` introspection type, all referenced built-in scalars must be included. If a built-in scalar type is not referenced anywhere in a schema (there is no field, argument, or input field of that type) then it must not be included.

When representing a GraphQL schema using the type system definition language, all built-in scalars must be omitted for brevity.

###### [Custom Scalars](#sec-Scalars.Custom-Scalars "link to this subsection")

GraphQL services may use custom scalar types in addition to the built-in scalars. For example, a GraphQL service could define a scalar called `UUID` which, while serialized as a string, conforms to [RFC 4122](https://tools.ietf.org/html/rfc4122). When querying a field of type `UUID`, you can then rely on the ability to parse the result with an RFC 4122 compliant parser. Another example of a potentially useful custom scalar is `URL`, which serializes as a string, but is guaranteed by the service to be a valid URL.

When defining a custom scalar, GraphQL services should provide a [scalar specification URL](#scalar-specification-url) via the `@specifiedBy` directive or the `specifiedByURL` introspection field. This URL must link to a human-readable specification of the data format, serialization, and coercion rules for the scalar.

For example, a GraphQL service providing a `UUID` scalar may link to RFC 4122, or some custom document defining a reasonable subset of that RFC. If a [scalar specification URL](#scalar-specification-url) is present, systems and tools that are aware of it should conform to its described rules.

[Example № 44](#example-0584a)`scalar UUID @specifiedBy(url: "https://tools.ietf.org/html/rfc4122") scalar URL @specifiedBy(url: "https://tools.ietf.org/html/rfc3986") scalar DateTime   @specifiedBy(url: "https://scalars.graphql.org/andimarek/date-time")`

Custom [scalar specification URL](#scalar-specification-url)s should provide a single, stable format to avoid ambiguity. If the linked specification is in flux, the service should link to a fixed version rather than to a resource which might change.

[Note](#note-84d64) Some community-maintained custom scalar specifications are hosted at [scalars.graphql.org](https://scalars.graphql.org/).

Custom [scalar specification URL](#scalar-specification-url)s should not be changed once defined. Doing so would likely disrupt tooling or could introduce breaking changes within the linked specification’s contents.

Built-in scalar types must not provide a [scalar specification URL](#scalar-specification-url) as they are specified by this document.

[Note](#note-02b6f) Custom scalars should also summarize the specified format and provide examples in their description; see the GraphQL scalars [implementation guide](https://scalars.graphql.org/implementation-guide) for more guidance.

###### [Result Coercion and Serialization](#sec-Scalars.Result-Coercion-and-Serialization "link to this subsection")

A GraphQL service, when preparing a field of a given scalar type, must uphold the contract the scalar type describes, either by coercing the value or producing an [execution error](#execution-error) if a value cannot be coerced or if coercion may result in data loss.

A GraphQL service may decide to allow coercing different internal types to the expected return type. For example when coercing a field of type Int a boolean true value may produce 1 or a string value "123" may be parsed as base-10 123. However if internal type coercion cannot be reasonably performed without losing information, then it must raise an [execution error](#execution-error).

Since this coercion behavior is not observable to clients of the GraphQL service, the precise rules of coercion are left to the implementation. The only requirement is that the service must yield values which adhere to the expected Scalar type.

GraphQL scalars are serialized according to the serialization format being used. There may be a most appropriate serialized primitive for each given scalar type, and the service should produce each primitive where appropriate.

See [Serialization Format](#sec-Serialization-Format) for more detailed information on the serialization of scalars in common JSON and other formats.

###### [Input Coercion](#sec-Scalars.Input-Coercion "link to this subsection")

If a GraphQL service expects a scalar type as input to an argument, coercion is observable and the rules must be well defined. If an input value does not match a coercion rule, a [request error](#request-error) must be raised (input values are validated before execution begins).

GraphQL has different constant literals to represent integer and floating-point input values, and coercion rules may apply differently depending on which type of input value is encountered. GraphQL may be parameterized by variables, the values of which are often serialized when sent over a transport like HTTP. Since some common serializations (e.g. JSON) do not discriminate between integer and floating-point values, they are interpreted as an integer input value if they have an empty fractional part (e.g. `1.0`) and otherwise as floating-point input value.

For all types below, with the exception of Non-Null, if the explicit value null is provided, then the result of input coercion is null.

### [3.5.1](#sec-Int)Int

The Int scalar type represents a signed 32-bit numeric non-fractional value. Response formats that support a 32-bit integer or a number type should use that type to represent this scalar.

###### [Result Coercion](#sec-Int.Result-Coercion "link to this subsection")

Fields returning the type Int expect to encounter 32-bit integer internal values.

GraphQL services may coerce non-integer internal values to integers when reasonable without losing information, otherwise they must raise an [execution error](#execution-error). Examples of this may include returning `1` for the floating-point number `1.0`, or returning `123` for the string `"123"`. In scenarios where coercion may lose data, raising an execution error is more appropriate. For example, a floating-point number `1.2` should raise an execution error instead of being truncated to `1`.

If the integer internal value represents a value less than -231 or greater than or equal to 231, an [execution error](#execution-error) should be raised.

###### [Input Coercion](#sec-Int.Input-Coercion "link to this subsection")

When expected as an input type, only integer input values are accepted. All other input values, including strings with numeric content, must raise a request error indicating an incorrect type. If the integer input value represents a value less than -231 or greater than or equal to 231, a [request error](#request-error) should be raised.

[Note](#note-0770a) Numeric integer values larger than 32-bit should either use String or a custom-defined Scalar type, as not all platforms and transports support encoding integer numbers larger than 32-bit.

### [3.5.2](#sec-Float)Float

The Float scalar type represents signed double-precision finite values as specified by [IEEE 754](https://en.wikipedia.org/wiki/IEEE_floating_point). Response formats that support an appropriate double-precision number type should use that type to represent this scalar.

###### [Result Coercion](#sec-Float.Result-Coercion "link to this subsection")

Fields returning the type Float expect to encounter double-precision floating-point internal values.

GraphQL services may coerce non-floating-point internal values to Float when reasonable without losing information, otherwise they must raise an [execution error](#execution-error). Examples of this may include returning `1.0` for the integer number `1`, or `123.0` for the string `"123"`.

Non-finite floating-point internal values (NaN and Infinity) cannot be coerced to Float and must raise an [execution error](#execution-error).

###### [Input Coercion](#sec-Float.Input-Coercion "link to this subsection")

When expected as an input type, both integer and float input values are accepted. Integer input values are coerced to Float by adding an empty fractional part, for example `1.0` for the integer input value `1`. All other input values, including strings with numeric content, must raise a [request error](#request-error) indicating an incorrect type. If the input value otherwise represents a value not representable by finite IEEE 754 (e.g. NaN, Infinity, or a value outside the available precision), a [request error](#request-error) must be raised.

### [3.5.3](#sec-String)String

The String scalar type represents textual data, represented as a sequence of Unicode code points. The String type is most often used by GraphQL to represent free-form human-readable text. How the String is encoded internally (for example UTF-8) is left to the service implementation. All response serialization formats must support a string representation (for example, JSON Unicode strings), and that representation must be used to serialize this type.

###### [Result Coercion](#sec-String.Result-Coercion "link to this subsection")

Fields returning the type String expect to encounter Unicode string values.

GraphQL services may coerce non-string raw values to String when reasonable without losing information, otherwise they must raise an [execution error](#execution-error). Examples of this may include returning the string `"true"` for a boolean true value, or the string `"1"` for the integer `1`.

###### [Input Coercion](#sec-String.Input-Coercion "link to this subsection")

When expected as an input type, only valid Unicode string input values are accepted. All other input values must raise a [request error](#request-error) indicating an incorrect type.

### [3.5.4](#sec-Boolean)Boolean

The Boolean scalar type represents `true` or `false`. Response formats should use a built-in boolean type if supported; otherwise, they should use their representation of the integers `1` and `0`.

###### [Result Coercion](#sec-Boolean.Result-Coercion "link to this subsection")

Fields returning the type Boolean expect to encounter boolean internal values.

GraphQL services may coerce non-boolean raw values to Boolean when reasonable without losing information, otherwise they must raise an [execution error](#execution-error). Examples of this may include returning `true` for non-zero numbers.

###### [Input Coercion](#sec-Boolean.Input-Coercion "link to this subsection")

When expected as an input type, only boolean input values are accepted. All other input values must raise a [request error](#request-error) indicating an incorrect type.

### [3.5.5](#sec-ID)ID

The ID scalar type represents a unique identifier, often used to refetch an object or as the key for a cache. The ID type is serialized in the same way as a String; however, it is not intended to be human-readable. While it is often numeric, it must always serialize as a String.

###### [Result Coercion](#sec-ID.Result-Coercion "link to this subsection")

GraphQL is agnostic to ID format, and serializes to string to ensure consistency across many formats ID could represent, from small auto-increment numbers, to large 128-bit random numbers, to base64 encoded values, or string values of a format like [GUID](https://en.wikipedia.org/wiki/Globally_unique_identifier).

GraphQL services should coerce as appropriate given the ID formats they expect. When coercion is not possible they must raise an [execution error](#execution-error).

###### [Input Coercion](#sec-ID.Input-Coercion "link to this subsection")

When expected as an input type, any string (such as `"4"`) or integer (such as `4` or `-4`) input value should be coerced to ID as appropriate for the ID formats a given GraphQL service expects. Any other input value, including float input values (such as `4.0`), must raise a [request error](#request-error) indicating an incorrect type.

### [3.5.6](#sec-Scalar-Extensions)Scalar Extensions

[ScalarTypeExtension](#ScalarTypeExtension)

extendscalar[Name](#Name)[Directives](#Directives)Const

Scalar type extensions are used to represent a scalar type which has been extended from some previous scalar type. For example, this might be used by a GraphQL tool or service which adds directives to an existing scalar.

###### [Type Validation](#sec-Scalar-Extensions.Type-Validation "link to this subsection")

Scalar type extensions have the potential to be invalid if incorrectly defined.

1.  The named type must already be defined and must be a Scalar type.
2.  Any non-repeatable directives provided must not already apply to the previous Scalar type.

## [3.6](#sec-Objects)Objects

[ObjectTypeDefinition](#ObjectTypeDefinition)

[Description](#Description)opttype[Name](#Name)[ImplementsInterfaces](#ImplementsInterfaces)opt[Directives](#Directives)Constopt[FieldsDefinition](#FieldsDefinition)

[Description](#Description)opttype[Name](#Name)[ImplementsInterfaces](#ImplementsInterfaces)opt[Directives](#Directives)Constopt{

[ImplementsInterfaces](#ImplementsInterfaces)

[ImplementsInterfaces](#ImplementsInterfaces)&[NamedType](#NamedType)

implements&opt[NamedType](#NamedType)

[FieldsDefinition](#FieldsDefinition)

{[FieldDefinition](#FieldDefinition)list}

[FieldDefinition](#FieldDefinition)

[Description](#Description)opt[Name](#Name)[ArgumentsDefinition](#ArgumentsDefinition)opt:[Type](#Type)[Directives](#Directives)Constopt

GraphQL operations are hierarchical and composed, describing a tree of information. While Scalar types describe the leaf values of these hierarchical operations, Objects describe the intermediate levels.

GraphQL Objects represent a list of named fields, each of which yields a value of a specific type. Object values should be serialized as ordered maps, where the selected field names (or aliases) are the keys and the result of evaluating the field is the value, ordered by the order in which they appear in the [selection set](#selection-set).

All fields defined within an Object type must not have a name which begins with "\_\_" (two underscores), as this is used exclusively by GraphQL’s introspection system.

For example, a type `Person` could be described as:

[Example № 45](#example-ccb01)`type Person {   name: String   age: Int   picture: Url }`

Where `name` is a field that will yield a String value, and `age` is a field that will yield an Int value, and `picture` is a field that will yield a `Url` value.

A query of an object value must select at least one field. This selection of fields will yield an ordered map containing exactly the subset of the object queried, which should be represented in the order in which they were queried. Only fields that are declared on the object type may validly be queried on that object.

For example, selecting all the fields of `Person`:

[Example № 46](#example-1743a)`{   name   age   picture }`

Would yield the object:

[Example № 47](#example-71184)`{   "name": "Mark Zuckerberg",   "age": 30,   "picture": "http://some.cdn/picture.jpg" }`

While selecting a subset of fields:

[Example № 48](#example-3964f)`{   age   name }`

Must only yield exactly that subset:

[Example № 49](#example-600a0)`{   "age": 30,   "name": "Mark Zuckerberg" }`

A field of an Object type may be a Scalar, Enum, another Object type, an Interface, or a Union. Additionally, it may be any wrapping type whose underlying base type is one of those five.

For example, the `Person` type might include a `relationship`:

[Example № 50](#example-49198)`type Person {   name: String   age: Int   picture: Url   relationship: Person }`

Valid operations must supply a [selection set](#selection-set) for every field whose return type is an object type, so this operation is not valid:

[Counter Example № 51](#example-729a1)`{   name   relationship }`

However, this example is valid:

[Example № 52](#example-bb999)`{   name   relationship {     name   } }`

And will yield the subset of each object type queried:

[Example № 53](#example-352cc)`{   "name": "Mark Zuckerberg",   "relationship": {     "name": "Priscilla Chan"   } }`

###### [Field Ordering](#sec-Objects.Field-Ordering "link to this subsection")

When querying an Object, the resulting mapping of fields are conceptually ordered in the same order in which they were encountered during execution, excluding fragments for which the type does not apply and fields or fragments that are skipped via `@skip` or `@include` directives. This ordering is correctly produced when using the [CollectFields](#CollectFields\(\))() algorithm.

Response serialization formats capable of representing ordered maps should maintain this ordering. Serialization formats which can only represent unordered maps (such as JSON) should retain this order textually. That is, if two fields `{foo, bar}` were queried in that order, the resulting JSON serialization should contain `{"foo": "...", "bar": "..."}` in the same order.

Producing a response where fields are represented in the same order in which they appear in the request improves human readability during debugging and enables more efficient parsing of responses if the order of properties can be anticipated.

If a fragment is spread before other fields, the fields that fragment specifies occur in the response before the following fields.

[Example № 54](#example-7924b)`{   foo   ...Frag   qux }  fragment Frag on Query {   bar   baz }`

Produces the ordered result:

[Example № 55](#example-1455b)`{   "foo": 1,   "bar": 2,   "baz": 3,   "qux": 4 }`

If a field is queried multiple times in a selection, it is ordered by the first time it is encountered. However fragments for which the type does not apply do not affect ordering.

[Example № 56](#example-70ded)`{   foo   ...Ignored   ...Matching   bar }  fragment Ignored on UnknownType {   qux   baz }  fragment Matching on Query {   bar   qux   foo }`

Produces the ordered result:

[Example № 57](#example-2e0e9)`{   "foo": 1,   "bar": 2,   "qux": 3 }`

Also, if directives result in fields being excluded, they are not considered in the ordering of fields.

[Example № 58](#example-50762)`{   foo @skip(if: true)   bar   foo }`

Produces the ordered result:

[Example № 59](#example-dd904)`{   "bar": 1,   "foo": 2 }`

###### [Result Coercion](#sec-Objects.Result-Coercion "link to this subsection")

Determining the result of coercing an object is the heart of the GraphQL executor, see [Value Completion](#sec-Value-Completion).

###### [Input Coercion](#sec-Objects.Input-Coercion "link to this subsection")

Objects are never valid inputs.

###### [Type Validation](#sec-Objects.Type-Validation "link to this subsection")

Object types have the potential to be invalid if incorrectly defined. This set of rules must be adhered to by every Object type in a GraphQL schema.

1.  An Object type must define one or more fields.
2.  For each field of an Object type:
    1.  The field must have a unique name within that Object type; no two fields may share the same name.
    2.  The field must not have a name which begins with the characters "\_\_" (two underscores).
    3.  The field must return a type where [IsOutputType](#IsOutputType\(\))(fieldType) returns true.
    4.  For each argument of the field:
        1.  The argument must not have a name which begins with the characters "\_\_" (two underscores).
        2.  The argument must have a unique name within that field; no two arguments may share the same name.
        3.  The argument must accept a type where [IsInputType](#IsInputType\(\))(argumentType) returns true.
        4.  If argument type is Non-Null and a default value is not defined:
            1.  The `@deprecated` directive must not be applied to this argument.
        5.  If the argument has a default value it must be compatible with argumentType as per the coercion rules for that type.
3.  An object type may declare that it implements one or more unique interfaces.
4.  An object type must be a super-set of all interfaces it implements:
    1.  Let this object type be objectType.
    2.  For each interface declared implemented as interfaceType, [IsValidImplementation](#IsValidImplementation\(\))(objectType, interfaceType) must be true.

[IsValidImplementation](#IsValidImplementation\(\))(type, implementedType)

1.  If implementedType declares it implements any interfaces, type must also declare it implements those interfaces.
2.  type must include a field of the same name for every field defined in implementedType.
    1.  Let field be that named field on type.
    2.  Let implementedField be that named field on implementedType.
    3.  field must include an argument of the same name for every argument defined in implementedField.
        1.  That named argument on field must accept the same type (invariant) as that named argument on implementedField.
    4.  field may include additional arguments not defined in implementedField, but any additional argument must not be required, e.g. must not be of a non-nullable type.
    5.  field must return a type which is equal to or a sub-type of (covariant) the return type of implementedField field’s return type:
        1.  Let fieldType be the return type of field.
        2.  Let implementedFieldType be the return type of implementedField.
        3.  [IsValidImplementationFieldType](#IsValidImplementationFieldType\(\))(fieldType, implementedFieldType) must be true.
    6.  If field is deprecated then implementedField must also be deprecated.

[IsValidImplementationFieldType](#IsValidImplementationFieldType\(\))(fieldType, implementedFieldType)

1.  If fieldType is a Non-Null type:
    1.  Let nullableType be the unwrapped nullable type of fieldType.
    2.  Let implementedNullableType be the unwrapped nullable type of implementedFieldType if it is a Non-Null type, otherwise let it be implementedFieldType directly.
    3.  Return [IsValidImplementationFieldType](#IsValidImplementationFieldType\(\))(nullableType, implementedNullableType).
2.  If fieldType is a List type and implementedFieldType is also a List type:
    1.  Let itemType be the unwrapped item type of fieldType.
    2.  Let implementedItemType be the unwrapped item type of implementedFieldType.
    3.  Return [IsValidImplementationFieldType](#IsValidImplementationFieldType\(\))(itemType, implementedItemType).
3.  Return [IsSubType](#IsSubType\(\))(fieldType, implementedFieldType).

[IsSubType](#IsSubType\(\))(possibleSubType, superType)

1.  If possibleSubType is the same type as superType then return true.
2.  If possibleSubType is an Object type and superType is a Union type and possibleSubType is a possible type of superType then return true.
3.  If possibleSubType is an Object or Interface type and superType is an Interface type and possibleSubType declares it implements superType then return true.
4.  Otherwise return false.

### [3.6.1](#sec-Field-Arguments)Field Arguments

[ArgumentsDefinition](#ArgumentsDefinition)

([InputValueDefinition](#InputValueDefinition)list)

[InputValueDefinition](#InputValueDefinition)

[Description](#Description)opt[Name](#Name):[Type](#Type)[DefaultValue](#DefaultValue)opt[Directives](#Directives)Constopt

Object fields are conceptually functions which yield values. Occasionally object fields can accept arguments to further specify the return value. Object field arguments are defined as a list of all possible argument names and their expected input types.

All arguments defined within a field must not have a name which begins with "\_\_" (two underscores), as this is used exclusively by GraphQL’s introspection system.

For example, a `Person` type with a `picture` field could accept an argument to determine what size of an image to return.

[Example № 60](#example-fb0d5)`type Person {   name: String   picture(size: Int): Url }`

Operations can optionally specify arguments to their fields to provide these arguments.

This example operation:

[Example № 61](#example-81f19)`{   name   picture(size: 600) }`

May return the result:

[Example № 62](#example-31f7a)`{   "name": "Mark Zuckerberg",   "picture": "http://some.cdn/picture_600.jpg" }`

The type of an object field argument must be an input type (any type except an Object, Interface, or Union type).

### [3.6.2](#sec-Field-Deprecation)Field Deprecation

Fields in an object may be marked as deprecated as deemed necessary by the application. It is still legal to include these fields in a [selection set](#selection-set) (to ensure existing clients are not broken by the change), but the fields should be appropriately treated in documentation and tooling.

When using the type system definition language, `@deprecated` directives are used to indicate that a field is deprecated:

[Example № 63](#example-013ef)`type ExampleType {   oldField: String @deprecated }`

### [3.6.3](#sec-Object-Extensions)Object Extensions

[ObjectTypeExtension](#ObjectTypeExtension)

extendtype[Name](#Name)[ImplementsInterfaces](#ImplementsInterfaces)opt[Directives](#Directives)Constopt[FieldsDefinition](#FieldsDefinition)

extendtype[Name](#Name)[ImplementsInterfaces](#ImplementsInterfaces)opt[Directives](#Directives)Const{

extendtype[Name](#Name)[ImplementsInterfaces](#ImplementsInterfaces){

Object type extensions are used to represent a type which has been extended from some previous type. For example, this might be used to represent local data, or by a GraphQL service which is itself an extension of another GraphQL service.

In this example, a local data field is added to a `Story` type:

[Example № 64](#example-8bda7)`extend type Story {   isHiddenLocally: Boolean }`

Object type extensions may choose not to add additional fields, instead only adding interfaces or directives.

In this example, a directive is added to a `User` type without adding fields:

[Example № 65](#example-605bd)`extend type User @addedDirective`

###### [Type Validation](#sec-Object-Extensions.Type-Validation "link to this subsection")

Object type extensions have the potential to be invalid if incorrectly defined.

1.  The named type must already be defined and must be an Object type.
2.  The fields of an Object type extension must have unique names; no two fields may share the same name.
3.  Any fields of an Object type extension must not be already defined on the previous Object type.
4.  Any non-repeatable directives provided must not already apply to the previous Object type.
5.  Any interfaces provided must not be already implemented by the previous Object type.
6.  The resulting extended object type must be a super-set of all interfaces it implements.

## [3.7](#sec-Interfaces)Interfaces

[InterfaceTypeDefinition](#InterfaceTypeDefinition)

[Description](#Description)optinterface[Name](#Name)[ImplementsInterfaces](#ImplementsInterfaces)opt[Directives](#Directives)Constopt[FieldsDefinition](#FieldsDefinition)

[Description](#Description)optinterface[Name](#Name)[ImplementsInterfaces](#ImplementsInterfaces)opt[Directives](#Directives)Constopt{

GraphQL interfaces represent a list of named fields and their arguments. GraphQL objects and interfaces can then implement these interfaces which requires the implementing type to define all fields defined by those interfaces.

Fields on a GraphQL interface have the same rules as fields on a GraphQL object; their type can be Scalar, Object, Enum, Interface, or Union, or any wrapping type whose base type is one of those five.

For example, an interface `NamedEntity` may describe a required field and types such as `Person` or `Business` may then implement this interface to guarantee this field will always exist.

Types may also implement multiple interfaces. For example, `Business` implements both the `NamedEntity` and `ValuedEntity` interfaces in the example below.

[Example № 66](#example-ab5e5)`interface NamedEntity {   name: String }  interface ValuedEntity {   value: Int }  type Person implements NamedEntity {   name: String   age: Int }  type Business implements NamedEntity & ValuedEntity {   name: String   value: Int   employeeCount: Int }`

Fields which yield an interface are useful when one of many Object types are expected, but some fields should be guaranteed.

To continue the example, a `Contact` might refer to `NamedEntity`.

[Example № 67](#example-00227)`type Contact {   entity: NamedEntity   phoneNumber: String   address: String }`

This allows us to write a [selection set](#selection-set) for a `Contact` that can select the common fields.

[Example № 68](#example-bc3fd)`{   entity {     name   }   phoneNumber }`

When selecting fields on an interface type, only those fields declared on the interface may be queried. In the above example, `entity` returns a `NamedEntity`, and `name` is defined on `NamedEntity`, so it is valid. However, the following would not be a valid selection set against `Contact`:

[Counter Example № 69](#example-0c812)`{   entity {     name     age   }   phoneNumber }`

because `entity` refers to a `NamedEntity`, and `age` is not defined on that interface. Querying for `age` is only valid when the result of `entity` is a `Person`; this can be expressed using a fragment or an inline fragment:

[Example № 70](#example-47576)`{   entity {     name     ... on Person {       age     }   }   phoneNumber }`

###### [Interfaces Implementing Interfaces](#sec-Interfaces.Interfaces-Implementing-Interfaces "link to this subsection")

When defining an interface that implements another interface, the implementing interface must define each field that is specified by the implemented interface. For example, the interface Resource must define the field id to implement the Node interface:

[Example № 71](#example-ba6cb)`interface Node {   id: ID! }  interface Resource implements Node {   id: ID!   url: String }`

Transitively implemented interfaces (interfaces implemented by the interface that is being implemented) must also be defined on an implementing type or interface. For example, `Image` cannot implement `Resource` without also implementing `Node`:

[Example № 72](#example-4c7ed)`interface Node {   id: ID! }  interface Resource implements Node {   id: ID!   url: String }  interface Image implements Resource & Node {   id: ID!   url: String   thumbnail: String }`

Interface definitions must not contain cyclic references nor implement themselves. This example is invalid because `Node` and `Named` implement themselves and each other:

[Counter Example № 73](#example-9b199)`interface Node implements Named & Node {   id: ID!   name: String }  interface Named implements Node & Named {   id: ID!   name: String }`

###### [Result Coercion](#sec-Interfaces.Result-Coercion "link to this subsection")

The interface type should have some way of determining which object a given result corresponds to. Once it has done so, the result coercion of the interface is the same as the result coercion of the object.

###### [Input Coercion](#sec-Interfaces.Input-Coercion "link to this subsection")

Interfaces are never valid inputs.

###### [Type Validation](#sec-Interfaces.Type-Validation "link to this subsection")

Interface types have the potential to be invalid if incorrectly defined.

1.  An Interface type must define one or more fields.
2.  For each field of an Interface type:
    1.  The field must have a unique name within that Interface type; no two fields may share the same name.
    2.  The field must not have a name which begins with the characters "\_\_" (two underscores).
    3.  The field must return a type where [IsOutputType](#IsOutputType\(\))(fieldType) returns true.
    4.  For each argument of the field:
        1.  The argument must not have a name which begins with the characters "\_\_" (two underscores).
        2.  The argument must have a unique name within that field; no two arguments may share the same name.
        3.  The argument must accept a type where [IsInputType](#IsInputType\(\))(argumentType) returns true.
3.  An interface type may declare that it implements one or more unique interfaces, but may not implement itself.
4.  An interface type must be a super-set of all interfaces it implements:
    1.  Let this interface type be implementingType.
    2.  For each interface declared implemented as implementedType, [IsValidImplementation](#IsValidImplementation\(\))(implementingType, implementedType) must be true.

### [3.7.1](#sec-Interface-Extensions)Interface Extensions

[InterfaceTypeExtension](#InterfaceTypeExtension)

extendinterface[Name](#Name)[ImplementsInterfaces](#ImplementsInterfaces)opt[Directives](#Directives)Constopt[FieldsDefinition](#FieldsDefinition)

extendinterface[Name](#Name)[ImplementsInterfaces](#ImplementsInterfaces)opt[Directives](#Directives)Const{

extendinterface[Name](#Name)[ImplementsInterfaces](#ImplementsInterfaces){

Interface type extensions are used to represent an interface which has been extended from some previous interface. For example, this might be used to represent common local data on many types, or by a GraphQL service which is itself an extension of another GraphQL service.

In this example, an extended data field is added to a `NamedEntity` type along with the types which implement it:

[Example № 74](#example-9d45f)`extend interface NamedEntity {   nickname: String }  extend type Person {   nickname: String }  extend type Business {   nickname: String }`

Interface type extensions may choose not to add additional fields, instead only adding directives.

In this example, a directive is added to a `NamedEntity` type without adding fields:

[Example № 75](#example-02d28)`extend interface NamedEntity @addedDirective`

###### [Type Validation](#sec-Interface-Extensions.Type-Validation "link to this subsection")

Interface type extensions have the potential to be invalid if incorrectly defined.

1.  The named type must already be defined and must be an Interface type.
2.  The fields of an Interface type extension must have unique names; no two fields may share the same name.
3.  Any fields of an Interface type extension must not be already defined on the previous Interface type.
4.  Any Object or Interface type which implemented the previous Interface type must also be a super-set of the fields of the Interface type extension (which may be due to Object type extension).
5.  Any non-repeatable directives provided must not already apply to the previous Interface type.
6.  The resulting extended Interface type must be a super-set of all Interfaces it implements.

## [3.8](#sec-Unions)Unions

[UnionTypeDefinition](#UnionTypeDefinition)

[Description](#Description)optunion[Name](#Name)[Directives](#Directives)Constopt[UnionMemberTypes](#UnionMemberTypes)opt

[UnionMemberTypes](#UnionMemberTypes)

[UnionMemberTypes](#UnionMemberTypes)|[NamedType](#NamedType)

\=|opt[NamedType](#NamedType)

GraphQL Unions represent an object that could be one of a list of GraphQL Object types, but provides for no guaranteed fields between those types. They also differ from interfaces in that Object types declare what interfaces they implement, but are not aware of what unions contain them.

With interfaces and objects, only those fields defined on the type can be queried directly; to query other fields on an interface, typed fragments must be used. This is the same as for unions, but unions do not define any fields, so **no** fields may be queried on this type without the use of type refining fragments or inline fragments (with the exception of the meta-field \_\_typename).

For example, we might define the following types:

[Example № 76](#example-255de)`union SearchResult = Photo | Person  type Person {   name: String   age: Int }  type Photo {   height: Int   width: Int }  type SearchQuery {   firstSearchResult: SearchResult }`

In this example, a query operation wants the name if the result was a Person, and the height if it was a photo. However because a union itself defines no fields, this could be ambiguous and is invalid.

[Counter Example № 77](#example-38dc1)`{   firstSearchResult {     name     height   } }`

A valid operation includes typed fragments (in this example, inline fragments):

[Example № 78](#example-f8163)`{   firstSearchResult {     ... on Person {       name     }     ... on Photo {       height     }   } }`

Union members may be defined with an optional leading `|` character to aid formatting when representing a longer list of possible types:

[Example № 79](#example-0fbc6)`union SearchResult =   | Photo   | Person`

###### [Result Coercion](#sec-Unions.Result-Coercion "link to this subsection")

The union type should have some way of determining which object a given result corresponds to. Once it has done so, the result coercion of the union is the same as the result coercion of the object.

###### [Input Coercion](#sec-Unions.Input-Coercion "link to this subsection")

Unions are never valid inputs.

###### [Type Validation](#sec-Unions.Type-Validation "link to this subsection")

Union types have the potential to be invalid if incorrectly defined.

1.  A Union type must include one or more unique member types.
2.  The member types of a Union type must all be Object base types; Scalar, Interface and Union types must not be member types of a Union. Similarly, wrapping types must not be member types of a Union.

### [3.8.1](#sec-Union-Extensions)Union Extensions

[UnionTypeExtension](#UnionTypeExtension)

extendunion[Name](#Name)[Directives](#Directives)Constopt[UnionMemberTypes](#UnionMemberTypes)

extendunion[Name](#Name)[Directives](#Directives)Const

Union type extensions are used to represent a union type which has been extended from some previous union type. For example, this might be used to represent additional local data, or by a GraphQL service which is itself an extension of another GraphQL service.

###### [Type Validation](#sec-Union-Extensions.Type-Validation "link to this subsection")

Union type extensions have the potential to be invalid if incorrectly defined.

1.  The named type must already be defined and must be a Union type.
2.  The member types of a Union type extension must all be Object base types; Scalar, Interface and Union types must not be member types of a Union. Similarly, wrapping types must not be member types of a Union.
3.  All member types of a Union type extension must be unique.
4.  All member types of a Union type extension must not already be a member of the previous Union type.
5.  Any non-repeatable directives provided must not already apply to the previous Union type.

## [3.9](#sec-Enums)Enums

[EnumTypeDefinition](#EnumTypeDefinition)

[Description](#Description)optenum[Name](#Name)[Directives](#Directives)Constopt[EnumValuesDefinition](#EnumValuesDefinition)

[Description](#Description)optenum[Name](#Name)[Directives](#Directives)Constopt{

[EnumValuesDefinition](#EnumValuesDefinition)

{[EnumValueDefinition](#EnumValueDefinition)list}

[EnumValueDefinition](#EnumValueDefinition)

[Description](#Description)opt[EnumValue](#EnumValue)[Directives](#Directives)Constopt

GraphQL Enum types, like Scalar types, also represent leaf values in a GraphQL type system. However Enum types describe the set of possible values.

Enums are not references for a numeric value, but are unique values in their own right. They may serialize as a string: the name of the represented value.

In this example, an Enum type called `Direction` is defined:

[Example № 80](#example-36555)`enum Direction {   NORTH   EAST   SOUTH   WEST }`

###### [Result Coercion](#sec-Enums.Result-Coercion "link to this subsection")

GraphQL services must return one of the defined set of possible values. If a reasonable coercion is not possible they must raise an [execution error](#execution-error).

###### [Input Coercion](#sec-Enums.Input-Coercion "link to this subsection")

GraphQL has a constant literal to represent enum input values. GraphQL string literals must not be accepted as an enum input and instead raise a request error.

Variable transport serializations which have a different representation for non-string symbolic values (for example, [EDN](https://github.com/edn-format/edn)) should only allow such values as enum input values. Otherwise, for most transport serializations that do not, strings may be interpreted as the enum input value with the same name.

###### [Type Validation](#sec-Enums.Type-Validation "link to this subsection")

Enum types have the potential to be invalid if incorrectly defined.

1.  An Enum type must define one or more unique enum values.

### [3.9.1](#sec-Enum-Extensions)Enum Extensions

[EnumTypeExtension](#EnumTypeExtension)

extendenum[Name](#Name)[Directives](#Directives)Constopt[EnumValuesDefinition](#EnumValuesDefinition)

extendenum[Name](#Name)[Directives](#Directives)Const{

Enum type extensions are used to represent an enum type which has been extended from some previous enum type. For example, this might be used to represent additional local data, or by a GraphQL service which is itself an extension of another GraphQL service.

###### [Type Validation](#sec-Enum-Extensions.Type-Validation "link to this subsection")

Enum type extensions have the potential to be invalid if incorrectly defined.

1.  The named type must already be defined and must be an Enum type.
2.  All values of an Enum type extension must be unique.
3.  All values of an Enum type extension must not already be a value of the previous Enum.
4.  Any non-repeatable directives provided must not already apply to the previous Enum type.

## [3.10](#sec-Input-Objects)Input Objects

[InputObjectTypeDefinition](#InputObjectTypeDefinition)

[Description](#Description)optinput[Name](#Name)[Directives](#Directives)Constopt[InputFieldsDefinition](#InputFieldsDefinition)

[Description](#Description)optinput[Name](#Name)[Directives](#Directives)Constopt{

[InputFieldsDefinition](#InputFieldsDefinition)

{[InputValueDefinition](#InputValueDefinition)list}

Fields may accept arguments to configure their behavior. These inputs are often scalars or enums, but they sometimes need to represent more complex values.

A GraphQL [Input Object](#input-object) defines a set of input fields; the input fields are scalars, enums, other input objects, or any wrapping type whose underlying base type is one of those three. This allows arguments to accept arbitrarily complex structs.

In this example, an Input Object called `Point2D` describes `x` and `y` inputs:

[Example № 81](#example-45e4e)`input Point2D {   x: Float   y: Float }`

[Note](#note-7a6d2) The GraphQL Object type ([ObjectTypeDefinition](#ObjectTypeDefinition)) defined above is inappropriate for re-use here, because Object types can contain fields that define arguments or contain references to interfaces and unions, neither of which is appropriate for use as an input argument. For this reason, input objects have a separate type in the system.

###### [Circular References](#sec-Input-Objects.Circular-References "link to this subsection")

Input Objects are allowed to reference other Input Objects as field types. A circular reference occurs when an Input Object references itself either directly or through referenced Input Objects.

Circular references are generally allowed, however they may not be defined as an unbroken chain of Non-Null singular fields. Such Input Objects are invalid because there is no way to provide a legal value for them.

This example of a circularly-referenced input type is valid as the field `self` may be omitted or the value null.

[Example № 82](#example-e9cda)`input Example {   self: Example   value: String }`

This example is also valid as the field `self` may be an empty List.

[Example № 83](#example-2f832)`input Example {   self: [Example!]!   value: String }`

This example of a circularly-referenced input type is invalid as the field `self` cannot be provided a finite value.

[Counter Example № 84](#example-f2b84)`input Example {   self: Example!   value: String }`

This example is also invalid, as there is a non-null singular circular reference via the `First.second` and `Second.first` fields.

[Counter Example № 85](#example-31c9f)`input First {   second: Second!   value: String }  input Second {   first: First!   value: String }`

###### [Result Coercion](#sec-Input-Objects.Result-Coercion "link to this subsection")

An input object is never a valid result. Input Object types cannot be the return type of an Object or Interface field.

###### [Input Coercion](#sec-Input-Objects.Input-Coercion "link to this subsection")

The value for an input object should be an input object literal or an unordered map supplied by a variable, otherwise a [request error](#request-error) must be raised. In either case, the input object literal or unordered map must not contain any entries with names not defined by a field of this input object type, otherwise a request error must be raised.

The result of coercion is an unordered map with an entry for each field both defined by the input object type and for which a value exists. The resulting map is constructed with the following rules:

-   If no value is provided for a defined input object field and that field definition provides a default value, the result of coercing the default value according to the coercion rules of the input field type should be used. If no default value is provided and the input object field’s type is non-null, an error should be raised. Otherwise, if the field is not required, then no entry is added to the coerced unordered map.
-   If the value null was provided for an input object field, and the field’s type is not a non-null type, an entry in the coerced unordered map is given the value null. In other words, there is a semantic difference between the explicitly provided value null versus having not provided a value.
-   If a literal value is provided for an input object field, an entry in the coerced unordered map is given the result of coercing that value according to the input coercion rules for the type of that field.
-   If a variable is provided for an input object field, the runtime value of that variable must be used. If the runtime value is null and the field type is non-null, an [execution error](#execution-error) must be raised. If no runtime value is provided, the variable definition’s default value should be used. If the variable definition does not provide a default value, the input object field definition’s default value should be used.

Following are examples of input coercion for an input object type with a `String` field `a` and a required (non-null) `Int!` field `b`:

[Example № 86](#example-704b8)`input ExampleInputObject {   a: String   b: Int! }`

| Literal Value | Variables | Coerced Value |
| --- | --- | --- |
| `{ a: "abc", b: 123 }` | `{}` | `{ a: "abc", b: 123 }` |
| `{ a: null, b: 123 }` | `{}` | `{ a: null, b: 123 }` |
| `{ b: 123 }` | `{}` | `{ b: 123 }` |
| `{ a: $var, b: 123 }` | `{ var: null }` | `{ a: null, b: 123 }` |
| `{ a: $var, b: 123 }` | `{}` | `{ b: 123 }` |
| `{ b: $var }` | `{ var: 123 }` | `{ b: 123 }` |
| `$var` | `{ var: { b: 123 } }` | `{ b: 123 }` |
| `"abc123"` | `{}` | Error: Incorrect value |
| `$var` | `{ var: "abc123" }` | Error: Incorrect value |
| `{ a: "abc", b: "123" }` | `{}` | Error: Incorrect value for field b |
| `{ a: "abc" }` | `{}` | Error: Missing required field b |
| `{ b: $var }` | `{}` | Error: Missing required field b. |
| `$var` | `{ var: { a: "abc" } }` | Error: Missing required field b |
| `{ a: "abc", b: null }` | `{}` | Error: b must be non-null. |
| `{ b: $var }` | `{ var: null }` | Error: b must be non-null. |
| `{ b: 123, c: "xyz" }` | `{}` | Error: Unexpected field c |

###### [Type Validation](#sec-Input-Objects.Type-Validation "link to this subsection")

1.  An Input Object type must define one or more input fields.
2.  For each input field of an Input Object type:
    1.  The input field must have a unique name within that Input Object type; no two input fields may share the same name.
    2.  The input field must not have a name which begins with the characters "\_\_" (two underscores).
    3.  The input field must accept a type where [IsInputType](#IsInputType\(\))(inputFieldType) returns true.
    4.  If input field type is Non-Null and a default value is not defined:
        1.  The `@deprecated` directive must not be applied to this input field.
    5.  If the Input Object is a [OneOf Input Object](#oneof-input-object) then:
        1.  The type of the input field must be nullable.
        2.  The input field must not have a default value.
3.  If an Input Object references itself either directly or through referenced Input Objects, at least one of the fields in the chain of references must be either a nullable or a List type.
4.  [InputObjectDefaultValueHasCycle](#InputObjectDefaultValueHasCycle\(\))(inputObject) must be false.

[InputObjectDefaultValueHasCycle](#InputObjectDefaultValueHasCycle\(\))(inputObject, defaultValue, visitedFields)

1.  If defaultValue is not provided, initialize it to an empty unordered map.
2.  If visitedFields is not provided, initialize it to the empty set.
3.  If defaultValue is a list:
    1.  For each itemValue in defaultValue:
        1.  If [InputObjectDefaultValueHasCycle](#InputObjectDefaultValueHasCycle\(\))(inputObject, itemValue, visitedFields), return true.
4.  Otherwise, if defaultValue is an unordered map:
    1.  For each field field in inputObject:
        1.  If [InputFieldDefaultValueHasCycle](#InputFieldDefaultValueHasCycle\(\))(field, defaultValue, visitedFields), return true.
5.  Return false.

[InputFieldDefaultValueHasCycle](#InputFieldDefaultValueHasCycle\(\))(field, defaultValue, visitedFields)

1.  Assert: defaultValue is an unordered map.
2.  Let fieldType be the type of field.
3.  Let namedFieldType be the underlying named type of fieldType.
4.  If namedFieldType is not an input object type:
    1.  Return false.
5.  Let fieldName be the name of field.
6.  Let fieldDefaultValue be the value for fieldName in defaultValue.
7.  If fieldDefaultValue exists:
    1.  Return [InputObjectDefaultValueHasCycle](#InputObjectDefaultValueHasCycle\(\))(namedFieldType, fieldDefaultValue, visitedFields).
8.  Otherwise:
    1.  Let fieldDefaultValue be the default value of field.
    2.  If fieldDefaultValue does not exist:
        1.  Return false.
    3.  If field is within visitedFields:
        1.  Return true.
    4.  Let nextVisitedFields be a new set containing field and everything from visitedFields.
    5.  Return [InputObjectDefaultValueHasCycle](#InputObjectDefaultValueHasCycle\(\))(namedFieldType, fieldDefaultValue, nextVisitedFields).

### [3.10.1](#sec-OneOf-Input-Objects)OneOf Input Objects

A [OneOf Input Object](#oneof-input-object) is a special variant of [Input Object](#input-object) where exactly one field must be set and non-null, all others being omitted. This is useful for representing situations where an input may be one of many different options.

When using the type system definition language, the [`@oneOf`](#sec--oneOf) directive is used to indicate that an Input Object is a OneOf Input Object (and thus requires exactly one of its fields be provided):

```
input UserUniqueCondition @oneOf {
  id: ID
  username: String
  organizationAndEmail: OrganizationAndEmailInput
}
```

In schema introspection, the `__Type.isOneOf` field will return true for OneOf Input Objects, and false for all other Input Objects.

###### [Input Coercion](#sec-OneOf-Input-Objects.Input-Coercion "link to this subsection")

The value of a OneOf Input Object, as a variant of Input Object, must also be an input object literal or an unordered map supplied by a variable, otherwise a [request error](#request-error) must be raised.

-   Prior to construction of the coerced map via the input coercion rules of an [Input Object](#input-object): the value to be coerced must contain exactly one entry and that entry must not be null or the null literal, otherwise a [request error](#request-error) must be raised.
-   All [Input Object](#input-object) [input coercion rules](#sec-Input-Objects.Input-Coercion) must also apply to a [OneOf Input Object](#oneof-input-object).
-   The resulting coerced map must contain exactly one entry and the value for that entry must not be null, otherwise an [execution error](#execution-error) must be raised.

Following are additional examples of input coercion for a OneOf Input Object type with a `String` member field `a` and an `Int` member field `b`:

[Example № 87](#example-82b67)`input ExampleOneOfInputObject @oneOf {   a: String   b: Int }`

| Literal Value | Variables | Coerced Value |
| --- | --- | --- |
| `{ a: "abc" }` | `{}` | `{ a: "abc" }` |
| `{ b: 123 }` | `{}` | `{ b: 123 }` |
| `$var` | `{ var: { a: "abc" } }` | `{ a: "abc" }` |
| `{ a: null }` | `{}` | Error: Value for member field a must be non-null |
| `$var` | `{ var: { a: null } }` | Error: Value for member field a must be non-null |
| `{ a: $a }` | `{}` | Error: Value for member field a must be specified |
| `{ a: "abc", b: 123 }` | `{}` | Error: Exactly one key must be specified |
| `{ a: 456, b: "xyz" }` | `{}` | Error: Exactly one key must be specified |
| `$var` | `{ var: { a: "abc", b: 123 } }` | Error: Exactly one key must be specified |
| `{ a: "abc", b: null }` | `{}` | Error: Exactly one key must be specified |
| `{ a: "abc", b: $b }` | `{}` | Error: Exactly one key must be specified |
| `{ a: $a, b: $b }` | `{ a: "abc" }` | Error: Exactly one key must be specified |
| `{}` | `{}` | Error: Exactly one key must be specified |
| `$var` | `{ var: {} }` | Error: Exactly one key must be specified |

### [3.10.2](#sec-Input-Object-Extensions)Input Object Extensions

[InputObjectTypeExtension](#InputObjectTypeExtension)

extendinput[Name](#Name)[Directives](#Directives)Constopt[InputFieldsDefinition](#InputFieldsDefinition)

extendinput[Name](#Name)[Directives](#Directives)Const{

Input object type extensions are used to represent an input object type which has been extended from some previous input object type. For example, this might be used by a GraphQL service which is itself an extension of another GraphQL service.

###### [Type Validation](#sec-Input-Object-Extensions.Type-Validation "link to this subsection")

Input object type extensions have the potential to be invalid if incorrectly defined.

1.  The named type must already be defined and must be a Input Object type.
2.  All fields of an Input Object type extension must have unique names.
3.  All fields of an Input Object type extension must not already be a field of the previous Input Object.
4.  Any non-repeatable directives provided must not already apply to the previous Input Object type.
5.  The `@oneOf` directive must not be provided by an Input Object type extension.
6.  If the original Input Object is a [OneOf Input Object](#oneof-input-object) then:
    1.  All fields of the Input Object type extension must be nullable.
    2.  All fields of the Input Object type extension must not have default values.

## [3.11](#sec-List)List

A GraphQL list is a special collection type which declares the type of each item in the List (referred to as the _item type_ of the list). List values are serialized as ordered lists, where each item in the list is serialized as per the item type.

To denote that a field uses a List type the item type is wrapped in square brackets like this: `pets: [Pet]`. Nesting lists is allowed: `matrix: [[Int]]`.

###### [Result Coercion](#sec-List.Result-Coercion "link to this subsection")

GraphQL services must return an ordered list as the result of a list type. Each item in the list must be the result of a result coercion of the item type. If a reasonable coercion is not possible it must raise an [execution error](#execution-error). In particular, if a non-list is returned, the coercion should fail, as this indicates a mismatch in expectations between the type system and the implementation.

If a list’s item type is nullable, then errors occurring during preparation or coercion of an individual item in the list must result in the value null at that position in the list along with an [execution error](#execution-error) added to the response. If a list’s item type is non-null, an execution error occurring at an individual item in the list must result in an execution error for the entire list.

[Note](#note-46a65) See [Handling Execution Errors](#sec-Handling-Execution-Errors) for more about this behavior.

###### [Input Coercion](#sec-List.Input-Coercion "link to this subsection")

When expected as an input, list values are accepted only when each item in the list can be accepted by the list’s item type.

If the value passed as an input to a list type is _not_ a list and not the null value, then the result of input coercion is a list of size one, where the single item value is the result of input coercion for the list’s item type on the provided value (note this may apply recursively for nested lists).

This allows inputs which accept one or many arguments (sometimes referred to as “var args”) to declare their input type as a list while for the common case of a single value, a client can just pass that value directly rather than constructing the list.

Following are examples of input coercion with various list types and values:

| Expected Type | Provided Value | Coerced Value |
| --- | --- | --- |
| `[Int]` | `[1, 2, 3]` | `[1, 2, 3]` |
| `[Int]` | `[1, "b", true]` | Error: Incorrect item value |
| `[Int]` | `1` | `[1]` |
| `[Int]` | `null` | `null` |
| `[[Int]]` | `[[1], [2, 3]]` | `[[1], [2, 3]]` |
| `[[Int]]` | `[1, 2, 3]` | `[[1], [2], [3]]` |
| `[[Int]]` | `[1, null, 3]` | `[[1], null, [3]]` |
| `[[Int]]` | `[[1], ["b"]]` | Error: Incorrect item value |
| `[[Int]]` | `1` | `[[1]]` |
| `[[Int]]` | `null` | `null` |

## [3.12](#sec-Non-Null)Non-Null

By default, all types in GraphQL are nullable; the null value is a valid response for all of the above types. To declare a type that disallows null, the GraphQL Non-Null type can be used. This type wraps an underlying type, and this type acts identically to that wrapped type, with the exception that null is not a valid response for the wrapping type. A trailing exclamation mark is used to denote a field that uses a Non-Null type like this: `name: String!`.

###### [Nullable vs. Optional](#sec-Non-Null.Nullable-vs-Optional "link to this subsection")

Fields are _always_ optional within the context of a [selection set](#selection-set), a field may be omitted and the selection set is still valid (so long as the selection set does not become empty). However fields that return Non-Null types will never return the value null if queried.

Inputs (such as field arguments), are always optional by default. However a non-null input type is required. In addition to not accepting the value null, it also does not accept omission. For the sake of simplicity nullable types are always optional and non-null types are always required.

###### [Result Coercion](#sec-Non-Null.Result-Coercion "link to this subsection")

In all of the above result coercions, null was considered a valid value. To coerce the result of a Non-Null type, the coercion of the wrapped type should be performed. If that result was not null, then the result of coercing the Non-Null type is that result. If that result was null, then an [execution error](#execution-error) must be raised.

[Note](#note-f6bf9) When an [execution error](#execution-error) is raised on a non-null [response position](#response-position), the error propagates to the parent [response position](#response-position). For more information on this process, see [Errors and Non-Null Types](#sec-Executing-Selection-Sets.Errors-and-Non-Null-Types) within the Execution section.

###### [Input Coercion](#sec-Non-Null.Input-Coercion "link to this subsection")

If an argument or input-object field of a Non-Null type is not provided, is provided with the literal value null, or is provided with a variable that was either not provided a value at runtime, or was provided the value null, then a [request error](#request-error) must be raised.

If the value provided to the Non-Null type is provided with a literal value other than null, or a Non-Null variable value, it is coerced using the input coercion for the wrapped type.

A non-null argument cannot be omitted:

[Counter Example № 88](#example-32bbf)`{   fieldWithNonNullArg }`

The value null cannot be provided to a non-null argument:

[Counter Example № 89](#example-da489)`{   fieldWithNonNullArg(nonNullArg: null) }`

A variable of a nullable type cannot be provided to a non-null argument:

[Example № 90](#example-6d129)`query withNullableVariable($var: String) {   fieldWithNonNullArg(nonNullArg: $var) }`

[Note](#note-97a45) The Validation section defines providing a nullable variable type to a non-null input type as invalid.

###### [Type Validation](#sec-Non-Null.Type-Validation "link to this subsection")

1.  A Non-Null type must not wrap another Non-Null type.

### [3.12.1](#sec-Combining-List-and-Non-Null)Combining List and Non-Null

The List and Non-Null wrapping types can compose, representing more complex types. The rules for result coercion and input coercion of Lists and Non-Null types apply in a recursive fashion.

For example if the inner item type of a List is Non-Null (e.g. `[T!]`), then that List may not contain any null items. However if the inner type of a Non-Null is a List (e.g. `[T]!`), then null is not accepted however an empty list is accepted.

Following are examples of result coercion with various types and values:

| Expected Type | Internal Value | Coerced Result |
| --- | --- | --- |
| `[Int]` | `[1, 2, 3]` | `[1, 2, 3]` |
| `[Int]` | `null` | `null` |
| `[Int]` | `[1, 2, null]` | `[1, 2, null]` |
| `[Int]` | `[1, 2, Error]` | `[1, 2, null]` (With logged error) |
| `[Int]!` | `[1, 2, 3]` | `[1, 2, 3]` |
| `[Int]!` | `null` | Error: Value cannot be null |
| `[Int]!` | `[1, 2, null]` | `[1, 2, null]` |
| `[Int]!` | `[1, 2, Error]` | `[1, 2, null]` (With logged error) |
| `[Int!]` | `[1, 2, 3]` | `[1, 2, 3]` |
| `[Int!]` | `null` | `null` |
| `[Int!]` | `[1, 2, null]` | `null` (With logged coercion error) |
| `[Int!]` | `[1, 2, Error]` | `null` (With logged error) |
| `[Int!]!` | `[1, 2, 3]` | `[1, 2, 3]` |
| `[Int!]!` | `null` | Error: Value cannot be null |
| `[Int!]!` | `[1, 2, null]` | Error: Item cannot be null |
| `[Int!]!` | `[1, 2, Error]` | Error: Error occurred in item |

## [3.13](#sec-Type-System.Directives)Directives

[DirectiveDefinition](#DirectiveDefinition)

[Description](#Description)optdirective@[Name](#Name)[ArgumentsDefinition](#ArgumentsDefinition)opt[Directives](#Directives)Constoptrepeatableopton[DirectiveLocations](#DirectiveLocations)

[DirectiveLocations](#DirectiveLocations)

[DirectiveLocations](#DirectiveLocations)|[DirectiveLocation](#DirectiveLocation)

|opt[DirectiveLocation](#DirectiveLocation)

[DirectiveLocation](#DirectiveLocation)

[ExecutableDirectiveLocation](#ExecutableDirectiveLocation)

[TypeSystemDirectiveLocation](#TypeSystemDirectiveLocation)

[ExecutableDirectiveLocation](#ExecutableDirectiveLocation)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">QUERY</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">MUTATION</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">SUBSCRIPTION</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">FIELD</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">FRAGMENT_DEFINITION</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">FRAGMENT_SPREAD</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">INLINE_FRAGMENT</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">VARIABLE_DEFINITION</span></td></tr></tbody></table>

[TypeSystemDirectiveLocation](#TypeSystemDirectiveLocation)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">SCHEMA</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">SCALAR</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">OBJECT</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">FIELD_DEFINITION</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">ARGUMENT_DEFINITION</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">INTERFACE</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">UNION</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">ENUM</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">ENUM_VALUE</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">INPUT_OBJECT</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">INPUT_FIELD_DEFINITION</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">DIRECTIVE_DEFINITION</span></td></tr></tbody></table>

A GraphQL schema describes directives which are used to annotate various parts of a GraphQL document as an indicator that they should be evaluated differently by a validator, executor, or client tool such as a code generator.

###### [Built-in Directives](#sec-Type-System.Directives.Built-in-Directives "link to this subsection")

A [built-in directive](#built-in-directive) is any directive defined within this specification.

GraphQL implementations should provide the `@skip` and `@include` directives.

GraphQL implementations that support the type system definition language must provide the `@deprecated` directive if representing deprecated portions of the schema.

GraphQL implementations that support the type system definition language should provide the `@specifiedBy` directive if representing custom scalar definitions.

GraphQL implementations that support the type system definition language should provide the `@oneOf` directive if representing OneOf Input Objects.

When representing a GraphQL schema using the type system definition language any [built-in directive](#built-in-directive) may be omitted for brevity.

When introspecting a GraphQL service all provided directives, including any [built-in directive](#built-in-directive), must be included in the set of returned directives.

###### [Custom Directives](#sec-Type-System.Directives.Custom-Directives "link to this subsection")

GraphQL services and client tooling may provide any additional [custom directive](#custom-directive) beyond those defined in this document. Directives are the preferred way to extend GraphQL with custom or experimental behavior.

[Note](#note-39239) When defining a [custom directive](#custom-directive), it is recommended to prefix the directive’s name to make its scope of usage clear and to prevent a collision with [built-in directive](#built-in-directive) which may be specified by future versions of this document (which will not include `_` in their name). For example, a [custom directive](#custom-directive) used by Facebook’s GraphQL service should be named `@fb_auth` instead of `@auth`. This is especially recommended for proposed additions to this specification which can change during the [RFC process](https://github.com/graphql/graphql-spec/blob/main/CONTRIBUTING.md). For example a work in progress version of `@live` should be named `@rfc_live`.

Directives must only be used in the locations they are declared to belong in. In this example, a directive is defined which can be used to annotate a field:

[Example № 91](#example-060af)`directive @example on FIELD  fragment SomeFragment on SomeType {   field @example }`

Directive locations may be defined with an optional leading `|` character to aid formatting when representing a longer list of possible locations:

[Example № 92](#example-79697)`directive @example on   | FIELD   | FRAGMENT_SPREAD   | INLINE_FRAGMENT`

Directives can also be used to annotate the type system definition language as well, which can be a useful tool for supplying additional metadata in order to generate GraphQL execution services, produce client generated runtime code, or many other useful extensions of the GraphQL semantics.

In this example, the directive `@example` annotates field and argument definitions:

[Example № 93](#example-c3a06)`directive @example on FIELD_DEFINITION | ARGUMENT_DEFINITION  type SomeType {   field(arg: Int @example): String @example }`

A directive may be defined as repeatable by including the “repeatable” keyword. Repeatable directives are often useful when the same directive should be used with different arguments at a single location, especially in cases where additional information needs to be provided to a type or schema extension via a directive:

[Example № 94](#example-67869)`directive @delegateField(name: String!) repeatable on OBJECT | INTERFACE  type Book @delegateField(name: "pageCount") @delegateField(name: "author") {   id: ID! }  extend type Book @delegateField(name: "index")`

While defining a directive, it must not reference itself directly or indirectly:

[Counter Example № 95](#example-79945)`directive @invalidExample(arg: String @invalidExample) on ARGUMENT_DEFINITION`

[Note](#note-921fb) The order in which directives appear may be significant, including repeatable directives.

###### [Type Validation](#sec-Type-System.Directives.Type-Validation "link to this subsection")

1.  A Directive definition must include at least one DirectiveLocation.
2.  A Directive definition must not contain the use of a Directive which references itself directly.
3.  A Directive definition must not contain the use of a Directive which references itself indirectly by referencing a Type or Directive which transitively includes a reference to this Directive.
4.  The Directive must not have a name which begins with the characters "\_\_" (two underscores).
5.  For each argument of the Directive:
    1.  The argument must not have a name which begins with the characters "\_\_" (two underscores).
    2.  The argument must have a unique name within that Directive; no two arguments may share the same name.
    3.  The argument must accept a type where [IsInputType](#IsInputType\(\))(argumentType) returns true.

### [3.13.1](#sec--skip)@skip

```
directive @skip(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT
```

The `@skip` [built-in directive](#built-in-directive) may be provided for fields, fragment spreads, and inline fragments, and allows for conditional exclusion during execution as described by the `if` argument.

In this example `experimentalField` will only be queried if the variable `$someTest` has the value `false`.

[Example № 96](#example-cb6b7)`query myQuery($someTest: Boolean!) {   experimentalField @skip(if: $someTest) }`

### [3.13.2](#sec--include)@include

```
directive @include(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT
```

The `@include` [built-in directive](#built-in-directive) may be provided for fields, fragment spreads, and inline fragments, and allows for conditional inclusion during execution as described by the `if` argument.

In this example `experimentalField` will only be queried if the variable `$someTest` has the value `true`

[Example № 97](#example-aa3a0)`query myQuery($someTest: Boolean!) {   experimentalField @include(if: $someTest) }`

[Note](#note-f3059) Neither `@skip` nor `@include` has precedence over the other. In the case that both the `@skip` and `@include` directives are provided on the same field or fragment, it _must_ be queried only if the `@skip` condition is false _and_ the `@include` condition is true. Stated conversely, the field or fragment must _not_ be queried if either the `@skip` condition is true _or_ the `@include` condition is false.

### [3.13.3](#sec--deprecated)@deprecated

```
directive @deprecated(
  reason: String! = "No longer supported"
) on FIELD_DEFINITION | ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION | ENUM_VALUE | DIRECTIVE_DEFINITION
```

The `@deprecated` [built-in directive](#built-in-directive) is used within the type system definition language to indicate deprecated portions of a GraphQL service’s schema, such as deprecated fields on a type, arguments on a field, input fields on an input type, values of an enum type, or directives.

Deprecations include a reason for why it is deprecated, which is formatted using Markdown syntax (as specified by [CommonMark](https://commonmark.org/)).

In this example type definition, `oldField` is deprecated in favor of using `newField` and `oldArg` is deprecated in favor of using `newArg`.

[Example № 98](#example-0e4e8)``type ExampleType {   newField: String   oldField: String @deprecated(reason: "Use `newField`.")    anotherField(     newArg: String     oldArg: String @deprecated(reason: "Use `newArg`.")   ): String }``

The `@deprecated` directive must not appear on required (non-null without a default) arguments or input object field definitions.

[Counter Example № 99](#example-3c02f)``type ExampleType {   invalidField(     newArg: String     oldArg: String! @deprecated(reason: "Use `newArg`.")   ): String }``

To deprecate a required argument or input field, it must first be made optional by either changing the type to nullable or adding a default value.

### [3.13.4](#sec--specifiedBy)@specifiedBy

```
directive @specifiedBy(url: String!) on SCALAR
```

The `@specifiedBy` [built-in directive](#built-in-directive) is used within the type system definition language to provide a [scalar specification URL](#scalar-specification-url) for specifying the behavior of [custom scalar types](#sec-Scalars.Custom-Scalars). The URL should point to a human-readable specification of the data format, serialization, and coercion rules. It must not appear on built-in scalar types.

[Note](#note-c8292) Details on implementing a GraphQL scalar specification can be found in the [scalars.graphql.org implementation guide](https://scalars.graphql.org/implementation-guide).

In this example, a custom scalar type for `UUID` is defined with a URL pointing to the relevant IETF specification.

[Example № 100](#example-e5b0d)`scalar UUID @specifiedBy(url: "https://tools.ietf.org/html/rfc4122")`

### [3.13.5](#sec--oneOf)@oneOf

```
directive @oneOf on INPUT_OBJECT
```

The `@oneOf` [built-in directive](#built-in-directive) is used within the type system definition language to indicate an [Input Object](#input-object) is a [OneOf Input Object](#oneof-input-object).

[Example № 101](#example-6b169)`input UserUniqueCondition @oneOf {   id: ID   username: String   organizationAndEmail: OrganizationAndEmailInput }`

### [3.13.6](#sec-Directive-Extensions)Directive Extensions

[DirectiveExtension](#DirectiveExtension)

extenddirective@[Name](#Name)[Directives](#Directives)Const

Directive extensions are used to represent a directive which has been extended from some previous directive. For example, this might be used by a GraphQL tool or service which adds directives to an existing directive.

###### [Type Validation](#sec-Directive-Extensions.Type-Validation "link to this subsection")

Directive extensions have the potential to be invalid if incorrectly defined.

1.  The previous directive must already be defined.
2.  Any non-repeatable directives provided must not already apply to the previous directive.
3.  Any directives provided must not contain the use of a Directive which references the previous directive directly.
4.  Any directives provided must not contain the use of a Directive which references the previous directive indirectly by referencing a Type or Directive which transitively includes a reference to the previous Directive.

# [4](#sec-Introspection)Introspection

A GraphQL service supports introspection over its schema. This schema is queried using GraphQL itself, creating a powerful platform for tool-building.

Take an example request for a trivial app. In this case there is a User type with three fields: id, name, and birthday.

For example, given a service with the following type definition:

[Example № 102](#example-3005e)`type User {   id: String   name: String   birthday: Date }`

A request containing the operation:

[Example № 103](#example-2efd3)`{   __type(name: "User") {     name     fields {       name       type {         name       }     }   } }`

would produce the result:

[Example № 104](#example-47d72)`{   "__type": {     "name": "User",     "fields": [       {         "name": "id",         "type": { "name": "String" }       },       {         "name": "name",         "type": { "name": "String" }       },       {         "name": "birthday",         "type": { "name": "Date" }       }     ]   } }`

###### [Reserved Names](#sec-Introspection.Reserved-Names "link to this subsection")

Types and fields required by the GraphQL introspection system that are used in the same context as user defined types and fields are prefixed with "\_\_" (two underscores), in order to avoid naming collisions with user defined GraphQL types.

Otherwise, any [Name](#Name) within a GraphQL type system must not start with two underscores "\_\_".

## [4.1](#sec-Type-Name-Introspection)Type Name Introspection

GraphQL supports type name introspection within any [selection set](#selection-set) in an operation, with the single exception of selections at the root of a subscription operation. Type name introspection is accomplished via the meta-field `__typename: String!` on any Object, Interface, or Union. It returns the name of the concrete Object type at that point during execution.

This is most often used when querying against Interface or Union types to identify which actual Object type of the possible types has been returned.

As a meta-field, `__typename` is implicit and does not appear in the fields list in any defined type.

[Note](#note-bc213) `__typename` may not be included as a root field in a subscription operation.

## [4.2](#sec-Schema-Introspection)Schema Introspection

The schema introspection system is accessible from the meta-fields `__schema` and `__type` which are accessible from the type of the root of a query operation.

```
__schema: __Schema!
__type(name: String!): __Type
```

Like all meta-fields, these are implicit and do not appear in the fields list in the root type of the query operation.

###### [First Class Documentation](#sec-Schema-Introspection.First-Class-Documentation "link to this subsection")

All types in the introspection system provide a `description` field of type `String` to allow type designers to publish documentation in addition to capabilities. A GraphQL service may return the `description` field using Markdown syntax (as specified by [CommonMark](https://commonmark.org/)). Therefore it is recommended that any tool that displays `description` use a CommonMark-compliant Markdown renderer.

###### [Deprecation](#sec-Schema-Introspection.Deprecation "link to this subsection")

To support the management of backwards compatibility, GraphQL fields, arguments, input fields, and enum values can indicate whether or not they are deprecated (`isDeprecated: Boolean!`) along with a description of why it is deprecated (`deprecationReason: String`).

Tools built using GraphQL introspection should respect deprecation by discouraging deprecated use through information hiding or developer-facing warnings.

###### [Stable Ordering](#sec-Schema-Introspection.Stable-Ordering "link to this subsection")

The observable order of all data collections should be preserved to improve schema legibility and stability. When a schema is produced from a [TypeSystemDocument](#TypeSystemDocument), introspection should return items in the same source order for each element list: object fields, input object fields, arguments, enum values, directives, union member types, and implemented interfaces.

###### [Schema Introspection Schema](#sec-Schema-Introspection.Schema-Introspection-Schema "link to this subsection")

The schema introspection system is itself represented as a GraphQL schema. Below are the full set of type system definitions providing schema introspection, which are fully defined in the sections below.

```
type __Schema {
  description: String
  types: [__Type!]!
  queryType: __Type!
  mutationType: __Type
  subscriptionType: __Type
  directives(includeDeprecated: Boolean! = false): [__Directive!]!
}

type __Type {
  kind: __TypeKind!
  name: String
  description: String
  # may be non-null for custom SCALAR, otherwise null.
  specifiedByURL: String
  # must be non-null for OBJECT and INTERFACE, otherwise null.
  fields(includeDeprecated: Boolean! = false): [__Field!]
  # must be non-null for OBJECT and INTERFACE, otherwise null.
  interfaces: [__Type!]
  # must be non-null for INTERFACE and UNION, otherwise null.
  possibleTypes: [__Type!]
  # must be non-null for ENUM, otherwise null.
  enumValues(includeDeprecated: Boolean! = false): [__EnumValue!]
  # must be non-null for INPUT_OBJECT, otherwise null.
  inputFields(includeDeprecated: Boolean! = false): [__InputValue!]
  # must be non-null for NON_NULL and LIST, otherwise null.
  ofType: __Type
  # must be non-null for INPUT_OBJECT, otherwise null.
  isOneOf: Boolean
}

enum __TypeKind {
  SCALAR
  OBJECT
  INTERFACE
  UNION
  ENUM
  INPUT_OBJECT
  LIST
  NON_NULL
}

type __Field {
  name: String!
  description: String
  args(includeDeprecated: Boolean! = false): [__InputValue!]!
  type: __Type!
  isDeprecated: Boolean!
  deprecationReason: String
}

type __InputValue {
  name: String!
  description: String
  type: __Type!
  defaultValue: String
  isDeprecated: Boolean!
  deprecationReason: String
}

type __EnumValue {
  name: String!
  description: String
  isDeprecated: Boolean!
  deprecationReason: String
}

type __Directive {
  name: String!
  description: String
  isRepeatable: Boolean!
  locations: [__DirectiveLocation!]!
  args(includeDeprecated: Boolean! = false): [__InputValue!]!
  isDeprecated: Boolean!
  deprecationReason: String
}

enum __DirectiveLocation {
  QUERY
  MUTATION
  SUBSCRIPTION
  FIELD
  FRAGMENT_DEFINITION
  FRAGMENT_SPREAD
  INLINE_FRAGMENT
  VARIABLE_DEFINITION
  SCHEMA
  SCALAR
  OBJECT
  FIELD_DEFINITION
  ARGUMENT_DEFINITION
  INTERFACE
  UNION
  ENUM
  ENUM_VALUE
  INPUT_OBJECT
  INPUT_FIELD_DEFINITION
  DIRECTIVE_DEFINITION
}
```

### [4.2.1](#sec-The-__Schema-Type)The \_\_Schema Type

The `__Schema` type is returned from the `__schema` meta-field and provides all information about the schema of a GraphQL service.

Fields:

-   `description` may return a String or null.
-   `queryType` is the root type of a query operation.
-   `mutationType` is the root type of a mutation operation, if supported. Otherwise null.
-   `subscriptionType` is the root type of a subscription operation, if supported. Otherwise null.
-   `types` must return the set of all named types contained within this schema. Any named type which can be found through a field of any introspection type must be included in this set.
-   `directives` must return the set of all directives available within this schema including all built-in directives.
    -   Accepts the argument `includeDeprecated` which defaults to false. If true, deprecated directives are also returned.

### [4.2.2](#sec-The-__Type-Type)The \_\_Type Type

`__Type` is at the core of the type introspection system. It represents all types in the system: both named types (e.g. Scalars and Object types) and type modifiers (e.g. List and Non-Null types).

Type modifiers are used to modify the type presented in the field `ofType`. This modified type may recursively be a modified type, representing a list or non-null type, and combinations thereof, ultimately modifying a named type.

There are several different kinds of type. In each kind, different fields are actually valid. All possible kinds are listed in the `__TypeKind` enum.

Each sub-section below defines the expected fields of `__Type` given each possible value of the `__TypeKind` enum:

-   "SCALAR"
-   "OBJECT"
-   "INTERFACE"
-   "UNION"
-   "ENUM"
-   "INPUT\_OBJECT"
-   "LIST"
-   "NON\_NULL"

###### [Scalar](#sec-The-__Type-Type.Scalar "link to this subsection")

Represents scalar types such as Int, String, and Boolean. Scalars cannot have fields.

Also represents [Custom scalars](#sec-Scalars.Custom-Scalars) which may provide `specifiedByURL` as a [scalar specification URL](#scalar-specification-url).

Fields:

-   `kind` must return `__TypeKind.SCALAR`.
-   `name` must return a String.
-   `description` may return a String or null.
-   `specifiedByURL` may return a String (in the form of a URL) for custom scalars, otherwise must be null.
-   All other fields must return null.

###### [Object](#sec-The-__Type-Type.Object "link to this subsection")

Object types represent concrete instantiations of sets of fields. The introspection types (e.g. `__Type`, `__Field`, etc.) are examples of objects.

Fields:

-   `kind` must return `__TypeKind.OBJECT`.
-   `name` must return a String.
-   `description` may return a String or null.
-   `fields` must return the set of fields that can be selected for this type.
    -   Accepts the argument `includeDeprecated` which defaults to false. If true, deprecated fields are also returned.
-   `interfaces` must return the set of interfaces that an object implements (if none, `interfaces` must return the empty set).
-   All other fields must return null.

###### [Union](#sec-The-__Type-Type.Union "link to this subsection")

Unions are an abstract type where no common fields are declared. The possible types of a union are explicitly listed out in `possibleTypes`. An object type can be a member of a union without modification to that type.

Fields:

-   `kind` must return `__TypeKind.UNION`.
-   `name` must return a String.
-   `description` may return a String or null.
-   `possibleTypes` returns the list of types that can be represented within this union. They must be object types.
-   All other fields must return null.

###### [Interface](#sec-The-__Type-Type.Interface "link to this subsection")

Interfaces are an abstract type where there are common fields declared. Any type that implements an interface must define all the named fields where each implementing field type is equal to or a sub-type of (covariant) the interface type. The implementations of this interface are explicitly listed out in `possibleTypes`.

Fields:

-   `kind` must return `__TypeKind.INTERFACE`.
-   `name` must return a String.
-   `description` may return a String or null.
-   `fields` must return the set of fields required by this interface.
    -   Accepts the argument `includeDeprecated` which defaults to false. If true, deprecated fields are also returned.
-   `interfaces` must return the set of interfaces that an interface implements (if none, `interfaces` must return the empty set).
-   `possibleTypes` returns the list of types that implement this interface. They must be object types.
-   All other fields must return null.

###### [Enum](#sec-The-__Type-Type.Enum "link to this subsection")

Enums are special scalars that can only have a defined set of values.

Fields:

-   `kind` must return `__TypeKind.ENUM`.
-   `name` must return a String.
-   `description` may return a String or null.
-   `enumValues` must return the set of enum values as a list of `__EnumValue`. There must be at least one and they must have unique names.
    -   Accepts the argument `includeDeprecated` which defaults to false. If true, deprecated enum values are also returned.
-   All other fields must return null.

###### [Input Object](#sec-The-__Type-Type.Input-Object "link to this subsection")

Input objects are composite types defined as a list of named input values. They are only used as inputs to arguments and variables and cannot be a field return type.

For example the input object `Point` could be defined as:

[Example № 105](#example-a0e6d)`input Point {   x: Int   y: Int }`

Fields:

-   `kind` must return `__TypeKind.INPUT_OBJECT`.
-   `name` must return a String.
-   `description` may return a String or null.
-   `inputFields` must return the set of input fields as a list of `__InputValue`.
    -   Accepts the argument `includeDeprecated` which defaults to false. If true, deprecated input fields are also returned.
-   `isOneOf` must return true when representing a [OneOf Input Object](#oneof-input-object), otherwise false.
-   All other fields must return null.

###### [List](#sec-The-__Type-Type.List "link to this subsection")

Lists represent sequences of values in GraphQL. A List type is a type modifier: it wraps another type instance in the `ofType` field, which defines the type of each item in the list.

The modified type in the `ofType` field may itself be a modified type, allowing the representation of Lists of Lists, or Lists of Non-Nulls.

Fields:

-   `kind` must return `__TypeKind.LIST`.
-   `ofType` must return a type of any kind.
-   All other fields must return null.

###### [Non-Null](#sec-The-__Type-Type.Non-Null "link to this subsection")

GraphQL types are nullable. The value null is a valid response for field type.

A Non-Null type is a type modifier: it wraps another type instance in the `ofType` field. Non-null types do not allow null as a response, and indicate required inputs for arguments and input object fields.

The modified type in the `ofType` field may itself be a modified List type, allowing the representation of Non-Null of Lists. However it must not be a modified Non-Null type to avoid a redundant Non-Null of Non-Null.

Fields:

-   `kind` must return `__TypeKind.NON_NULL`.
-   `ofType` must return a type of any kind except Non-Null.
-   All other fields must return null.

### [4.2.3](#sec-The-__Field-Type)The \_\_Field Type

The `__Field` type represents each field in an Object or Interface type.

Fields:

-   `name` must return a String.
-   `description` may return a String or null.
-   `args` returns a List of `__InputValue` representing the arguments this field accepts.
    -   Accepts the argument `includeDeprecated` which defaults to false. If true, deprecated arguments are also returned.
-   `type` must return a `__Type` that represents the type of value returned by this field.
-   `isDeprecated` returns true if this field should no longer be used, otherwise false.
-   `deprecationReason` returns the reason why this field is deprecated, or null if this field is not deprecated.

### [4.2.4](#sec-The-__InputValue-Type)The \_\_InputValue Type

The `__InputValue` type represents field and directive arguments as well as the `inputFields` of an input object.

Fields:

-   `name` must return a String.
-   `description` may return a String or null.
-   `type` must return a `__Type` that represents the type this input value expects.
-   `defaultValue` may return a String encoding (using the GraphQL language) of the default value used by this input value in the condition a value is not provided at runtime. If this input value has no default value, returns null.
-   `isDeprecated` returns true if this input field or argument should no longer be used, otherwise false.
-   `deprecationReason` returns the reason why this input field or argument is deprecated, or null if the input field or argument is not deprecated.

### [4.2.5](#sec-The-__EnumValue-Type)The \_\_EnumValue Type

The `__EnumValue` type represents one of possible values of an enum.

Fields:

-   `name` must return a String.
-   `description` may return a String or null.
-   `isDeprecated` returns true if this enum value should no longer be used, otherwise false.
-   `deprecationReason` returns the reason why this enum value is deprecated, or null if the enum value is not deprecated.

### [4.2.6](#sec-The-__Directive-Type)The \_\_Directive Type

The `__Directive` type represents a directive that a service supports.

This includes both any [built-in directive](#built-in-directive) and any [custom directive](#custom-directive).

Individual directives may only be used in locations that are explicitly supported. All possible locations are listed in the `__DirectiveLocation` enum:

-   "QUERY"
-   "MUTATION"
-   "SUBSCRIPTION"
-   "FIELD"
-   "FRAGMENT\_DEFINITION"
-   "FRAGMENT\_SPREAD"
-   "INLINE\_FRAGMENT"
-   "VARIABLE\_DEFINITION"
-   "SCHEMA"
-   "SCALAR"
-   "OBJECT"
-   "FIELD\_DEFINITION"
-   "ARGUMENT\_DEFINITION"
-   "INTERFACE"
-   "UNION"
-   "ENUM"
-   "ENUM\_VALUE"
-   "INPUT\_OBJECT"
-   "INPUT\_FIELD\_DEFINITION"
-   "DIRECTIVE\_DEFINITION"

Fields:

-   `name` must return a String.
-   `description` may return a String or null.
-   `locations` returns a List of `__DirectiveLocation` representing the valid locations this directive may be placed.
-   `args` returns a List of `__InputValue` representing the arguments this directive accepts.
    -   Accepts the argument `includeDeprecated` which defaults to false. If true, deprecated arguments are also returned.
-   `isRepeatable` must return a Boolean that indicates if the directive may be used repeatedly at a single location.
-   `isDeprecated` returns true if this directive should no longer be used, otherwise false.
-   `deprecationReason` returns the reason why this directive is deprecated, or null if this directive is not deprecated.

# [5](#sec-Validation)Validation

A GraphQL service does not just verify if a request is syntactically correct, but also ensures that it is unambiguous and mistake-free in the context of a given GraphQL schema.

An invalid request is still technically executable, and will always produce a stable result as defined by the algorithms in the Execution section, however that result may be ambiguous, surprising, or unexpected relative to a request containing validation errors, so execution should only occur for valid requests.

Typically validation is performed in the context of a request immediately before execution, however a GraphQL service may execute a request without explicitly validating it if that exact same request is known to have been validated before. For example: the request may be validated during development, provided it does not later change, or a service may validate a request once and memoize the result to avoid validating the same request again in the future. Any client-side or development-time tool should report validation errors and not allow the formulation or execution of requests known to be invalid at that given point in time.

###### [Type System Evolution](#sec-Validation.Type-System-Evolution "link to this subsection")

As GraphQL type system schema evolves over time by adding new types and new fields, it is possible that a request which was previously valid could later become invalid. Any change that can cause a previously valid request to become invalid is considered a _breaking change_. GraphQL services and schema maintainers are encouraged to avoid breaking changes, however in order to be more resilient to these breaking changes, sophisticated GraphQL systems may still allow for the execution of requests which _at some point_ were known to be free of any validation errors, and have not changed since.

###### [Examples](#sec-Validation.Examples "link to this subsection")

The examples in this section will use the following types:

[Example № 106](#example-14b1a)`type Query {   dog: Dog   findDog(searchBy: FindDogInput): Dog }  type Mutation {   addPet(pet: PetInput!): Pet   addPets(pets: [PetInput!]!): [Pet] }  enum DogCommand {   SIT   DOWN   HEEL }  type Dog implements Pet {   name: String!   nickname: String   barkVolume: Int   doesKnowCommand(dogCommand: DogCommand!): Boolean!   isHouseTrained(atOtherHomes: Boolean): Boolean!   owner: Human }  interface Sentient {   name: String! }  interface Pet {   name: String! }  type Alien implements Sentient {   name: String!   homePlanet: String }  type Human implements Sentient {   name: String!   pets: [Pet!] }  enum CatCommand {   JUMP }  type Cat implements Pet {   name: String!   nickname: String   doesKnowCommand(catCommand: CatCommand!): Boolean!   meowVolume: Int }  union CatOrDog = Cat | Dog union DogOrHuman = Dog | Human union HumanOrAlien = Human | Alien  input FindDogInput {   name: String   owner: String }  input CatInput {   name: String!   nickname: String   meowVolume: Int }  input DogInput {   name: String!   nickname: String   barkVolume: Int }  input PetInput @oneOf {   cat: CatInput   dog: DogInput }`

## [5.1](#sec-Documents)Documents

### [5.1.1](#sec-Executable-Definitions)Executable Definitions

###### [Formal Specification](#sec-Executable-Definitions.Formal-Specification "link to this subsection")

-   For each definition definition in the document:
    -   definition must be [ExecutableDefinition](#ExecutableDefinition) (it must not be [TypeSystemDefinitionOrExtension](#TypeSystemDefinitionOrExtension)).

###### [Explanatory Text](#sec-Executable-Definitions.Explanatory-Text "link to this subsection")

GraphQL execution will only consider the executable definitions Operation and Fragment. Type system definitions and extensions are not executable, and are not considered during execution.

To avoid ambiguity, a document containing [TypeSystemDefinitionOrExtension](#TypeSystemDefinitionOrExtension) is invalid for execution.

GraphQL documents not intended to be directly executed may include [TypeSystemDefinitionOrExtension](#TypeSystemDefinitionOrExtension).

For example, the following document is invalid for execution since the original executing schema may not know about the provided type extension:

[Counter Example № 107](#example-12752)`query getDogName {   dog {     name     color   } }  extend type Dog {   color: String }`

## [5.2](#sec-Validation.Operations)Operations

### [5.2.1](#sec-All-Operation-Definitions)All Operation Definitions

#### [5.2.1.1](#sec-Operation-Type-Existence)Operation Type Existence

###### [Formal Specification](#sec-Operation-Type-Existence.Formal-Specification "link to this subsection")

-   For each operation definition operation in the document:
    -   Let rootOperationType be the [root operation type](#root-operation-type) in schema corresponding to the kind of operation.
    -   rootOperationType must exist.

###### [Explanatory Text](#sec-Operation-Type-Existence.Explanatory-Text "link to this subsection")

A schema defines the [root operation type](#root-operation-type) for each kind of operation that it supports. Every schema must support `query` operations, however support for `mutation` and `subscription` operations is optional.

If the schema does not include the necessary [root operation type](#root-operation-type) for the kind of an operation defined in the document, that operation is invalid since it cannot be executed.

For example given the following schema:

[Example № 108](#example-be9b1)`type Query {   hello: String }`

The following operation is valid:

[Example № 109](#example-ed01f)`query helloQuery {   hello }`

While the following operation is invalid:

[Counter Example № 110](#example-55de2)`mutation goodbyeMutation {   goodbye }`

### [5.2.2](#sec-Named-Operation-Definitions)Named Operation Definitions

#### [5.2.2.1](#sec-Operation-Name-Uniqueness)Operation Name Uniqueness

###### [Formal Specification](#sec-Operation-Name-Uniqueness.Formal-Specification "link to this subsection")

-   For each operation definition operation in the document:
    -   Let operationName be the name of operation.
    -   If operationName exists:
        -   Let operations be all operation definitions in the document named operationName.
        -   operations must be a set of one.

###### [Explanatory Text](#sec-Operation-Name-Uniqueness.Explanatory-Text "link to this subsection")

Each named operation definition must be unique within a document when referred to by its name.

For example the following document is valid:

[Example № 111](#example-069e1)`query getDogName {   dog {     name   } }  query getOwnerName {   dog {     owner {       name     }   } }`

While this document is invalid:

[Counter Example № 112](#example-5e409)`query getName {   dog {     name   } }  query getName {   dog {     owner {       name     }   } }`

It is invalid even if the type of each operation is different:

[Counter Example № 113](#example-77c2e)`query dogOperation {   dog {     name   } }  mutation dogOperation {   mutateDog {     id   } }`

### [5.2.3](#sec-Anonymous-Operation-Definitions)Anonymous Operation Definitions

#### [5.2.3.1](#sec-Lone-Anonymous-Operation)Lone Anonymous Operation

###### [Formal Specification](#sec-Lone-Anonymous-Operation.Formal-Specification "link to this subsection")

-   Let operations be all operation definitions in the document.
-   Let anonymous be all anonymous operation definitions in the document.
-   If operations is a set of more than 1:
    -   anonymous must be empty.

###### [Explanatory Text](#sec-Lone-Anonymous-Operation.Explanatory-Text "link to this subsection")

GraphQL allows a shorthand form for defining query operations when only that one operation exists in the document.

For example the following document is valid:

[Example № 114](#example-be853)`{   dog {     name   } }`

While this document is invalid:

[Counter Example № 115](#example-44b85)`{   dog {     name   } }  query getName {   dog {     owner {       name     }   } }`

### [5.2.4](#sec-Subscription-Operation-Definitions)Subscription Operation Definitions

#### [5.2.4.1](#sec-Single-Root-Field)Single Root Field

###### [Formal Specification](#sec-Single-Root-Field.Formal-Specification "link to this subsection")

-   Let subscriptionType be the root Subscription type in schema.
-   For each subscription operation definition subscription in the document:
    -   Let selectionSet be the top level selection set on subscription.
    -   Let collectedFieldsMap be the result of [CollectSubscriptionFields](#CollectSubscriptionFields\(\))(subscriptionType, selectionSet).
    -   collectedFieldsMap must have exactly one entry, which must not be an introspection field.

[CollectSubscriptionFields](#CollectSubscriptionFields\(\))(objectType, selectionSet, visitedFragments)

1.  If visitedFragments is not provided, initialize it to the empty set.
2.  Initialize collectedFieldsMap to an empty ordered map of ordered sets.
3.  For each selection in selectionSet:
    1.  selection must not provide the `@skip` directive.
    2.  selection must not provide the `@include` directive.
    3.  If selection is a [Field](#Field):
        1.  Let responseName be the [response name](#response-name) of selection (the alias if defined, otherwise the field name).
        2.  Let fieldsForResponseKey be the [field set](#field-set) value in collectedFieldsMap for the key responseName; otherwise create the entry with an empty ordered set.
        3.  Add selection to the fieldsForResponseKey.
    4.  If selection is a [FragmentSpread](#FragmentSpread):
        1.  Let fragmentSpreadName be the name of selection.
        2.  If fragmentSpreadName is in visitedFragments, continue with the next selection in selectionSet.
        3.  Add fragmentSpreadName to visitedFragments.
        4.  Let fragment be the Fragment in the current Document whose name is fragmentSpreadName.
        5.  If no such fragment exists, continue with the next selection in selectionSet.
        6.  Let fragmentType be the type condition on fragment.
        7.  If [DoesFragmentTypeApply](#DoesFragmentTypeApply\(\))(objectType, fragmentType) is false, continue with the next selection in selectionSet.
        8.  Let fragmentSelectionSet be the top-level selection set of fragment.
        9.  Let fragmentCollectedFieldsMap be the result of calling [CollectSubscriptionFields](#CollectSubscriptionFields\(\))(objectType, fragmentSelectionSet, visitedFragments).
        10.  For each responseName and fragmentFields in fragmentCollectedFieldsMap:
             1.  Let fieldsForResponseKey be the [field set](#field-set) value in collectedFieldsMap for the key responseName; otherwise create the entry with an empty ordered set.
             2.  Add each item from fragmentFields to fieldsForResponseKey.
    5.  If selection is an [InlineFragment](#InlineFragment):
        1.  Let fragmentType be the type condition on selection.
        2.  If fragmentType is not null and [DoesFragmentTypeApply](#DoesFragmentTypeApply\(\))(objectType, fragmentType) is false, continue with the next selection in selectionSet.
        3.  Let fragmentSelectionSet be the top-level selection set of selection.
        4.  Let fragmentCollectedFieldsMap be the result of calling [CollectSubscriptionFields](#CollectSubscriptionFields\(\))(objectType, fragmentSelectionSet, visitedFragments).
        5.  For each responseName and fragmentFields in fragmentCollectedFieldsMap:
            1.  Let fieldsForResponseKey be the [field set](#field-set) value in collectedFieldsMap for the key responseName; otherwise create the entry with an empty ordered set.
            2.  Add each item from fragmentFields to fieldsForResponseKey.
4.  Return collectedFieldsMap.

[Note](#note-523b0) This algorithm is very similar to [CollectFields](#CollectFields\(\))(), it differs in that it does not have access to runtime variables and thus the `@skip` and `@include` directives cannot be used.

###### [Explanatory Text](#sec-Single-Root-Field.Explanatory-Text "link to this subsection")

Subscription operations must have exactly one root field.

To enable us to determine this without access to runtime variables, we must forbid the `@skip` and `@include` directives in the root selection set.

Valid examples:

[Example № 116](#example-5bbc3)`subscription sub {   newMessage {     body     sender   } }`

[Example № 117](#example-13061)`subscription sub {   ...newMessageFields }  fragment newMessageFields on Subscription {   newMessage {     body     sender   } }`

Invalid:

[Counter Example № 118](#example-3997d)`subscription sub {   newMessage {     body     sender   }   disallowedSecondRootField }`

[Counter Example № 119](#example-18466)`subscription sub {   ...multipleSubscriptions }  fragment multipleSubscriptions on Subscription {   newMessage {     body     sender   }   disallowedSecondRootField }`

We do not allow the `@skip` and `@include` directives at the root of the subscription operation. The following example is also invalid:

[Counter Example № 120](#example-53457)`subscription requiredRuntimeValidation($bool: Boolean!) {   newMessage @include(if: $bool) {     body     sender   }   disallowedSecondRootField @skip(if: $bool) }`

The root field of a subscription operation must not be an introspection field. The following example is also invalid:

[Counter Example № 121](#example-a8fa1)`subscription sub {   __typename }`

[Note](#note-80ec0) While each subscription must have exactly one root field, a document may contain any number of operations, each of which may contain different root fields. When executed, a document containing multiple subscription operations must provide the operation name as described in [GetOperation](#GetOperation\(\))().

## [5.3](#sec-Validation.Fields)Fields

### [5.3.1](#sec-Field-Selections)Field Selections

Field selections must exist on Object, Interface, and Union types.

###### [Formal Specification](#sec-Field-Selections.Formal-Specification "link to this subsection")

-   For each selection in the document:
    -   Let fieldName be the target field of selection.
    -   fieldName must be defined on type in scope.

###### [Explanatory Text](#sec-Field-Selections.Explanatory-Text "link to this subsection")

The target field of a field selection must be defined on the scoped type of the selection set. There are no limitations on alias names.

For example the following fragment would not pass validation:

[Counter Example № 122](#example-48706)`fragment fieldNotDefined on Dog {   meowVolume }  fragment aliasedLyingFieldTargetNotDefined on Dog {   barkVolume: kawVolume }`

For interfaces, direct field selection can only be done on fields. Fields of concrete implementers are not relevant to the validity of the given interface-typed selection set.

For example, the following is valid:

[Example № 123](#example-d34e0)`fragment interfaceFieldSelection on Pet {   name }`

and the following is invalid:

[Counter Example № 124](#example-e3eef)`fragment definedOnImplementersButNotInterface on Pet {   nickname }`

Because unions do not define fields, fields may not be directly selected from a union-typed selection set, with the exception of the meta-field \_\_typename. Fields from a union-typed selection set must only be queried indirectly via a fragment.

For example the following is valid:

[Example № 125](#example-245fa)`fragment inDirectFieldSelectionOnUnion on CatOrDog {   __typename   ... on Pet {     name   }   ... on Dog {     barkVolume   } }`

But the following is invalid:

[Counter Example № 126](#example-252ad)`fragment directFieldSelectionOnUnion on CatOrDog {   name   barkVolume }`

### [5.3.2](#sec-Field-Selection-Merging)Field Selection Merging

###### [Formal Specification](#sec-Field-Selection-Merging.Formal-Specification "link to this subsection")

-   Let set be any selection set defined in the GraphQL document.
-   [FieldsInSetCanMerge](#FieldsInSetCanMerge\(\))(set) must be true.

[FieldsInSetCanMerge](#FieldsInSetCanMerge\(\))(set)

1.  Let fieldsForName be the set of selections with a given [response name](#response-name) in set including visiting fragments and inline fragments.
2.  Given each pair of distinct members fieldA and fieldB in fieldsForName:
    1.  [SameResponseShape](#SameResponseShape\(\))(fieldA, fieldB) must be true.
    2.  If the parent types of fieldA and fieldB are equal or if either is not an Object Type:
        1.  fieldA and fieldB must have identical field names.
        2.  fieldA and fieldB must have identical sets of arguments.
        3.  Let mergedSet be the result of adding the selection set of fieldA and the selection set of fieldB.
        4.  [FieldsInSetCanMerge](#FieldsInSetCanMerge\(\))(mergedSet) must be true.

[SameResponseShape](#SameResponseShape\(\))(fieldA, fieldB)

1.  Let typeA be the return type of fieldA.
2.  Let typeB be the return type of fieldB.
3.  If typeA or typeB is Non-Null:
    1.  If typeA or typeB is nullable, return false.
    2.  Let typeA be the nullable type of typeA.
    3.  Let typeB be the nullable type of typeB.
4.  If typeA or typeB is List:
    1.  If typeA or typeB is not List, return false.
    2.  Let typeA be the item type of typeA.
    3.  Let typeB be the item type of typeB.
    4.  Repeat from step 3.
5.  If typeA or typeB is Scalar or Enum:
    1.  If typeA and typeB are the same type return true, otherwise return false.
6.  Assert: typeA is an object, union or interface type.
7.  Assert: typeB is an object, union or interface type.
8.  Let mergedSet be the result of adding the selection set of fieldA and the selection set of fieldB.
9.  Let fieldsForName be the set of selections with a given [response name](#response-name) in mergedSet including visiting fragments and inline fragments.
10.  Given each pair of distinct members subfieldA and subfieldB in fieldsForName:
     1.  If [SameResponseShape](#SameResponseShape\(\))(subfieldA, subfieldB) is false, return false.
11.  Return true.

[Note](#note-5d2a3) In prior versions of the spec the term “composite” was used to signal a type that is either an Object, Interface or Union type.

###### [Explanatory Text](#sec-Field-Selection-Merging.Explanatory-Text "link to this subsection")

If multiple field selections with the same [response name](#response-name) are encountered during execution, the field and arguments to execute and the resulting value should be unambiguous. Therefore any two field selections which might both be encountered for the same object are only valid if they are equivalent.

During execution, the simultaneous execution of fields with the same response name is accomplished by performing [CollectSubfields](#CollectSubfields\(\))() before their execution.

For simple hand-written GraphQL, this rule is obviously a clear developer error, however nested fragments can make this difficult to detect manually.

The following selections correctly merge:

[Example № 127](#example-4e10c)`fragment mergeIdenticalFields on Dog {   name   name }  fragment mergeIdenticalAliasesAndFields on Dog {   otherName: name   otherName: name }`

The following is not able to merge:

[Counter Example № 128](#example-a2230)`fragment conflictingBecauseAlias on Dog {   name: nickname   name }`

Identical fields are also merged if they have identical arguments. Both values and variables can be correctly merged.

For example the following correctly merge:

[Example № 129](#example-b6369)`fragment mergeIdenticalFieldsWithIdenticalArgs on Dog {   doesKnowCommand(dogCommand: SIT)   doesKnowCommand(dogCommand: SIT) }  fragment mergeIdenticalFieldsWithIdenticalValues on Dog {   doesKnowCommand(dogCommand: $dogCommand)   doesKnowCommand(dogCommand: $dogCommand) }`

The following do not correctly merge:

[Counter Example № 130](#example-00fbf)`fragment conflictingArgsOnValues on Dog {   doesKnowCommand(dogCommand: SIT)   doesKnowCommand(dogCommand: HEEL) }  fragment conflictingArgsValueAndVar on Dog {   doesKnowCommand(dogCommand: SIT)   doesKnowCommand(dogCommand: $dogCommand) }  fragment conflictingArgsWithVars on Dog {   doesKnowCommand(dogCommand: $varOne)   doesKnowCommand(dogCommand: $varTwo) }  fragment differingArgs on Dog {   doesKnowCommand(dogCommand: SIT)   doesKnowCommand }`

The following fields would not merge together, however both cannot be encountered against the same object, so they are safe:

[Example № 131](#example-a8406)`fragment safeDifferingFields on Pet {   ... on Dog {     volume: barkVolume   }   ... on Cat {     volume: meowVolume   } }  fragment safeDifferingArgs on Pet {   ... on Dog {     doesKnowCommand(dogCommand: SIT)   }   ... on Cat {     doesKnowCommand(catCommand: JUMP)   } }`

However, the field responses must be shapes which can be merged. For example, leaf types must not differ. In this example, `someValue` might be a `String` or an `Int`:

[Counter Example № 132](#example-54e3d)`fragment conflictingDifferingResponses on Pet {   ... on Dog {     someValue: nickname   }   ... on Cat {     someValue: meowVolume   } }`

### [5.3.3](#sec-Leaf-Field-Selections)Leaf Field Selections

###### [Formal Specification](#sec-Leaf-Field-Selections.Formal-Specification "link to this subsection")

-   For each selection in the document:
    -   Let selectionType be the unwrapped result type of selection.
    -   If selectionType is a scalar or enum:
        -   The subselection set of that selection must be empty.
    -   If selectionType is an interface, union, or object:
        -   The subselection set of that selection must not be empty.

###### [Explanatory Text](#sec-Leaf-Field-Selections.Explanatory-Text "link to this subsection")

A field subselection is not allowed on leaf fields. A [leaf field](#leaf-field) is any field with a scalar or enum unwrapped type.

The following is valid.

[Example № 133](#example-e23c5)`fragment scalarSelection on Dog {   barkVolume }`

The following is invalid.

[Counter Example № 134](#example-13b69)`fragment scalarSelectionsNotAllowedOnInt on Dog {   barkVolume {     sinceWhen   } }`

Conversely, non-leaf fields must have a field subselection. A non-leaf field is any field with an object, interface, or union unwrapped type.

Let’s assume the following additions to the query root operation type of the schema:

[Example № 135](#example-9bada)`extend type Query {   human: Human   pet: Pet   catOrDog: CatOrDog }`

The following examples are invalid because they include non-leaf fields without a field subselection.

[Counter Example № 136](#example-d68ee)`query directQueryOnObjectWithoutSubFields {   human }  query directQueryOnInterfaceWithoutSubFields {   pet }  query directQueryOnUnionWithoutSubFields {   catOrDog }`

However the following example is valid since it includes a field subselection.

[Example № 137](#example-1623a)`query directQueryOnObjectWithSubFields {   human {     name   } }`

## [5.4](#sec-Validation.Arguments)Arguments

Arguments are provided to both fields and directives. The following validation rules apply in both cases.

### [5.4.1](#sec-Argument-Names)Argument Names

###### [Formal Specification](#sec-Argument-Names.Formal-Specification "link to this subsection")

-   For each argument in the document:
    -   Let argumentName be the Name of argument.
    -   Let argumentDefinition be the argument definition provided by the parent field or definition named argumentName.
    -   argumentDefinition must exist.

###### [Explanatory Text](#sec-Argument-Names.Explanatory-Text "link to this subsection")

Every argument provided to a field or directive must be defined in the set of possible arguments of that field or directive.

For example the following are valid:

[Example № 138](#example-dfd15)`fragment argOnRequiredArg on Dog {   doesKnowCommand(dogCommand: SIT) }  fragment argOnOptional on Dog {   isHouseTrained(atOtherHomes: true) @include(if: true) }`

the following is invalid since `command` is not defined on `DogCommand`.

[Counter Example № 139](#example-d5639)`fragment invalidArgName on Dog {   doesKnowCommand(command: CLEAN_UP_HOUSE) }`

and this is also invalid as `unless` is not defined on `@include`.

[Counter Example № 140](#example-df41e)`fragment invalidArgName on Dog {   isHouseTrained(atOtherHomes: true) @include(unless: false) }`

In order to explore more complicated argument examples, let’s add the following to our type system:

[Example № 141](#example-73706)`type Arguments {   multipleRequirements(x: Int!, y: Int!): Int!   booleanArgField(booleanArg: Boolean): Boolean   floatArgField(floatArg: Float): Float   intArgField(intArg: Int): Int   nonNullBooleanArgField(nonNullBooleanArg: Boolean!): Boolean!   booleanListArgField(booleanListArg: [Boolean]!): [Boolean]   optionalNonNullBooleanArgField(optionalBooleanArg: Boolean! = false): Boolean! }  extend type Query {   arguments: Arguments }`

Order does not matter in arguments. Therefore both the following examples are valid.

[Example № 142](#example-bda7e)`fragment multipleArgs on Arguments {   multipleRequirements(x: 1, y: 2) }  fragment multipleArgsReverseOrder on Arguments {   multipleRequirements(y: 2, x: 1) }`

### [5.4.2](#sec-Argument-Uniqueness)Argument Uniqueness

Fields and directives treat arguments as a mapping of argument name to value. More than one argument with the same name in an argument set is ambiguous and invalid.

###### [Formal Specification](#sec-Argument-Uniqueness.Formal-Specification "link to this subsection")

-   For each argument in the Document:
    -   Let argumentName be the Name of argument.
    -   Let arguments be all Arguments named argumentName in the Argument Set which contains argument.
    -   arguments must be the set containing only argument.

### [5.4.3](#sec-Required-Arguments)Required Arguments

-   For each Field or Directive in the document:
    -   Let arguments be the arguments provided by the Field or Directive.
    -   Let argumentDefinitions be the set of argument definitions of that Field or Directive.
    -   For each argumentDefinition in argumentDefinitions:
        -   Let type be the expected type of argumentDefinition.
        -   Let defaultValue be the default value of argumentDefinition.
        -   If type is Non-Null and defaultValue does not exist:
            -   Let argumentName be the name of argumentDefinition.
            -   Let argument be the argument in arguments named argumentName.
            -   argument must exist.
            -   Let value be the value of argument.
            -   value must not be the null literal.

###### [Explanatory Text](#sec-Required-Arguments.Explanatory-Text "link to this subsection")

Arguments can be required. An argument is required if the argument type is non-null and does not have a default value. Otherwise, the argument is optional.

For example the following are valid:

[Example № 143](#example-503bd)`fragment goodBooleanArg on Arguments {   booleanArgField(booleanArg: true) }  fragment goodNonNullArg on Arguments {   nonNullBooleanArgField(nonNullBooleanArg: true) }`

The argument can be omitted from a field with a nullable argument.

Therefore the following fragment is valid:

[Example № 144](#example-1f1d2)`fragment goodBooleanArgDefault on Arguments {   booleanArgField }`

but this is not valid on a required argument.

[Counter Example № 145](#example-f12a1)`fragment missingRequiredArg on Arguments {   nonNullBooleanArgField }`

Providing the explicit value null is also not valid since required arguments always have a non-null type.

[Counter Example № 146](#example-0bc81)`fragment missingRequiredArg on Arguments {   nonNullBooleanArgField(nonNullBooleanArg: null) }`

## [5.5](#sec-Validation.Fragments)Fragments

### [5.5.1](#sec-Fragment-Declarations)Fragment Declarations

#### [5.5.1.1](#sec-Fragment-Name-Uniqueness)Fragment Name Uniqueness

###### [Formal Specification](#sec-Fragment-Name-Uniqueness.Formal-Specification "link to this subsection")

-   For each fragment definition fragment in the document:
    -   Let fragmentName be the name of fragment.
    -   Let fragments be all fragment definitions in the document named fragmentName.
    -   fragments must be a set of one.

###### [Explanatory Text](#sec-Fragment-Name-Uniqueness.Explanatory-Text "link to this subsection")

Fragment definitions are referenced in fragment spreads by name. To avoid ambiguity, each fragment’s name must be unique within a document.

Inline fragments are not considered fragment definitions, and are unaffected by this validation rule.

For example the following document is valid:

[Example № 147](#example-3703b)`{   dog {     ...fragmentOne     ...fragmentTwo   } }  fragment fragmentOne on Dog {   name }  fragment fragmentTwo on Dog {   owner {     name   } }`

While this document is invalid:

[Counter Example № 148](#example-2c3e3)`{   dog {     ...fragmentOne   } }  fragment fragmentOne on Dog {   name }  fragment fragmentOne on Dog {   owner {     name   } }`

#### [5.5.1.2](#sec-Fragment-Spread-Type-Existence)Fragment Spread Type Existence

###### [Formal Specification](#sec-Fragment-Spread-Type-Existence.Formal-Specification "link to this subsection")

-   For each named spread namedSpread in the document:
    -   Let fragment be the target of namedSpread.
    -   The target type of fragment must be defined in the schema.

###### [Explanatory Text](#sec-Fragment-Spread-Type-Existence.Explanatory-Text "link to this subsection")

Fragments must be specified on types that exist in the schema. This applies for both named and inline fragments. If they are not defined in the schema, the fragment is invalid.

For example the following fragments are valid:

[Example № 149](#example-1b2da)`fragment correctType on Dog {   name }  fragment inlineFragment on Dog {   ... on Dog {     name   } }  fragment inlineFragment2 on Dog {   ... @include(if: true) {     name   } }`

and the following do not validate:

[Counter Example № 150](#example-463f6)`fragment notOnExistingType on NotInSchema {   name }  fragment inlineNotExistingType on Dog {   ... on NotInSchema {     name   } }`

#### [5.5.1.3](#sec-Fragments-on-Object-Interface-or-Union-Types)Fragments on Object, Interface or Union Types

###### [Formal Specification](#sec-Fragments-on-Object-Interface-or-Union-Types.Formal-Specification "link to this subsection")

-   For each fragment defined in the document:
    -   The target type of fragment must have kind UNION, INTERFACE, or OBJECT.

###### [Explanatory Text](#sec-Fragments-on-Object-Interface-or-Union-Types.Explanatory-Text "link to this subsection")

Fragments can only be declared on unions, interfaces, and objects. They are invalid on scalars. They can only be applied on non-leaf fields. This rule applies to both inline and named fragments.

The following fragment declarations are valid:

[Example № 151](#example-3c8d4)`fragment fragOnObject on Dog {   name }  fragment fragOnInterface on Pet {   name }  fragment fragOnUnion on CatOrDog {   ... on Dog {     name   } }`

and the following are invalid:

[Counter Example № 152](#example-4d5e5)`fragment fragOnScalar on Int {   something }  fragment inlineFragOnScalar on Dog {   ... on Boolean {     somethingElse   } }`

#### [5.5.1.4](#sec-Fragments-Must-Be-Used)Fragments Must Be Used

###### [Formal Specification](#sec-Fragments-Must-Be-Used.Formal-Specification "link to this subsection")

-   For each fragment defined in the document:
    -   fragment must be the target of at least one spread in the document.

###### [Explanatory Text](#sec-Fragments-Must-Be-Used.Explanatory-Text "link to this subsection")

Defined fragments must be used within a document.

For example the following is an invalid document:

[Counter Example № 153](#example-9e1e3)`fragment nameFragment on Dog { # unused   name }  {   dog {     name   } }`

### [5.5.2](#sec-Fragment-Spreads)Fragment Spreads

Field selection is also determined by spreading fragments into one another. The selection set of the target fragment is combined into the selection set at the level at which the target fragment is referenced.

#### [5.5.2.1](#sec-Fragment-Spread-Target-Defined)Fragment Spread Target Defined

###### [Formal Specification](#sec-Fragment-Spread-Target-Defined.Formal-Specification "link to this subsection")

-   For every namedSpread in the document:
    -   Let fragment be the target of namedSpread.
    -   fragment must be defined in the document.

###### [Explanatory Text](#sec-Fragment-Spread-Target-Defined.Explanatory-Text "link to this subsection")

Named fragment spreads must refer to fragments defined within the document. It is a validation error if the target of a spread is not defined.

[Counter Example № 154](#example-28421)`{   dog {     ...undefinedFragment   } }`

#### [5.5.2.2](#sec-Fragment-Spreads-Must-Not-Form-Cycles)Fragment Spreads Must Not Form Cycles

###### [Formal Specification](#sec-Fragment-Spreads-Must-Not-Form-Cycles.Formal-Specification "link to this subsection")

-   For each fragmentDefinition in the document:
    -   Let visited be the empty set.
    -   [DetectFragmentCycles](#DetectFragmentCycles\(\))(fragmentDefinition, visited).

[DetectFragmentCycles](#DetectFragmentCycles\(\))(fragmentDefinition, visited)

1.  Let spreads be all fragment spread descendants of fragmentDefinition.
2.  For each spread in spreads:
    1.  visited must not contain spread.
    2.  Let nextVisited be the set including spread and members of visited.
    3.  Let nextFragmentDefinition be the target of spread.
    4.  [DetectFragmentCycles](#DetectFragmentCycles\(\))(nextFragmentDefinition, nextVisited).

###### [Explanatory Text](#sec-Fragment-Spreads-Must-Not-Form-Cycles.Explanatory-Text "link to this subsection")

The graph of fragment spreads must not form any cycles including spreading itself. Otherwise an operation could infinitely spread or infinitely execute on cycles in the underlying data.

This invalidates fragments that would result in an infinite spread:

[Counter Example № 155](#example-9ceb4)`{   dog {     ...nameFragment   } }  fragment nameFragment on Dog {   name   ...barkVolumeFragment }  fragment barkVolumeFragment on Dog {   barkVolume   ...nameFragment }`

If the above fragments were inlined, this would result in the infinitely large:

[Example № 156](#example-08734)`{   dog {     name     barkVolume     name     barkVolume     name     barkVolume     name     # forever...   } }`

This also invalidates fragments that would result in an infinite recursion when executed against cyclic data:

[Counter Example № 157](#example-cd11c)`{   dog {     ...dogFragment   } }  fragment dogFragment on Dog {   name   owner {     ...ownerFragment   } }  fragment ownerFragment on Human {   name   pets {     ...dogFragment   } }`

#### [5.5.2.3](#sec-Fragment-Spread-Is-Possible)Fragment Spread Is Possible

###### [Formal Specification](#sec-Fragment-Spread-Is-Possible.Formal-Specification "link to this subsection")

-   For each spread (named or inline) defined in the document:
    -   Let fragment be the target of spread.
    -   Let fragmentType be the type condition of fragment.
    -   Let parentType be the type of the selection set containing spread.
    -   Let applicableTypes be the intersection of [GetPossibleTypes](#GetPossibleTypes\(\))(fragmentType) and [GetPossibleTypes](#GetPossibleTypes\(\))(parentType).
    -   applicableTypes must not be empty.

[GetPossibleTypes](#GetPossibleTypes\(\))(type)

1.  If type is an object type, return a set containing type.
2.  If type is an interface type, return the set of types implementing type.
3.  If type is a union type, return the set of possible types of type.

###### [Explanatory Text](#sec-Fragment-Spread-Is-Possible.Explanatory-Text "link to this subsection")

Fragments are declared on a type and will only apply when the runtime object type matches the type condition. They also are spread within the context of a parent type. A fragment spread is only valid if its type condition could ever apply within the parent type.

##### [5.5.2.3.1](#sec-Object-Spreads-in-Object-Scope)Object Spreads in Object Scope

In the scope of an object type, the only valid object type fragment spread is one that applies to the same type that is in scope.

For example

[Example № 158](#example-0fc38)`fragment dogFragment on Dog {   ... on Dog {     barkVolume   } }`

and the following is invalid

[Counter Example № 159](#example-4d411)`fragment catInDogFragmentInvalid on Dog {   ... on Cat {     meowVolume   } }`

##### [5.5.2.3.2](#sec-Abstract-Spreads-in-Object-Scope)Abstract Spreads in Object Scope

In scope of an object type, unions or interface spreads can be used if the object type implements the interface or is a member of the union.

For example

[Example № 160](#example-2c8d0)`fragment petNameFragment on Pet {   name }  fragment interfaceWithinObjectFragment on Dog {   ...petNameFragment }`

is valid because Dog implements Pet.

Likewise

[Example № 161](#example-41843)`fragment catOrDogNameFragment on CatOrDog {   ... on Cat {     meowVolume   } }  fragment unionWithObjectFragment on Dog {   ...catOrDogNameFragment }`

is valid because Dog is a member of the CatOrDog union. It is worth noting that if one inspected the contents of the CatOrDogNameFragment you could note that no valid results would ever be returned. However we do not specify this as invalid because we only consider the fragment declaration, not its body.

##### [5.5.2.3.3](#sec-Object-Spreads-in-Abstract-Scope)Object Spreads in Abstract Scope

Union or interface spreads can be used within the context of an object type fragment, but only if the object type is one of the possible types of that interface or union.

For example, the following fragments are valid:

[Example № 162](#example-85110)`fragment petFragment on Pet {   name   ... on Dog {     barkVolume   } }  fragment catOrDogFragment on CatOrDog {   ... on Cat {     meowVolume   } }`

petFragment is valid because Dog implements the interface Pet. catOrDogFragment is valid because Cat is a member of the CatOrDog union.

By contrast the following fragments are invalid:

[Counter Example № 163](#example-a8dcc)`fragment sentientFragment on Sentient {   ... on Dog {     barkVolume   } }  fragment humanOrAlienFragment on HumanOrAlien {   ... on Cat {     meowVolume   } }`

Dog does not implement the interface Sentient and therefore sentientFragment can never return meaningful results. Therefore the fragment is invalid. Likewise Cat is not a member of the union HumanOrAlien, and it can also never return meaningful results, making it invalid.

##### [5.5.2.3.4](#sec-Abstract-Spreads-in-Abstract-Scope)Abstract Spreads in Abstract Scope

Union or interfaces fragments can be used within each other. As long as there exists at least _one_ object type that exists in the intersection of the possible types of the scope and the spread, the spread is considered valid.

So for example

[Example № 164](#example-dc875)`fragment unionWithInterface on Pet {   ...dogOrHumanFragment }  fragment dogOrHumanFragment on DogOrHuman {   ... on Dog {     barkVolume   } }`

is considered valid because Dog implements interface Pet and is a member of DogOrHuman.

However

[Counter Example № 165](#example-c9c63)`fragment nonIntersectingInterfaces on Pet {   ...sentientFragment }  fragment sentientFragment on Sentient {   name }`

is not valid because there exists no type that implements both Pet and Sentient.

###### [Interface Spreads in Implemented Interface Scope](#sec-Abstract-Spreads-in-Abstract-Scope.Interface-Spreads-in-Implemented-Interface-Scope "link to this subsection")

Additionally, an interface type fragment can always be spread into an interface scope which it implements.

In the example below, the `...resourceFragment` fragments spreads is valid, since `Resource` implements `Node`.

[Example № 166](#example-bc12a)`interface Node {   id: ID! }  interface Resource implements Node {   id: ID!   url: String }  fragment interfaceWithInterface on Node {   ...resourceFragment }  fragment resourceFragment on Resource {   url }`

## [5.6](#sec-Values)Values

### [5.6.1](#sec-Values-of-Correct-Type)Values of Correct Type

###### [Formal Specification](#sec-Values-of-Correct-Type.Formal-Specification "link to this subsection")

-   For each literal Input Value value in the document:
    -   Let type be the type expected in the position value is found.
    -   value must be coercible to type (with the assumption that any variableUsage nested within value will represent a runtime value valid for usage in its position).

###### [Explanatory Text](#sec-Values-of-Correct-Type.Explanatory-Text "link to this subsection")

Literal values must be compatible with the type expected in the position they are found as per the coercion rules defined in the Type System chapter.

[Note](#note-dd940) A [ListValue](#ListValue) or [ObjectValue](#ObjectValue) may contain nested Input Values, some of which may be a variable usage. The [All Variable Usages Are Allowed](#sec-All-Variable-Usages-Are-Allowed) validation rule ensures that each variableUsage is of a type allowed in its position. The [Coercing Variable Values](#sec-Coercing-Variable-Values) algorithm ensures runtime values for variables coerce correctly. Therefore, for the purposes of the “coercible” assertion in this validation rule, we can assume the runtime value of each variableUsage is valid for usage in its position.

The type expected in a position includes the type defined by the argument a value is provided for, the type defined by an input object field a value is provided for, and the type of a variable definition a default value is provided for.

The following examples are valid use of value literals:

[Example № 167](#example-255db)`fragment goodBooleanArg on Arguments {   booleanArgField(booleanArg: true) }  fragment coercedIntIntoFloatArg on Arguments {   # Note: The input coercion rules for Float allow Int literals.   floatArgField(floatArg: 123) }  query goodComplexDefaultValue($search: FindDogInput = { name: "Fido" }) {   findDog(searchBy: $search) {     name   } }  mutation addPet($pet: PetInput! = { cat: { name: "Brontie" } }) {   addPet(pet: $pet) {     name   } }`

Non-coercible values (such as a String into an Int) are invalid. The following examples are invalid:

[Counter Example № 168](#example-877c3)`fragment stringIntoInt on Arguments {   intArgField(intArg: "123") }  query badComplexValue {   findDog(searchBy: { name: 123 }) {     name   } }  mutation oneOfWithNoFields {   addPet(pet: {}) {     name   } }  mutation oneOfWithTwoFields($dog: DogInput) {   addPet(pet: { cat: { name: "Brontie" }, dog: $dog }) {     name   } }  mutation listOfOneOfWithNullableVariable($dog: DogInput) {   addPets(pets: [{ dog: $dog }]) {     name   } }`

### [5.6.2](#sec-Input-Object-Field-Names)Input Object Field Names

###### [Formal Specification](#sec-Input-Object-Field-Names.Formal-Specification "link to this subsection")

-   For each Input Object Field inputField in the document:
    -   Let inputFieldName be the Name of inputField.
    -   Let inputFieldDefinition be the input field definition provided by the parent input object type named inputFieldName.
    -   inputFieldDefinition must exist.

###### [Explanatory Text](#sec-Input-Object-Field-Names.Explanatory-Text "link to this subsection")

Every input field provided in an input object value must be defined in the set of possible fields of that input object’s expected type.

For example the following example input object is valid:

[Example № 169](#example-f7e9b)`{   findDog(searchBy: { name: "Fido" }) {     name   } }`

While the following example input-object uses a field “favoriteCookieFlavor” which is not defined on the expected type:

[Counter Example № 170](#example-cc58c)`{   findDog(searchBy: { favoriteCookieFlavor: "Bacon" }) {     name   } }`

### [5.6.3](#sec-Input-Object-Field-Uniqueness)Input Object Field Uniqueness

###### [Formal Specification](#sec-Input-Object-Field-Uniqueness.Formal-Specification "link to this subsection")

-   For each input object value inputObject in the document:
    -   For every inputField in inputObject:
        -   Let name be the Name of inputField.
        -   Let fields be all Input Object Fields named name in inputObject.
        -   fields must be the set containing only inputField.

###### [Explanatory Text](#sec-Input-Object-Field-Uniqueness.Explanatory-Text "link to this subsection")

Input objects must not contain more than one field of the same name, otherwise an ambiguity would exist which includes an ignored portion of syntax.

For example the following document will not pass validation.

[Counter Example № 171](#example-5d541)`{   field(arg: { field: true, field: false }) }`

### [5.6.4](#sec-Input-Object-Required-Fields)Input Object Required Fields

###### [Formal Specification](#sec-Input-Object-Required-Fields.Formal-Specification "link to this subsection")

-   For each Input Object in the document:
    -   Let fields be the fields provided by that Input Object.
    -   Let fieldDefinitions be the set of input field definitions of that Input Object.
    -   For each fieldDefinition in fieldDefinitions:
        -   Let type be the expected type of fieldDefinition.
        -   Let defaultValue be the default value of fieldDefinition.
        -   If type is Non-Null and defaultValue does not exist:
            -   Let fieldName be the name of fieldDefinition.
            -   Let field be the input field in fields named fieldName.
            -   field must exist.
            -   Let value be the value of field.
            -   value must not be the null literal.

###### [Explanatory Text](#sec-Input-Object-Required-Fields.Explanatory-Text "link to this subsection")

Input object fields may be required. Much like a field may have required arguments, an input object may have required fields. An input field is required if it has a non-null type and does not have a default value. Otherwise, the input object field is optional.

## [5.7](#sec-Validation.Directives)Directives

### [5.7.1](#sec-Directives-Are-Defined)Directives Are Defined

###### [Formal Specification](#sec-Directives-Are-Defined.Formal-Specification "link to this subsection")

-   For every directive in a document:
    -   Let directiveName be the name of directive.
    -   Let directiveDefinition be the directive named directiveName.
    -   directiveDefinition must exist.

###### [Explanatory Text](#sec-Directives-Are-Defined.Explanatory-Text "link to this subsection")

GraphQL services define what directives they support. For each usage of a directive, the directive must be available on that service.

### [5.7.2](#sec-Directives-Are-in-Valid-Locations)Directives Are in Valid Locations

###### [Formal Specification](#sec-Directives-Are-in-Valid-Locations.Formal-Specification "link to this subsection")

-   For every directive in a document:
    -   Let directiveName be the name of directive.
    -   Let directiveDefinition be the directive named directiveName.
    -   Let locations be the valid locations for directiveDefinition.
    -   Let adjacent be the AST node the directive affects.
    -   adjacent must be represented by an item within locations.

###### [Explanatory Text](#sec-Directives-Are-in-Valid-Locations.Explanatory-Text "link to this subsection")

GraphQL services define what directives they support and where they support them. For each usage of a directive, the directive must be used in a location that the service has declared support for.

For example the following document will not pass validation because `@skip` does not provide `QUERY` as a valid location.

[Counter Example № 172](#example-55f3f)`query @skip(if: $foo) {   field }`

### [5.7.3](#sec-Directives-Are-Unique-per-Location)Directives Are Unique per Location

###### [Formal Specification](#sec-Directives-Are-Unique-per-Location.Formal-Specification "link to this subsection")

-   For every location in the document for which Directives can apply:
    -   Let directives be the set of Directives which apply to location and are not repeatable.
    -   For each directive in directives:
        -   Let directiveName be the name of directive.
        -   Let namedDirectives be the set of all Directives named directiveName in directives.
        -   namedDirectives must be a set of one.

###### [Explanatory Text](#sec-Directives-Are-Unique-per-Location.Explanatory-Text "link to this subsection")

GraphQL allows directives that are defined as `repeatable` to be used more than once on the definition they apply to, possibly with different arguments. In contrast, if a directive is not `repeatable`, then only one occurrence of it is allowed per location.

For example, the following document will not pass validation because non-repeatable `@skip` has been used twice for the same field:

[Counter Example № 173](#example-b2e6c)`query ($foo: Boolean = true, $bar: Boolean = false) {   field @skip(if: $foo) @skip(if: $bar) }`

However the following example is valid because `@skip` has been used only once per location, despite being used twice in the operation and on the same named field:

[Example № 174](#example-c5ee9)`query ($foo: Boolean = true, $bar: Boolean = false) {   field @skip(if: $foo) {     subfieldA   }   field @skip(if: $bar) {     subfieldB   } }`

## [5.8](#sec-Validation.Variables)Variables

### [5.8.1](#sec-Variable-Uniqueness)Variable Uniqueness

###### [Formal Specification](#sec-Variable-Uniqueness.Formal-Specification "link to this subsection")

-   For every operation in the document:
    -   For every variable defined on operation:
        -   Let variableName be the name of variable.
        -   Let variables be the set of all variables named variableName on operation.
        -   variables must be a set of one.

###### [Explanatory Text](#sec-Variable-Uniqueness.Explanatory-Text "link to this subsection")

If any operation defines more than one variable with the same name, it is ambiguous and invalid. It is invalid even if the type of the duplicate variable is the same.

[Counter Example № 175](#example-abc9c)`query houseTrainedQuery($atOtherHomes: Boolean, $atOtherHomes: Boolean) {   dog {     isHouseTrained(atOtherHomes: $atOtherHomes)   } }`

It is valid for multiple operations to define a variable with the same name. If two operations reference the same fragment, it might actually be necessary:

[Example № 176](#example-54c93)`query A($atOtherHomes: Boolean) {   ...HouseTrainedFragment }  query B($atOtherHomes: Boolean) {   ...HouseTrainedFragment }  fragment HouseTrainedFragment on Query {   dog {     isHouseTrained(atOtherHomes: $atOtherHomes)   } }`

### [5.8.2](#sec-Variables-Are-Input-Types)Variables Are Input Types

###### [Formal Specification](#sec-Variables-Are-Input-Types.Formal-Specification "link to this subsection")

-   For every operation in a document:
    -   For every variable on each operation:
        -   Let variableType be the type of variable.
        -   [IsInputType](#IsInputType\(\))(variableType) must be true.

###### [Explanatory Text](#sec-Variables-Are-Input-Types.Explanatory-Text "link to this subsection")

Variables can only be input types. Objects, unions, and interfaces cannot be used as inputs.

For these examples, consider the following type system additions:

[Example № 177](#example-3aac3)`extend type Query {   booleanList(booleanListArg: [Boolean!]): Boolean }`

The following operations are valid:

[Example № 178](#example-0d628)`query takesBoolean($atOtherHomes: Boolean) {   dog {     isHouseTrained(atOtherHomes: $atOtherHomes)   } }  query takesComplexInput($search: FindDogInput) {   findDog(searchBy: $search) {     name   } }  query TakesListOfBooleanBang($booleans: [Boolean!]) {   booleanList(booleanListArg: $booleans) }`

The following operations are invalid:

[Counter Example № 179](#example-aeba9)`query takesCat($cat: Cat) {   # ... }  query takesDogBang($dog: Dog!) {   # ... }  query takesListOfPet($pets: [Pet]) {   # ... }  query takesCatOrDog($catOrDog: CatOrDog) {   # ... }`

### [5.8.3](#sec-All-Variable-Uses-Defined)All Variable Uses Defined

###### [Formal Specification](#sec-All-Variable-Uses-Defined.Formal-Specification "link to this subsection")

-   For each operation in a document:
    -   For each variableUsage in scope, variable must be in operation‘s variable list.
    -   Let fragments be every fragment referenced by that operation transitively.
    -   For each fragment in fragments:
        -   For each variableUsage in scope of fragment, variable must be in operation‘s variable list.

###### [Explanatory Text](#sec-All-Variable-Uses-Defined.Explanatory-Text "link to this subsection")

Variables are scoped on a per-operation basis. That means that any variable used within the context of an operation must be defined at the top level of that operation

For example:

[Example № 180](#example-38119)`query variableIsDefined($atOtherHomes: Boolean) {   dog {     isHouseTrained(atOtherHomes: $atOtherHomes)   } }`

is valid. $atOtherHomes is defined by the operation.

By contrast the following document is invalid:

[Counter Example № 181](#example-5ba94)`query variableIsNotDefined {   dog {     isHouseTrained(atOtherHomes: $atOtherHomes)   } }`

$atOtherHomes is not defined by the operation.

Fragments complicate this rule. Any fragment transitively included by an operation has access to the variables defined by that operation. Fragments can appear within multiple operations and therefore variable usages must correspond to variable definitions in all of those operations.

For example the following is valid:

[Example № 182](#example-559c2)`query variableIsDefinedUsedInSingleFragment($atOtherHomes: Boolean) {   dog {     ...isHouseTrainedFragment   } }  fragment isHouseTrainedFragment on Dog {   isHouseTrained(atOtherHomes: $atOtherHomes) }`

since isHouseTrainedFragment is used within the context of the operation variableIsDefinedUsedInSingleFragment and the variable is defined by that operation.

On the other hand, if a fragment is included within an operation that does not define a referenced variable, the document is invalid.

[Counter Example № 183](#example-93d3e)`query variableIsNotDefinedUsedInSingleFragment {   dog {     ...isHouseTrainedFragment   } }  fragment isHouseTrainedFragment on Dog {   isHouseTrained(atOtherHomes: $atOtherHomes) }`

This applies transitively as well, so the following also fails:

[Counter Example № 184](#example-ee7be)`query variableIsNotDefinedUsedInNestedFragment {   dog {     ...outerHouseTrainedFragment   } }  fragment outerHouseTrainedFragment on Dog {   ...isHouseTrainedFragment }  fragment isHouseTrainedFragment on Dog {   isHouseTrained(atOtherHomes: $atOtherHomes) }`

Variables must be defined in all operations in which a fragment is used.

[Example № 185](#example-d601e)`query houseTrainedQueryOne($atOtherHomes: Boolean) {   dog {     ...isHouseTrainedFragment   } }  query houseTrainedQueryTwo($atOtherHomes: Boolean) {   dog {     ...isHouseTrainedFragment   } }  fragment isHouseTrainedFragment on Dog {   isHouseTrained(atOtherHomes: $atOtherHomes) }`

However the following does not validate:

[Counter Example № 186](#example-2b284)`query houseTrainedQueryOne($atOtherHomes: Boolean) {   dog {     ...isHouseTrainedFragment   } }  query houseTrainedQueryTwoNotDefined {   dog {     ...isHouseTrainedFragment   } }  fragment isHouseTrainedFragment on Dog {   isHouseTrained(atOtherHomes: $atOtherHomes) }`

This is because houseTrainedQueryTwoNotDefined does not define a variable $atOtherHomes but that variable is used by isHouseTrainedFragment which is included in that operation.

### [5.8.4](#sec-All-Variables-Used)All Variables Used

###### [Formal Specification](#sec-All-Variables-Used.Formal-Specification "link to this subsection")

-   For every operation in the document:
    -   Let variables be the variables defined by that operation.
    -   Each variable in variables must be used at least once in either the operation scope itself or any fragment transitively referenced by that operation.

###### [Explanatory Text](#sec-All-Variables-Used.Explanatory-Text "link to this subsection")

All variables defined by an operation must be used in that operation or a fragment transitively included by that operation. Unused variables cause a validation error.

For example the following is invalid:

[Counter Example № 187](#example-464b6)`query variableUnused($atOtherHomes: Boolean) {   dog {     isHouseTrained   } }`

because $atOtherHomes is not referenced.

These rules apply to transitive fragment spreads as well:

[Example № 188](#example-6d4bb)`query variableUsedInFragment($atOtherHomes: Boolean) {   dog {     ...isHouseTrainedFragment   } }  fragment isHouseTrainedFragment on Dog {   isHouseTrained(atOtherHomes: $atOtherHomes) }`

The above is valid since $atOtherHomes is used in isHouseTrainedFragment which is included by variableUsedInFragment.

If that fragment did not have a reference to $atOtherHomes it would be not valid:

[Counter Example № 189](#example-a30e2)`query variableNotUsedWithinFragment($atOtherHomes: Boolean) {   dog {     ...isHouseTrainedWithoutVariableFragment   } }  fragment isHouseTrainedWithoutVariableFragment on Dog {   isHouseTrained }`

All operations in a document must use all of their variables.

As a result, the following document does not validate.

[Counter Example № 190](#example-e647f)`query queryWithUsedVar($atOtherHomes: Boolean) {   dog {     ...isHouseTrainedFragment   } }  query queryWithExtraVar($atOtherHomes: Boolean, $extra: Int) {   dog {     ...isHouseTrainedFragment   } }  fragment isHouseTrainedFragment on Dog {   isHouseTrained(atOtherHomes: $atOtherHomes) }`

This document is not valid because queryWithExtraVar defines an extraneous variable.

### [5.8.5](#sec-All-Variable-Usages-Are-Allowed)All Variable Usages Are Allowed

###### [Formal Specification](#sec-All-Variable-Usages-Are-Allowed.Formal-Specification "link to this subsection")

-   For each operation in document:
    -   Let variableUsages be all usages transitively included in the operation.
    -   For each variableUsage in variableUsages:
        -   Let variableName be the name of variableUsage.
        -   Let variableDefinition be the [VariableDefinition](#VariableDefinition) named variableName defined within operation.
        -   [IsVariableUsageAllowed](#IsVariableUsageAllowed\(\))(variableDefinition, variableUsage) must be true.

[IsVariableUsageAllowed](#IsVariableUsageAllowed\(\))(variableDefinition, variableUsage)

1.  Let variableType be the expected type of variableDefinition.
2.  Let locationType be the expected type of the [Argument](#Argument), [ObjectField](#ObjectField), or [ListValue](#ListValue) entry where variableUsage is located.
3.  If [IsNonNullPosition](#IsNonNullPosition\(\))(locationType, variableUsage) AND variableType is NOT a non-null type:
    1.  Let hasNonNullVariableDefaultValue be true if a default value exists for variableDefinition and is not the value null.
    2.  Let hasLocationDefaultValue be true if a default value exists for the [Argument](#Argument) or [ObjectField](#ObjectField) where variableUsage is located.
    3.  If hasNonNullVariableDefaultValue is NOT true AND hasLocationDefaultValue is NOT true, return false.
    4.  Let nullableLocationType be the unwrapped nullable type of locationType.
    5.  Return [AreTypesCompatible](#AreTypesCompatible\(\))(variableType, nullableLocationType).
4.  Return [AreTypesCompatible](#AreTypesCompatible\(\))(variableType, locationType).

[IsNonNullPosition](#IsNonNullPosition\(\))(locationType, variableUsage)

1.  If locationType is a non-null type, return true.
2.  If the location of variableUsage is an [ObjectField](#ObjectField):
    1.  Let parentObjectValue be the [ObjectValue](#ObjectValue) containing [ObjectField](#ObjectField).
    2.  Let parentLocationType be the expected type of [ObjectValue](#ObjectValue).
    3.  If parentLocationType is a [OneOf Input Object](#oneof-input-object) type, return true.
3.  Return false.

[AreTypesCompatible](#AreTypesCompatible\(\))(variableType, locationType)

1.  If locationType is a non-null type:
    1.  If variableType is NOT a non-null type, return false.
    2.  Let nullableLocationType be the unwrapped nullable type of locationType.
    3.  Let nullableVariableType be the unwrapped nullable type of variableType.
    4.  Return [AreTypesCompatible](#AreTypesCompatible\(\))(nullableVariableType, nullableLocationType).
2.  Otherwise, if variableType is a non-null type:
    1.  Let nullableVariableType be the nullable type of variableType.
    2.  Return [AreTypesCompatible](#AreTypesCompatible\(\))(nullableVariableType, locationType).
3.  Otherwise, if locationType is a list type:
    1.  If variableType is NOT a list type, return false.
    2.  Let itemLocationType be the unwrapped item type of locationType.
    3.  Let itemVariableType be the unwrapped item type of variableType.
    4.  Return [AreTypesCompatible](#AreTypesCompatible\(\))(itemVariableType, itemLocationType).
4.  Otherwise, if variableType is a list type, return false.
5.  Return true if variableType and locationType are identical, otherwise false.

###### [Explanatory Text](#sec-All-Variable-Usages-Are-Allowed.Explanatory-Text "link to this subsection")

Variable usages must be compatible with the arguments they are passed to.

Validation failures occur when variables are used in the context of types that are complete mismatches, or if a nullable type in a variable is passed to a non-null argument type.

Types must match:

[Counter Example № 191](#example-2028e)`query intCannotGoIntoBoolean($intArg: Int) {   arguments {     booleanArgField(booleanArg: $intArg)   } }`

$intArg typed as Int cannot be used as an argument to booleanArg, typed as Boolean.

List cardinality must also be the same. For example, lists cannot be passed into singular values.

[Counter Example № 192](#example-8d369)`query booleanListCannotGoIntoBoolean($booleanListArg: [Boolean]) {   arguments {     booleanArgField(booleanArg: $booleanListArg)   } }`

Nullability must also be respected. In general a nullable variable cannot be passed to a non-null argument.

[Counter Example № 193](#example-ed727)`query booleanArgQuery($booleanArg: Boolean) {   arguments {     nonNullBooleanArgField(nonNullBooleanArg: $booleanArg)   } }`

For list types, the same rules around nullability apply to both outer types and inner types. A nullable list cannot be passed to a non-null list, and a list of nullable values cannot be passed to a list of non-null values. The following is valid:

[Example № 194](#example-c5959)`query nonNullListToList($nonNullBooleanList: [Boolean]!) {   arguments {     booleanListArgField(booleanListArg: $nonNullBooleanList)   } }`

However, a nullable list cannot be passed to a non-null list:

[Counter Example № 195](#example-64255)`query listToNonNullList($booleanList: [Boolean]) {   arguments {     nonNullBooleanListField(nonNullBooleanListArg: $booleanList)   } }`

This would fail validation because a `[T]` cannot be passed to a `[T]!`. Similarly a `[T]` cannot be passed to a `[T!]`.

Variables used for OneOf Input Object fields must be non-nullable.

[Example № 196](#example-441e5)`mutation addCat($cat: CatInput!) {   addPet(pet: { cat: $cat }) {     name   } }  mutation addCatWithDefault($cat: CatInput! = { name: "Brontie" }) {   addPet(pet: { cat: $cat }) {     name   } }`

[Counter Example № 197](#example-614b8)`mutation addNullableCat($cat: CatInput) {   addPet(pet: { cat: $cat }) {     name   } }`

###### [Allowing Optional Variables When Default Values Exist](#sec-All-Variable-Usages-Are-Allowed.Allowing-Optional-Variables-When-Default-Values-Exist "link to this subsection")

A notable exception to typical variable type compatibility is allowing a variable definition with a nullable type to be provided to a non-null location as long as either that variable or that location provides a default value.

In the example below, an optional variable `$booleanArg` is allowed to be used in the non-null argument `optionalBooleanArg` because the field argument is optional since it provides a default value in the schema.

[Example № 198](#example-0877c)`query booleanArgQueryWithDefault($booleanArg: Boolean) {   arguments {     optionalNonNullBooleanArgField(optionalBooleanArg: $booleanArg)   } }`

In the example below, an optional variable `$booleanArg` is allowed to be used in the non-null argument (`nonNullBooleanArg`) because the variable provides a default value in the operation. This behavior is explicitly supported for compatibility with earlier editions of this specification. GraphQL authoring tools may wish to report this as a warning with the suggestion to replace `Boolean` with `Boolean!` to avoid ambiguity.

[Example № 199](#example-d24d9)`query booleanArgQueryWithDefault($booleanArg: Boolean = true) {   arguments {     nonNullBooleanArgField(nonNullBooleanArg: $booleanArg)   } }`

[Note](#note-0aed8) The value null could still be provided to such a variable at runtime. A non-null argument must raise an [execution error](#execution-error) if provided a null value.

# [6](#sec-Execution)Execution

A GraphQL service generates a response from a request via execution.

A [request](#request) for execution consists of a few pieces of information:

-   schema: The schema to use, typically solely provided by the GraphQL service.
-   document: A [Document](#Document) which must contain GraphQL [OperationDefinition](#OperationDefinition) and may contain [FragmentDefinition](#FragmentDefinition).
-   operationName (optional): The name of the Operation in the Document to execute.
-   variableValues (optional): Values for any Variables defined by the Operation.
-   initialValue (optional): An initial value corresponding to the root type being executed. Conceptually, an initial value represents the “universe” of data available via a GraphQL Service. It is common for a GraphQL Service to always use the same initial value for every request.
-   extensions (optional): A map reserved for implementation-specific additional information.

Given this information, the result of [ExecuteRequest](#ExecuteRequest\(\))(schema, document, operationName, variableValues, initialValue) produces the response, to be formatted according to the Response section below.

Implementations should not add additional properties to a [request](#request), which may conflict with future editions of the GraphQL specification. Instead, extensions provides a reserved location for implementation-specific additional information. If present, extensions must be a map, but there are no additional restrictions on its contents. To avoid conflicts, keys should use unique prefixes.

[Note](#note-81789) GraphQL requests do not require any specific serialization format or transport mechanism. Message serialization and transport mechanisms should be chosen by the implementing service.

[Note](#note-891cd) Descriptions and comments in executable documents (operation definitions, fragment definitions, and variable definitions) MUST be ignored during execution and have no effect on the observable execution, validation, or response of a GraphQL document. Descriptions and comments on executable documents MAY be used for non-observable purposes, such as logging and other developer tools.

## [6.1](#sec-Executing-Requests)Executing Requests

To execute a request, the executor must have a parsed [Document](#Document) and a selected operation name to run if the document defines multiple operations, otherwise the document is expected to only contain a single operation. The result of the request is determined by the result of executing this operation according to the “Executing Operations” section below.

[ExecuteRequest](#ExecuteRequest\(\))(schema, document, operationName, variableValues, initialValue)

1.  Let operation be the result of [GetOperation](#GetOperation\(\))(document, operationName).
2.  Let coercedVariableValues be the result of [CoerceVariableValues](#CoerceVariableValues\(\))(schema, operation, variableValues).
3.  If operation is a query operation:
    1.  Return [ExecuteQuery](#ExecuteQuery\(\))(operation, schema, coercedVariableValues, initialValue).
4.  Otherwise if operation is a mutation operation:
    1.  Return [ExecuteMutation](#ExecuteMutation\(\))(operation, schema, coercedVariableValues, initialValue).
5.  Otherwise if operation is a subscription operation:
    1.  Return [Subscribe](#Subscribe\(\))(operation, schema, coercedVariableValues, initialValue).

[GetOperation](#GetOperation\(\))(document, operationName)

1.  If operationName is null:
    1.  If document contains exactly one operation.
        1.  Return the Operation contained in the document.
    2.  Otherwise raise a [request error](#request-error) requiring operationName.
2.  Otherwise:
    1.  Let operation be the Operation named operationName in document.
    2.  If operation was not found, raise a [request error](#request-error).
    3.  Return operation.

### [6.1.1](#sec-Validating-Requests)Validating Requests

As explained in the Validation section, only requests which pass all validation rules should be executed. If validation errors are known, they should be reported in the list of “errors” in the response and the request must fail without execution.

Typically validation is performed in the context of a request immediately before execution, however a GraphQL service may execute a request without immediately validating it if that exact same request is known to have been validated before. A GraphQL service should only execute requests which _at some point_ were known to be free of any validation errors, and have since not changed.

For example: the request may be validated during development, provided it does not later change, or a service may validate a request once and memoize the result to avoid validating the same request again in the future.

### [6.1.2](#sec-Coercing-Variable-Values)Coercing Variable Values

If the operation has defined any variables, then the values for those variables need to be coerced using the input coercion rules of the variable’s declared type. If a [request error](#request-error) is encountered during input coercion of variable values, then the operation fails without execution.

[CoerceVariableValues](#CoerceVariableValues\(\))(schema, operation, variableValues)

1.  Let coercedValues be an empty unordered Map.
2.  Let variablesDefinition be the variables defined by operation.
3.  For each variableDefinition in variablesDefinition:
    1.  Let variableName be the name of variableDefinition.
    2.  Let variableType be the expected type of variableDefinition.
    3.  Assert: [IsInputType](#IsInputType\(\))(variableType) must be true.
    4.  Let defaultValue be the default value for variableDefinition.
    5.  Let hasValue be true if variableValues provides a value for the name variableName.
    6.  Let value be the value provided in variableValues for the name variableName.
    7.  If hasValue is not true and defaultValue exists (including null):
        1.  Let coercedDefaultValue be the result of coercing defaultValue according to the input coercion rules of variableType.
        2.  Add an entry to coercedValues named variableName with the value coercedDefaultValue.
    8.  Otherwise if variableType is a Non-Nullable type, and either hasValue is not true or value is null, raise a [request error](#request-error).
    9.  Otherwise if hasValue is true:
        1.  If value is null:
            1.  Add an entry to coercedValues named variableName with the value null.
        2.  Otherwise:
            1.  If value cannot be coerced according to the input coercion rules of variableType, raise a [request error](#request-error).
            2.  Let coercedValue be the result of coercing value according to the input coercion rules of variableType.
            3.  Add an entry to coercedValues named variableName with the value coercedValue.
4.  Return coercedValues.

[Note](#note-38e04) This algorithm is very similar to [CoerceArgumentValues](#CoerceArgumentValues\(\))().

## [6.2](#sec-Executing-Operations)Executing Operations

The type system, as described in the “Type System” section of the spec, must provide a query root operation type. If mutations or subscriptions are supported, it must also provide a mutation or subscription root operation type, respectively.

### [6.2.1](#sec-Query)Query

If the operation is a query, the result of the operation is the result of executing the operation’s [root selection set](#root-selection-set) with the query root operation type.

An initial value may be provided when executing a query operation.

[ExecuteQuery](#ExecuteQuery\(\))(query, schema, variableValues, initialValue)

1.  Let queryType be the root Query type in schema.
2.  Assert: queryType is an Object type.
3.  Let rootSelectionSet be the [root selection set](#root-selection-set) in query.
4.  Return [ExecuteRootSelectionSet](#ExecuteRootSelectionSet\(\))(variableValues, initialValue, queryType, rootSelectionSet, "normal").

### [6.2.2](#sec-Mutation)Mutation

If the operation is a mutation, the result of the operation is the result of executing the operation’s [root selection set](#root-selection-set) on the mutation root object type. This selection set should be executed serially.

It is expected that the top level fields in a mutation operation perform side-effects on the underlying data system. Serial execution of the provided mutations ensures against race conditions during these side-effects.

[ExecuteMutation](#ExecuteMutation\(\))(mutation, schema, variableValues, initialValue)

1.  Let mutationType be the root Mutation type in schema.
2.  Assert: mutationType is an Object type.
3.  Let rootSelectionSet be the [root selection set](#root-selection-set) in mutation.
4.  Return [ExecuteRootSelectionSet](#ExecuteRootSelectionSet\(\))(variableValues, initialValue, mutationType, rootSelectionSet, "serial").

### [6.2.3](#sec-Subscription)Subscription

If the operation is a subscription, the result is an [event stream](#event-stream) called the [response stream](#response-stream) where each event in the event stream is the result of executing the operation for each new event on an underlying [source stream](#source-stream).

Executing a subscription operation creates a persistent function on the service that maps an underlying [source stream](#source-stream) to a returned [response stream](#response-stream).

[Subscribe](#Subscribe\(\))(subscription, schema, variableValues, initialValue)

1.  Let sourceStream be the result of running [CreateSourceEventStream](#CreateSourceEventStream\(\))(subscription, schema, variableValues, initialValue).
2.  Let responseStream be the result of running [MapSourceToResponseEvent](#MapSourceToResponseEvent\(\))(sourceStream, subscription, schema, variableValues).
3.  Return responseStream.

[Note](#note-b7e10) In a large-scale subscription system, the [Subscribe](#Subscribe\(\))() and [ExecuteSubscriptionEvent](#ExecuteSubscriptionEvent\(\))() algorithms may be run on separate services to maintain predictable scaling properties. See the section below on Supporting Subscriptions at Scale.

As an example, consider a chat application. To subscribe to new messages posted to the chat room, the client sends a request like so:

[Example № 200](#example-2a5f0)`subscription NewMessages {   newMessage(roomId: 123) {     sender     text   } }`

While the client is subscribed, whenever new messages are posted to chat room with ID “123”, the selection for “sender” and “text” will be evaluated and published to the client, for example:

[Example № 201](#example-a4629)`{   "data": {     "newMessage": {       "sender": "Hagrid",       "text": "You're a wizard!"     }   } }`

The “new message posted to chat room” could use a “Pub-Sub” system where the chat room ID is the “topic” and each “publish” contains the sender and text.

###### [Event Streams](#sec-Subscription.Event-Streams "link to this subsection")

An [event stream](#event-stream) represents a sequence of events: discrete emitted values over time which can be observed. As an example, a “Pub-Sub” system may produce an [event stream](#event-stream) when “subscribing to a topic”, with an value emitted for each “publish” to that topic.

An [event stream](#event-stream) may complete at any point, often because no further events will occur. An [event stream](#event-stream) may emit an infinite sequence of values, in which it may never complete. If an [event stream](#event-stream) encounters an error, it must complete with that error.

An observer may at any point decide to stop observing an [event stream](#event-stream) by cancelling it. When an [event stream](#event-stream) is cancelled, it must complete.

Internal user code also may cancel an [event stream](#event-stream) for any reason, which would be observed as that [event stream](#event-stream) completing.

###### [Supporting Subscriptions at Scale](#sec-Subscription.Supporting-Subscriptions-at-Scale "link to this subsection")

Query and mutation operations are stateless, allowing scaling via cloning of GraphQL service instances. Subscriptions, by contrast, are stateful and require maintaining the GraphQL document, variables, and other context over the lifetime of the subscription.

Consider the behavior of your system when state is lost due to the failure of a single machine in a service. Durability and availability may be improved by having separate dedicated services for managing subscription state and client connectivity.

###### [Delivery Agnostic](#sec-Subscription.Delivery-Agnostic "link to this subsection")

GraphQL subscriptions do not require any specific serialization format or transport mechanism. GraphQL specifies algorithms for the creation of the response stream, the content of each payload on that stream, and the closing of that stream. There are intentionally no specifications for message acknowledgement, buffering, resend requests, or any other quality of service (QoS) details. Message serialization, transport mechanisms, and quality of service details should be chosen by the implementing service.

#### [6.2.3.1](#sec-Source-Stream)Source Stream

A [source stream](#source-stream) is an [event stream](#event-stream) representing a sequence of root values, each of which will trigger a GraphQL execution. Like field value resolution, the logic to create a [source stream](#source-stream) is application-specific.

[CreateSourceEventStream](#CreateSourceEventStream\(\))(subscription, schema, variableValues, initialValue)

1.  Let subscriptionType be the root Subscription type in schema.
2.  Assert: subscriptionType is an Object type.
3.  Let selectionSet be the top level selection set in subscription.
4.  Let collectedFieldsMap be the result of [CollectFields](#CollectFields\(\))(subscriptionType, selectionSet, variableValues).
5.  If collectedFieldsMap does not have exactly one entry, raise a [request error](#request-error).
6.  Let fields be the value of the first entry in collectedFieldsMap.
7.  Let fieldName be the name of the first entry in fields. Note: This value is unaffected if an alias is used.
8.  Let field be the first entry in fields.
9.  Let argumentValues be the result of [CoerceArgumentValues](#CoerceArgumentValues\(\))(subscriptionType, field, variableValues).
10.  Let sourceStream be the result of running [ResolveFieldEventStream](#ResolveFieldEventStream\(\))(subscriptionType, initialValue, fieldName, argumentValues).
11.  Return sourceStream.

[ResolveFieldEventStream](#ResolveFieldEventStream\(\))(subscriptionType, rootValue, fieldName, argumentValues)

1.  Let resolver be the internal function provided by subscriptionType for determining the resolved [event stream](#event-stream) of a subscription field named fieldName.
2.  Return the result of calling resolver, providing rootValue and argumentValues.

[Note](#note-5869a) This [ResolveFieldEventStream](#ResolveFieldEventStream\(\))() algorithm is intentionally similar to [ResolveFieldValue](#ResolveFieldValue\(\))() to enable consistency when defining resolvers on any operation type.

#### [6.2.3.2](#sec-Subscription.Response-Stream)Response Stream

Each event from the underlying [source stream](#source-stream) triggers execution of the subscription [selection set](#selection-set) using that event’s value as the initialValue.

[MapSourceToResponseEvent](#MapSourceToResponseEvent\(\))(sourceStream, subscription, schema, variableValues)

1.  Let responseStream be a new [event stream](#event-stream).
2.  When sourceStream emits sourceValue:
    1.  Let executionResult be the result of running [ExecuteSubscriptionEvent](#ExecuteSubscriptionEvent\(\))(subscription, schema, variableValues, sourceValue).
    2.  If internal error was raised:
        1.  Cancel sourceStream.
        2.  Complete responseStream with error.
    3.  Otherwise emit executionResult on responseStream.
3.  When sourceStream completes normally:
    1.  Complete responseStream normally.
4.  When sourceStream completes with error:
    1.  Complete responseStream with error.
5.  When responseStream is cancelled:
    1.  Cancel sourceStream.
    2.  Complete responseStream normally.
6.  Return responseStream.

[Note](#note-27b0d) Since [ExecuteSubscriptionEvent](#ExecuteSubscriptionEvent\(\))() handles all [execution error](#execution-error), and [request error](#request-error) only occur during [CreateSourceEventStream](#CreateSourceEventStream\(\))(), the only remaining error condition handled from [ExecuteSubscriptionEvent](#ExecuteSubscriptionEvent\(\))() are internal exceptional errors not described by this specification.

[ExecuteSubscriptionEvent](#ExecuteSubscriptionEvent\(\))(subscription, schema, variableValues, initialValue)

1.  Let subscriptionType be the root Subscription type in schema.
2.  Assert: subscriptionType is an Object type.
3.  Let rootSelectionSet be the [root selection set](#root-selection-set) in subscription.
4.  Return [ExecuteRootSelectionSet](#ExecuteRootSelectionSet\(\))(variableValues, initialValue, subscriptionType, rootSelectionSet, "normal").

[Note](#note-5fb9c) The [ExecuteSubscriptionEvent](#ExecuteSubscriptionEvent\(\))() algorithm is intentionally similar to [ExecuteQuery](#ExecuteQuery\(\))() since this is how each event result is produced.

#### [6.2.3.3](#sec-Unsubscribe)Unsubscribe

Unsubscribe cancels the [response stream](#response-stream) when a client no longer wishes to receive payloads for a subscription. This in turn also cancels the Source Stream, which is a good opportunity to clean up any other resources used by the subscription.

[Unsubscribe](#Unsubscribe\(\))(responseStream)

1.  Cancel responseStream.

## [6.3](#sec-Executing-Selection-Sets)Executing Selection Sets

Executing a GraphQL operation recursively collects and executes every selected field in the operation. First all initially selected fields from the operation’s top most [root selection set](#root-selection-set) are collected, then each executed. As each field completes, all its subfields are collected, then each executed. This process continues until there are no more subfields to collect and execute.

### [6.3.1](#sec-Executing-the-Root-Selection-Set)Executing the Root Selection Set

A [root selection set](#root-selection-set) is the top level [selection set](#selection-set) provided by a GraphQL operation. A root selection set always selects from a [root operation type](#root-operation-type).

To execute the root selection set, the initial value being evaluated and the root type must be known, as well as whether the fields must be executed in a series, or normally by executing all fields in parallel (see [Normal and Serial Execution](#sec-Normal-and-Serial-Execution)).

Executing the root selection set works similarly for queries (parallel), mutations (serial), and subscriptions (where it is executed for each event in the underlying Source Stream).

First, the [selection set](#selection-set) is collected into a [collected fields map](#collected-fields-map) which is then executed, returning the resulting data and errors.

[ExecuteRootSelectionSet](#ExecuteRootSelectionSet\(\))(variableValues, initialValue, objectType, selectionSet, executionMode)

1.  Let collectedFieldsMap be the result of [CollectFields](#CollectFields\(\))(objectType, selectionSet, variableValues).
2.  Let data be the result of running [ExecuteCollectedFields](#ExecuteCollectedFields\(\))(collectedFieldsMap, objectType, initialValue, variableValues) _serially_ if executionMode is "serial", otherwise _normally_ (allowing parallelization)).
3.  Let errors be the list of all [execution error](#execution-error) raised while executing the selection set.
4.  Return an unordered map containing data and errors.

### [6.3.2](#sec-Field-Collection)Field Collection

Before execution, each [selection set](#selection-set) is converted to a [collected fields map](#collected-fields-map) by collecting all fields with the same response name, including those in referenced fragments, into an individual [field set](#field-set). This ensures that multiple references to fields with the same response name will only be executed once.

A [collected fields map](#collected-fields-map) is an ordered map where each entry is a [response name](#response-name) and its associated [field set](#field-set). A [collected fields map](#collected-fields-map) may be produced from a selection set via [CollectFields](#CollectFields\(\))() or from the selection sets of all entries of a [field set](#field-set) via [CollectSubfields](#CollectSubfields\(\))().

A [field set](#field-set) is an ordered set of selected fields that share the same [response name](#response-name) (the field alias if defined, otherwise the field’s name). Validation ensures each field in the set has the same name and arguments, however each may have different subfields (see: [Field Selection Merging](#sec-Field-Selection-Merging)).

[Note](#note-a4e73) The order of field selections in both a [collected fields map](#collected-fields-map) and a [field set](#field-set) are significant, hence the algorithms in this specification model them as an ordered map and ordered set.

As an example, collecting the fields of this query’s selection set would result in a collected fields map with two entries, `"a"` and `"b"`, with two instances of the field `a` and one of field `b`:

[Example № 202](#example-fdbb7)`{   a {     subfield1   }   ...ExampleFragment }  fragment ExampleFragment on Query {   a {     subfield2   }   b }`

The depth-first-search order of each [field set](#field-set) produced by [CollectFields](#CollectFields\(\))() is maintained through execution, ensuring that fields appear in the executed response in a stable and predictable order.

[CollectFields](#CollectFields\(\))(objectType, selectionSet, variableValues, visitedFragments)

1.  If visitedFragments is not provided, initialize it to the empty set.
2.  Initialize collectedFieldsMap to an empty ordered map of ordered sets.
3.  For each selection in selectionSet:
    1.  If selection provides the directive `@skip`, let skipDirective be that directive.
        1.  If skipDirective‘s if argument is true or is a variable in variableValues with the value true, continue with the next selection in selectionSet.
    2.  If selection provides the directive `@include`, let includeDirective be that directive.
        1.  If includeDirective‘s if argument is not true and is not a variable in variableValues with the value true, continue with the next selection in selectionSet.
    3.  If selection is a [Field](#Field):
        1.  Let responseName be the [response name](#response-name) of selection (the alias if defined, otherwise the field name).
        2.  Let fieldsForResponseName be the [field set](#field-set) value in collectedFieldsMap for the key responseName; otherwise create the entry with an empty ordered set.
        3.  Add selection to the fieldsForResponseName.
    4.  If selection is a [FragmentSpread](#FragmentSpread):
        1.  Let fragmentSpreadName be the name of selection.
        2.  If fragmentSpreadName is in visitedFragments, continue with the next selection in selectionSet.
        3.  Add fragmentSpreadName to visitedFragments.
        4.  Let fragment be the Fragment in the current Document whose name is fragmentSpreadName.
        5.  If no such fragment exists, continue with the next selection in selectionSet.
        6.  Let fragmentType be the type condition on fragment.
        7.  If [DoesFragmentTypeApply](#DoesFragmentTypeApply\(\))(objectType, fragmentType) is false, continue with the next selection in selectionSet.
        8.  Let fragmentSelectionSet be the top-level selection set of fragment.
        9.  Let fragmentCollectedFieldsMap be the result of calling [CollectFields](#CollectFields\(\))(objectType, fragmentSelectionSet, variableValues, visitedFragments).
        10.  For each responseName and fragmentFields in fragmentCollectedFieldsMap:
             1.  Let fieldsForResponseName be the [field set](#field-set) value in collectedFieldsMap for the key responseName; otherwise create the entry with an empty ordered set.
             2.  Add each item from fragmentFields to fieldsForResponseName.
    5.  If selection is an [InlineFragment](#InlineFragment):
        1.  Let fragmentType be the type condition on selection.
        2.  If fragmentType is not null and [DoesFragmentTypeApply](#DoesFragmentTypeApply\(\))(objectType, fragmentType) is false, continue with the next selection in selectionSet.
        3.  Let fragmentSelectionSet be the top-level selection set of selection.
        4.  Let fragmentCollectedFieldsMap be the result of calling [CollectFields](#CollectFields\(\))(objectType, fragmentSelectionSet, variableValues, visitedFragments).
        5.  For each responseName and fragmentFields in fragmentCollectedFieldsMap:
            1.  Let fieldsForResponseName be the [field set](#field-set) value in collectedFieldsMap for the key responseName; otherwise create the entry with an empty ordered set.
            2.  Append each item from fragmentFields to fieldsForResponseName.
4.  Return collectedFieldsMap.

[DoesFragmentTypeApply](#DoesFragmentTypeApply\(\))(objectType, fragmentType)

1.  If fragmentType is an Object Type:
    1.  If objectType and fragmentType are the same type, return true, otherwise return false.
2.  If fragmentType is an Interface Type:
    1.  If objectType is an implementation of fragmentType, return true, otherwise return false.
3.  If fragmentType is a Union:
    1.  If objectType is a possible type of fragmentType, return true, otherwise return false.

[Note](#note-f1a76) The steps in [CollectFields](#CollectFields\(\))() evaluating the `@skip` and `@include` directives may be applied in either order since they apply commutatively.

###### [Merging Selection Sets](#sec-Field-Collection.Merging-Selection-Sets "link to this subsection")

In order to execute the sub-selections of an object typed field, all _selection sets_ of each field with the same response name in the parent [field set](#field-set) are merged together into a single [collected fields map](#collected-fields-map) representing the subfields to be executed next.

An example operation illustrating parallel fields with the same name with sub-selections.

Continuing the example above,

[Example № 203](#example-18321)`{   a {     subfield1   }   ...ExampleFragment }  fragment ExampleFragment on Query {   a {     subfield2   }   b }`

After resolving the value for field `"a"`, the following multiple selection sets are collected and merged together so `"subfield1"` and `"subfield2"` are resolved in the same phase with the same value.

[CollectSubfields](#CollectSubfields\(\))(objectType, fields, variableValues)

1.  Let collectedFieldsMap be an empty ordered map of ordered sets.
2.  For each field in fields:
    1.  Let fieldSelectionSet be the selection set of field.
    2.  If fieldSelectionSet is null or empty, continue to the next field.
    3.  Let fieldCollectedFieldsMap be the result of [CollectFields](#CollectFields\(\))(objectType, fieldSelectionSet, variableValues).
    4.  For each responseName and subfields in fieldCollectedFieldsMap:
        1.  Let fieldsForResponseName be the [field set](#field-set) value in collectedFieldsMap for the key responseName; otherwise create the entry with an empty ordered set.
        2.  Add each fields from subfields to fieldsForResponseName.
3.  Return collectedFieldsMap.

[Note](#note-b00be) All the fields passed to [CollectSubfields](#CollectSubfields\(\))() share the same [response name](#response-name).

### [6.3.3](#sec-Executing-Collected-Fields)Executing Collected Fields

To execute a [collected fields map](#collected-fields-map), the object type being evaluated and the runtime value need to be known, as well as the runtime values for any variables.

Execution will recursively resolve and complete the value of every entry in the collected fields map, producing an entry in the result map with the same [response name](#response-name) key.

[ExecuteCollectedFields](#ExecuteCollectedFields\(\))(collectedFieldsMap, objectType, objectValue, variableValues)

1.  Initialize resultMap to an empty ordered map.
2.  For each responseName and fields in collectedFieldsMap:
    1.  Let fieldName be the name of the first entry in fields. Note: This value is unaffected if an alias is used.
    2.  Let fieldType be the return type defined for the field fieldName of objectType.
    3.  If fieldType is defined:
        1.  Let responseValue be [ExecuteField](#ExecuteField\(\))(objectType, objectValue, fieldType, fields, variableValues).
        2.  Set responseValue as the value for responseName in resultMap.
3.  Return resultMap.

[Note](#note-9d48b) resultMap is ordered by which fields appear first in the operation. This is explained in greater detail in the [Field Collection](#sec-Field-Collection) section.

###### [Errors and Non-Null Types](#sec-Executing-Collected-Fields.Errors-and-Non-Null-Types "link to this subsection")

If during [ExecuteCollectedFields](#ExecuteCollectedFields\(\))() a [response position](#response-position) with a non-null type raises an [execution error](#execution-error) then that error must propagate to the parent response position (the entire selection set in the case of a field, or the entire list in the case of a list position), either resolving to null if allowed or being further propagated to a parent response position.

If this occurs, any sibling response positions which have not yet executed or have not yet yielded a value may be cancelled to avoid unnecessary work.

[Note](#note-c91b4) See [Handling Execution Errors](#sec-Handling-Execution-Errors) for more about this behavior.

### [6.3.4](#sec-Normal-and-Serial-Execution)Normal and Serial Execution

Normally the executor can execute the entries in a [collected fields map](#collected-fields-map) in whatever order it chooses (normally in parallel). Because the resolution of fields other than top-level mutation fields must always be side effect-free and idempotent, the execution order must not affect the result, and hence the service has the freedom to execute the field entries in whatever order it deems optimal.

For example, given the following collected fields map to be executed normally:

[Example № 204](#example-65e7d)`{   birthday {     month   }   address {     street   } }`

A valid GraphQL executor can resolve the four fields in whatever order it chose (however of course `birthday` must be resolved before `month`, and `address` before `street`).

When executing a mutation, the selections in the top most selection set will be executed in serial order, starting with the first appearing field textually.

When executing a collected fields map serially, the executor must consider each entry from the collected fields map in the order provided in the collected fields map. It must determine the corresponding entry in the result map for each item to completion before it continues on to the next entry in the collected fields map:

For example, given the following mutation operation, the root [selection set](#selection-set) must be executed serially:

[Example № 205](#example-989b1)`mutation ChangeBirthdayAndAddress($newBirthday: String!, $newAddress: String!) {   changeBirthday(birthday: $newBirthday) {     month   }   changeAddress(address: $newAddress) {     street   } }`

Therefore the executor must, in serial:

-   Run [ExecuteField](#ExecuteField\(\))() for `changeBirthday`, which during [CompleteValue](#CompleteValue\(\))() will execute the `{ month }` sub-selection set normally.
-   Run [ExecuteField](#ExecuteField\(\))() for `changeAddress`, which during [CompleteValue](#CompleteValue\(\))() will execute the `{ street }` sub-selection set normally.

As an illustrative example, let’s assume we have a mutation field `changeTheNumber` that returns an object containing one field, `theNumber`. If we execute the following [selection set](#selection-set) serially:

[Example № 206](#example-15fa8)`# Note: This is a selection set, not a full document using the query shorthand. {   first: changeTheNumber(newNumber: 1) {     theNumber   }   second: changeTheNumber(newNumber: 3) {     theNumber   }   third: changeTheNumber(newNumber: 2) {     theNumber   } }`

The executor will execute the following serially:

-   Resolve the `changeTheNumber(newNumber: 1)` field
-   Execute the `{ theNumber }` sub-selection set of `first` normally
-   Resolve the `changeTheNumber(newNumber: 3)` field
-   Execute the `{ theNumber }` sub-selection set of `second` normally
-   Resolve the `changeTheNumber(newNumber: 2)` field
-   Execute the `{ theNumber }` sub-selection set of `third` normally

A correct executor must generate the following result for that [selection set](#selection-set):

[Example № 207](#example-1d82c)`{   "first": {     "theNumber": 1   },   "second": {     "theNumber": 3   },   "third": {     "theNumber": 2   } }`

## [6.4](#sec-Executing-Fields)Executing Fields

Each entry in a result map is the result of executing a field on an object type selected by the name of that field in a [collected fields map](#collected-fields-map). Field execution first coerces any provided argument values, then resolves a value for the field, and finally completes that value either by recursively executing another selection set or coercing a scalar value.

[ExecuteField](#ExecuteField\(\))(objectType, objectValue, fieldType, fields, variableValues)

1.  Let field be the first entry in fields.
2.  Let fieldName be the field name of field.
3.  Let argumentValues be the result of [CoerceArgumentValues](#CoerceArgumentValues\(\))(objectType, field, variableValues).
4.  Let resolvedValue be [ResolveFieldValue](#ResolveFieldValue\(\))(objectType, objectValue, fieldName, argumentValues).
5.  Return the result of [CompleteValue](#CompleteValue\(\))(fieldType, fields, resolvedValue, variableValues).

### [6.4.1](#sec-Coercing-Field-Arguments)Coercing Field Arguments

Fields may include arguments which are provided to the underlying runtime in order to correctly produce a value. These arguments are defined by the field in the type system to have a specific input type.

At each argument position in an operation may be a literal [Value](#Value), or a [Variable](#Variable) to be provided at runtime.

[CoerceArgumentValues](#CoerceArgumentValues\(\))(objectType, field, variableValues)

1.  Let coercedValues be an empty unordered Map.
2.  Let argumentValues be the argument values provided in field.
3.  Let fieldName be the name of field.
4.  Let argumentDefinitions be the arguments defined by objectType for the field named fieldName.
5.  For each argumentDefinition in argumentDefinitions:
    1.  Let argumentName be the name of argumentDefinition.
    2.  Let argumentType be the expected type of argumentDefinition.
    3.  Let defaultValue be the default value for argumentDefinition.
    4.  Let argumentValue be the value provided in argumentValues for the name argumentName.
    5.  If argumentValue is a [Variable](#Variable):
        1.  Let variableName be the name of argumentValue.
        2.  If variableValues provides a value for the name variableName:
            1.  Let hasValue be true.
            2.  Let value be the value provided in variableValues for the name variableName.
    6.  Otherwise if argumentValues provides a value for the name argumentName.
        1.  Let hasValue be true.
        2.  Let value be argumentValue.
    7.  If hasValue is not true and defaultValue exists (including null):
        1.  Let coercedDefaultValue be the result of coercing defaultValue according to the input coercion rules of argumentType.
        2.  Add an entry to coercedValues named argumentName with the value coercedDefaultValue.
    8.  Otherwise if argumentType is a Non-Nullable type, and either hasValue is not true or value is null, raise an [execution error](#execution-error).
    9.  Otherwise if hasValue is true:
        1.  If value is null:
            1.  Add an entry to coercedValues named argumentName with the value null.
        2.  Otherwise, if argumentValue is a [Variable](#Variable):
            1.  Add an entry to coercedValues named argumentName with the value value.
        3.  Otherwise:
            1.  If value cannot be coerced according to the input coercion rules of argumentType, raise an [execution error](#execution-error).
            2.  Let coercedValue be the result of coercing value according to the input coercion rules of argumentType.
            3.  Add an entry to coercedValues named argumentName with the value coercedValue.
6.  Return coercedValues.

Any [request error](#request-error) raised as a result of input coercion during [CoerceArgumentValues](#CoerceArgumentValues\(\))() should be treated instead as an [execution error](#execution-error).

[Note](#note-65769) Variable values are not coerced because they are expected to be coerced before executing the operation in [CoerceVariableValues](#CoerceVariableValues\(\))(), and valid operations must only allow usage of variables of appropriate types.

[Note](#note-c815d) Implementations are encouraged to optimize the coercion of an argument’s default value by doing so only once and caching the resulting coerced value.

### [6.4.2](#sec-Value-Resolution)Value Resolution

While nearly all of GraphQL execution can be described generically, ultimately the internal system exposing the GraphQL interface must provide values. This is exposed via ResolveFieldValue, which produces a value for a given field on a type for a real value.

As an example, this might accept the objectType `Person`, the field "soulMate", and the objectValue representing John Lennon. It would be expected to yield the value representing Yoko Ono.

[ResolveFieldValue](#ResolveFieldValue\(\))(objectType, objectValue, fieldName, argumentValues)

1.  Let resolver be the internal function provided by objectType for determining the resolved value of a field named fieldName.
2.  Return the result of calling resolver, providing objectValue and argumentValues.

[Note](#note-778fd) It is common for resolver to be asynchronous due to relying on reading an underlying database or networked service to produce a value. This necessitates the rest of a GraphQL executor to handle an asynchronous execution flow. If the field is of a list type, each value in the collection of values returned by resolver may itself be retrieved asynchronously.

### [6.4.3](#sec-Value-Completion)Value Completion

After resolving the value for a field, it is completed by ensuring it adheres to the expected return type. If the return type is another Object type, then the field execution process continues recursively by collecting and executing subfields.

[CompleteValue](#CompleteValue\(\))(fieldType, fields, result, variableValues)

1.  If the fieldType is a Non-Null type:
    1.  Let innerType be the inner type of fieldType.
    2.  Let completedResult be the result of calling [CompleteValue](#CompleteValue\(\))(innerType, fields, result, variableValues).
    3.  If completedResult is null, raise an [execution error](#execution-error).
    4.  Return completedResult.
2.  If result is null (or another internal value similar to null such as undefined), return null.
3.  If fieldType is a List type:
    1.  If result is not a collection of values, raise an [execution error](#execution-error).
    2.  Let innerType be the inner type of fieldType.
    3.  Return a list where each list item is the result of calling [CompleteValue](#CompleteValue\(\))(innerType, fields, resultItem, variableValues), where resultItem is each item in result.
4.  If fieldType is a Scalar or Enum type:
    1.  Return the result of [CoerceResult](#CoerceResult\(\))(fieldType, result).
5.  If fieldType is an Object, Interface, or Union type:
    1.  If fieldType is an Object type.
        1.  Let objectType be fieldType.
    2.  Otherwise if fieldType is an Interface or Union type.
        1.  Let objectType be [ResolveAbstractType](#ResolveAbstractType\(\))(fieldType, result).
    3.  Let collectedFieldsMap be the result of calling [CollectSubfields](#CollectSubfields\(\))(objectType, fields, variableValues).
    4.  Return the result of evaluating [ExecuteCollectedFields](#ExecuteCollectedFields\(\))(collectedFieldsMap, objectType, result, variableValues) _normally_ (allowing for parallelization).

###### [Coercing Results](#sec-Value-Completion.Coercing-Results "link to this subsection")

The primary purpose of value completion is to ensure that the values returned by field resolvers are valid according to the GraphQL type system and a service’s schema. This “dynamic type checking” allows GraphQL to provide consistent guarantees about returned types atop any service’s internal runtime.

See the Scalars [Result Coercion and Serialization](#sec-Scalars.Result-Coercion-and-Serialization) sub-section for more detailed information about how GraphQL’s built-in scalars coerce result values.

[CoerceResult](#CoerceResult\(\))(leafType, value)

1.  Assert: value is not null.
2.  Return the result of calling the internal method provided by the type system for determining the “result coercion” of leafType given the value value. This internal method must return a valid value for the type and not null. Otherwise raise an [execution error](#execution-error).

[Note](#note-5bde4) If a field resolver returns null then it is handled within [CompleteValue](#CompleteValue\(\))() before [CoerceResult](#CoerceResult\(\))() is called. Therefore both the input and output of [CoerceResult](#CoerceResult\(\))() must not be null.

###### [Resolving Abstract Types](#sec-Value-Completion.Resolving-Abstract-Types "link to this subsection")

When completing a field with an abstract return type, that is an Interface or Union return type, first the abstract type must be resolved to a relevant Object type. This determination is made by the internal system using whatever means appropriate.

[Note](#note-5ee58) A common method of determining the Object type for an objectValue in object-oriented environments, such as Java or C#, is to use the class name of the objectValue.

[ResolveAbstractType](#ResolveAbstractType\(\))(abstractType, objectValue)

1.  Return the result of calling the internal method provided by the type system for determining the Object type of abstractType given the value objectValue.

### [6.4.4](#sec-Handling-Execution-Errors)Handling Execution Errors

An [execution error](#execution-error) is an error raised during field execution, value resolution or coercion, at a specific [response position](#response-position). While these errors must be reported in the response, they are “handled” by producing partial "data" in the [response](#response).

[Note](#note-80a26) This is distinct from a [request error](#request-error) which results in a [request error result](#request-error-result) with no data.

If an execution error is raised while resolving a field (either directly or nested inside any lists), it is handled as though the [response position](#response-position) at which the error occurred resolved to null, and the error must be added to the "errors" list in the [execution result](#execution-result).

If the result of resolving a [response position](#response-position) is null (either due to the result of [ResolveFieldValue](#ResolveFieldValue\(\))() or because an execution error was raised), and that position is of a `Non-Null` type, then an execution error is raised at that position. The error must be added to the "errors" list in the [execution result](#execution-result).

If a [response position](#response-position) resolves to null because of an execution error which has already been added to the "errors" list in the [execution result](#execution-result), the "errors" list must not be further affected. That is, only one error should be added to the errors list per [response position](#response-position).

Since `Non-Null` response positions cannot be null, execution errors are propagated to be handled by the parent [response position](#response-position). If the parent response position may be null then it resolves to null, otherwise if it is a `Non-Null` type, the execution error is further propagated to its parent [response position](#response-position).

If a `List` type wraps a `Non-Null` type, and one of the [response position](#response-position) elements of that list resolves to null, then the entire list [response position](#response-position) must resolve to null. If the `List` type is also wrapped in a `Non-Null`, the execution error continues to propagate upwards.

If every [response position](#response-position) from the root of the request to the source of the execution error has a `Non-Null` type, then the "data" entry in the [execution result](#execution-result) should be null.

# [7](#sec-Response)Response

When a GraphQL service receives a [request](#request), it must return a well-formed response. The service’s response describes the result of executing the requested operation if successful, and describes any errors raised during the request.

A response may contain both a partial response as well as a list of errors in the case that any [execution error](#execution-error) was raised and replaced with null.

## [7.1](#sec-Response-Format)Response Format

A GraphQL request returns a [response](#response). A [response](#response) is either an [execution result](#execution-result), a [response stream](#response-stream), or a [request error result](#request-error-result).

### [7.1.1](#sec-Execution-Result)Execution Result

A GraphQL request returns an [execution result](#execution-result) when the GraphQL operation is a query or mutation and the request included execution. Additionally, for each event in a subscription’s [source stream](#source-stream), the [response stream](#response-stream) will emit an [execution result](#execution-result).

An [execution result](#execution-result) must be a map.

The [execution result](#execution-result) must contain an entry with key "data". The value of this entry is described in the “Data” section.

If execution raised any errors, the [execution result](#execution-result) must contain an entry with key "errors". The value of this entry must be a non-empty list of [execution error](#execution-error) raised during execution. Each error must be a map as described in the “Errors” section below. If the request completed without raising any errors, this entry must not be present.

[Note](#note-19ca4) When "errors" is present in an [execution result](#execution-result), it may be helpful for it to appear first when serialized to make it more apparent that errors are present.

The [execution result](#execution-result) may also contain an entry with key `extensions`. The value of this entry is described in the “Extensions” section.

### [7.1.2](#sec-Response-Format.Response-Stream)Response Stream

A GraphQL request returns a [response stream](#response-stream) when the GraphQL operation is a subscription and the request included execution. A response stream must be a stream of [execution result](#execution-result).

### [7.1.3](#sec-Request-Error-Result)Request Error Result

A GraphQL request returns a [request error result](#request-error-result) when one or more [request error](#request-error) are raised, causing the request to fail before execution. This request will result in no response data.

[Note](#note-fc078) A [request error](#request-error) may be raised before execution due to missing information, syntax errors, validation failure, coercion failure, or any other reason the implementation may determine should prevent the request from proceeding.

A [request error result](#request-error-result) must be a map.

The [request error result](#request-error-result) map must contain an entry with key "errors". The value of this entry must be a non-empty list of [request error](#request-error) raised during the [request](#request). It must contain at least one [request error](#request-error) indicating why no data was able to be returned. Each error must be a map as described in the “Errors” section below.

[Note](#note-4d54d) It may be helpful for the "errors" key to appear first when serialized to make it more apparent that errors are present.

The [request error result](#request-error-result) map must not contain an entry with key "data".

The [request error result](#request-error-result) map may also contain an entry with key `extensions`. The value of this entry is described in the “Extensions” section.

### [7.1.4](#sec-Response-Position)Response Position

A [response position](#response-position) is a uniquely identifiable position in the response data produced during execution. It is either a direct entry in the resultMap of a ExecuteSelectionSet(), or it is a position in a (potentially nested) List value. Each response position is uniquely identifiable via a [response path](#response-path).

A [response path](#response-path) uniquely identifies a [response position](#response-position) via a list of path segments (response names or list indices) starting at the root of the response and ending with the associated response position.

The value for a [response path](#response-path) must be a list of path segments. Path segments that represent field [response name](#response-name) must be strings, and path segments that represent list indices must be 0-indexed integers. If a path segment is associated with an aliased field it must use the aliased name, since it represents a path in the response, not in the request.

When a [response path](#response-path) is present on an _error result_, it identifies the [response position](#response-position) which raised the error.

A single field execution may result in multiple response positions. For example,

[Example № 208](#example-95aa3)`{   hero(episode: $episode) {     name     friends {       name     }   } }`

The hero’s name would be found in the [response position](#response-position) identified by the [response path](#response-path) `["hero", "name"]`. The List of the hero’s friends would be found at `["hero", "friends"]`, the hero’s first friend at `["hero", "friends", 0]` and that friend’s name at `["hero", "friends", 0, "name"]`.

### [7.1.5](#sec-Data)Data

The "data" entry in the [execution result](#execution-result) will be the result of the execution of the requested operation. If the operation was a query, this output will be an object of the query root operation type; if the operation was a mutation, this output will be an object of the mutation root operation type.

The response data is the result of accumulating the resolved result of all response positions during execution.

If an error was raised before execution begins, the [response](#response) must be a [request error result](#request-error-result) which will result in no response data.

If an error was raised during the execution that prevented a valid response, the "data" entry in the response should be `null`.

### [7.1.6](#sec-Errors)Errors

The "errors" entry in the [execution result](#execution-result) or [request error result](#request-error-result) is a non-empty list of errors raised during the [request](#request), where each error is a map of data described by the error result format below.

###### [Request Errors](#sec-Errors.Request-Errors "link to this subsection")

A [request error](#request-error) is an error raised during a [request](#request) which results in no response data. Typically raised before execution begins, a request error may occur due to a parse grammar or validation error in the _Document_, an inability to determine which operation to execute, or invalid input values for variables.

A request error is typically the fault of the requesting client.

If a request error is raised, the [response](#response) must be a [request error result](#request-error-result). The "data" entry in this map must not be present, the "errors" entry must include the error, and request execution should be halted.

###### [Execution Errors](#sec-Errors.Execution-Errors "link to this subsection")

An [execution error](#execution-error) is an error raised during the execution of a particular field which results in partial response data. This may occur due to failure to coerce the arguments for the field, an internal error during value resolution, or failure to coerce the resulting value.

[Note](#note-d628e) In previous versions of this specification [execution error](#execution-error) was called _field error_.

An execution error is typically the fault of a GraphQL service.

An [execution error](#execution-error) must occur at a specific [response position](#response-position), and may occur in any response position. The response position of an execution error is indicated via a [response path](#response-path) in the error response’s "path" entry.

When an execution error is raised at a given [response position](#response-position), then that response position must not be present within the [response](#response) "data" entry (except null), and the "errors" entry must include the error. Nested execution is halted and sibling execution attempts to continue, producing partial result (see [Handling Execution Errors](#sec-Handling-Execution-Errors)).

###### [Error Result Format](#sec-Errors.Error-Result-Format "link to this subsection")

Every error must contain an entry with the key "message" with a string description of the error intended for the developer as a guide to understand and correct the error.

If an error can be associated to a particular point in the requested GraphQL document, it should contain an entry with the key "locations" with a list of locations, where each location is a map with the keys "line" and "column", both positive numbers starting from `1` which describe the beginning of an associated syntax element.

If an error can be associated to a particular field in the GraphQL result, it must contain an entry with the key "path" with a [response path](#response-path) which describes the [response position](#response-position) which raised the error. This allows clients to identify whether a null resolved result is a true value or the result of an [execution error](#execution-error).

For example, if fetching one of the friends’ names fails in the following operation:

[Example № 209](#example-bc485)`{   hero(episode: $episode) {     name     heroFriends: friends {       id       name     }   } }`

The response might look like:

[Example № 210](#example-072c4)`{   "errors": [     {       "message": "Name for character with ID 1002 could not be fetched.",       "locations": [{ "line": 6, "column": 7 }],       "path": ["hero", "heroFriends", 1, "name"]     }   ],   "data": {     "hero": {       "name": "R2-D2",       "heroFriends": [         {           "id": "1000",           "name": "Luke Skywalker"         },         {           "id": "1002",           "name": null         },         {           "id": "1003",           "name": "Leia Organa"         }       ]     }   } }`

If the field which experienced an error was declared as `Non-Null`, the `null` result will bubble up to the next nullable field. In that case, the `path` for the error should include the full path to the result field where the error was raised, even if that field is not present in the response.

For example, if the `name` field from above had declared a `Non-Null` return type in the schema, the result would look different but the error reported would be the same:

[Example № 211](#example-c18ef)`{   "errors": [     {       "message": "Name for character with ID 1002 could not be fetched.",       "locations": [{ "line": 6, "column": 7 }],       "path": ["hero", "heroFriends", 1, "name"]     }   ],   "data": {     "hero": {       "name": "R2-D2",       "heroFriends": [         {           "id": "1000",           "name": "Luke Skywalker"         },         null,         {           "id": "1003",           "name": "Leia Organa"         }       ]     }   } }`

GraphQL services may provide an additional entry to errors with key `extensions`. This entry, if set, must have a map as its value. This entry is reserved for implementers to add additional information to errors however they see fit, and there are no additional restrictions on its contents.

[Example № 212](#example-8b658)`{   "errors": [     {       "message": "Name for character with ID 1002 could not be fetched.",       "locations": [{ "line": 6, "column": 7 }],       "path": ["hero", "heroFriends", 1, "name"],       "extensions": {         "code": "CAN_NOT_FETCH_BY_ID",         "timestamp": "Fri Feb 9 14:33:09 UTC 2018"       }     }   ] }`

GraphQL services should not provide any additional entries to the error format since they could conflict with additional entries that may be added in future versions of this specification.

[Note](#note-5c13b) Previous versions of this spec did not describe the `extensions` entry for error formatting. While non-specified entries are not violations, they are still discouraged.

[Counter Example № 213](#example-78af4)`{   "errors": [     {       "message": "Name for character with ID 1002 could not be fetched.",       "locations": [{ "line": 6, "column": 7 }],       "path": ["hero", "heroFriends", 1, "name"],       "code": "CAN_NOT_FETCH_BY_ID",       "timestamp": "Fri Feb 9 14:33:09 UTC 2018"     }   ] }`

### [7.1.7](#sec-Extensions)Extensions

The "extensions" entry in an [execution result](#execution-result) or [request error result](#request-error-result), if set, must have a map as its value. This entry is reserved for implementers to extend the protocol however they see fit, and hence there are no additional restrictions on its contents.

### [7.1.8](#sec-Additional-Entries)Additional Entries

To ensure future changes to the protocol do not break existing services and clients, the [execution result](#execution-result) and [request error result](#request-error-result) maps must not contain any entries other than those described above. Clients must ignore any entries other than those described above.

## [7.2](#sec-Serialization-Format)Serialization Format

GraphQL does not require a specific serialization format. However, clients should use a serialization format that supports the major primitives in the GraphQL response. In particular, the serialization format must at least support representations of the following four primitives:

-   Map
-   List
-   String
-   Null

A serialization format should also support the following primitives, each representing one of the common GraphQL scalar types, however a string or simpler primitive may be used as a substitute if any are not directly supported:

-   Boolean
-   Int
-   Float
-   Enum Value

This is not meant to be an exhaustive list of what a serialization format may encode. For example custom scalars representing a Date, Time, URI, or number with a different precision may be represented in whichever relevant format a given serialization format may support.

### [7.2.1](#sec-JSON-Serialization)JSON Serialization

JSON is the most common serialization format for GraphQL. Though as mentioned above, GraphQL does not require a specific serialization format.

When using JSON as a serialization of GraphQL responses, the following JSON values should be used to encode the related GraphQL values:

| GraphQL Value | JSON Value |
| --- | --- |
| Map | Object |
| List | Array |
| Null | null |
| String | String |
| Boolean | true or false |
| Int | Number |
| Float | Number |
| Enum Value | String |

[Note](#note-786e2) For consistency and ease of notation, examples of responses are given in JSON format throughout this document.

### [7.2.2](#sec-Serialized-Map-Ordering)Serialized Map Ordering

Since the result of evaluating a [selection set](#selection-set) is ordered, the serialized Map of results should preserve this order by writing the map entries in the same order as those fields were requested as defined by selection set execution. Producing a serialized response where fields are represented in the same order in which they appear in the request improves human readability during debugging and enables more efficient parsing of responses if the order of properties can be anticipated.

Serialization formats which represent an ordered map should preserve the order of requested fields as defined by [CollectFields](#CollectFields\(\))() in the Execution section. Serialization formats which only represent unordered maps but where order is still implicit in the serialization’s textual order (such as JSON) should preserve the order of requested fields textually.

For example, if the request was `{ name, age }`, a GraphQL service responding in JSON should respond with `{ "name": "Mark", "age": 30 }` and should not respond with `{ "age": 30, "name": "Mark" }`.

While JSON Objects are specified as an [unordered collection of key-value pairs](https://tools.ietf.org/html/rfc7159#section-4) the pairs are represented in an ordered manner. In other words, while the JSON strings `{ "name": "Mark", "age": 30 }` and `{ "age": 30, "name": "Mark" }` encode the same value, they also have observably different property orderings.

[Note](#note-4bb20) This does not violate the JSON spec, as clients may still interpret objects in the response as unordered Maps and arrive at a valid value.

# [A](#sec-Appendix-Conformance)Appendix: Conformance

A conforming implementation of GraphQL must fulfill all normative requirements. Conformance requirements are described in this document via both descriptive assertions and key words with clearly defined meanings.

The key words “MUST”, “MUST NOT”, “REQUIRED”, “SHALL”, “SHALL NOT”, “SHOULD”, “SHOULD NOT”, “RECOMMENDED”, “MAY”, and “OPTIONAL” in the normative portions of this document are to be interpreted as described in [IETF RFC 2119](https://tools.ietf.org/html/rfc2119). These key words may appear in lowercase and still retain their meaning unless explicitly declared as non-normative.

A conforming implementation of GraphQL may provide additional functionality, but must not do so where explicitly disallowed or where it would otherwise result in non-conformance.

###### [Conforming Algorithms](#sec-Appendix-Conformance.Conforming-Algorithms "link to this subsection")

Algorithm steps phrased in imperative grammar (e.g. “Return the result of calling resolver”) are to be interpreted with the same level of requirement as the algorithm it is contained within. Any algorithm referenced within an algorithm step (e.g. “Let completedResult be the result of calling CompleteValue()”) is to be interpreted as having at least the same level of requirement as the algorithm containing that step.

Conformance requirements expressed as algorithms and data collections can be fulfilled by an implementation of this specification in any way as long as the perceived result is equivalent. Algorithms described in this document are written to be easy to understand. Implementers are encouraged to include equivalent but optimized implementations.

See [Appendix A](#sec-Appendix-Notation-Conventions) for more details about the definition of algorithms, data collections, and other notational conventions used in this document.

###### [Non-Normative Portions](#sec-Appendix-Conformance.Non-Normative-Portions "link to this subsection")

All contents of this document are normative except portions explicitly declared as non-normative.

Examples in this document are non-normative, and are presented to aid understanding of introduced concepts and the behavior of normative portions of the specification. Examples are either introduced explicitly in prose (e.g. “for example”) or are set apart in example or counterexample blocks, like this:

[Example № 214](#example-fed99)`This is an example of a non-normative example.`

[Counter Example № 215](#example-189c5)`This is an example of a non-normative counterexample.`

Notes in this document are non-normative, and are presented to clarify intent, draw attention to potential edge cases and pitfalls, and answer common questions that arise during implementation. Notes are either introduced explicitly in prose (e.g. “Note: “) or are set apart in a note block, like this:

[Note](#note-c0129) This is an example of a non-normative note.

# [B](#sec-Appendix-Notation-Conventions)Appendix: Notation Conventions

This specification document contains a number of notation conventions used to describe technical concepts such as language grammar and semantics as well as runtime algorithms.

This appendix seeks to explain these notations in greater detail to avoid ambiguity.

## [B.1](#sec-Context-Free-Grammar)Context-Free Grammar

A context-free grammar consists of a number of productions. Each production has an abstract symbol called a “non-terminal” as its left-hand side, and zero or more possible sequences of non-terminal symbols and/or terminal characters as its right-hand side.

Starting from a single goal non-terminal symbol, a context-free grammar describes a language: the set of possible sequences of characters that can be described by repeatedly replacing any non-terminal in the goal sequence with one of the sequences it is defined by, until all non-terminal symbols have been replaced by terminal characters.

Terminals are represented in this document in a monospace font in two forms: a specific Unicode character or sequence of Unicode characters (i.e. \= or terminal), and prose typically describing a specific Unicode code point "Space (U+0020)". Sequences of Unicode characters only appear in syntactic grammars and represent a [Name](#Name) token of that specific sequence.

Non-terminal production rules are represented in this document using the following notation for a non-terminal with a single definition:

[NonTerminalWithSingleDefinition](#NonTerminalWithSingleDefinition)

NonTerminalterminal

While using the following notation for a production with a list of definitions:

[NonTerminalWithManyDefinitions](#NonTerminalWithManyDefinitions)

OtherNonTerminalterminal

terminal

A definition may refer to itself, which describes repetitive sequences, for example:

[ListOfLetterA](#ListOfLetterA)

[ListOfLetterA](#ListOfLetterA)a

a

## [B.2](#sec-Lexical-and-Syntactic-Grammar)Lexical and Syntactic Grammar

The GraphQL language is defined in a syntactic grammar where terminal symbols are tokens. Tokens are defined in a lexical grammar which matches patterns of source characters. The result of parsing a source text sequence of Unicode characters first produces a sequence of lexical tokens according to the lexical grammar which then produces abstract syntax tree (AST) according to the syntactic grammar.

A lexical grammar production describes non-terminal “tokens” by patterns of terminal Unicode characters. No “whitespace” or other ignored characters may appear between any terminal Unicode characters in the lexical grammar production. A lexical grammar production is distinguished by a two colon `::` definition.

[Word](#Word)

[Letter](#Letter)list

A Syntactic grammar production describes non-terminal “rules” by patterns of terminal Tokens. [Whitespace](#Whitespace) and other [Ignored](#Ignored) sequences may appear before or after any terminal [Token](#Token). A syntactic grammar production is distinguished by a one colon `:` definition.

[Sentence](#Sentence)

[Word](#Word)list.

## [B.3](#sec-Grammar-Notation)Grammar Notation

This specification uses some additional notation to describe common patterns, such as optional or repeated patterns, or parameterized alterations of the definition of a non-terminal. This section explains these shorthand notations and their expanded definitions in the context-free grammar.

###### [Constraints](#sec-Grammar-Notation.Constraints "link to this subsection")

A grammar production may specify that certain expansions are not permitted by using the phrase “but not” and then indicating the expansions to be excluded.

For example, the following production means that the non-terminal [SafeWord](#SafeWord) may be replaced by any sequence of characters that could replace [Word](#Word) provided that the same sequence of characters could not replace SevenCarlinWords.

[SafeWord](#SafeWord)

[Word](#Word)SevenCarlinWords

A grammar may also list a number of restrictions after “but not” separated by “or”.

For example:

[NonBooleanName](#NonBooleanName)

[Name](#Name)truefalse

###### [Lookahead Restrictions](#sec-Grammar-Notation.Lookahead-Restrictions "link to this subsection")

A grammar production may specify that certain characters or tokens are not permitted to follow it by using the pattern NotAllowed. Lookahead restrictions are often used to remove ambiguity from the grammar.

The following example makes it clear that [Letter](#Letter)list must be greedy, since [Word](#Word) cannot be followed by yet another [Letter](#Letter).

[Word](#Word)

[Letter](#Letter)list[Letter](#Letter)

###### [Optionality and Lists](#sec-Grammar-Notation.Optionality-and-Lists "link to this subsection")

A subscript suffix “Symbolopt” is shorthand for two possible sequences, one including that symbol and one excluding it.

As an example:

[Sentence](#Sentence)

NounVerbAdverbopt

is shorthand for

[Sentence](#Sentence)

NounVerbAdverb

NounVerb

A subscript suffix “Symbollist” is shorthand for a list of one or more of that symbol, represented as an additional recursive production.

As an example:

[Book](#Book)

CoverPagelistCover

is shorthand for

[Book](#Book)

Cover[Page\_list](#Page_list)Cover

[Page\_list](#Page_list)

[Page\_list](#Page_list)Page

Page

###### [Parameterized Grammar Productions](#sec-Grammar-Notation.Parameterized-Grammar-Productions "link to this subsection")

A symbol definition subscript suffix parameter in braces “SymbolParam” is shorthand for two symbol definitions, one appended with that parameter name, the other without. The same subscript suffix on a symbol is shorthand for that variant of the definition. If the parameter starts with “?”, that form of the symbol is used if in a symbol definition with the same parameter. Some possible sequences can be included or excluded conditionally when respectively prefixed with “\[+Param\]” and “\[~Param\]”.

As an example:

[Example](#Example)Param

A

BParam

CParam

ParamD

ParamE

is shorthand for

[Example](#Example)

A

B\_param

C

E

[Example\_param](#Example_param)

A

B\_param

C\_param

D

## [B.4](#sec-Grammar-Semantics)Grammar Semantics

This specification describes the semantic value of many grammar productions in the form of a list of algorithmic steps.

For example, this describes how a parser should interpret a string literal:

[StringValue](#StringValue)

""

1.  Return an empty Unicode character sequence.

[StringValue](#StringValue)

"[StringCharacter](#StringCharacter)list"

1.  Return the Unicode character sequence of all [StringCharacter](#StringCharacter) Unicode character values.

## [B.5](#sec-Algorithms)Algorithms

This specification describes some algorithms used by the static and runtime semantics, they’re defined in the form of a function-like syntax with the algorithm’s name and the arguments it accepts along with a list of algorithmic steps to take in the order listed. Each step may establish references to other values, check various conditions, call other algorithms, and eventually return a value representing the outcome of the algorithm for the provided arguments.

For example, the following example describes an algorithm named Fibonacci which accepts a single argument number. The algorithm’s steps produce the next number in the Fibonacci sequence:

[Fibonacci](#Fibonacci\(\))(number)

1.  If number is 0:
    1.  Return 1.
2.  If number is 1:
    1.  Return 2.
3.  Let previousNumber be number - 1.
4.  Let previousPreviousNumber be number - 2.
5.  Return [Fibonacci](#Fibonacci\(\))(previousNumber) + [Fibonacci](#Fibonacci\(\))(previousPreviousNumber).

[Note](#note-28343) Algorithms described in this document are written to be easy to understand. Implementers are encouraged to include observably equivalent but optimized implementations.

## [B.6](#sec-Data-Collections)Data Collections

Algorithms within this specification refer to abstract data collection types to express normative structural, uniqueness, and ordering requirements. Temporary data collections internal to an algorithm use these types to best describe expected behavior, but implementers are encouraged to provide observably equivalent but optimized implementations. Implementations may use any data structure as long as the expected requirements are met.

###### [List](#sec-Data-Collections.List "link to this subsection")

A [list](#list) is an ordered collection of values which may contain duplicates. A value added to a list is ordered after existing values.

###### [Set](#sec-Data-Collections.Set "link to this subsection")

A [set](#set) is a collection of values which must not contain duplicates.

An [ordered set](#ordered-set) is a set which has a defined order. A value added to an ordered set, which does not already contain that value, is ordered after existing values.

###### [Map](#sec-Data-Collections.Map "link to this subsection")

A [map](#map) is a collection of entries, each of which has a key and value. Each entry has a unique key, and can be directly referenced by that key.

An [ordered map](#ordered-map) is a map which has a defined order. An entry added to an ordered map, which does not have an entry with that key, is ordered after existing entries.

[Note](#note-06f0f) This specification defines ordered data collection only when strictly required. When an order is observable, implementations should preserve it to improve output legibility and stability. For example if applying a grammar to an input string yields a [set](#set) of elements, serialization should emit those elements in the same source order.

# [C](#sec-Appendix-Grammar-Summary)Appendix: Grammar Summary

## [C.1](#sec-Appendix-Grammar-Summary.Source-Text)Source Text

[SourceCharacter](#SourceCharacter)

Any Unicode scalar value

## [C.2](#sec-Appendix-Grammar-Summary.Ignored-Tokens)Ignored Tokens

[Ignored](#Ignored)

[UnicodeBOM](#UnicodeBOM)

[Whitespace](#Whitespace)

[LineTerminator](#LineTerminator)

[Comment](#Comment)

[Comma](#Comma)

[UnicodeBOM](#UnicodeBOM)

Byte Order Mark (U+FEFF)

[Whitespace](#Whitespace)

Horizontal Tab (U+0009)

Space (U+0020)

[LineTerminator](#LineTerminator)

New Line (U+000A)

Carriage Return (U+000D)New Line (U+000A)

Carriage Return (U+000D)New Line (U+000A)

[Comment](#Comment)

#[CommentChar](#CommentChar)listopt[CommentChar](#CommentChar)

[CommentChar](#CommentChar)

[SourceCharacter](#SourceCharacter)[LineTerminator](#LineTerminator)

[Comma](#Comma)

,

## [C.3](#sec-Appendix-Grammar-Summary.Lexical-Tokens)Lexical Tokens

[Token](#Token)

[Punctuator](#Punctuator)

[Name](#Name)

[IntValue](#IntValue)

[FloatValue](#FloatValue)

[StringValue](#StringValue)

[Punctuator](#Punctuator)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">!</span></td><td class="spec-rhs"><span class="spec-t">$</span></td><td class="spec-rhs"><span class="spec-t">&amp;</span></td><td class="spec-rhs"><span class="spec-t">(</span></td><td class="spec-rhs"><span class="spec-t">)</span></td><td class="spec-rhs"><span class="spec-t">...</span></td><td class="spec-rhs"><span class="spec-t">:</span></td><td class="spec-rhs"><span class="spec-t">=</span></td><td class="spec-rhs"><span class="spec-t">@</span></td><td class="spec-rhs"><span class="spec-t">[</span></td><td class="spec-rhs"><span class="spec-t">]</span></td><td class="spec-rhs"><span class="spec-t">{</span></td><td class="spec-rhs"><span class="spec-t">|</span></td><td class="spec-rhs"><span class="spec-t">}</span></td></tr></tbody></table>

[Name](#Name)

[NameStart](#NameStart)[NameContinue](#NameContinue)listopt[NameContinue](#NameContinue)

[NameStart](#NameStart)

[Letter](#Letter)

\_

[NameContinue](#NameContinue)

[Letter](#Letter)

[Digit](#Digit)

\_

[Letter](#Letter)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">A</span></td><td class="spec-rhs"><span class="spec-t">B</span></td><td class="spec-rhs"><span class="spec-t">C</span></td><td class="spec-rhs"><span class="spec-t">D</span></td><td class="spec-rhs"><span class="spec-t">E</span></td><td class="spec-rhs"><span class="spec-t">F</span></td><td class="spec-rhs"><span class="spec-t">G</span></td><td class="spec-rhs"><span class="spec-t">H</span></td><td class="spec-rhs"><span class="spec-t">I</span></td><td class="spec-rhs"><span class="spec-t">J</span></td><td class="spec-rhs"><span class="spec-t">K</span></td><td class="spec-rhs"><span class="spec-t">L</span></td><td class="spec-rhs"><span class="spec-t">M</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">N</span></td><td class="spec-rhs"><span class="spec-t">O</span></td><td class="spec-rhs"><span class="spec-t">P</span></td><td class="spec-rhs"><span class="spec-t">Q</span></td><td class="spec-rhs"><span class="spec-t">R</span></td><td class="spec-rhs"><span class="spec-t">S</span></td><td class="spec-rhs"><span class="spec-t">T</span></td><td class="spec-rhs"><span class="spec-t">U</span></td><td class="spec-rhs"><span class="spec-t">V</span></td><td class="spec-rhs"><span class="spec-t">W</span></td><td class="spec-rhs"><span class="spec-t">X</span></td><td class="spec-rhs"><span class="spec-t">Y</span></td><td class="spec-rhs"><span class="spec-t">Z</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">a</span></td><td class="spec-rhs"><span class="spec-t">b</span></td><td class="spec-rhs"><span class="spec-t">c</span></td><td class="spec-rhs"><span class="spec-t">d</span></td><td class="spec-rhs"><span class="spec-t">e</span></td><td class="spec-rhs"><span class="spec-t">f</span></td><td class="spec-rhs"><span class="spec-t">g</span></td><td class="spec-rhs"><span class="spec-t">h</span></td><td class="spec-rhs"><span class="spec-t">i</span></td><td class="spec-rhs"><span class="spec-t">j</span></td><td class="spec-rhs"><span class="spec-t">k</span></td><td class="spec-rhs"><span class="spec-t">l</span></td><td class="spec-rhs"><span class="spec-t">m</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">n</span></td><td class="spec-rhs"><span class="spec-t">o</span></td><td class="spec-rhs"><span class="spec-t">p</span></td><td class="spec-rhs"><span class="spec-t">q</span></td><td class="spec-rhs"><span class="spec-t">r</span></td><td class="spec-rhs"><span class="spec-t">s</span></td><td class="spec-rhs"><span class="spec-t">t</span></td><td class="spec-rhs"><span class="spec-t">u</span></td><td class="spec-rhs"><span class="spec-t">v</span></td><td class="spec-rhs"><span class="spec-t">w</span></td><td class="spec-rhs"><span class="spec-t">x</span></td><td class="spec-rhs"><span class="spec-t">y</span></td><td class="spec-rhs"><span class="spec-t">z</span></td></tr></tbody></table>

[Digit](#Digit)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">0</span></td><td class="spec-rhs"><span class="spec-t">1</span></td><td class="spec-rhs"><span class="spec-t">2</span></td><td class="spec-rhs"><span class="spec-t">3</span></td><td class="spec-rhs"><span class="spec-t">4</span></td><td class="spec-rhs"><span class="spec-t">5</span></td><td class="spec-rhs"><span class="spec-t">6</span></td><td class="spec-rhs"><span class="spec-t">7</span></td><td class="spec-rhs"><span class="spec-t">8</span></td><td class="spec-rhs"><span class="spec-t">9</span></td></tr></tbody></table>

[IntValue](#IntValue)

[IntegerPart](#IntegerPart)[Digit](#Digit).[NameStart](#NameStart)

[IntegerPart](#IntegerPart)

[NegativeSign](#NegativeSign)opt0

[NegativeSign](#NegativeSign)opt[NonZeroDigit](#NonZeroDigit)[Digit](#Digit)listopt

[NegativeSign](#NegativeSign)

\-

[NonZeroDigit](#NonZeroDigit)

[Digit](#Digit)0

[FloatValue](#FloatValue)

[IntegerPart](#IntegerPart)[FractionalPart](#FractionalPart)[ExponentPart](#ExponentPart)[Digit](#Digit).[NameStart](#NameStart)

[IntegerPart](#IntegerPart)[FractionalPart](#FractionalPart)[Digit](#Digit).[NameStart](#NameStart)

[IntegerPart](#IntegerPart)[ExponentPart](#ExponentPart)[Digit](#Digit).[NameStart](#NameStart)

[FractionalPart](#FractionalPart)

.[Digit](#Digit)list

[ExponentPart](#ExponentPart)

[ExponentIndicator](#ExponentIndicator)[Sign](#Sign)opt[Digit](#Digit)list

[ExponentIndicator](#ExponentIndicator)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">e</span></td><td class="spec-rhs"><span class="spec-t">E</span></td></tr></tbody></table>

[Sign](#Sign)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">+</span></td><td class="spec-rhs"><span class="spec-t">-</span></td></tr></tbody></table>

[StringValue](#StringValue)

"""

"[StringCharacter](#StringCharacter)list"

[BlockString](#BlockString)

[StringCharacter](#StringCharacter)

[SourceCharacter](#SourceCharacter)"\\[LineTerminator](#LineTerminator)

\\u[EscapedUnicode](#EscapedUnicode)

\\[EscapedCharacter](#EscapedCharacter)

[EscapedUnicode](#EscapedUnicode)

{[HexDigit](#HexDigit)list}

[HexDigit](#HexDigit)[HexDigit](#HexDigit)[HexDigit](#HexDigit)[HexDigit](#HexDigit)

[HexDigit](#HexDigit)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">0</span></td><td class="spec-rhs"><span class="spec-t">1</span></td><td class="spec-rhs"><span class="spec-t">2</span></td><td class="spec-rhs"><span class="spec-t">3</span></td><td class="spec-rhs"><span class="spec-t">4</span></td><td class="spec-rhs"><span class="spec-t">5</span></td><td class="spec-rhs"><span class="spec-t">6</span></td><td class="spec-rhs"><span class="spec-t">7</span></td><td class="spec-rhs"><span class="spec-t">8</span></td><td class="spec-rhs"><span class="spec-t">9</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">A</span></td><td class="spec-rhs"><span class="spec-t">B</span></td><td class="spec-rhs"><span class="spec-t">C</span></td><td class="spec-rhs"><span class="spec-t">D</span></td><td class="spec-rhs"><span class="spec-t">E</span></td><td class="spec-rhs"><span class="spec-t">F</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">a</span></td><td class="spec-rhs"><span class="spec-t">b</span></td><td class="spec-rhs"><span class="spec-t">c</span></td><td class="spec-rhs"><span class="spec-t">d</span></td><td class="spec-rhs"><span class="spec-t">e</span></td><td class="spec-rhs"><span class="spec-t">f</span></td></tr></tbody></table>

[EscapedCharacter](#EscapedCharacter)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">"</span></td><td class="spec-rhs"><span class="spec-t">\</span></td><td class="spec-rhs"><span class="spec-t">/</span></td><td class="spec-rhs"><span class="spec-t">b</span></td><td class="spec-rhs"><span class="spec-t">f</span></td><td class="spec-rhs"><span class="spec-t">n</span></td><td class="spec-rhs"><span class="spec-t">r</span></td><td class="spec-rhs"><span class="spec-t">t</span></td></tr></tbody></table>

[BlockString](#BlockString)

"""[BlockStringCharacter](#BlockStringCharacter)listopt"""

[BlockStringCharacter](#BlockStringCharacter)

[SourceCharacter](#SourceCharacter)"""\\"""

\\"""

[Note](#note-5ad29) Block string values are interpreted to exclude blank initial and trailing lines and uniform indentation with [BlockStringValue](#BlockStringValue\(\))().

## [C.4](#sec-Document-Syntax)Document Syntax

[Description](#Description)

[StringValue](#StringValue)

[Document](#Document)

[Definition](#Definition)list

[Definition](#Definition)

[ExecutableDefinition](#ExecutableDefinition)

[TypeSystemDefinitionOrExtension](#TypeSystemDefinitionOrExtension)

[ExecutableDocument](#ExecutableDocument)

[ExecutableDefinition](#ExecutableDefinition)list

[ExecutableDefinition](#ExecutableDefinition)

[OperationDefinition](#OperationDefinition)

[FragmentDefinition](#FragmentDefinition)

[OperationDefinition](#OperationDefinition)

[Description](#Description)opt[OperationType](#OperationType)[Name](#Name)opt[VariablesDefinition](#VariablesDefinition)opt[Directives](#Directives)opt[SelectionSet](#SelectionSet)

[SelectionSet](#SelectionSet)

[OperationType](#OperationType)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">query</span></td><td class="spec-rhs"><span class="spec-t">mutation</span></td><td class="spec-rhs"><span class="spec-t">subscription</span></td></tr></tbody></table>

[SelectionSet](#SelectionSet)

{[Selection](#Selection)list}

[Selection](#Selection)

[Field](#Field)

[FragmentSpread](#FragmentSpread)

[InlineFragment](#InlineFragment)

[Field](#Field)

[Alias](#Alias)opt[Name](#Name)[Arguments](#Arguments)opt[Directives](#Directives)opt[SelectionSet](#SelectionSet)opt

[Alias](#Alias)

[Name](#Name):

[Arguments](#Arguments)Const

([Argument](#Argument)Constlist)

[Argument](#Argument)Const

[Name](#Name):[Value](#Value)Const

[FragmentSpread](#FragmentSpread)

...[FragmentName](#FragmentName)[Directives](#Directives)opt

[InlineFragment](#InlineFragment)

...[TypeCondition](#TypeCondition)opt[Directives](#Directives)opt[SelectionSet](#SelectionSet)

[FragmentDefinition](#FragmentDefinition)

[Description](#Description)optfragment[FragmentName](#FragmentName)[TypeCondition](#TypeCondition)[Directives](#Directives)opt[SelectionSet](#SelectionSet)

[FragmentName](#FragmentName)

[Name](#Name)on

[TypeCondition](#TypeCondition)

on[NamedType](#NamedType)

[Value](#Value)Const

Const[Variable](#Variable)

[IntValue](#IntValue)

[FloatValue](#FloatValue)

[StringValue](#StringValue)

[BooleanValue](#BooleanValue)

[NullValue](#NullValue)

[EnumValue](#EnumValue)

[ListValue](#ListValue)Const

[ObjectValue](#ObjectValue)Const

[BooleanValue](#BooleanValue)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">true</span></td><td class="spec-rhs"><span class="spec-t">false</span></td></tr></tbody></table>

[NullValue](#NullValue)

null

[EnumValue](#EnumValue)

[Name](#Name)truefalsenull

[ListValue](#ListValue)Const

\[\]

\[[Value](#Value)Constlist\]

[ObjectValue](#ObjectValue)Const

{}

{[ObjectField](#ObjectField)Constlist}

[ObjectField](#ObjectField)Const

[Name](#Name):[Value](#Value)Const

[VariablesDefinition](#VariablesDefinition)

([VariableDefinition](#VariableDefinition)list)

[VariableDefinition](#VariableDefinition)

[Description](#Description)opt[Variable](#Variable):[Type](#Type)[DefaultValue](#DefaultValue)opt[Directives](#Directives)Constopt

[Variable](#Variable)

$[Name](#Name)

[DefaultValue](#DefaultValue)

\=[Value](#Value)Const

[Type](#Type)

[NamedType](#NamedType)

[ListType](#ListType)

[NonNullType](#NonNullType)

[NamedType](#NamedType)

[Name](#Name)

[ListType](#ListType)

\[[Type](#Type)\]

[NonNullType](#NonNullType)

[NamedType](#NamedType)!

[ListType](#ListType)!

[Directives](#Directives)Const

[Directive](#Directive)Constlist

[Directive](#Directive)Const

@[Name](#Name)[Arguments](#Arguments)Constopt

[TypeSystemDocument](#TypeSystemDocument)

[TypeSystemDefinition](#TypeSystemDefinition)list

[TypeSystemDefinition](#TypeSystemDefinition)

[SchemaDefinition](#SchemaDefinition)

[TypeDefinition](#TypeDefinition)

[DirectiveDefinition](#DirectiveDefinition)

[TypeSystemExtensionDocument](#TypeSystemExtensionDocument)

[TypeSystemDefinitionOrExtension](#TypeSystemDefinitionOrExtension)list

[TypeSystemDefinitionOrExtension](#TypeSystemDefinitionOrExtension)

[TypeSystemDefinition](#TypeSystemDefinition)

[TypeSystemExtension](#TypeSystemExtension)

[TypeSystemExtension](#TypeSystemExtension)

[SchemaExtension](#SchemaExtension)

[TypeExtension](#TypeExtension)

[DirectiveExtension](#DirectiveExtension)

[SchemaDefinition](#SchemaDefinition)

[Description](#Description)optschema[Directives](#Directives)Constopt{[RootOperationTypeDefinition](#RootOperationTypeDefinition)list}

[SchemaExtension](#SchemaExtension)

extendschema[Directives](#Directives)Constopt{[RootOperationTypeDefinition](#RootOperationTypeDefinition)list}

extendschema[Directives](#Directives)Const{

[RootOperationTypeDefinition](#RootOperationTypeDefinition)

[OperationType](#OperationType):[NamedType](#NamedType)

[TypeDefinition](#TypeDefinition)

[ScalarTypeDefinition](#ScalarTypeDefinition)

[ObjectTypeDefinition](#ObjectTypeDefinition)

[InterfaceTypeDefinition](#InterfaceTypeDefinition)

[UnionTypeDefinition](#UnionTypeDefinition)

[EnumTypeDefinition](#EnumTypeDefinition)

[InputObjectTypeDefinition](#InputObjectTypeDefinition)

[TypeExtension](#TypeExtension)

[ScalarTypeExtension](#ScalarTypeExtension)

[ObjectTypeExtension](#ObjectTypeExtension)

[InterfaceTypeExtension](#InterfaceTypeExtension)

[UnionTypeExtension](#UnionTypeExtension)

[EnumTypeExtension](#EnumTypeExtension)

[InputObjectTypeExtension](#InputObjectTypeExtension)

[ScalarTypeDefinition](#ScalarTypeDefinition)

[Description](#Description)optscalar[Name](#Name)[Directives](#Directives)Constopt

[ScalarTypeExtension](#ScalarTypeExtension)

extendscalar[Name](#Name)[Directives](#Directives)Const

[ObjectTypeDefinition](#ObjectTypeDefinition)

[Description](#Description)opttype[Name](#Name)[ImplementsInterfaces](#ImplementsInterfaces)opt[Directives](#Directives)Constopt[FieldsDefinition](#FieldsDefinition)

[Description](#Description)opttype[Name](#Name)[ImplementsInterfaces](#ImplementsInterfaces)opt[Directives](#Directives)Constopt{

[ObjectTypeExtension](#ObjectTypeExtension)

extendtype[Name](#Name)[ImplementsInterfaces](#ImplementsInterfaces)opt[Directives](#Directives)Constopt[FieldsDefinition](#FieldsDefinition)

extendtype[Name](#Name)[ImplementsInterfaces](#ImplementsInterfaces)opt[Directives](#Directives)Const{

extendtype[Name](#Name)[ImplementsInterfaces](#ImplementsInterfaces){

[ImplementsInterfaces](#ImplementsInterfaces)

[ImplementsInterfaces](#ImplementsInterfaces)&[NamedType](#NamedType)

implements&opt[NamedType](#NamedType)

[FieldsDefinition](#FieldsDefinition)

{[FieldDefinition](#FieldDefinition)list}

[FieldDefinition](#FieldDefinition)

[Description](#Description)opt[Name](#Name)[ArgumentsDefinition](#ArgumentsDefinition)opt:[Type](#Type)[Directives](#Directives)Constopt

[ArgumentsDefinition](#ArgumentsDefinition)

([InputValueDefinition](#InputValueDefinition)list)

[InputValueDefinition](#InputValueDefinition)

[Description](#Description)opt[Name](#Name):[Type](#Type)[DefaultValue](#DefaultValue)opt[Directives](#Directives)Constopt

[InterfaceTypeDefinition](#InterfaceTypeDefinition)

[Description](#Description)optinterface[Name](#Name)[ImplementsInterfaces](#ImplementsInterfaces)opt[Directives](#Directives)Constopt[FieldsDefinition](#FieldsDefinition)

[Description](#Description)optinterface[Name](#Name)[ImplementsInterfaces](#ImplementsInterfaces)opt[Directives](#Directives)Constopt{

[InterfaceTypeExtension](#InterfaceTypeExtension)

extendinterface[Name](#Name)[ImplementsInterfaces](#ImplementsInterfaces)opt[Directives](#Directives)Constopt[FieldsDefinition](#FieldsDefinition)

extendinterface[Name](#Name)[ImplementsInterfaces](#ImplementsInterfaces)opt[Directives](#Directives)Const{

extendinterface[Name](#Name)[ImplementsInterfaces](#ImplementsInterfaces){

[UnionTypeDefinition](#UnionTypeDefinition)

[Description](#Description)optunion[Name](#Name)[Directives](#Directives)Constopt[UnionMemberTypes](#UnionMemberTypes)opt

[UnionMemberTypes](#UnionMemberTypes)

[UnionMemberTypes](#UnionMemberTypes)|[NamedType](#NamedType)

\=|opt[NamedType](#NamedType)

[UnionTypeExtension](#UnionTypeExtension)

extendunion[Name](#Name)[Directives](#Directives)Constopt[UnionMemberTypes](#UnionMemberTypes)

extendunion[Name](#Name)[Directives](#Directives)Const

[EnumTypeDefinition](#EnumTypeDefinition)

[Description](#Description)optenum[Name](#Name)[Directives](#Directives)Constopt[EnumValuesDefinition](#EnumValuesDefinition)

[Description](#Description)optenum[Name](#Name)[Directives](#Directives)Constopt{

[EnumValuesDefinition](#EnumValuesDefinition)

{[EnumValueDefinition](#EnumValueDefinition)list}

[EnumValueDefinition](#EnumValueDefinition)

[Description](#Description)opt[EnumValue](#EnumValue)[Directives](#Directives)Constopt

[EnumTypeExtension](#EnumTypeExtension)

extendenum[Name](#Name)[Directives](#Directives)Constopt[EnumValuesDefinition](#EnumValuesDefinition)

extendenum[Name](#Name)[Directives](#Directives)Const{

[InputObjectTypeDefinition](#InputObjectTypeDefinition)

[Description](#Description)optinput[Name](#Name)[Directives](#Directives)Constopt[InputFieldsDefinition](#InputFieldsDefinition)

[Description](#Description)optinput[Name](#Name)[Directives](#Directives)Constopt{

[InputFieldsDefinition](#InputFieldsDefinition)

{[InputValueDefinition](#InputValueDefinition)list}

[InputObjectTypeExtension](#InputObjectTypeExtension)

extendinput[Name](#Name)[Directives](#Directives)Constopt[InputFieldsDefinition](#InputFieldsDefinition)

extendinput[Name](#Name)[Directives](#Directives)Const{

[DirectiveDefinition](#DirectiveDefinition)

[Description](#Description)optdirective@[Name](#Name)[ArgumentsDefinition](#ArgumentsDefinition)opt[Directives](#Directives)Constoptrepeatableopton[DirectiveLocations](#DirectiveLocations)

[DirectiveExtension](#DirectiveExtension)

extenddirective@[Name](#Name)[Directives](#Directives)Const

[DirectiveLocations](#DirectiveLocations)

[DirectiveLocations](#DirectiveLocations)|[DirectiveLocation](#DirectiveLocation)

|opt[DirectiveLocation](#DirectiveLocation)

[DirectiveLocation](#DirectiveLocation)

[ExecutableDirectiveLocation](#ExecutableDirectiveLocation)

[TypeSystemDirectiveLocation](#TypeSystemDirectiveLocation)

[ExecutableDirectiveLocation](#ExecutableDirectiveLocation)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">QUERY</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">MUTATION</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">SUBSCRIPTION</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">FIELD</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">FRAGMENT_DEFINITION</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">FRAGMENT_SPREAD</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">INLINE_FRAGMENT</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">VARIABLE_DEFINITION</span></td></tr></tbody></table>

[TypeSystemDirectiveLocation](#TypeSystemDirectiveLocation)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">SCHEMA</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">SCALAR</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">OBJECT</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">FIELD_DEFINITION</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">ARGUMENT_DEFINITION</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">INTERFACE</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">UNION</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">ENUM</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">ENUM_VALUE</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">INPUT_OBJECT</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">INPUT_FIELD_DEFINITION</span></td></tr><tr><td class="spec-rhs"><span class="spec-t">DIRECTIVE_DEFINITION</span></td></tr></tbody></table>

## [C.5](#sec-Schema-Coordinate-Syntax)Schema Coordinate Syntax

[Note](#note-bf382) Schema coordinates must not contain [Ignored](#Ignored).

[SchemaCoordinateToken](#SchemaCoordinateToken)

[SchemaCoordinatePunctuator](#SchemaCoordinatePunctuator)

[Name](#Name)

[SchemaCoordinatePunctuator](#SchemaCoordinatePunctuator)

<table><tbody><tr><td class="spec-rhs"><span class="spec-t">(</span></td><td class="spec-rhs"><span class="spec-t">)</span></td><td class="spec-rhs"><span class="spec-t">.</span></td><td class="spec-rhs"><span class="spec-t">:</span></td><td class="spec-rhs"><span class="spec-t">@</span></td></tr></tbody></table>

[SchemaCoordinate](#SchemaCoordinate)

[TypeCoordinate](#TypeCoordinate)

[MemberCoordinate](#MemberCoordinate)

[ArgumentCoordinate](#ArgumentCoordinate)

[DirectiveCoordinate](#DirectiveCoordinate)

[DirectiveArgumentCoordinate](#DirectiveArgumentCoordinate)

[TypeCoordinate](#TypeCoordinate)

[Name](#Name)

[MemberCoordinate](#MemberCoordinate)

[Name](#Name).[Name](#Name)

[ArgumentCoordinate](#ArgumentCoordinate)

[Name](#Name).[Name](#Name)([Name](#Name):)

[DirectiveCoordinate](#DirectiveCoordinate)

@[Name](#Name)

[DirectiveArgumentCoordinate](#DirectiveArgumentCoordinate)

@[Name](#Name)([Name](#Name):)

# [D](#sec-Appendix-Type-System-Definitions)Appendix: Type System Definitions

This appendix lists all type system definitions specified in this document.

The order of types, fields, arguments, values and directives is non-normative.

```
scalar String

scalar Int

scalar Float

scalar Boolean

scalar ID

directive @include(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

directive @skip(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

directive @deprecated(
  reason: String! = "No longer supported"
) on FIELD_DEFINITION | ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION | ENUM_VALUE | DIRECTIVE_DEFINITION

directive @specifiedBy(url: String!) on SCALAR

directive @oneOf on INPUT_OBJECT

type __Schema {
  description: String
  types: [__Type!]!
  queryType: __Type!
  mutationType: __Type
  subscriptionType: __Type
  directives(includeDeprecated: Boolean! = false): [__Directive!]!
}

type __Type {
  kind: __TypeKind!
  name: String
  description: String
  specifiedByURL: String
  fields(includeDeprecated: Boolean! = false): [__Field!]
  interfaces: [__Type!]
  possibleTypes: [__Type!]
  enumValues(includeDeprecated: Boolean! = false): [__EnumValue!]
  inputFields(includeDeprecated: Boolean! = false): [__InputValue!]
  ofType: __Type
  isOneOf: Boolean
}

enum __TypeKind {
  SCALAR
  OBJECT
  INTERFACE
  UNION
  ENUM
  INPUT_OBJECT
  LIST
  NON_NULL
}

type __Field {
  name: String!
  description: String
  args(includeDeprecated: Boolean! = false): [__InputValue!]!
  type: __Type!
  isDeprecated: Boolean!
  deprecationReason: String
}

type __InputValue {
  name: String!
  description: String
  type: __Type!
  defaultValue: String
  isDeprecated: Boolean!
  deprecationReason: String
}

type __EnumValue {
  name: String!
  description: String
  isDeprecated: Boolean!
  deprecationReason: String
}

type __Directive {
  name: String!
  description: String
  isRepeatable: Boolean!
  locations: [__DirectiveLocation!]!
  args(includeDeprecated: Boolean! = false): [__InputValue!]!
  isDeprecated: Boolean!
  deprecationReason: String
}

enum __DirectiveLocation {
  QUERY
  MUTATION
  SUBSCRIPTION
  FIELD
  FRAGMENT_DEFINITION
  FRAGMENT_SPREAD
  INLINE_FRAGMENT
  VARIABLE_DEFINITION
  SCHEMA
  SCALAR
  OBJECT
  FIELD_DEFINITION
  ARGUMENT_DEFINITION
  INTERFACE
  UNION
  ENUM
  ENUM_VALUE
  INPUT_OBJECT
  INPUT_FIELD_DEFINITION
  DIRECTIVE_DEFINITION
}
```

# [E](#sec-Appendix-Copyright-and-Licensing)Appendix: Copyright and Licensing

The GraphQL Specification Project is made available by the [Joint Development Foundation](https://www.jointdevelopment.org/) Projects, LLC, GraphQL Series. The current [Working Group](https://github.com/graphql/graphql-wg) charter, which includes the IP policy governing all working group deliverables (including specifications, source code, and datasets) may be found at [https://technical-charter.graphql.org](https://technical-charter.graphql.org).

###### [Copyright Notice](#sec-Appendix-Copyright-and-Licensing.Copyright-Notice "link to this subsection")

Copyright © 2015-2018, Facebook, Inc.

Copyright © 2019-present, GraphQL contributors

THESE MATERIALS ARE PROVIDED “AS IS”. The parties expressly disclaim any warranties (express, implied, or otherwise), including implied warranties of merchantability, non-infringement, fitness for a particular purpose, or title, related to the materials. The entire risk as to implementing or otherwise using the materials is assumed by the implementer and user. IN NO EVENT WILL THE PARTIES BE LIABLE TO ANY OTHER PARTY FOR LOST PROFITS OR ANY FORM OF INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES OF ANY CHARACTER FROM ANY CAUSES OF ACTION OF ANY KIND WITH RESPECT TO THIS DELIVERABLE OR ITS GOVERNING AGREEMENT, WHETHER BASED ON BREACH OF CONTRACT, TORT (INCLUDING NEGLIGENCE), OR OTHERWISE, AND WHETHER OR NOT THE OTHER MEMBER HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

###### [Licensing](#sec-Appendix-Copyright-and-Licensing.Licensing "link to this subsection")

The licenses for the GraphQL Specification Project are:

| Deliverable | License |
| --- | --- |
| Specifications | [Open Web Foundation Agreement 1.0 (Patent and Copyright Grants)](https://www.openwebfoundation.org/the-agreements/the-owf-1-0-agreements-granted-claims/owfa-1-0) |
| Source code | [MIT License](https://opensource.org/licenses/MIT) |
| Data sets | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

# [§](#index)Index

1.  [Alias](#Alias)
2.  [AreTypesCompatible](#AreTypesCompatible\(\))
3.  [Argument](#Argument)
4.  [ArgumentCoordinate](#ArgumentCoordinate)
5.  [Arguments](#Arguments)
6.  [ArgumentsDefinition](#ArgumentsDefinition)
7.  [BlockString](#BlockString)
8.  [BlockStringCharacter](#BlockStringCharacter)
9.  [BlockStringValue](#BlockStringValue\(\))
10.  [BooleanValue](#BooleanValue)
11.  [built-in directive](#built-in-directive)
12.  [CoerceArgumentValues](#CoerceArgumentValues\(\))
13.  [CoerceResult](#CoerceResult\(\))
14.  [CoerceVariableValues](#CoerceVariableValues\(\))
15.  [collected fields map](#collected-fields-map)
16.  [CollectFields](#CollectFields\(\))
17.  [CollectSubfields](#CollectSubfields\(\))
18.  [CollectSubscriptionFields](#CollectSubscriptionFields\(\))
19.  [Comma](#Comma)
20.  [Comment](#Comment)
21.  [CommentChar](#CommentChar)
22.  [CompleteValue](#CompleteValue\(\))
23.  [containing element](#containing-element)
24.  [CreateSourceEventStream](#CreateSourceEventStream\(\))
25.  [custom directive](#custom-directive)
26.  [default root type name](#default-root-type-name)
27.  [DefaultValue](#DefaultValue)
28.  [Definition](#Definition)
29.  [Description](#Description)
30.  [DetectFragmentCycles](#DetectFragmentCycles\(\))
31.  [Digit](#Digit)
32.  [Directive](#Directive)
33.  [DirectiveArgumentCoordinate](#DirectiveArgumentCoordinate)
34.  [DirectiveCoordinate](#DirectiveCoordinate)
35.  [DirectiveDefinition](#DirectiveDefinition)
36.  [DirectiveExtension](#DirectiveExtension)
37.  [DirectiveLocation](#DirectiveLocation)
38.  [DirectiveLocations](#DirectiveLocations)
39.  [Directives](#Directives)
40.  [Document](#Document)
41.  [DoesFragmentTypeApply](#DoesFragmentTypeApply\(\))
42.  [EnumTypeDefinition](#EnumTypeDefinition)
43.  [EnumTypeExtension](#EnumTypeExtension)
44.  [EnumValue](#EnumValue)
45.  [EnumValueDefinition](#EnumValueDefinition)
46.  [EnumValuesDefinition](#EnumValuesDefinition)
47.  [EscapedCharacter](#EscapedCharacter)
48.  [EscapedUnicode](#EscapedUnicode)
49.  [event stream](#event-stream)
50.  [ExecutableDefinition](#ExecutableDefinition)
51.  [ExecutableDirectiveLocation](#ExecutableDirectiveLocation)
52.  [ExecutableDocument](#ExecutableDocument)
53.  [ExecuteCollectedFields](#ExecuteCollectedFields\(\))
54.  [ExecuteField](#ExecuteField\(\))
55.  [ExecuteMutation](#ExecuteMutation\(\))
56.  [ExecuteQuery](#ExecuteQuery\(\))
57.  [ExecuteRequest](#ExecuteRequest\(\))
58.  [ExecuteRootSelectionSet](#ExecuteRootSelectionSet\(\))
59.  [ExecuteSubscriptionEvent](#ExecuteSubscriptionEvent\(\))
60.  [execution error](#execution-error)
61.  [execution result](#execution-result)
62.  [ExponentIndicator](#ExponentIndicator)
63.  [ExponentPart](#ExponentPart)
64.  [Field](#Field)
65.  [field set](#field-set)
66.  [FieldDefinition](#FieldDefinition)
67.  [FieldsDefinition](#FieldsDefinition)
68.  [FieldsInSetCanMerge](#FieldsInSetCanMerge\(\))
69.  [FloatValue](#FloatValue)
70.  [FractionalPart](#FractionalPart)
71.  [FragmentDefinition](#FragmentDefinition)
72.  [FragmentName](#FragmentName)
73.  [FragmentSpread](#FragmentSpread)
74.  [GetOperation](#GetOperation\(\))
75.  [GetPossibleTypes](#GetPossibleTypes\(\))
76.  [HexDigit](#HexDigit)
77.  [Ignored](#Ignored)
78.  [ImplementsInterfaces](#ImplementsInterfaces)
79.  [InlineFragment](#InlineFragment)
80.  [Input Object](#input-object)
81.  [InputFieldDefaultValueHasCycle](#InputFieldDefaultValueHasCycle\(\))
82.  [InputFieldsDefinition](#InputFieldsDefinition)
83.  [InputObjectDefaultValueHasCycle](#InputObjectDefaultValueHasCycle\(\))
84.  [InputObjectTypeDefinition](#InputObjectTypeDefinition)
85.  [InputObjectTypeExtension](#InputObjectTypeExtension)
86.  [InputValueDefinition](#InputValueDefinition)
87.  [IntegerPart](#IntegerPart)
88.  [InterfaceTypeDefinition](#InterfaceTypeDefinition)
89.  [InterfaceTypeExtension](#InterfaceTypeExtension)
90.  [IntValue](#IntValue)
91.  [IsInputType](#IsInputType\(\))
92.  [IsNonNullPosition](#IsNonNullPosition\(\))
93.  [IsOutputType](#IsOutputType\(\))
94.  [IsSubType](#IsSubType\(\))
95.  [IsValidImplementation](#IsValidImplementation\(\))
96.  [IsValidImplementationFieldType](#IsValidImplementationFieldType\(\))
97.  [IsVariableUsageAllowed](#IsVariableUsageAllowed\(\))
98.  [leaf field](#leaf-field)
99.  [Letter](#Letter)
100.  [LineTerminator](#LineTerminator)
101.  [ListType](#ListType)
102.  [ListValue](#ListValue)
103.  [MapSourceToResponseEvent](#MapSourceToResponseEvent\(\))
104.  [MemberCoordinate](#MemberCoordinate)
105.  [Name](#Name)
106.  [NameContinue](#NameContinue)
107.  [NamedType](#NamedType)
108.  [NameStart](#NameStart)
109.  [NegativeSign](#NegativeSign)
110.  [NonNullType](#NonNullType)
111.  [NonZeroDigit](#NonZeroDigit)
112.  [NullValue](#NullValue)
113.  [ObjectField](#ObjectField)
114.  [ObjectTypeDefinition](#ObjectTypeDefinition)
115.  [ObjectTypeExtension](#ObjectTypeExtension)
116.  [ObjectValue](#ObjectValue)
117.  [OneOf Input Object](#oneof-input-object)
118.  [OperationDefinition](#OperationDefinition)
119.  [OperationType](#OperationType)
120.  [Punctuator](#Punctuator)
121.  [request](#request)
122.  [request error](#request-error)
123.  [request error result](#request-error-result)
124.  [ResolveAbstractType](#ResolveAbstractType\(\))
125.  [ResolveFieldEventStream](#ResolveFieldEventStream\(\))
126.  [ResolveFieldValue](#ResolveFieldValue\(\))
127.  [response](#response)
128.  [response name](#response-name)
129.  [response path](#response-path)
130.  [response position](#response-position)
131.  [response stream](#response-stream)
132.  [root operation type](#root-operation-type)
133.  [root selection set](#root-selection-set)
134.  [RootOperationTypeDefinition](#RootOperationTypeDefinition)
135.  [SameResponseShape](#SameResponseShape\(\))
136.  [scalar specification URL](#scalar-specification-url)
137.  [ScalarTypeDefinition](#ScalarTypeDefinition)
138.  [ScalarTypeExtension](#ScalarTypeExtension)
139.  [schema coordinate](#schema-coordinate)
140.  [schema element](#schema-element)
141.  [SchemaCoordinate](#SchemaCoordinate)
142.  [SchemaCoordinatePunctuator](#SchemaCoordinatePunctuator)
143.  [SchemaCoordinateToken](#SchemaCoordinateToken)
144.  [SchemaDefinition](#SchemaDefinition)
145.  [SchemaExtension](#SchemaExtension)
146.  [Selection](#Selection)
147.  [selection set](#selection-set)
148.  [SelectionSet](#SelectionSet)
149.  [Sign](#Sign)
150.  [source stream](#source-stream)
151.  [SourceCharacter](#SourceCharacter)
152.  [StringCharacter](#StringCharacter)
153.  [StringValue](#StringValue)
154.  [Subscribe](#Subscribe\(\))
155.  [Token](#Token)
156.  [Type](#Type)
157.  [TypeCondition](#TypeCondition)
158.  [TypeCoordinate](#TypeCoordinate)
159.  [TypeDefinition](#TypeDefinition)
160.  [TypeExtension](#TypeExtension)
161.  [TypeSystemDefinition](#TypeSystemDefinition)
162.  [TypeSystemDefinitionOrExtension](#TypeSystemDefinitionOrExtension)
163.  [TypeSystemDirectiveLocation](#TypeSystemDirectiveLocation)
164.  [TypeSystemDocument](#TypeSystemDocument)
165.  [TypeSystemExtension](#TypeSystemExtension)
166.  [TypeSystemExtensionDocument](#TypeSystemExtensionDocument)
167.  [Unicode text](#unicode-text)
168.  [UnicodeBOM](#UnicodeBOM)
169.  [UnionMemberTypes](#UnionMemberTypes)
170.  [UnionTypeDefinition](#UnionTypeDefinition)
171.  [UnionTypeExtension](#UnionTypeExtension)
172.  [Unsubscribe](#Unsubscribe\(\))
173.  [Value](#Value)
174.  [Variable](#Variable)
175.  [VariableDefinition](#VariableDefinition)
176.  [VariablesDefinition](#VariablesDefinition)
177.  [Whitespace](#Whitespace)

Written in [Spec Markdown](https://spec-md.com).

☰

[GraphQL](#)

1.  [1Overview](#sec-Overview)
2.  [2Language](#sec-Language) [ ] 
    1.  [2.1Source Text](#sec-Language.Source-Text) [ ] 
        1.  [2.1.1White Space](#sec-White-Space)
        2.  [2.1.2Line Terminators](#sec-Line-Terminators)
        3.  [2.1.3Comments](#sec-Comments)
        4.  [2.1.4Insignificant Commas](#sec-Insignificant-Commas)
        5.  [2.1.5Lexical Tokens](#sec-Language.Source-Text.Lexical-Tokens)
        6.  [2.1.6Ignored Tokens](#sec-Language.Source-Text.Ignored-Tokens)
        7.  [2.1.7Punctuators](#sec-Punctuators)
        8.  [2.1.8Names](#sec-Names)
    2.  [2.2Descriptions](#sec-Descriptions)
    3.  [2.3Document](#sec-Document)
    4.  [2.4Operations](#sec-Language.Operations)
    5.  [2.5Selection Sets](#sec-Selection-Sets)
    6.  [2.6Fields](#sec-Language.Fields)
    7.  [2.7Arguments](#sec-Language.Arguments)
    8.  [2.8Field Alias](#sec-Field-Alias)
    9.  [2.9Fragments](#sec-Language.Fragments) [ ] 
        1.  [2.9.1Type Conditions](#sec-Type-Conditions)
        2.  [2.9.2Inline Fragments](#sec-Inline-Fragments)
    10.  [2.10Input Values](#sec-Input-Values) [ ] 
         1.  [2.10.1Int Value](#sec-Int-Value)
         2.  [2.10.2Float Value](#sec-Float-Value)
         3.  [2.10.3Boolean Value](#sec-Boolean-Value)
         4.  [2.10.4String Value](#sec-String-Value)
         5.  [2.10.5Null Value](#sec-Null-Value)
         6.  [2.10.6Enum Value](#sec-Enum-Value)
         7.  [2.10.7List Value](#sec-List-Value)
         8.  [2.10.8Input Object Values](#sec-Input-Object-Values)
    11.  [2.11Variables](#sec-Language.Variables)
    12.  [2.12Type References](#sec-Type-References)
    13.  [2.13Directives](#sec-Language.Directives)
    14.  [2.14Schema Coordinates](#sec-Schema-Coordinates)
3.  [3Type System](#sec-Type-System) [ ] 
    1.  [3.1Type System Extensions](#sec-Type-System-Extensions)
    2.  [3.2Type System Descriptions](#sec-Type-System-Descriptions)
    3.  [3.3Schema](#sec-Schema) [ ] 
        1.  [3.3.1Root Operation Types](#sec-Root-Operation-Types)
        2.  [3.3.2Schema Extension](#sec-Schema-Extension)
    4.  [3.4Types](#sec-Types) [ ] 
        1.  [3.4.1Wrapping Types](#sec-Wrapping-Types)
        2.  [3.4.2Input and Output Types](#sec-Input-and-Output-Types)
        3.  [3.4.3Type Extensions](#sec-Type-Extensions)
    5.  [3.5Scalars](#sec-Scalars) [ ] 
        1.  [3.5.1Int](#sec-Int)
        2.  [3.5.2Float](#sec-Float)
        3.  [3.5.3String](#sec-String)
        4.  [3.5.4Boolean](#sec-Boolean)
        5.  [3.5.5ID](#sec-ID)
        6.  [3.5.6Scalar Extensions](#sec-Scalar-Extensions)
    6.  [3.6Objects](#sec-Objects) [ ] 
        1.  [3.6.1Field Arguments](#sec-Field-Arguments)
        2.  [3.6.2Field Deprecation](#sec-Field-Deprecation)
        3.  [3.6.3Object Extensions](#sec-Object-Extensions)
    7.  [3.7Interfaces](#sec-Interfaces) [ ] 
        1.  [3.7.1Interface Extensions](#sec-Interface-Extensions)
    8.  [3.8Unions](#sec-Unions) [ ] 
        1.  [3.8.1Union Extensions](#sec-Union-Extensions)
    9.  [3.9Enums](#sec-Enums) [ ] 
        1.  [3.9.1Enum Extensions](#sec-Enum-Extensions)
    10.  [3.10Input Objects](#sec-Input-Objects) [ ] 
         1.  [3.10.1OneOf Input Objects](#sec-OneOf-Input-Objects)
         2.  [3.10.2Input Object Extensions](#sec-Input-Object-Extensions)
    11.  [3.11List](#sec-List)
    12.  [3.12Non-Null](#sec-Non-Null) [ ] 
         1.  [3.12.1Combining List and Non-Null](#sec-Combining-List-and-Non-Null)
    13.  [3.13Directives](#sec-Type-System.Directives) [ ] 
         1.  [3.13.1@skip](#sec--skip)
         2.  [3.13.2@include](#sec--include)
         3.  [3.13.3@deprecated](#sec--deprecated)
         4.  [3.13.4@specifiedBy](#sec--specifiedBy)
         5.  [3.13.5@oneOf](#sec--oneOf)
         6.  [3.13.6Directive Extensions](#sec-Directive-Extensions)
4.  [4Introspection](#sec-Introspection) [ ] 
    1.  [4.1Type Name Introspection](#sec-Type-Name-Introspection)
    2.  [4.2Schema Introspection](#sec-Schema-Introspection) [ ] 
        1.  [4.2.1The \_\_Schema Type](#sec-The-__Schema-Type)
        2.  [4.2.2The \_\_Type Type](#sec-The-__Type-Type)
        3.  [4.2.3The \_\_Field Type](#sec-The-__Field-Type)
        4.  [4.2.4The \_\_InputValue Type](#sec-The-__InputValue-Type)
        5.  [4.2.5The \_\_EnumValue Type](#sec-The-__EnumValue-Type)
        6.  [4.2.6The \_\_Directive Type](#sec-The-__Directive-Type)
5.  [5Validation](#sec-Validation) [ ] 
    1.  [5.1Documents](#sec-Documents) [ ] 
        1.  [5.1.1Executable Definitions](#sec-Executable-Definitions)
    2.  [5.2Operations](#sec-Validation.Operations) [ ] 
        1.  [5.2.1All Operation Definitions](#sec-All-Operation-Definitions) [ ] 
            1.  [5.2.1.1Operation Type Existence](#sec-Operation-Type-Existence)
        2.  [5.2.2Named Operation Definitions](#sec-Named-Operation-Definitions) [ ] 
            1.  [5.2.2.1Operation Name Uniqueness](#sec-Operation-Name-Uniqueness)
        3.  [5.2.3Anonymous Operation Definitions](#sec-Anonymous-Operation-Definitions) [ ] 
            1.  [5.2.3.1Lone Anonymous Operation](#sec-Lone-Anonymous-Operation)
        4.  [5.2.4Subscription Operation Definitions](#sec-Subscription-Operation-Definitions) [ ] 
            1.  [5.2.4.1Single Root Field](#sec-Single-Root-Field)
    3.  [5.3Fields](#sec-Validation.Fields) [ ] 
        1.  [5.3.1Field Selections](#sec-Field-Selections)
        2.  [5.3.2Field Selection Merging](#sec-Field-Selection-Merging)
        3.  [5.3.3Leaf Field Selections](#sec-Leaf-Field-Selections)
    4.  [5.4Arguments](#sec-Validation.Arguments) [ ] 
        1.  [5.4.1Argument Names](#sec-Argument-Names)
        2.  [5.4.2Argument Uniqueness](#sec-Argument-Uniqueness)
        3.  [5.4.3Required Arguments](#sec-Required-Arguments)
    5.  [5.5Fragments](#sec-Validation.Fragments) [ ] 
        1.  [5.5.1Fragment Declarations](#sec-Fragment-Declarations) [ ] 
            1.  [5.5.1.1Fragment Name Uniqueness](#sec-Fragment-Name-Uniqueness)
            2.  [5.5.1.2Fragment Spread Type Existence](#sec-Fragment-Spread-Type-Existence)
            3.  [5.5.1.3Fragments on Object, Interface or Union Types](#sec-Fragments-on-Object-Interface-or-Union-Types)
            4.  [5.5.1.4Fragments Must Be Used](#sec-Fragments-Must-Be-Used)
        2.  [5.5.2Fragment Spreads](#sec-Fragment-Spreads) [ ] 
            1.  [5.5.2.1Fragment Spread Target Defined](#sec-Fragment-Spread-Target-Defined)
            2.  [5.5.2.2Fragment Spreads Must Not Form Cycles](#sec-Fragment-Spreads-Must-Not-Form-Cycles)
            3.  [5.5.2.3Fragment Spread Is Possible](#sec-Fragment-Spread-Is-Possible) [ ] 
                1.  [5.5.2.3.1Object Spreads in Object Scope](#sec-Object-Spreads-in-Object-Scope)
                2.  [5.5.2.3.2Abstract Spreads in Object Scope](#sec-Abstract-Spreads-in-Object-Scope)
                3.  [5.5.2.3.3Object Spreads in Abstract Scope](#sec-Object-Spreads-in-Abstract-Scope)
                4.  [5.5.2.3.4Abstract Spreads in Abstract Scope](#sec-Abstract-Spreads-in-Abstract-Scope)
    6.  [5.6Values](#sec-Values) [ ] 
        1.  [5.6.1Values of Correct Type](#sec-Values-of-Correct-Type)
        2.  [5.6.2Input Object Field Names](#sec-Input-Object-Field-Names)
        3.  [5.6.3Input Object Field Uniqueness](#sec-Input-Object-Field-Uniqueness)
        4.  [5.6.4Input Object Required Fields](#sec-Input-Object-Required-Fields)
    7.  [5.7Directives](#sec-Validation.Directives) [ ] 
        1.  [5.7.1Directives Are Defined](#sec-Directives-Are-Defined)
        2.  [5.7.2Directives Are in Valid Locations](#sec-Directives-Are-in-Valid-Locations)
        3.  [5.7.3Directives Are Unique per Location](#sec-Directives-Are-Unique-per-Location)
    8.  [5.8Variables](#sec-Validation.Variables) [ ] 
        1.  [5.8.1Variable Uniqueness](#sec-Variable-Uniqueness)
        2.  [5.8.2Variables Are Input Types](#sec-Variables-Are-Input-Types)
        3.  [5.8.3All Variable Uses Defined](#sec-All-Variable-Uses-Defined)
        4.  [5.8.4All Variables Used](#sec-All-Variables-Used)
        5.  [5.8.5All Variable Usages Are Allowed](#sec-All-Variable-Usages-Are-Allowed)
6.  [6Execution](#sec-Execution) [ ] 
    1.  [6.1Executing Requests](#sec-Executing-Requests) [ ] 
        1.  [6.1.1Validating Requests](#sec-Validating-Requests)
        2.  [6.1.2Coercing Variable Values](#sec-Coercing-Variable-Values)
    2.  [6.2Executing Operations](#sec-Executing-Operations) [ ] 
        1.  [6.2.1Query](#sec-Query)
        2.  [6.2.2Mutation](#sec-Mutation)
        3.  [6.2.3Subscription](#sec-Subscription) [ ] 
            1.  [6.2.3.1Source Stream](#sec-Source-Stream)
            2.  [6.2.3.2Response Stream](#sec-Subscription.Response-Stream)
            3.  [6.2.3.3Unsubscribe](#sec-Unsubscribe)
    3.  [6.3Executing Selection Sets](#sec-Executing-Selection-Sets) [ ] 
        1.  [6.3.1Executing the Root Selection Set](#sec-Executing-the-Root-Selection-Set)
        2.  [6.3.2Field Collection](#sec-Field-Collection)
        3.  [6.3.3Executing Collected Fields](#sec-Executing-Collected-Fields)
        4.  [6.3.4Normal and Serial Execution](#sec-Normal-and-Serial-Execution)
    4.  [6.4Executing Fields](#sec-Executing-Fields) [ ] 
        1.  [6.4.1Coercing Field Arguments](#sec-Coercing-Field-Arguments)
        2.  [6.4.2Value Resolution](#sec-Value-Resolution)
        3.  [6.4.3Value Completion](#sec-Value-Completion)
        4.  [6.4.4Handling Execution Errors](#sec-Handling-Execution-Errors)
7.  [7Response](#sec-Response) [ ] 
    1.  [7.1Response Format](#sec-Response-Format) [ ] 
        1.  [7.1.1Execution Result](#sec-Execution-Result)
        2.  [7.1.2Response Stream](#sec-Response-Format.Response-Stream)
        3.  [7.1.3Request Error Result](#sec-Request-Error-Result)
        4.  [7.1.4Response Position](#sec-Response-Position)
        5.  [7.1.5Data](#sec-Data)
        6.  [7.1.6Errors](#sec-Errors)
        7.  [7.1.7Extensions](#sec-Extensions)
        8.  [7.1.8Additional Entries](#sec-Additional-Entries)
    2.  [7.2Serialization Format](#sec-Serialization-Format) [ ] 
        1.  [7.2.1JSON Serialization](#sec-JSON-Serialization)
        2.  [7.2.2Serialized Map Ordering](#sec-Serialized-Map-Ordering)
8.  [AAppendix: Conformance](#sec-Appendix-Conformance)
9.  [BAppendix: Notation Conventions](#sec-Appendix-Notation-Conventions) [ ] 
    1.  [B.1Context-Free Grammar](#sec-Context-Free-Grammar)
    2.  [B.2Lexical and Syntactic Grammar](#sec-Lexical-and-Syntactic-Grammar)
    3.  [B.3Grammar Notation](#sec-Grammar-Notation)
    4.  [B.4Grammar Semantics](#sec-Grammar-Semantics)
    5.  [B.5Algorithms](#sec-Algorithms)
    6.  [B.6Data Collections](#sec-Data-Collections)
10.  [CAppendix: Grammar Summary](#sec-Appendix-Grammar-Summary) [ ] 
     1.  [C.1Source Text](#sec-Appendix-Grammar-Summary.Source-Text)
     2.  [C.2Ignored Tokens](#sec-Appendix-Grammar-Summary.Ignored-Tokens)
     3.  [C.3Lexical Tokens](#sec-Appendix-Grammar-Summary.Lexical-Tokens)
     4.  [C.4Document Syntax](#sec-Document-Syntax)
     5.  [C.5Schema Coordinate Syntax](#sec-Schema-Coordinate-Syntax)
11.  [DAppendix: Type System Definitions](#sec-Appendix-Type-System-Definitions)
12.  [EAppendix: Copyright and Licensing](#sec-Appendix-Copyright-and-Licensing)
13.  [§Index](#index)
