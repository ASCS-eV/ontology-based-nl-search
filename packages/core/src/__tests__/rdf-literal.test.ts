/**
 * Semantics of the shared RDF literal escaper.
 *
 * This pins the exact output the emitters depend on. The grammar-level proofs
 * live where a parser is available: `packages/sparql` round-trips the output
 * through sparqljs (SPARQL `STRING_LITERAL2`), `packages/authoring-gate`
 * round-trips it through N3 (Turtle `STRING_LITERAL_QUOTE`).
 */
import { describe, expect, it } from 'vitest'

import { escapeRdfLiteral } from '../rdf/literal.js'

describe('escapeRdfLiteral', () => {
  it('passes clean strings through unchanged', () => {
    expect(escapeRdfLiteral('motorway')).toBe('motorway')
    expect(escapeRdfLiteral('ASAM OpenDRIVE')).toBe('ASAM OpenDRIVE')
  })

  it('escapes the four characters both grammars forbid raw', () => {
    expect(escapeRdfLiteral('value"injection')).toBe('value\\"injection')
    expect(escapeRdfLiteral('path\\to')).toBe('path\\\\to')
    expect(escapeRdfLiteral('line1\nline2')).toBe('line1\\nline2')
    expect(escapeRdfLiteral('cr\rhere')).toBe('cr\\rhere')
  })

  it('escapes tab and single quote via ECHAR', () => {
    expect(escapeRdfLiteral('col1\tcol2')).toBe('col1\\tcol2')
    expect(escapeRdfLiteral("it's fine")).toBe("it\\'s fine")
  })

  it.each([
    [0x00, '\\u0000'],
    [0x07, '\\u0007'],
    [0x0b, '\\u000B'],
    [0x0c, '\\u000C'],
    [0x1f, '\\u001F'],
  ])('emits code point %i as a UCHAR escape', (code, expected) => {
    expect(escapeRdfLiteral(String.fromCharCode(code))).toBe(expected)
  })

  it('leaves no raw character below U+0020 in its output', () => {
    for (let code = 0; code < 0x20; code++) {
      const ch = String.fromCharCode(code)
      expect(escapeRdfLiteral(`a${ch}b`)).not.toContain(ch)
    }
  })

  it('preserves printable ASCII (no over-escaping)', () => {
    const printable = 'abcXYZ 0123!@#$%^&*()-+=[]{};:,./?<>~'
    expect(escapeRdfLiteral(printable)).toBe(printable)
  })

  it('preserves astral-plane code points intact', () => {
    expect(escapeRdfLiteral('🚀 to the moon')).toBe('🚀 to the moon')
  })

  it('prevents a literal breakout that would inject query syntax', () => {
    const malicious = '" ) . ?s ?p ?o } # '
    const escaped = escapeRdfLiteral(malicious)
    expect(escaped).not.toContain('")')
    expect(escaped).toBe('\\" ) . ?s ?p ?o } # ')
  })

  it('handles combined special characters', () => {
    expect(escapeRdfLiteral('val"ue\\with\nnewline')).toBe('val\\"ue\\\\with\\nnewline')
  })
})
