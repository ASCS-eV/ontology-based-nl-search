/**
 * Pluggable embedding seam for schema retrieval (epic #120, task 05).
 *
 * The default is OFFLINE lexical-only ranking — no external service, no
 * network, air-gap friendly, and fully deterministic (the epic's accepted
 * default). An embedding service can be plugged in later by implementing
 * `EmbeddingProvider`; callers of the retrieval API never change.
 */

export interface EmbeddingProvider {
  /**
   * Embed each text into a vector. Returning an EMPTY vector for a text
   * means "no embedding signal" — the retrieval layer then relies on the
   * lexical score alone for that text.
   */
  embed(texts: string[]): Promise<number[][]>
  /** Stable identifier, e.g. for logging/eval attribution. */
  readonly id: string
}

/**
 * Default provider: contributes no vectors, so ranking falls back to the
 * pure lexical scorer. Kept as a real object (not `undefined`) so warmup,
 * logging, and eval treat "no embeddings" uniformly.
 */
export const lexicalOnlyProvider: EmbeddingProvider = {
  id: 'lexical-only',
  embed(texts: string[]): Promise<number[][]> {
    return Promise.resolve(texts.map(() => []))
  },
}
