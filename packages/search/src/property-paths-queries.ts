/**
 * Property-path discovery queries (ADR 0003) — the SPARQL/IO layer: resolves
 * SHACL property-shape edges, leaf properties, and enriches leaf kinds from the
 * graph. Feeds the graph-traversal + orchestration in `property-paths.ts`.
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 * @see https://www.w3.org/TR/shacl/ — [SHACL]
 */
import { iri, sparqlPrefixes } from '@ontology-search/core/rdf/prefixes'
import type { SparqlStore } from '@ontology-search/sparql/types'

import { type LeafKind, type PropertyPath } from './property-paths-types.js'
import { SCHEMA_GRAPH } from './schema-loader.js'

export interface ResolvedEdge {
  parentClass: string
  predicate: string
  childClass: string
}

/**
 * Query shape-to-shape edges and resolve them to
 * (parentClass, predicate, childClass) triples.
 *
 * `sh:or` list membership is resolved with an `rdf:rest`-star / `rdf:first`
 * property path, kept in its OWN query (never inside a UNION) — Oxigraph WASM
 * traps ("unreachable") on `UNION` + property path, and evaluating a
 * fixed-depth list walk inside a UNION is pathologically slow (~33s for the
 * 4-deep walk this replaced; the split runs in ~25ms). Each membership form
 * (direct `sh:node`, `sh:or` member) is a separate query merged in TS. The
 * property path also handles `sh:or` lists of any length — the previous
 * fixed-depth UNION silently dropped members past the 4th.
 *
 * @see https://github.com/oxigraph/oxigraph/issues — UNION + rdf:rest* crash
 */

