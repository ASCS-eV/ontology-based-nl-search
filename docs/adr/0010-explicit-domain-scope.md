# ADR 0010 — Explicit domain scope, and what a vocabulary in it searches

- **Status:** Accepted
- **Date:** 2026-10-21

## Context

Without a scope of its own, a request covers whatever the model puts into
`slots.domains`, corrected by the owners of the properties it fills. A user
then has no way to say "search only OpenLABEL" and be sure that is what
happens.

A support vocabulary roots no asset class of its own: its shapes describe
content that asset domains embed, and some of it is also published on its own.
A request scoped to one ("OpenLABEL only") therefore needs a meaning the
compiler can act on. Widening it to the asset domains whose paths end in its
leaves is not one: with no constraint of the vocabulary in the query (no
constraint at all, or only one from outside it, such as a country), every
asset of every such domain answers, whether or not it carries any of that
content. Searching its standalone documents alone is not one either: it misses
every asset described with the vocabulary. And a meaning that differs between
the natural-language entry point and `/search/refine` makes the same slots say
two things.

## Decision

**A vocabulary in `slots.domains` means "what is described with it", in every
entry point.** The compiler expands it (`compiler-vocabulary-scope.ts`):

1. Its standalone documents answer through its own arms.
2. Each asset domain whose discovered paths end in one of its leaves (an
   _owner_) answers with the assets that carry its content. The arm requires
   that, where the domain's own paths enter the vocabulary, the node at the end
   of the carrier chain has a property of the vocabulary: a property in the
   vocabulary's namespace and in no longer namespace another domain claims
   inside it, the rule `domainForIri` applies.
3. An owner is searched only when it can express every constraint of the query
   that is a leaf of the vocabulary.
4. A domain whose primary class is a subclass of a class of the vocabulary is
   an owner too, and answers with all its assets: they are described with the
   vocabulary by their type, whether or not they carry any of its properties.
5. An owner the request names itself is searched as named, without the
   restriction: the domains of a scope are a union, and the named domain's
   answers already include its assets carrying the vocabulary. An owner the
   request references is the target of that reference, not an answer.
6. Whether the named domains form a parent → child JOIN is decided among them
   alone. An owner the vocabulary adds is a peer by construction; when the
   named domains JOIN, the query is one query rooted at the parent, which the
   owners cannot join, and they are not searched. A named child that carries
   no constraint its parent lacks is a peer, so a scope of a parent and its
   child with no constraints searches both. Only a reference a discovered
   chain joins counts: one the schema declares without such a chain leaves
   the named domains peers, since its JOIN would have to leave the child out.

A domain counts as a vocabulary when it owns no compiler path of its own and
other domains' paths end in its leaves, their primary classes are subclasses
of its classes, or it has standalone entry classes. Natural language keeps its
reading of the model's choice: a vocabulary next to an asset domain describes
that asset and is dropped, and a vocabulary-only request is passed on as the
vocabulary rather than widened, unless the query names one of the domains
using the vocabulary outright ("HD maps in Germany" read as a georeference
request), which is then what was asked for.

**A request can state its scope.** `POST /search/stream` takes `domains`, the
domains the user selected. Every name must be a domain of the loaded ontology;
an unknown one is rejected with 400 rather than dropped. A stated scope
replaces the model's domain choice:

- retrieval routes exactly the searched domains (the scope's asset domains,
  the owners of its vocabularies, and the vocabularies);
- the slot pipeline neither corrects, nor narrows, nor widens the domains, and
  when the model submits nothing usable the fallback searches the scope;
- the scope's domains are the answers, so a reference the model fills to one
  of them is dropped and reported as a `limitation` gap;
- a constraint no searched domain can express, judged key by key, is removed
  and reported as a `limitation` gap under the user's own words, never
  answered by searching further. Whether one domain can express all of them
  together stays the compiler's question.

The web UI offers the loaded domains next to the search field and shows the
scope a search ran with next to its interpretation. The domains stay editable
in the refinement.

## Consequences

- "OpenLABEL only" and "OpenLABEL in Germany" return only assets that carry
  OpenLABEL content. On the pinned sample data every HD map and scenario
  carries some, so the result is unchanged there. On data where some do not,
  they are no longer returned.
- The interpretation of a vocabulary-only request lists the vocabulary, and
  `/search/refine` with the vocabulary alone returns its owners' assets that
  carry its content next to its standalone documents.
- A vocabulary scope with a reference compiles through the owners that are not
  the reference's target, joined to it. Where that leaves several owners, the
  peer `UNION` applies, and a peer `UNION` does not compile references: each is
  reported as a `limitation` gap. This is the same limit an explicit
  multi-domain scope with a reference has.
- The content restriction is one `FILTER EXISTS` per owner arm, sized by the
  number of distinct carrier chains, not by the number of the vocabulary's
  leaves.
