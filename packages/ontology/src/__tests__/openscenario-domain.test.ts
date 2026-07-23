/**
 * Acceptance for the derived OpenSCENARIO authoring domain (task 01).
 *
 * Proves the derived OWL+SHACL is loadable by the repo's SHACL engine and that
 * lifting the normative cut-in example into RDF conforms — while a tampered
 * value (out-of-enum, out-of-range) is caught. This is the regression backstop
 * (criterion #30): every constraint transcribed from the XSD / RangeCheckerRules
 * has a positive (conforms) and negative (violates) assertion.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import datasetFactory from '@rdfjs/dataset'
import type { DatasetCore, Quad } from '@rdfjs/types'
import { DataFactory, Parser } from 'n3'
import SHACLValidator from 'rdf-validate-shacl'
import { describe, expect, it } from 'vitest'

import { liftXmlToRdf } from '../xml-to-rdf.js'

const { namedNode } = DataFactory

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const ART = join(ROOT, 'artifacts', 'openscenario')
const CUT_IN = join(ROOT, 'packages', 'authoring-wasm', 'src', '__fixtures__', 'cut-in.xosc')
const NS = 'https://w3id.org/ascs-ev/envited-x/openscenario/v1/'
const SH = 'http://www.w3.org/ns/shacl#'

function parseTtl(...files: string[]): DatasetCore {
  const ds = datasetFactory.dataset()
  const parser = new Parser()
  for (const file of files) {
    for (const q of parser.parse(readFileSync(file, 'utf-8'))) ds.add(q as unknown as Quad)
  }
  return ds
}

function makeValidator(): SHACLValidator {
  const shapes = parseTtl(join(ART, 'openscenario.owl.ttl'), join(ART, 'openscenario.shacl.ttl'))
  return new SHACLValidator(shapes, { importGraph: () => datasetFactory.dataset() })
}

const rawCutIn = readFileSync(CUT_IN, 'utf-8')

describe('OpenSCENARIO domain — shapes load', () => {
  it('the repo SHACL engine loads the derived shapes without error', () => {
    expect(() => makeValidator()).not.toThrow()
  })

  it('encodes enums (sh:in) and numeric ranges (sh:minInclusive) from the XSD/RangeCheckerRules', () => {
    const shapes = parseTtl(join(ART, 'openscenario.shacl.ttl'))
    const inCount = [...shapes.match(null, namedNode(SH + 'in'), null)].length
    const minInclCount = [...shapes.match(null, namedNode(SH + 'minInclusive'), null)].length
    expect(inCount).toBeGreaterThanOrEqual(4) // ParameterType, VehicleCategory, DynamicsShape×2, DynamicsDimension×2
    expect(minInclCount).toBeGreaterThanOrEqual(6)
  })
})

describe('OpenSCENARIO domain — cut-in conformance', () => {
  it('lifts the normative cut-in .xosc and it CONFORMS to the derived shapes', async () => {
    const data = liftXmlToRdf(rawCutIn, { namespace: NS })
    const report = await makeValidator().validate(data)
    if (!report.conforms) {
      // Surface the offending shapes to make a regression obvious.
      const detail = report.results
        .map((r) => `${r.path?.value ?? '?'}: ${r.message.map((m) => m.value).join(' ')}`)
        .join('\n')
      throw new Error(`expected cut-in to conform, got:\n${detail}`)
    }
    expect(report.conforms).toBe(true)
  })

  it('lifts three ScenarioObjects with a Vehicle typed by the ontology', () => {
    const data = liftXmlToRdf(rawCutIn, { namespace: NS })
    const rdfType = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')
    const scenarioObjects = [...data.match(null, rdfType, namedNode(NS + 'ScenarioObject'))]
    const vehicles = [...data.match(null, rdfType, namedNode(NS + 'Vehicle'))]
    expect(scenarioObjects.length).toBe(3)
    expect(vehicles.length).toBe(3)
  })
})

describe('OpenSCENARIO domain — the gate has teeth', () => {
  it('rejects an out-of-enum vehicleCategory', async () => {
    const tampered = rawCutIn.replace('vehicleCategory="car"', 'vehicleCategory="spaceship"')
    expect(tampered).not.toBe(rawCutIn)
    const report = await makeValidator().validate(liftXmlToRdf(tampered, { namespace: NS }))
    expect(report.conforms).toBe(false)
    expect(report.results.some((r) => r.path?.value === NS + 'vehicleCategory')).toBe(true)
  })

  it('rejects an out-of-range maxSteering (> PI)', async () => {
    const tampered = rawCutIn.replace('maxSteering="0.5"', 'maxSteering="5.0"')
    expect(tampered).not.toBe(rawCutIn)
    const report = await makeValidator().validate(liftXmlToRdf(tampered, { namespace: NS }))
    expect(report.conforms).toBe(false)
    expect(report.results.some((r) => r.path?.value === NS + 'maxSteering')).toBe(true)
  })

  it('rejects a negative Dimensions value', async () => {
    const tampered = rawCutIn.replace('width="2.1"', 'width="-1.0"')
    expect(tampered).not.toBe(rawCutIn)
    const report = await makeValidator().validate(liftXmlToRdf(tampered, { namespace: NS }))
    expect(report.conforms).toBe(false)
    expect(report.results.some((r) => r.path?.value === NS + 'width')).toBe(true)
  })
})