export async function queryResolvedEdges(store: SparqlStore): Promise<ResolvedEdge[]> {
  // An edge is `parentClass --predicate--> childShape`, where the property
  // shape references the child shape either directly (`sh:node`) or as a
  // member of an `sh:or` disjunction list.
  //
  // Each reference form is its own UNION-free query, merged in TS, for two
  // reasons (both verified against the workspace ontology):
  //
  // 1. PERF: a fixed-depth `rdf:rest`/`rdf:first` list walk expressed *inside
  //    a UNION* makes Oxigraph WASM evaluate ~33s for a 4-deep walk (the
  //    planner re-runs the property-shape prefix join per branch over the
  //    blank-node list). The standalone `rdf:rest*/rdf:first` form is ~10ms.
  // 2. SAFETY: `UNION` combined with a property path traps the WASM runtime
  //    ("unreachable") — the same class of crash that forced the OPTIONAL
  //    split in `queryLeafProperties`. So the property path must live in its
  //    own query, never unioned.
  //
  // `rdf:rest*/rdf:first` also drops the previous hard cap of 4 sh:or members,
  // so arbitrarily long disjunction lists in other ontologies resolve too.
  //
  // Step 1a: edges where the child shape is referenced directly via sh:node.
  const directEdgeSparql = `
    ${sparqlPrefixes('sh')}

    SELECT DISTINCT ?parentClass ?predicate ?childShape WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?parentShape sh:targetClass ?parentClass .
        ?parentShape sh:property ?propShape .
        ?propShape sh:path ?predicate .
        FILTER(isIRI(?predicate))
        ?propShape sh:node ?childShape .
      }
    }
  `

  // Step 1b: edges where the child shape is any member of an sh:or list.
  const orEdgeSparql = `
    ${sparqlPrefixes('sh', 'rdf')}

    SELECT DISTINCT ?parentClass ?predicate ?childShape WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?parentShape sh:targetClass ?parentClass .
        ?parentShape sh:property ?propShape .
        ?propShape sh:path ?predicate .
        FILTER(isIRI(?predicate))
        ?propShape sh:or ?list .
        ?list rdf:rest*/rdf:first ?item .
        ?item sh:node ?childShape .
      }
    }
  `

  // Step 1c: edges via sh:class (LinkML-generated SHACL uses sh:class
  // rather than sh:node to reference nested shapes). The value is the
  // class IRI directly, so these produce edges without needing
  // shapeTarget resolution.
  const classEdgeSparql = `
    ${sparqlPrefixes('sh')}

    SELECT DISTINCT ?parentClass ?predicate ?childClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?parentShape sh:targetClass ?parentClass .
        ?parentShape sh:property ?propShape .
        ?propShape sh:path ?predicate .
        FILTER(isIRI(?predicate))
        ?propShape sh:class ?childClass .
        FILTER(isIRI(?childClass))
        ?childShape sh:targetClass ?childClass .
      }
    }
  `

  // Step 2a: shapes that declare a target class directly.
  const directTargetSparql = `
    ${sparqlPrefixes('sh')}

    SELECT DISTINCT ?shape ?targetClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?shape sh:targetClass ?targetClass .
        FILTER(isIRI(?targetClass))
      }
    }
  `

  // Step 2b: shapes whose target class is reached through an sh:or member.
  const orTargetSparql = `
    ${sparqlPrefixes('sh', 'rdf')}

    SELECT DISTINCT ?shape ?targetClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?shape sh:or ?list .
        ?list rdf:rest*/rdf:first ?item .
        ?item sh:node ?inner .
        ?inner sh:targetClass ?targetClass .
        FILTER(isIRI(?targetClass))
      }
    }
  `

  const [directEdges, orEdges, classEdges, directTargets, orTargets] = await Promise.all([
    store.query(directEdgeSparql),
    store.query(orEdgeSparql),
    store.query(classEdgeSparql),
    store.query(directTargetSparql),
    store.query(orTargetSparql),
  ])

  // Build shape → targetClass[] lookup from both target forms.
  const shapeTargets = new Map<string, string[]>()
  for (const row of [...directTargets.results.bindings, ...orTargets.results.bindings]) {
    const shape = row['shape']?.value
    const targetClass = row['targetClass']?.value
    if (!shape || !targetClass) continue
    const list = shapeTargets.get(shape) ?? []
    list.push(targetClass)
    shapeTargets.set(shape, list)
  }

  // Resolve edges from both edge forms.
  const edges: ResolvedEdge[] = []
  const seen = new Set<string>()
  for (const row of [...directEdges.results.bindings, ...orEdges.results.bindings]) {
    const parentClass = row['parentClass']?.value
    const predicate = row['predicate']?.value
    const childShape = row['childShape']?.value
    if (!parentClass || !predicate || !childShape) continue

    const targets = shapeTargets.get(childShape) ?? []
    for (const childClass of targets) {
      const key = `${parentClass}|${predicate}|${childClass}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({ parentClass, predicate, childClass })
    }
  }

  // sh:class edges already carry the resolved class (no shapeTargets lookup).
  for (const row of classEdges.results.bindings) {
    const parentClass = row['parentClass']?.value
    const predicate = row['predicate']?.value
    const childClass = row['childClass']?.value
    if (!parentClass || !predicate || !childClass) continue
    const key = `${parentClass}|${predicate}|${childClass}`
    if (seen.has(key)) continue
    seen.add(key)
    edges.push({ parentClass, predicate, childClass })
  }

  // Sort deterministically. The downstream BFS reconstructs ONE path per
  // (asset, leaf) and breaks ties among equal-length paths by edge-insertion
  // order — so a stable edge order is what makes path discovery reproducible.
  // The previous fixed-depth UNION happened to emit sh:or members in RDF-list
  // order; the `rdf:rest*/rdf:first` property path does NOT (SPARQL leaves
  // path-result order unspecified), so without this sort the chosen
  // intermediate could flip between runs (e.g. a sensor leaf reachable via
  // both Camera and Lidar). Sorting by (parent, predicate, child) IRI makes
  // the choice independent of the engine's result order — the same
  // determinism discipline the rest of this module uses (see the chain sort
  // in compiler.ts).
  edges.sort(
    (a, b) =>
      a.parentClass.localeCompare(b.parentClass) ||
      a.predicate.localeCompare(b.predicate) ||
      a.childClass.localeCompare(b.childClass)
  )
  return edges
}

export interface LeafRow {
  owningClass: string
  propertyIri: string
  leafKind: LeafKind
}

/**
 * Query every `(targetClass, leaf-predicate, leaf-iri)` triple — the
 * leaves of every property path. A leaf is a property shape with a
 * literal `sh:path` and NO `sh:node` (its values are RDF literals,
 * IRIs, or typed instances, not sub-resources to recurse into).
 *
 * Returns each leaf annotated with its {@link LeafKind} so the
 * compiler can distinguish literal-value leaves (used for filters
 * and ranges) from IRI / class-typed leaves (used to express
 * cross-domain references).
 *
 * Determined from SHACL: `sh:nodeKind sh:IRI` → `iri`, `sh:class ?C`
 * → `class:<IRI>`, anything else (including `sh:datatype xsd:foo`,
 * `sh:in`, or unconstrained) → `literal`.
 *
 * Implementation note (Oxigraph WASM): an OPTIONAL on both
 * `sh:nodeKind` and `sh:class` would be the obvious shape, but the
 * project hits OPTIONAL-correlated crashes in the WASM runtime on the
 * same workloads where `UNION + property-path *` crashes (see header
 * comment). The query is split into two SELECT runs and merged in TS.
 */

export async function queryLeafProperties(store: SparqlStore): Promise<LeafRow[]> {
  // Single SELECT — the original 21a query, unchanged. Performance is
  // critical here because the result feeds the BFS in `buildPropertyPaths`,
  // which runs at compiler-vocab startup. The two extra `OPTIONAL`s the
  // earlier 21c draft tried (sh:nodeKind, sh:class) blew through the
  // 30s test timeout on the workspace ontology — Oxigraph WASM appears
  // to expand OPTIONAL over a property-shape blank-node graph
  // pathologically. Enrichment now happens via a separate query post-BFS
  // (see `enrichLeafKinds` below).
  const leafSparql = `
    ${sparqlPrefixes('sh')}

    SELECT DISTINCT ?owningClass ?propertyIri WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?owningShape sh:targetClass ?owningClass .
        ?owningShape sh:property ?propShape .
        ?propShape sh:path ?propertyIri .
        FILTER(isIRI(?propertyIri))
        FILTER NOT EXISTS { ?propShape sh:node ?anyNode }
        FILTER NOT EXISTS { ?propShape sh:or ?anyOr }
      }
    }
  `
  const leafResult = await store.query(leafSparql)

  const leaves: LeafRow[] = []
  for (const row of leafResult.results.bindings) {
    const owningClass = row['owningClass']?.value
    const propertyIri = row['propertyIri']?.value
    if (!owningClass || !propertyIri) continue
    leaves.push({ owningClass, propertyIri, leafKind: 'literal' })
  }
  return leaves
}

/**
 * Discover the SHACL nodeKind / sh:class declaration on every leaf
 * property IRI used by the discovered paths. Runs as a second pass
 * against the schema graph so the hot BFS query in
 * `queryLeafProperties` stays minimal.
 *
 * Only IRIs that were already discovered as leaves are introspected
 * — properties never reached by a BFS path are skipped — so the
 * enrichment cost scales with the discovered-leaf count, not with
 * the total schema-graph size.
 */

export async function enrichLeafKinds(
  store: SparqlStore,
  paths: PropertyPath[]
): Promise<Map<string, LeafKind>> {
  const propIris = new Set<string>()
  for (const p of paths) propIris.add(p.propertyIri)
  if (propIris.size === 0) return new Map()

  const valuesClause = [...propIris].map((iri) => `<${iri}>`).join(' ')
  const sparql = `
    ${sparqlPrefixes('sh')}

    SELECT DISTINCT ?propertyIri ?nodeKind ?targetClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        VALUES ?propertyIri { ${valuesClause} }
        ?propShape sh:path ?propertyIri .
        { ?propShape sh:nodeKind ?nodeKind }
        UNION
        { ?propShape sh:class ?targetClass . FILTER(isIRI(?targetClass)) }
      }
    }
  `
  const result = await store.query(sparql)

  const SH_IRI = iri('sh', 'IRI')
  const out = new Map<string, LeafKind>()
  for (const row of result.results.bindings) {
    const pi = row['propertyIri']?.value
    if (!pi) continue
    const nodeKind = row['nodeKind']?.value
    const targetClass = row['targetClass']?.value
    // Prefer `class` over `iri` when both are declared on the same
    // property — `sh:class` carries strictly more information.
    if (targetClass && !out.get(pi)?.startsWith('class:')) {
      out.set(pi, `class:${targetClass}`)
    } else if (nodeKind === SH_IRI && !out.has(pi)) {
      out.set(pi, 'iri')
    }
  }
  return out
}
