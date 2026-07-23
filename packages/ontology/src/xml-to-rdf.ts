/**
 * Generic XML → RDF lift.
 *
 * A domain-agnostic structural projection of an XML document into an RDF/JS
 * dataset: every element becomes a typed blank node, every attribute a datatype
 * property, every child element an object property, so a standards document
 * (an OpenSCENARIO `.xosc`, an OpenDRIVE `.xodr`) can be validated against SHACL
 * shapes derived from its schema (task 01) and, later, joined into one graph for
 * the cross-file semantic gate (task 03). It carries NO domain knowledge — the
 * translation lives entirely in the shapes.
 *
 * Naming convention (must match the derived ontology, `artifacts/openscenario/`):
 *   - element `<Vehicle>`      → node `rdf:type ns:Vehicle`      (class = local name verbatim)
 *   - attribute `vehicleCategory="car"` → `ns:vehicleCategory "car"` (predicate = attribute name)
 *   - child `<Performance>` under `<Vehicle>` → `ns:performance <child>` (predicate = camelCase(child))
 *   - text content → `rdf:value`
 *
 * Literals are typed generically: a token that is wholly a decimal/scientific
 * number becomes `xsd:double`; everything else stays `xsd:string`. The lift
 * cannot know an attribute's XSD datatype without the schema, so numeric range
 * shapes (`sh:minInclusive`, …) drive off this uniform numeric typing and the
 * shapes avoid asserting `sh:datatype` on lifted numerics.
 *
 * STANDARDS (criterion #31):
 *   [RDF11]  W3C RDF 1.1 Concepts — docs/specs/references/rdf11-concepts.md
 *   [XML10]  W3C XML 1.0 (the lifted serialization)
 */
import datasetFactory from '@rdfjs/dataset'
import type { DatasetCore, NamedNode, Quad } from '@rdfjs/types'
import { XMLParser } from 'fast-xml-parser'
import { DataFactory } from 'n3'

const { namedNode, blankNode, literal, quad } = DataFactory

const RDF_TYPE = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')
const RDF_VALUE = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#value')
const XSD_DOUBLE = namedNode('http://www.w3.org/2001/XMLSchema#double')

/** A token that is wholly an optionally-signed decimal / scientific number. */
const NUMERIC = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/

const ATTR_PREFIX = '@_'
const TEXT_KEY = '#text'

export interface LiftOptions {
  /** Namespace IRI for the derived classes/properties (must end with `/` or `#`). */
  namespace: string
}

/** Lift a raw XML string into an RDF/JS dataset. Throws on malformed XML. */
export function liftXmlToRdf(xml: string, options: LiftOptions): DatasetCore {
  const ns = options.namespace
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ATTR_PREFIX,
    ignoreDeclaration: true,
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
    allowBooleanAttributes: true,
  })
  const tree = parser.parse(xml) as Record<string, unknown>
  const ds = datasetFactory.dataset()

  // The parsed tree is `{ RootElement: <value> }` (declaration ignored). A
  // namespaced or missing root is a malformed input for our purposes.
  const rootName = Object.keys(tree).find((k) => !k.startsWith('?') && !k.includes(':'))
  if (!rootName) throw new Error('liftXmlToRdf: no element root found')
  emitElement(ds, ns, rootName, tree[rootName])
  return ds
}

/** Class IRI for an element (local name verbatim). */
export function classIri(ns: string, elementName: string): NamedNode {
  return namedNode(ns + elementName)
}

/** Predicate IRI linking a parent to a child element (camelCase of child). */
export function childPredicateIri(ns: string, childName: string): NamedNode {
  return namedNode(ns + camel(childName))
}

function camel(name: string): string {
  return name.length === 0 ? name : name[0]!.toLowerCase() + name.slice(1)
}

/** Skip XML-namespace machinery — it never maps to a domain predicate. */
function isNamespaceName(name: string): boolean {
  return name.includes(':') || name === 'xmlns'
}

function typedLiteral(value: string) {
  return NUMERIC.test(value) ? literal(value, XSD_DOUBLE) : literal(value)
}

/**
 * Emit one element as a typed blank node and return it. `value` is the
 * fast-xml-parser payload for the element: an object (attributes + children),
 * a string (text-only / empty element), or nested arrays for repeats.
 */
function emitElement(ds: DatasetCore, ns: string, elementName: string, value: unknown) {
  const subject = blankNode()
  ds.add(quad(subject, RDF_TYPE, classIri(ns, elementName)) as Quad)

  if (typeof value === 'string') {
    if (value.length > 0) ds.add(quad(subject, RDF_VALUE, typedLiteral(value)) as Quad)
    return subject
  }
  if (value === null || typeof value !== 'object') return subject

  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith(ATTR_PREFIX)) {
      const attr = key.slice(ATTR_PREFIX.length)
      if (isNamespaceName(attr)) continue
      ds.add(quad(subject, namedNode(ns + attr), typedLiteral(String(raw))) as Quad)
      continue
    }
    if (key === TEXT_KEY) {
      const text = String(raw)
      if (text.length > 0) ds.add(quad(subject, RDF_VALUE, typedLiteral(text)) as Quad)
      continue
    }
    if (isNamespaceName(key)) continue
    const predicate = childPredicateIri(ns, key)
    for (const child of Array.isArray(raw) ? raw : [raw]) {
      const childNode = emitElement(ds, ns, key, child)
      ds.add(quad(subject, predicate, childNode) as Quad)
    }
  }
  return subject
}
