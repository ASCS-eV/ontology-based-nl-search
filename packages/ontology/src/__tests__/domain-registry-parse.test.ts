/**
 * Regression for I2 (architecture-improvements plan): `domain-registry-parse`
 * reads Turtle through a real RDF/JS parse (n3), not a regex over source text.
 *
 * Each case below is constructed to DEFEAT the prior regex extractors while a
 * faithful RDF parse handles it. They would fail on the pre-I2 code:
 *
 *  - `parseTtl` must honor SPARQL-style `PREFIX` directives (no leading `@`, no
 *    trailing `.`, case-insensitive keyword) [RDF11-TURTLE §6.4], which the
 *    `@prefix`-only regex ignored.
 *  - `extractTargetClasses` matches `sh:targetClass` by RESOLVED IRI
 *    [SHACL §2.1.3.3], so a class written with a *different* alias bound to the
 *    same namespace, or as a full `<IRI>`, or separated from the predicate by a
 *    comment, is still found — none of which the alias-keyed regex caught.
 *  - A malformed document degrades to the empty view rather than throwing.
 */
import { describe, expect, it } from 'vitest'

import { extractNamespace, extractTargetClasses, parseTtl } from '../domain-registry-parse.js'

const NS = 'http://example.org/v1/'

describe('domain-registry-parse — RDF-faithful Turtle parsing (I2)', () => {
  it('parseTtl honors SPARQL-style PREFIX directives and comments', () => {
    // SPARQL-style `PREFIX` (Turtle 1.1) — the old `@prefix`-only regex missed it.
    const ttl = `PREFIX ex: <${NS}>
# a stray comment line
@prefix  sh:  <http://www.w3.org/ns/shacl#> .
ex:Thing a sh:NodeShape .`
    const parsed = parseTtl(ttl)
    expect(parsed.prefixes['ex']).toBe(NS)
    expect(parsed.prefixes['sh']).toBe('http://www.w3.org/ns/shacl#')
    expect(parsed.quads.length).toBeGreaterThan(0)
  })

  it('extractTargetClasses finds classes via any alias, full IRIs, and across comments', () => {
    const ttl = `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <${NS}> .
@prefix alt: <${NS}> .

ex:AShape a sh:NodeShape ; sh:targetClass ex:Alpha .
alt:BShape a sh:NodeShape ; sh:targetClass alt:Beta .
ex:CShape a sh:NodeShape ; sh:targetClass
  # comment between predicate and object
  <${NS}Gamma> .`
    const locals = extractTargetClasses(parseTtl(ttl), NS).map((t) => t.localName)
    // Old alias-keyed regex would have found only Alpha.
    expect(locals).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  it('extractTargetClasses ignores classes outside the namespace and non-bare locals', () => {
    const ttl = `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <${NS}> .
@prefix other: <http://other.example/v1/> .

ex:S1 sh:targetClass ex:InNs .
ex:S2 sh:targetClass other:OutOfNs .
ex:S3 sh:targetClass <${NS}nested/Deep> .`
    const locals = extractTargetClasses(parseTtl(ttl), NS).map((t) => t.localName)
    expect(locals).toEqual(['InNs'])
  })

  it('extractNamespace resolves a domain prefix regardless of declaration style', () => {
    const ttl = `PREFIX mydomain: <${NS}>
mydomain:X a <http://www.w3.org/2002/07/owl#Class> .`
    expect(extractNamespace(parseTtl(ttl), 'mydomain')).toBe(NS)
  })

  it('extractNamespace falls back to the owl:Ontology subject', () => {
    const ttl = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
<${NS}> a owl:Ontology .`
    // No prefix bound to the domain name → owl:Ontology subject wins.
    expect(extractNamespace(parseTtl(ttl), 'nomatch')).toBe(NS)
  })

  it('parseTtl degrades to the empty view on a malformed document', () => {
    const parsed = parseTtl('@prefix ex: <not a valid iri ; this is broken turtle')
    expect(parsed.quads).toEqual([])
    expect(parsed.prefixes).toEqual({})
  })
})

describe('domain-registry-parse — flat-ontology namespace fallback (SHACL §2.1.3.3)', () => {
  it('derives the namespace from sh:targetClass shapes when prefix name and owl:Ontology are absent', () => {
    // LinkML gen-shacl shape: prefix alias "adont" differs from the directory name
    // "adontology", and there is no owl:Ontology declaration. The namespace shared
    // by the target-class shapes IS the domain namespace.
    const ttl = `@prefix adont: <http://placeholder/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
adont:Scenario a sh:NodeShape ; sh:targetClass adont:Scenario .
adont:TestCase a sh:NodeShape ; sh:targetClass adont:TestCase .`
    expect(extractNamespace(parseTtl(ttl), 'adontology')).toBe('http://placeholder/')
  })

  it('prefers an explicit strategy over the target-class fallback', () => {
    const ttl = `@prefix scenario: <${NS}> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
scenario:X a sh:NodeShape ; sh:targetClass scenario:X .`
    expect(extractNamespace(parseTtl(ttl), 'scenario')).toBe(NS)
  })

  it('returns null when there are no named target-class shapes', () => {
    const ttl = `@prefix sh: <http://www.w3.org/ns/shacl#> .
[] a sh:NodeShape .`
    expect(extractNamespace(parseTtl(ttl), 'nomatch')).toBeNull()
  })
})
