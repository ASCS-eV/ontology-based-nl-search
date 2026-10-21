/**
 * Several values on one filter leaf are alternatives (the slot contract's
 * IN-semantics), never a conjunction: "icy OR wet surface" matches an asset
 * with either. A broad IRI value also matches the values below it, which the
 * compiler lists explicitly from the schema's hierarchy (`value-hierarchy.ts`)
 * before the filter is emitted, so the data needs no hierarchy edges.
 * Executed against a synthetic, ontology-neutral fixture in Oxigraph.
 */
import { describe, expect, it } from 'vitest'

import { OxigraphStore } from '../../../sparql/src/oxigraph-store.js'
import { addEnumFilter } from '../compiler-helpers-primitives.js'
import { pruneUnusedPrefixes } from '../compiler-helpers-query.js'
import { withNarrowerValues } from '../value-hierarchy.js'

const EX = 'http://example.org/'

/** The schema's hierarchy: `Puddles` is below `Wet`. */
const NARROWER = new Map([[`${EX}Wet`, [`${EX}Puddles`]]])

const FIXTURE = `
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix ex: <${EX}> .

ex:a1 ex:surface ex:Wet .
ex:a2 ex:surface ex:Icy .
ex:a3 ex:surface ex:Dry .
ex:a4 ex:surface ex:Puddles .
ex:a5 ex:surface "slush" .

ex:a1 ex:surface_target "zzz" .
ex:a2 ex:surface_target "zzz" .
ex:a3 ex:surface_target "zzz" .
ex:a4 ex:surface_target "zzz" .
ex:a5 ex:surface_target "zzz" .
`

/** The filter the compiler emits for `value`, its IRIs expanded first. */
function filterFor(value: string | string[]): string[] {
  const values = (Array.isArray(value) ? value : [value]).flatMap((v) =>
    v.startsWith('http') ? withNarrowerValues(v, NARROWER) : [v]
  )
  const filters: string[] = []
  addEnumFilter(filters, '?s', values)
  return filters
}

async function run(value: string | string[]): Promise<string[]> {
  const store = new OxigraphStore()
  await store.loadTurtle(FIXTURE)
  const query = `SELECT ?a WHERE {\n  ?a <${EX}surface> ?s .\n  ${filterFor(value).join('\n  ')}\n}`
  const res = await store.query(query)
  return res.results.bindings.map((b) => b['a']!.value.replace(EX, '')).sort()
}

describe('addEnumFilter — several values are alternatives', () => {
  it('matches any of several IRI values, including the values below them', async () => {
    expect(await run([`${EX}Wet`, `${EX}Icy`])).toEqual(['a1', 'a2', 'a4'])
  })

  it('returns one row per asset when a value falls under several targets', async () => {
    expect(await run([`${EX}Wet`, `${EX}Puddles`])).toEqual(['a1', 'a4'])
  })

  it('matches either an IRI or a literal value in a mixed list', async () => {
    expect(await run([`${EX}Icy`, 'slush'])).toEqual(['a2', 'a5'])
  })

  it('compiles one IRI to a comparison with it and the values below it', async () => {
    expect(filterFor(`${EX}Icy`)).toEqual([`FILTER(?s = <${EX}Icy>)`])
    expect(filterFor(`${EX}Wet`)).toEqual([`FILTER(?s IN (<${EX}Puddles>, <${EX}Wet>))`])
    expect(await run(`${EX}Wet`)).toEqual(['a1', 'a4'])
  })

  it('compiles the same set of values identically regardless of order or duplicates', () => {
    // Regression: value lists are sets (IN semantics), but the compiler kept the
    // LLM's order, so a GraphQL round-trip (which sorts) produced different SPARQL.
    const compile = (value: string[]): string[] => {
      const filters: string[] = []
      addEnumFilter(filters, '?s', value)
      return filters
    }
    const canonical = compile([`${EX}Icy`, `${EX}Wet`, 'slush'])
    expect(compile(['slush', `${EX}Wet`, `${EX}Icy`])).toEqual(canonical)
    expect(compile([`${EX}Wet`, 'slush', `${EX}Icy`, `${EX}Wet`])).toEqual(canonical)
  })

  it('introduces no variable the surrounding query could shadow', async () => {
    // A filter that introduced a variable of its own could collide with a
    // leaf variable of the surrounding query, since ontology local names reach
    // variable names verbatim. The filter mentions only the leaf variable.
    const emitted = filterFor([`${EX}Wet`, `${EX}Icy`]).join('\n  ')
    const introduced = [...emitted.matchAll(/\?[A-Za-z_][A-Za-z0-9_]*/g)]
      .map((m) => m[0])
      .filter((v) => v !== '?s')
    expect(introduced).toEqual([])

    const store = new OxigraphStore()
    await store.loadTurtle(FIXTURE)
    const query =
      `SELECT ?a WHERE {\n  ?a <${EX}surface> ?s .\n` +
      `  ?a <${EX}surface_target> ?s_target .\n  ${emitted}\n}`
    const res = await store.query(query)
    expect(res.results.bindings.map((b) => b['a']!.value.replace(EX, '')).sort()).toEqual([
      'a1',
      'a2',
      'a4',
    ])
  })

  it('excludes a row whose leaf the surrounding OPTIONAL left unbound', async () => {
    // The cross-domain compiler binds a filtered leaf inside OPTIONAL, so the
    // variable can reach the filter unbound. Comparing an unbound operand is
    // an error, and a FILTER reads an error as false ([SPARQL11] §17.2).
    //
    // `ex:a3` has `ex:surface ex:Dry`, which is under neither target, and
    // `ex:a6` has no `ex:surface` triple at all. Both must be excluded.
    for (const value of [
      [`${EX}Wet`, `${EX}Icy`],
      [`${EX}Wet`, `${EX}Icy`, 'slush'],
    ]) {
      const store = new OxigraphStore()
      await store.loadTurtle(`${FIXTURE}\nex:a6 a skos:Concept .\nex:a3 a skos:Concept .\n`)
      const query =
        `SELECT ?a WHERE {\n  ?a a skos:Concept .\n` +
        `  OPTIONAL { ?a <${EX}surface> ?s }\n` +
        `  ${filterFor(value).join('\n  ')}\n}`
      const res = await store.query(`PREFIX skos: <http://www.w3.org/2004/02/skos/core#>\n${query}`)
      const matched = res.results.bindings.map((b) => b['a']!.value.replace(EX, '')).sort()
      expect(matched).toEqual([])
    }
  })
})

describe('pruneUnusedPrefixes', () => {
  const prologue = [
    'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>',
    'PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>',
    'PREFIX unused: <http://example.org/unused#>',
    'PREFIX ex: <http://example.org/>',
  ].join('\n')

  it('drops declarations no prefixed name in the body uses', () => {
    const body = 'SELECT ?a WHERE { ?a a ex:Thing ; rdfs:label ?n . }'
    expect(pruneUnusedPrefixes(prologue, body)).toBe(
      [
        'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>',
        'PREFIX ex: <http://example.org/>',
      ].join('\n')
    )
  })

  it('keeps a prefix used in a function call and ignores label suffix matches', () => {
    const body = 'SELECT ?a WHERE { ?a ex:v ?v . FILTER(xsd:float(?v) > 1) ?a notunused:x ?y }'
    expect(pruneUnusedPrefixes(prologue, body)).toBe(
      ['PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>', 'PREFIX ex: <http://example.org/>'].join(
        '\n'
      )
    )
  })
})
