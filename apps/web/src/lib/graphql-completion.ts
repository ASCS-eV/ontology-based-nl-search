/**
 * GraphQL editor autocomplete logic.
 *
 * Pure, view-agnostic helpers so the completion behaviour can be unit-tested
 * without rendering CodeMirror:
 *  - `buildCompletionSource` — suggests domains at the root, properties inside
 *    a domain block, and allowed values inside `values: [...]`.
 *  - `shouldAutoOpenAfterChange` — decides when to auto-open the popup so all
 *    options appear on a fresh line without the user guessing a letter.
 */
import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import type { ChangeSet, EditorState } from '@uiw/react-codemirror'

import type { VocabProperty } from '../hooks/useVocabulary'

/** Vocabulary subset the completion logic needs. */
export interface CompletionVocabulary {
  domains: string[]
  properties: VocabProperty[]
}

/** Synchronous completion source — assignable to CodeMirror's `CompletionSource`. */
export type SyncCompletionSource = (context: CompletionContext) => CompletionResult | null

/**
 * Per-category suggestion caps. Properties/domains are high enough to show
 * every field of a typical element at once (the point of the feature);
 * values stay tighter since enum lists can be long and are filtered by the
 * partial the user is typing.
 */
const MAX_VALUE_OPTIONS = 20
const MAX_PROPERTY_OPTIONS = 50
const MAX_DOMAIN_OPTIONS = 50

/**
 * Build the CodeMirror completion source for the GraphQL editor.
 *
 * When completion is triggered with no word prefix — Ctrl-Space or the
 * auto-open-on-newline listener both set `context.explicit` — it returns ALL
 * options for the current element, so the user sees e.g. every `hdmap` field
 * without typing a letter to filter. While typing, results narrow by prefix.
 */
export function buildCompletionSource(vocabulary: CompletionVocabulary): SyncCompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    const line = context.state.doc.lineAt(context.pos)
    const textBefore = line.text.slice(0, context.pos - line.from)

    // Inside values: [...] — suggest allowed values
    const valuesMatch = textBefore.match(/values:\s*\[([^\]]*?)(?:"([^"]*))$/)
    if (valuesMatch) {
      // Find which field we're in
      const fieldMatch = textBefore.match(/^\s*(\w+)\s*\(/)
      const fieldName = fieldMatch?.[1]
      const partial = valuesMatch[2] ?? ''

      if (fieldName) {
        const prop = vocabulary.properties.find((p) => p.name === fieldName)
        if (prop?.allowedValues) {
          const options = prop.allowedValues
            .filter((v) => v.toLowerCase().startsWith(partial.toLowerCase()))
            .slice(0, MAX_VALUE_OPTIONS)
            .map((v) => ({ label: v, type: 'value' as const }))
          if (options.length > 0) {
            return { from: context.pos - partial.length, options }
          }
        }
      }
      return null
    }

    // At field level inside a domain block — suggest property names.
    // An empty word only completes when explicit (Ctrl-Space / auto-open),
    // so the popup doesn't flicker open on every non-word keystroke.
    const word = context.matchBefore(/\w*/)
    if (!word || (word.from === word.to && !context.explicit)) return null

    // Check if we're inside a domain block (indented, after a `{`)
    const docText = context.state.doc.toString()
    const beforePos = docText.slice(0, context.pos)
    const openBraces = (beforePos.match(/\{/g) ?? []).length
    const closeBraces = (beforePos.match(/\}/g) ?? []).length
    const depth = openBraces - closeBraces

    if (depth >= 2) {
      // Inside a domain block — find which domain we're in by walking
      // backwards through the text to find the nearest unmatched `{`
      // preceded by a word (the domain name)
      let braceCount = 0
      let currentDomain: string | undefined
      for (let i = beforePos.length - 1; i >= 0; i--) {
        if (beforePos[i] === '}') braceCount++
        if (beforePos[i] === '{') {
          if (braceCount > 0) {
            braceCount--
          } else {
            // Found our enclosing `{` — extract the word before it
            const preceding = beforePos.slice(0, i).trimEnd()
            const domainNameMatch = preceding.match(/(\w+)\s*(?:\([^)]*\))?\s*$/)
            currentDomain = domainNameMatch?.[1]
            break
          }
        }
      }

      // Suggest properties — show all if domain unknown
      const props = vocabulary.properties
        .filter((p) => !currentDomain || p.domain === currentDomain)
        .filter((p) => p.name.toLowerCase().startsWith(word.text.toLowerCase()))
        .slice(0, MAX_PROPERTY_OPTIONS)
        .map((p) => ({
          label: p.name,
          type: (p.type === 'enum' ? 'property' : 'variable') as string,
          detail: p.type === 'enum' ? `[${p.allowedValues?.length ?? 0} values]` : p.datatype,
          info: p.label || p.description || undefined,
          apply: p.type === 'enum' ? `${p.name}(values: [""])` : `${p.name}(min: )`,
        }))

      if (props.length > 0) {
        return { from: word.from, options: props }
      }
    } else if (depth === 1) {
      // At root level inside query {} — suggest domain names
      const options = vocabulary.domains
        .filter((d) => d.toLowerCase().startsWith(word.text.toLowerCase()))
        .slice(0, MAX_DOMAIN_OPTIONS)
        .map((d) => ({
          label: d,
          type: 'class' as const,
          apply: `${d} {\n    \n  }`,
        }))

      if (options.length > 0) {
        return { from: word.from, options }
      }
    }

    return null
  }
}

/**
 * Decide whether a document change should auto-open the completion popup:
 * true when the change inserted a newline and the cursor now sits on a blank
 * (whitespace-only) line — i.e. the user just opened a fresh line and is about
 * to type a field. This lets the editor reveal all options automatically,
 * without a keypress.
 */
export function shouldAutoOpenAfterChange(state: EditorState, changes: ChangeSet): boolean {
  let insertedNewline = false
  changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
    if (inserted.toString().includes('\n')) insertedNewline = true
  })
  if (!insertedNewline) return false

  const sel = state.selection.main
  if (!sel.empty) return false

  const line = state.doc.lineAt(sel.head)
  const before = line.text.slice(0, sel.head - line.from)
  return before.trim() === ''
}
