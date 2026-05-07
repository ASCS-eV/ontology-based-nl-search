/**
 * Next.js Instrumentation Hook — runs once when the server starts.
 *
 * Used to eagerly warm up the SPARQL store and ontology indexes so
 * the first user request doesn't pay initialization cost.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only preload on the server (not edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getInitializedStore } = await import('@/lib/search/init')
    const { warmupOntologyIndexes } = await import('@/lib/ontology/warmup')

    // Fire and forget — don't block server start
    Promise.all([getInitializedStore(), warmupOntologyIndexes()]).then(() => {
      console.info('[instrumentation] SPARQL store and ontology indexes warmed up')
    })
  }
}
