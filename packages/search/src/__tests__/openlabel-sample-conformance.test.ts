/**
 * The OpenLABEL sample data must be VALID against the OpenLABEL V1-0-0 shapes.
 *
 * "OpenLABEL v1" is the ASAM class taxonomy plus the OMB-authored SHACL shapes
 * (`openlabel.shacl.ttl`) — it has no LinkML source and its OWL declares no
 * properties, so the shapes are the only machine-checkable contract. This test
 * validates the data exactly as loaded into the store (JSON-LD → RDF, with the
 * ontology's class hierarchy mirrored into the default graph, which is what
 * makes `sh:targetClass openlabel:Odd` reach `openlabel:OddScenery` nodes
 * ([SHACL] §2.1.3.2 class-based targets, §1.5 RDFS inferencing).
 *
 * Engine: rdf-validate-shacl (SHACL Core). The flag ↔ value pairing of the v1
 * shapes is a SHACL-SPARQL rule ([SHACL] §5, `sh:sparql`) the engine may not
 * evaluate, so that invariant is asserted explicitly as well. OMB's own
 * `onto-validate` (pyshacl, RDFS inference) is the reference engine; both agree
 * on the committed data and on every negative control below.
 */
import { readFileSync } from 'node:fs'

import { discoverShapeFiles } from '@ontology-search/ontology/sources'
import type { SparqlStore } from '@ontology-search/sparql/types'
import datasetFactory from '@rdfjs/dataset'
import { DataFactory, Parser } from 'n3'
import SHACLValidator from 'rdf-validate-shacl'
import { beforeAll, describe, expect, it } from 'vitest'

import { getInitializedStore } from '../init.js'

const { namedNode, blankNode, literal, quad } = DataFactory

const OL = 'https://openlabel.asam.net/V1-0-0/ontologies/'
const XSD = 'http://www.w3.org/2001/XMLSchema#'
const SCHEMA = 'https://schema.org/'
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
const RDFS_SUBCLASS = 'http://www.w3.org/2000/01/rdf-schema#subClassOf'
const SH_SPARQL = 'http://www.w3.org/ns/shacl#sparql'
const SH_DATATYPE = 'http://www.w3.org/ns/shacl#datatype'
const SH_NODEKIND = 'http://www.w3.org/ns/shacl#nodeKind'
const SH_LITERAL = 'http://www.w3.org/ns/shacl#Literal'
const RDFS_LITERAL = 'http://www.w3.org/2000/01/rdf-schema#Literal'

type Dataset = ReturnType<typeof datasetFactory.dataset>

/** Default graph of the loaded store as an RDF/JS dataset. */
async function defaultGraph(store: SparqlStore): Promise<Dataset> {
  const { results } = await store.query('SELECT ?s ?p ?o WHERE { ?s ?p ?o }')
  const dataset = datasetFactory.dataset()
  for (const row of results.bindings) {
    const s = row['s']!
    const p = row['p']!
    const o = row['o']!
    const subject = s.type === 'bnode' ? blankNode(s.value) : namedNode(s.value)
    let object
    if (o.type === 'uri') object = namedNode(o.value)
    else if (o.type === 'bnode') object = blankNode(o.value)
    else if (o['xml:lang']) object = literal(o.value, o['xml:lang'])
    else object = literal(o.value, o.datatype ? namedNode(o.datatype) : undefined)
    dataset.add(quad(subject, namedNode(p.value), object))
  }
  return dataset
}

