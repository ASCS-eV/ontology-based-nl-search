import { autocompletion, completionKeymap, startCompletion } from '@codemirror/autocomplete'
import { hoverTooltip } from '@codemirror/view'
import { buildGraphQLSchema } from '@ontology-search/graphql-ir'
import { EditorView, type Extension, keymap, Prec } from '@uiw/react-codemirror'
import { graphql } from 'cm6-graphql'
import type { GraphQLSchema } from 'graphql'
import { getHoverInformation } from 'graphql-language-service'

import type { EditorVocabulary } from './types'

/**
 * CodeMirror extensions for the GraphQL editor.
 *
 * cm6-graphql exposes its schema-aware completion as a *language-data*
 * autocomplete source (`graphqlLanguage.data.of({ autocomplete })`). That
 * source only runs when an `@codemirror/autocomplete` `autocompletion()`
 * extension is active in the editor. The editor disables basicSetup's default
 * autocompletion, so it is (re)added here — with no `override`, so it collects
 * cm6-graphql's language-data source. All completion content (fields, enum
 * values, argument names) comes from the GraphQLSchema built from the
 * discovered vocabulary, so the editor cannot drift from the compiler. See
 * `docs/adr/0001-graphql-editor-schema-from-discovery.md`.
 */
export function buildEditorExtensions(vocabulary: EditorVocabulary): Extension[] {
  const schema = buildGraphQLSchema(vocabulary)

  // Auto-open the completion popup in the positions where the user is about to
  // type a field, an argument name, or a value — a new line inside a block, or
  // just after `(`, `[`, `,`, or `:`. cm6-graphql only auto-triggers on word
  // characters, so argument/value positions would otherwise stay empty until the
  // user typed a letter or pressed Ctrl-Space. The `:` trigger matters for
  // categorical filters: their values are a GraphQL *enum* (the standard mapping
  // of a closed `sh:in` vocabulary), so the spec-correct form is unquoted
  // (`compression(values: lz4)`, §2.9.6) — opening the list right after
  // `values:` surfaces the allowed members and steers users away from typing a
  // quote, which is a string literal an enum field validly rejects. Dispatching
  // from inside an update listener is illegal, so defer the (explicit)
  // startCompletion to the next microtask.
  const autoOpenInContext = EditorView.updateListener.of((update) => {
    if (!update.docChanged) return
    if (!update.transactions.some((tr) => tr.isUserEvent('input'))) return
    let trigger = false
    update.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
      if (/[([,:\n]/.test(inserted.toString())) trigger = true
    })
    if (trigger) queueMicrotask(() => startCompletion(update.view))
  })

  return [
    // basicSetup's completion keymap is disabled, so re-add it: Ctrl-Space
    // opens the list; arrows/Enter navigate and accept. Highest precedence so
    // Enter accepts the highlighted option instead of inserting a newline.
    Prec.highest(keymap.of(completionKeymap)),
    autocompletion({ activateOnTyping: true }),
    ...graphql(schema),
    buildGraphQLHover(schema),
    autoOpenInContext,
  ]
}

type HoverContent =
  | string
  | { language: string; value: string }
  | { kind: string; value: string }
  | readonly (string | { language: string; value: string })[]

/** Normalize all standard hover content forms to safe plain text. */
export function normalizeHoverContent(content: HoverContent | null | undefined): string {
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    return content
      .map((entry) =>
        typeof entry === 'string' ? entry : `${entry.language}\n${entry.value}`.trim()
      )
      .filter(Boolean)
      .join('\n\n')
      .trim()
  }
  if (content && 'value' in content) return content.value.trim()
  return ''
}

/** Convert a CodeMirror offset to the UTF-16 position used by GraphQL and LSP. */
export function offsetToGraphQLPosition(
  document: EditorView['state']['doc'],
  offset: number
): { line: number; character: number } {
  const line = document.lineAt(offset)
  return { line: line.number - 1, character: offset - line.from }
}

function buildGraphQLHover(schema: GraphQLSchema): Extension {
  return hoverTooltip((view, position) => {
    try {
      const text = view.state.doc.toString()
      const content = normalizeHoverContent(
        getHoverInformation(
          schema,
          text,
          offsetToGraphQLPosition(view.state.doc, position) as never
        ) as HoverContent
      )
      if (!content) return null

      const word = view.state.wordAt(position)
      return {
        pos: word?.from ?? position,
        end: word?.to ?? position,
        above: true,
        create() {
          const dom = document.createElement('div')
          dom.className = 'cm-graphql-hover'
          dom.textContent = content
          dom.style.maxWidth = '36rem'
          dom.style.whiteSpace = 'pre-wrap'
          return { dom }
        },
      }
    } catch {
      return null
    }
  })
}
