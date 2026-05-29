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

  it('includes domain headers (mechanically title-cased from domain id)', () => {
    const prompt = buildSystemPrompt(mockShaclContent)
    // Mechanical kebab→Title conversion — no hand-curated label map.
    // 'hdmap' → 'Hdmap', 'scenario' → 'Scenario'. The exact phrasing is
    // determined by the transformation, not a per-domain override.
    expect(prompt).toContain('Hdmap domain')
    expect(prompt).toContain('Scenario domain')
  })

  /**
   * Regression: adding a new domain to the SHACL fixture MUST surface in the
   * prompt without any code change to prompt-builder.ts. The previous
   * implementation embedded a 13-entry domain→label map that had to be
   * updated for every new domain — a long-standing genericity violation.
   */
  it('renders an arbitrary new kebab-case domain id with title-cased words', () => {
    const fresh: ShaclDomainContent[] = [
      {
        domain: 'foo-bar-baz',
        fileName: 'foo-bar-baz.shacl.ttl',
        sizeBytes: 100,
        content: `@prefix fb: <https://example.org/foo-bar-baz/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .

fb:Shape a sh:NodeShape ;
    sh:property [ sh:path fb:hello ] .`,
      },
    ]
    const prompt = buildSystemPrompt(fresh)
    expect(prompt).toContain('Foo Bar Baz domain')
  })

  it('includes SHACL reading instructions', () => {
    const prompt = buildSystemPrompt(mockShaclContent)
    expect(prompt).toContain('sh:in')
    expect(prompt).toContain('sh:pattern')
    expect(prompt).toContain('sh:datatype')
  })

  it('explains how geographic constraints flow through generic filters', () => {
    const prompt = buildSystemPrompt(mockShaclContent)
    // Post task 21d-flat: no dedicated "location" slot — geographic
    // constraints route into `filters` keyed by the SHACL leaf local
    // name. The prompt must teach this so the LLM doesn't try to nest
    // them under a removed sub-object.
    expect(prompt).toContain('country')
    expect(prompt).toMatch(/filters: \{ "country"/)
  })

  it('includes rules section', () => {
    const prompt = buildSystemPrompt(mockShaclContent)
    expect(prompt).toContain('Rules')
    expect(prompt).toContain('synonym resolver')
    expect(prompt).toContain('Tiered Confidence')
  })

  /**
   * Regression: an LLM observed mapping "motorways" to a CamelCase
   * compound value `RoadTypeMotorway` on a different property when the
   * intended target property's `sh:in` already contained the bare
   * lowercase `motorway`. The prompt's "value-first" disambiguation
   * section pins the rule the model must follow — without referencing
   * any specific ontology term. This test only asserts the structural
   * guidance is present; the test stays correct as ontology terms
   * evolve.
   */
  /**
   * Regression: the prompt must teach the structural cross-reference
   * rule generically (without naming any specific verb or language).
   * Surface change of intent: "scenarios derived from traces" should
   * compile to `references.domain: ositrace`, not to a `sourceType`
   * filter. The discriminator the LLM uses is whether two named
   * concepts BOTH resolve to asset classes the SHACL connects — not
   * the English wording. The test pins the structural-rule headings;
   * specific ontology terms must stay OUT.
   */
  it('teaches the cross-reference rule structurally, never via English cues', () => {
    const prompt = buildSystemPrompt(mockShaclContent)
    expect(prompt).toContain('Cross-reference vs Filter')
    // The rule is ontology- AND language-agnostic; the prompt must
    // SAY so to keep future contributors from sneaking in cue lists.
    expect(prompt).toMatch(/structural/i)
    expect(prompt).toMatch(/language-agnostic/i)
    // Explicit English phrasal cues like "derived from", "based on",
    // "linked to" MUST NOT appear in the prompt as classifier rules.
    expect(prompt).not.toMatch(/"derived from"/i)
    expect(prompt).not.toMatch(/"based on"/i)
    expect(prompt).not.toMatch(/"linked to"/i)
  })

  it('teaches value-first property disambiguation generically', () => {
    const prompt = buildSystemPrompt(mockShaclContent)
    expect(prompt).toContain('Value-first Property Disambiguation')
    // The rule: prefer the property whose `sh:in` carries the user's
    // word as a whole literal over a property whose value space
    // requires reshaping (CamelCase compounds, substrings).
    expect(prompt).toContain('VERBATIM')
    expect(prompt).toMatch(/CamelCase/)
    expect(prompt).toMatch(/case-insensitive/i)
  })

  it('includes examples', () => {
    const prompt = buildSystemPrompt(mockShaclContent)
    expect(prompt).toContain('Example 1')
    expect(prompt).toContain('Single domain with filter and range')
    expect(prompt).toContain('Unmapped term becomes a gap')
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
    // The example must demonstrate the array-syntax shape with multiple
    // ISO codes inside a `filters: { "country": [...] }` block; the
    // specific set is allowed to evolve.
    expect(prompt).toMatch(/"country":\s*\[/)
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
