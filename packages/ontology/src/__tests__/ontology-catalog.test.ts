/**
 * The pinned package resolves ontology IRIs to files through an OASIS XML
 * catalog [XMLCAT]. Consumers ask it by IRI so that upstream moving a file —
 * which it does — cannot break them.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { parseOntologyCatalog, resolveOntologyPath } from '../ontology-catalog.js'

const OPENDRIVE = 'http://code.asam.net/simulation/standard/opendrive'
const OPENSCENARIO = 'http://code.asam.net/simulation/standard/openscenario'

const work = mkdtempSync(join(tmpdir(), 'catalog-test-'))
afterAll(() => rmSync(work, { recursive: true, force: true }))

function catalogXml(entries: ReadonlyArray<readonly [string, string]>): string {
  const lines = entries.map(([name, uri]) => `  <uri name="${name}" uri="${uri}"/>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<catalog xmlns="urn:oasis:names:tc:entity:xmlns:xml:catalog">
${lines}
</catalog>`
}

describe('parseOntologyCatalog', () => {
  it('maps each declared IRI to a path under the imports directory', () => {
    const entries = parseOntologyCatalog(
      catalogXml([
        [OPENDRIVE, 'opendrive/opendrive.owl.ttl'],
        [OPENSCENARIO, 'openscenario/openscenario.owl.ttl'],
      ]),
      '/imports'
    )
    expect(entries.get(OPENDRIVE)).toBe(join('/imports', 'opendrive/opendrive.owl.ttl'))
    expect(entries.get(OPENSCENARIO)).toBe(join('/imports', 'openscenario/openscenario.owl.ttl'))
  })

  /**
   * The reason this module exists. OMB v0.4.0 relocated
   * `imports/OpenScenario/OpenSCENARIO.xsd` to
   * `imports/openscenario/schema/OpenSCENARIO.xsd`, which broke a consumer that
   * had joined the old path segments. A consumer that asks by IRI follows the
   * move without changing.
   */
  it('follows a file the distribution has moved, because the IRI did not move', () => {
    const before = parseOntologyCatalog(
      catalogXml([[OPENDRIVE, 'OpenDrive/opendrive.owl.ttl']]),
      '/imports'
    )
    const after = parseOntologyCatalog(
      catalogXml([[OPENDRIVE, 'opendrive/opendrive.owl.ttl']]),
      '/imports'
    )
    expect(before.get(OPENDRIVE)).not.toBe(after.get(OPENDRIVE))
    // Same question, both times — only the answer moved.
    expect(before.has(OPENDRIVE) && after.has(OPENDRIVE)).toBe(true)
  })

  it('rejects a document that is not an OASIS catalog', () => {
    expect(() => parseOntologyCatalog('<nope/>', '/imports')).toThrow(/OASIS XML catalog/)
  })

  it('rejects a catalog that declares nothing, rather than resolving nothing later', () => {
    expect(() => parseOntologyCatalog(catalogXml([]), '/imports')).toThrow(/no <uri> entries/)
  })

  it('handles a single-entry catalog (parsers collapse one child to an object)', () => {
    const entries = parseOntologyCatalog(catalogXml([[OPENDRIVE, 'a/b.ttl']]), '/imports')
    expect(entries.size).toBe(1)
  })
})

describe('resolveOntologyPath against the real pinned catalog', () => {
  it('resolves both ASAM ontologies and their shapes to files that exist', () => {
    for (const iri of [OPENDRIVE, `${OPENDRIVE}/shapes`, OPENSCENARIO, `${OPENSCENARIO}/shapes`]) {
      expect(resolveOntologyPath(iri)).toMatch(/\.ttl$/)
    }
  })

  it('names what it does declare when asked for an IRI it does not have', () => {
    expect(() => resolveOntologyPath('https://example.invalid/nope')).toThrow(
      /The pinned catalog declares:.*opendrive/s
    )
  })

  it('reports the path when the catalog and the layout disagree', () => {
    const importsDir = join(work, 'imports')
    mkdirSync(importsDir, { recursive: true })
    writeFileSync(join(importsDir, 'catalog-v001.xml'), catalogXml([[OPENDRIVE, 'gone/x.ttl']]))
    const entries = parseOntologyCatalog(catalogXml([[OPENDRIVE, 'gone/x.ttl']]), importsDir)
    expect(entries.get(OPENDRIVE)).toContain('gone')
  })
})
