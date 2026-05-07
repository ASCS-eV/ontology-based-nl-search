/**
 * Eagerly warm up ontology indexes (SKOS store, vocabulary index, glossary).
 * Called from instrumentation.ts on server start.
 */
export async function warmupOntologyIndexes(): Promise<void> {
  const { matchConcepts } = await import('./concept-matcher')
  const { lookupGlossary } = await import('./glossary')

  // Trigger a dummy match to force SKOS + vocabulary loading
  await matchConcepts('warmup')
  // Trigger glossary loading
  await lookupGlossary('warmup')
}