function loadShapes(): Dataset {
  const file = discoverShapeFiles().find(
    (f) => f.domain === 'openlabel' && f.path.endsWith('.shacl.ttl')
  )
  if (!file) throw new Error('OpenLABEL v1 shapes (domain "openlabel") not found in the ontology')
  const shapes = datasetFactory.dataset()
  for (const q of new Parser().parse(readFileSync(file.path, 'utf8'))) shapes.add(q)
  // rdf-validate-shacl implements SHACL Core only and throws on SHACL-SPARQL
  // constraints ([SHACL] §5.2). The v1 `sh:sparql` rules are asserted by the
  // "invariants" tests below instead.
  for (const q of [...shapes.match(null, namedNode(SH_SPARQL))]) shapes.delete(q)
  // v1 declares AdminTag properties as `sh:datatype rdfs:Literal`. `rdfs:Literal`
  // is a class, not the datatype IRI of any literal, so a strict engine
  // ([SHACL] §4.1.2) can never accept a value (pyshacl special-cases it). The
  // evident intent is `sh:nodeKind sh:Literal`; validate that instead.
  for (const q of [...shapes.match(null, namedNode(SH_DATATYPE), namedNode(RDFS_LITERAL))]) {
    shapes.delete(q)
    shapes.add(quad(q.subject, namedNode(SH_NODEKIND), namedNode(SH_LITERAL)))
  }
  return shapes
}

async function select(store: SparqlStore, sparql: string): Promise<Record<string, string>[]> {
  const { results } = await store.query(sparql)
  return results.bindings.map((b) =>
    Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value]))
  )
}

