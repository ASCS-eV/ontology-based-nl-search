import { useEffect, useState } from 'react'

/** Property info from the vocabulary API */
export interface VocabProperty {
  name: string
  label: string
  description: string
  domain: string
  type: 'enum' | 'numeric'
  allowedValues?: string[]
  datatype?: 'integer' | 'float'
}

export interface Vocabulary {
  domains: string[]
  properties: VocabProperty[]
}

/**
 * Fetch the ontology vocabulary for GraphQL editor autocomplete.
 * Caches the result — vocabulary doesn't change during a session.
 */
export function useVocabulary(): Vocabulary | null {
  const [vocabulary, setVocabulary] = useState<Vocabulary | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/vocabulary')
      .then((res) => {
        if (!res.ok) throw new Error(`Vocabulary fetch failed: ${res.status}`)
        return res.json() as Promise<Vocabulary>
      })
      .then((data) => {
        if (!cancelled) setVocabulary(data)
      })
      .catch(() => {
        // Vocabulary is optional — autocomplete just won't work
      })

    return () => {
      cancelled = true
    }
  }, [])

  return vocabulary
}
