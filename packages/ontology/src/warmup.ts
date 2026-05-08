/**
 * Eagerly warm up ontology indexes.
 * Called from API warmup on server start.
 * Now only needs to warm the vocabulary index (SKOS layer removed).
 */
export async function warmupOntologyIndexes(): Promise<void> {
  const { buildVocabularyIndex } = await import('./vocabulary-index.js')
  await buildVocabularyIndex()
}