const localName = (iri: string) => iri.split(/[/#]/).pop()!

/** Single COUNT result of `sparql` bound to `variable`. */
async function count(store: SparqlStore, sparql: string, variable: string): Promise<number> {
  return Number((await select(store, sparql))[0]?.[variable] ?? 0)
}

// rdf-validate-shacl types its datasets over `Quad`, @rdfjs/dataset over
// `BaseQuad` — the same RDF/JS terms across an external typing boundary.
type EngineDataset = Parameters<SHACLValidator['validate']>[0]

describe('OpenLABEL sample data conforms to the OpenLABEL V1-0-0 shapes', () => {
  let store: SparqlStore
  let data: Dataset
  let shapes: Dataset

  beforeAll(async () => {
    store = await getInitializedStore()
    data = await defaultGraph(store)
    shapes = loadShapes()
  }, 180_000)

  const validate = (dataset: Dataset) =>
    new SHACLValidator(shapes as EngineDataset, {
      importGraph: () => datasetFactory.dataset() as EngineDataset,
    }).validate(dataset as EngineDataset)

  it('has no SHACL violations', async () => {
    const report = await validate(data)
    const messages = report.results.map(
      (r) => `${r.focusNode?.value} ${r.path?.value}: ${r.message.map((m) => m.value).join('; ')}`
    )
    expect(messages).toEqual([])
    expect(report.conforms).toBe(true)
  }, 180_000)

  it('exercises the shapes (the check is not vacuous)', async () => {
    const tags = await count(
      store,
      `SELECT (COUNT(DISTINCT ?t) AS ?tags) WHERE { ?t a <${OL}Tag> }`,
      'tags'
    )
    const odd = await count(
      store,
      `SELECT (COUNT(DISTINCT ?n) AS ?odd) WHERE { ?n a ?c . ?c <${RDFS_SUBCLASS}>* <${OL}Odd> }`,
      'odd'
    )
    const behaviour = await count(
      store,
      `SELECT (COUNT(DISTINCT ?n) AS ?behaviour) WHERE { ?n a <${OL}Behaviour> }`,
      'behaviour'
    )
    expect(tags).toBeGreaterThanOrEqual(30)
    // standalone Odd nodes + embedded OddScenery / OddEnvironment / OddDynamicElements
    expect(odd).toBeGreaterThan(tags)
    expect(behaviour).toBeGreaterThan(tags)
  })

  describe('negative controls — the check catches what v1 forbids', () => {
    const firstNode = async (property: string) => {
      const { results } = await store.query(
        `SELECT ?n WHERE { ?t a <${OL}Tag> ; <${OL}${property}> ?n } ORDER BY ?n LIMIT 1`
      )
      const n = results.bindings[0]!['n']!
      // nested Odd / Behaviour nodes of a Tag are blank nodes
      return n.type === 'bnode' ? blankNode(n.value) : namedNode(n.value)
    }

    async function violationsWith(extra: ReturnType<typeof quad>[]) {
      const mutated = datasetFactory.dataset([...data])
      for (const q of extra) mutated.add(q)
      return (await validate(mutated)).results
    }

    it('rejects an xsd:integer where v1 requires decimal or a QuantitativeValue', async () => {
      // the defect the previous sample data had for `motionDriveValue`
      const results = await violationsWith([
        quad(
          await firstNode('Behaviour'),
          namedNode(`${OL}motionDriveValue`),
          literal('88', namedNode(`${XSD}integer`))
        ),
      ])
      expect(results.length).toBeGreaterThan(0)
    })

    it('rejects an enumeration member from another family (sh:in)', async () => {
      const results = await violationsWith([
        quad(
          await firstNode('Odd'),
          namedNode(`${OL}DrivableAreaType`),
          namedNode(`${OL}VehicleCar`)
        ),
      ])
      expect(results.length).toBeGreaterThan(0)
    })

    it('rejects a boolean flag stored as a string', async () => {
      const results = await violationsWith([
        quad(await firstNode('Odd'), namedNode(`${OL}HorizontalStraights`), literal('yes')),
      ])
      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('invariants the v1 shapes express as SHACL-SPARQL rules', () => {
    it('every <flag>Value is accompanied by its flag set to true', async () => {
      // v1 rule: "If 'weatherRain' is not true, 'weatherRainValue' must not be present."
      const rows = await select(
        store,
        `SELECT ?n ?valueProperty WHERE {
           ?n ?valueProperty ?v .
           FILTER(STRSTARTS(STR(?valueProperty), "${OL}") && STRENDS(STR(?valueProperty), "Value"))
           BIND(STRAFTER(STR(?valueProperty), "${OL}") AS ?local)
           BIND(IRI(CONCAT("${OL}", UCASE(SUBSTR(?local, 1, 1)),
                           REPLACE(SUBSTR(?local, 2), "Value$", ""))) AS ?flag)
           FILTER NOT EXISTS { ?n ?flag true }
         }`
      )
      expect(rows).toEqual([])
    })

    it('every QuantitativeValue has minValue <= maxValue', async () => {
      const rows = await select(
        store,
        `SELECT ?q WHERE {
           ?q <${SCHEMA}minValue> ?lo ; <${SCHEMA}maxValue> ?hi .
           FILTER(<${XSD}decimal>(?lo) > <${XSD}decimal>(?hi))
         }`
      )
      expect(rows).toEqual([])
    })
  })

  describe('modelling conventions (OMB `tests/data/scenario/valid/scenario_instance.json`)', () => {
    it('embedded ODD nodes are category-pure: every attribute belongs to the node type', async () => {
      // v1 has no properties — the attribute IRI is also an rdfs:Class whose
      // ancestors include its ODD category class.
      const rows = await select(
        store,
        `SELECT DISTINCT ?type ?attribute WHERE {
           VALUES ?type { <${OL}OddScenery> <${OL}OddEnvironment> <${OL}OddDynamicElements> }
           ?n a ?type ; ?attribute ?o .
           FILTER(STRSTARTS(STR(?attribute), "${OL}"))
           FILTER(REGEX(STRAFTER(STR(?attribute), "${OL}"), "^[A-Z]"))
           FILTER NOT EXISTS { ?attribute <${RDFS_SUBCLASS}>* ?type }
         }`
      )
      expect(rows).toEqual([])
    })

    it('scenery lives in HD maps; environment, dynamics, behaviour and road users in scenarios', async () => {
      const rows = await select(
        store,
        `SELECT DISTINCT ?assetType ?nodeType WHERE {
           ?asset a ?assetType ; ?toSpec ?spec .
           ?spec ?toContent ?content .
           ?content a ?nodeType .
           FILTER(STRSTARTS(STR(?nodeType), "${OL}") && ?assetType != <${OL}Tag>)
           FILTER(?toSpec != <${RDF_TYPE}> && ?toContent != <${RDF_TYPE}>)
         }`
      )
      const pairs = rows.map((r) => `${localName(r['assetType']!)}→${localName(r['nodeType']!)}`)
      expect(pairs.sort()).toEqual(
        [
          'HdMap→OddScenery',
          'Scenario→Behaviour',
          'Scenario→OddDynamicElements',
          'Scenario→OddEnvironment',
          'Scenario→RoadUser',
        ].sort()
      )
    })
  })
})
