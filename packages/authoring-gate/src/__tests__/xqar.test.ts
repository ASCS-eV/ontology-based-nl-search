/**
 * `.xqar` interop, held to the framework's own schema.
 *
 * The point of emitting `.xqar` is that a *foreign* program reads it, so the
 * assertions here are about the contract rather than about our own round-trip:
 * element and attribute names come from
 * `asam-ev/qc-framework:doc/schema/xqar_result_format.xsd` ([QC-FW]), and the
 * import direction is checked against a document shaped like the ones the ASAM
 * bundles emit, not one we produced.
 */
import { describe, expect, it } from 'vitest'

import { QC_RULES } from '../qc-rules.js'
import type { AuthoringGap } from '../types.js'
import { gapsToXqar, parseXqar, XQAR_LEVEL } from '../xqar.js'

const BUNDLE = {
  name: 'authoringGate',
  version: '1.0.0',
  description: 'Design-time authoring gates',
  buildDate: '2026-01-01',
}

const semanticGap: AuthoringGap = {
  term: 'A3',
  reason: 'A named reference in an EntityRef must resolve to a declared entity.',
  ruleUid: QC_RULES.resolvableEntityReferences.uid,
  gate: 'semantic',
  focusNode: 'A3',
}

const residualGap: AuthoringGap = {
  term: 'road 1 geometry[2]',
  reason: 'G1 (heading) discontinuity at road 1 geometry[2].',
  ruleUid: QC_RULES.geometryContinuity.uid,
  gate: 'residual',
  focusNode: 'road 1 geometry[2]',
}

const structuralGap = {
  term: 'Value "bogus" is not allowed.',
  reason: 'OpenSCENARIO schema violation at line 42:17.',
  ruleUid: QC_RULES.schemaValidation.uid,
  gate: 'structural' as const,
  location: { line: 42, col: 17 },
}

describe('gapsToXqar', () => {
  const xml = gapsToXqar([semanticGap, residualGap, structuralGap], {
    inputFile: '/tmp/scene.xosc',
    bundle: BUNDLE,
  })

  it('emits the elements and attributes the framework schema defines', () => {
    expect(xml).toContain('<CheckerResults version="1.0.0">')
    expect(xml).toContain('name="authoringGate"')
    expect(xml).toContain('<Param name="InputFile" value="/tmp/scene.xosc"')
    expect(xml).toContain('checkerId=')
    expect(xml).toContain('issueId=')
    expect(xml).toContain('ruleUID=')
  })

  it('locates a structural finding with a FileLocation row/column', () => {
    expect(xml).toMatch(/<FileLocation row="42" column="17"/)
  })

  it('groups issues under one checker per gate, each declaring its rules', () => {
    const issues = parseXqar(xml)
    expect(new Set(issues.map((i) => i.checkerId)).size).toBe(3)
    // Every rule a checker can emit is declared, not just the ones that fired.
    expect(xml).toContain(`<AddressedRule ruleUID="${QC_RULES.uniqueElementNames.uid}"`)
  })

  it('reports residual findings as warnings and the rest as errors', () => {
    const issues = parseXqar(xml)
    const byRule = new Map(issues.map((i) => [i.ruleUid, i]))
    expect(byRule.get(QC_RULES.geometryContinuity.uid)?.level).toBe(XQAR_LEVEL.warning)
    expect(byRule.get(QC_RULES.resolvableEntityReferences.uid)?.level).toBe(XQAR_LEVEL.error)
    expect(byRule.get(QC_RULES.schemaValidation.uid)?.level).toBe(XQAR_LEVEL.error)
  })

  it('round-trips every gap, carrying the rule identity through', () => {
    const issues = parseXqar(xml)
    expect(issues).toHaveLength(3)
    expect(issues.map((i) => i.ruleUid).sort()).toEqual(
      [semanticGap.ruleUid, residualGap.ruleUid, structuralGap.ruleUid].sort()
    )
    expect(issues.every((i) => i.description.length > 0)).toBe(true)
  })

  it('emits a well-formed document for an empty gap set', () => {
    const empty = gapsToXqar([], { inputFile: '/tmp/scene.xosc', bundle: BUNDLE })
    expect(empty).toContain('<CheckerResults')
    expect(parseXqar(empty)).toEqual([])
  })
})

describe('parseXqar', () => {
  // Shaped like the framework's own test fixtures: attributes on Issue, the
  // Locations wrapper, level as a numeric string.
  const foreign = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<CheckerResults version="1.1.0">
  <CheckerBundle build_date="" description="OpenDRIVE checker bundle" name="xodrBundle" summary="Found 2 issues" version="1.0.0">
    <Param name="InputFile" value="road.xodr" />
    <Checker checkerId="check_asam_xodr_road_geometry_parampoly3_length_match" description="" summary="1 issue">
      <AddressedRule ruleUID="asam.net:xodr:1.7.0:road.geometry.parampoly3.length_match" />
      <Issue description="Length does not match" issueId="0" level="1" ruleUID="asam.net:xodr:1.7.0:road.geometry.parampoly3.length_match">
        <Locations description="road 1">
          <FileLocation column="7" row="112" />
        </Locations>
      </Issue>
    </Checker>
    <Checker checkerId="check_asam_xodr_performance_avoid_redundant_info" description="" summary="1 issue">
      <Issue description="Redundant info" issueId="1" level="2" ruleUID="asam.net:xodr:1.7.0:performance.avoid_redundant_info" />
    </Checker>
  </CheckerBundle>
</CheckerResults>
`

  it('reads a bundle-produced document into flat issues', () => {
    const issues = parseXqar(foreign)
    expect(issues).toHaveLength(2)
    expect(issues[0]).toEqual({
      checkerId: 'check_asam_xodr_road_geometry_parampoly3_length_match',
      ruleUid: 'asam.net:xodr:1.7.0:road.geometry.parampoly3.length_match',
      description: 'Length does not match',
      level: XQAR_LEVEL.error,
      location: { row: 112, column: 7 },
    })
    expect(issues[1]?.level).toBe(XQAR_LEVEL.warning)
    expect(issues[1]?.location).toBeUndefined()
  })

  it('returns nothing for a document that is not a checker result', () => {
    expect(parseXqar('<?xml version="1.0"?><OpenSCENARIO/>')).toEqual([])
  })

  it('defaults an unreadable severity to error rather than dropping the issue', () => {
    const odd = `<CheckerResults version="1.0.0"><CheckerBundle name="b"><Checker checkerId="c">
      <Issue description="d" issueId="0" ruleUID="asam.net:xodr:1.7.0:road.geometry.contact_point" />
    </Checker></CheckerBundle></CheckerResults>`
    const [issue] = parseXqar(odd)
    expect(issue?.level).toBe(XQAR_LEVEL.error)
  })
})
