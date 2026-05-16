import type { ShaclDomainContent } from '@ontology-search/search/shacl-reader'
import { describe, expect, it } from 'vitest'

import { buildSystemPrompt } from '../prompt-builder.js'

const mockShaclContent: ShaclDomainContent[] = [
  {
    domain: 'hdmap',
    fileName: 'hdmap.shacl.ttl',
    sizeBytes: 500,
    content: `@prefix hdmap: <https://example.org/hdmap/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .

hdmap:DomainSpecificationShape a sh:NodeShape ;
    sh:property [
        sh:path hdmap:roadTypes ;
        sh:in ("motorway" "rural" "urban") ;
        sh:name "road types"@en ;
    ] .`,
  },
  {
    domain: 'scenario',
    fileName: 'scenario.shacl.ttl',
    sizeBytes: 300,
    content: `@prefix scenario: <https://example.org/scenario/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .

scenario:ScenarioShape a sh:NodeShape ;
    sh:property [
        sh:path scenario:weatherSummary ;
        sh:in ("clear" "rain" "fog") ;
    ] .`,
  },
]

describe('buildSystemPrompt (SHACL-based)', () => {
  it('generates a non-empty prompt', () => {
    const prompt = buildSystemPrompt(mockShaclContent)
    expect(prompt.length).toBeGreaterThan(0)
  })

  it('includes the preamble', () => {
    const prompt = buildSystemPrompt(mockShaclContent)
    expect(prompt).toContain('Slot-Filling Agent')
    expect(prompt).toContain('submit_slots')
  })

  it('includes raw SHACL Turtle content', () => {
    const prompt = buildSystemPrompt(mockShaclContent)
    expect(prompt).toContain('sh:NodeShape')
    expect(prompt).toContain('sh:in ("motorway" "rural" "urban")')
    expect(prompt).toContain('sh:in ("clear" "rain" "fog")')
  })

  it('wraps SHACL content in turtle code blocks', () => {
    const prompt = buildSystemPrompt(mockShaclContent)
    expect(prompt).toContain('```turtle')
    expect(prompt).toContain('```')
  })

  it('includes domain headers', () => {
    const prompt = buildSystemPrompt(mockShaclContent)
    expect(prompt).toContain('HD Map domain')
    expect(prompt).toContain('Scenario domain')
  })

  it('includes SHACL reading instructions', () => {
    const prompt = buildSystemPrompt(mockShaclContent)
    expect(prompt).toContain('sh:in')
    expect(prompt).toContain('sh:pattern')
    expect(prompt).toContain('sh:datatype')
  })

  it('includes location section', () => {
    const prompt = buildSystemPrompt(mockShaclContent)
    expect(prompt).toContain('country')
    expect(prompt).toContain('ISO 2-letter')
  })

  it('includes rules section', () => {
    const prompt = buildSystemPrompt(mockShaclContent)
    expect(prompt).toContain('Rules')
    expect(prompt).toContain('synonym resolver')
    expect(prompt).toContain('Tiered Confidence')
  })

  it('includes examples', () => {
    const prompt = buildSystemPrompt(mockShaclContent)
    expect(prompt).toContain('Example 1')
    expect(prompt).toContain('German highway map')
    expect(prompt).toContain('emergency braking')
  })

  it('includes ranges instruction with implicit ranges', () => {
    const prompt = buildSystemPrompt(mockShaclContent)
    expect(prompt).toContain('ranges')
    expect(prompt).toContain('min')
    expect(prompt).toContain('max')
  })

  it('handles empty SHACL content gracefully', () => {
    const prompt = buildSystemPrompt([])
    expect(prompt).toContain('Slot-Filling Agent')
    expect(prompt).toContain('Rules')
  })

  it('generates prompt with realistic SHACL content', () => {
    // Use the actual SHACL reader to test with real ontology data
    const { getShaclContent } = require('@ontology-search/search/shacl-reader')
    const realContent = getShaclContent()
    const prompt = buildSystemPrompt(realContent)

    // Prompt should be under 500K characters (~125K tokens)
    expect(prompt.length).toBeLessThan(500_000)
    expect(prompt.length).toBeGreaterThan(10_000)

    // Should contain real ontology data
    expect(prompt).toContain('motorway')
    expect(prompt).toContain('roadTypes')
  })
})

describe('buildSystemPrompt — region-expansion guidance (R5)', () => {
  /**
   * R5: The prompt MUST tell the LLM to expand a region / continent /
   * multi-country expression into an explicit array of values, with at
   * least one concrete example. Without this guidance the LLM silently
   * shimmed "europe" to a single country (the original regression).
   *
   * Assertions are on STABLE substrings only — never the full prompt — so
   * future copy-edits don't break unrelated tests.
   */
  it('contains the multi-country region guidance heading', () => {
    const prompt = buildSystemPrompt(mockShaclContent)
    expect(prompt).toMatch(/Always emit an array when the user expresses a region/i)
  })

  it('shows an ISO-3166 array example with at least two countries', () => {
    const prompt = buildSystemPrompt(mockShaclContent)
    // The example must demonstrate the array-syntax shape with multiple ISO
    // codes; the specific set is allowed to evolve.
    expect(prompt).toMatch(/country:\s*\[/)
    expect(prompt).toMatch(/\[\s*"DE"\s*,\s*"FR"/)
  })

  it('explicitly forbids silent single-country substitution', () => {
    const prompt = buildSystemPrompt(mockShaclContent)
    // The prompt may wrap the sentence across lines — match through whitespace.
    expect(prompt).toMatch(/do NOT silently\s+substitute one country for a region/i)
  })

  it('mentions the SHACL gate as the validator of choice for elements', () => {
    const prompt = buildSystemPrompt(mockShaclContent)
    expect(prompt).toMatch(/SHACL gate validates every element/i)
  })
})
