import { describe, expect, it } from 'vitest'

import { irToRdf } from '../ir-to-rdf.js'
import { cutInIR } from './fixtures/cut-in-ir.js'

describe('irToRdf', () => {
  it('emits a ScenarioObject per entity, keyed by index with the ref as its name', () => {
    const ttl = irToRdf(cutInIR())
    expect(ttl).toContain('<urn:scene:entity:0> a os:ScenarioObject ; os:name "Ego" .')
    expect(ttl).toContain('<urn:scene:entity:1> a os:ScenarioObject ; os:name "A1" .')
    expect(ttl).toContain('<urn:scene:entity:2> a os:ScenarioObject ; os:name "A2" .')
  })

  it('emits a ParameterDeclaration per parameter', () => {
    const ttl = irToRdf(cutInIR())
    expect(ttl).toContain('a os:ParameterDeclaration ; os:name "owner" ; os:value "A2" .')
  })

  it('reifies each entity reference with its role, value and referencing actor', () => {
    const ttl = irToRdf(cutInIR())
    expect(ttl).toContain('a gate:EntityReference')
    expect(ttl).toContain('gate:referenceValue "$owner"')
    expect(ttl).toContain('gate:referenceValue "Ego"')
    expect(ttl).toContain('gate:referencedBy "A2"')
  })

  it('reifies the absolute teleport road id as a cross-file RoadReference', () => {
    const ttl = irToRdf(cutInIR())
    expect(ttl).toContain('a gate:RoadReference ; gate:roadId "1"')
  })

  it('is deterministic — identical IR yields byte-identical Turtle', () => {
    expect(irToRdf(cutInIR())).toBe(irToRdf(cutInIR()))
  })

  it('does not emit a RoadReference for a relative teleport, and escapes special chars', () => {
    const ttl = irToRdf({
      entities: [{ ref: 'a"b\\c\nd', type: 'Vehicle', properties: {} }],
      actions: [
        {
          actor: 'a"b\\c\nd',
          kind: 'TeleportAction',
          properties: { roadId: '5' },
          references: { relativeTo: 'a"b\\c\nd' },
        },
      ],
    })
    // Relative teleport (references.relativeTo set) ⇒ no cross-file RoadReference.
    expect(ttl).not.toContain('a gate:RoadReference')
    // Turtle escaping applied to the quote, backslash and newline in the name.
    expect(ttl).toContain('\\"')
    expect(ttl).toContain('\\\\')
    expect(ttl).toContain('\\n')
  })

  it('reifies a RoadReference from the first value of an array-valued roadId', () => {
    const ttl = irToRdf({
      entities: [{ ref: 'Ego', type: 'Vehicle', properties: {} }],
      actions: [{ actor: 'Ego', kind: 'TeleportAction', properties: { roadId: ['7', '8'] } }],
    })
    expect(ttl).toContain('a gate:RoadReference ; gate:roadId "7"')
  })
})
