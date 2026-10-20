/**
 * Several values on one filter leaf are alternatives (the slot contract's
 * IN-semantics), never a conjunction. Before the fix every IRI value got its
 * own hierarchy walk on the same variable, so a request such as "icy OR wet
 * surface" required one term to sit under both concepts and matched nothing.
 * Executed against a synthetic, ontology-neutral SKOS fixture in Oxigraph.
 */
import { describe, expect, it } from 'vitest'

import { OxigraphStore } from '../../../sparql/src/oxigraph-store.js'
import { addEnumFilter } from '../compiler-helpers-primitives.js'
import { pruneUnusedPrefixes } from '../compiler-helpers-query.js'

const EX = 'http://example.org/'

const FIXTURE = `
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix ex: <${EX}> .

ex:Wet a skos:Concept .
ex:Icy a skos:Concept .
ex:Dry a skos:Concept .
ex:Puddles a skos:Concept ; skos:broaderTransitive ex:Wet .

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

async function run(value: string | string[]): Promise<string[]> {
  const patterns: string[] = []
  const filters: string[] = []
  addEnumFilter(patterns, filters, '?s', value)
  const store = new OxigraphStore()
  await store.loadTurtle(FIXTURE)
  const query = `SELECT ?a WHERE {\n  ?a <${EX}surface> ?s .\n  ${[...patterns, ...filters].join('\n  ')}\n}`
  const res = await store.query(query)
  return res.results.bindings.map((b) => b['a']!.value.replace(EX, '')).sort()
}

describe('addEnumFilter — several values are alternatives', () => {
  it('matches any of several IRI values, including narrower concepts', async () => {
    expect(await run([`${EX}Wet`, `${EX}Icy`])).toEqual(['a1', 'a2', 'a4'])
  })

  it('returns one row per asset when a value falls under several targets', async () => {
    expect(await run([`${EX}Wet`, `${EX}Puddles`])).toEqual(['a1', 'a4'])
  })

  it('matches either an IRI or a literal value in a mixed list', async () => {
    expect(await run([`${EX}Icy`, 'slush'])).toEqual(['a2', 'a5'])
  })

  it('keeps the single-IRI hierarchy walk as a graph pattern', async () => {
    const patterns: string[] = []
    const filters: string[] = []
    addEnumFilter(patterns, filters, '?s', `${EX}Wet`)
    expect(filters).toEqual([])
    expect(patterns).toHaveLength(1)
    expect(await run(`${EX}Wet`)).toEqual(['a1', 'a4'])
  })

  it('compiles the same set of values identically regardless of order or duplicates', () => {
    // Regression: value lists are sets (IN semantics), but the compiler kept the
    // LLM's order, so a GraphQL round-trip (which sorts) produced different SPARQL.
    const compile = (value: string[]): string[] => {
      const patterns: string[] = []
      const filters: string[] = []
      addEnumFilter(patterns, filters, '?s', value)
      return [...patterns, ...filters]
    }
    const canonical = compile([`${EX}Icy`, `${EX}Wet`, 'slush'])
    expect(compile(['slush', `${EX}Wet`, `${EX}Icy`])).toEqual(canonical)
    expect(compile([`${EX}Wet`, 'slush', `${EX}Icy`, `${EX}Wet`])).toEqual(canonical)
  })

  it('introduces no variable the surrounding query could shadow', async () => {
    // EXISTS is evaluated by substituting the current solution mapping into
    // its pattern ([SPARQL11] §17.4.1.4). An auxiliary target variable named
    // after the filtered variable — `?s` → `?s_target` — collides as soon as
    // the query also projects a property whose leaf variable is `?s_target`:
    // the target set is rewritten to that row's literal and the disjunction
    // silently matches nothing.
    //
    // A reserved internal name only narrows that window. Ontology local names
    // reach variable names verbatim, so a property called `_enumTarget` would
    // collide with a reserved `?_enumTarget` in exactly the same way. The
    // disjunction therefore introduces no variable at all, which is what this
    // asserts: the emitted filter mentions only the leaf variable.
    const patterns: string[] = []
    const filters: string[] = []
    addEnumFilter(patterns, filters, '?s', [`${EX}Wet`, `${EX}Icy`])
    const emitted = [...patterns, ...filters].join('\n  ')

    const introduced = [...emitted.matchAll(/\?[A-Za-z_][A-Za-z0-9_]*/g)]
      .map((m) => m[0])
      .filter((v) => v !== '?s')
    expect(introduced).toEqual([])

    // Bound to the fixture, the filter still has to behave: `?s_target` is
    // bound to "zzz" on every asset, which would poison any target named
    // after the filtered variable.
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
    // variable can reach the filter unbound. A literal condition drops such a
    // row for free — an unbound operand is an error and a FILTER reads an
    // error as false ([SPARQL11] §17.2) — but EXISTS does not: substitution
    // leaves the variable free ([SPARQL11] §17.4.1.4), the pattern becomes an
    // open join over the dataset, and it answers true whenever any target
    // value occurs anywhere. Without the BOUND guard this filter matched
    // every asset, including ones with no value for the property.
    //
    // `ex:a3` has `ex:surface ex:Dry`, which is under neither target, and
    // `ex:a6` has no `ex:surface` triple at all. Both must be excluded.
    for (const value of [
      [`${EX}Wet`, `${EX}Icy`],
      [`${EX}Wet`, `${EX}Icy`, 'slush'],
    ]) {
      const patterns: string[] = []
      const filters: string[] = []
      addEnumFilter(patterns, filters, '?s', value)

      const store = new OxigraphStore()
      await store.loadTurtle(`${FIXTURE}\nex:a6 a skos:Concept .\n`)
      const query =
        `SELECT ?a WHERE {\n  ?a a skos:Concept .\n` +
        `  OPTIONAL { ?a <${EX}surface> ?s .\n    ${patterns.join('\n    ')} }\n` +
        `  ${filters.join('\n  ')}\n}`
      const res = await store.query(`PREFIX skos: <http://www.w3.org/2004/02/skos/core#>\n${query}`)
      const matched = res.results.bindings.map((b) => b['a']!.value.replace(EX, '')).sort()
      expect(matched).not.toContain('a6')
      expect(matched).not.toContain('a3')
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
