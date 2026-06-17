import { Button, Heading } from '@ontology-search/design-system'
import CodeMirror from '@uiw/react-codemirror'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { VocabProperty } from '../hooks/useVocabulary'
import { buildEditorExtensions } from '../lib/graphql-editor-extensions'

interface GraphQLEditorProps {
  /** The auto-generated GraphQL query from slots */
  value: string
  /** Called when user wants to reset to the auto-generated value */
  onReset?: () => void
  /** Called when user clicks "Run" with the edited GraphQL query */
  onExecute?: (graphql: string) => void
  /** Vocabulary data for autocomplete suggestions */
  vocabulary?: { domains: string[]; properties: VocabProperty[] } | null
  /** Whether the editor is read-only (display mode) */
  readOnly?: boolean
}

/** Duration to show "Copied" feedback before reverting */
const COPY_FEEDBACK_MS = 2000

/**
 * Inline GraphQL editor with syntax highlighting, autocomplete, and edit→run.
 * Autocomplete suggests domain names, property names, and allowed values.
 */
export function GraphQLEditor({
  value,
  onReset,
  onExecute,
  vocabulary,
  readOnly = false,
}: GraphQLEditorProps) {
  const [localValue, setLocalValue] = useState(value)
  const [copied, setCopied] = useState(false)
  const [isEdited, setIsEdited] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync with external value when it changes (e.g., new search)
  useEffect(() => {
    setLocalValue(value)
    setIsEdited(false)
  }, [value])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleChange = useCallback(
    (val: string) => {
      setLocalValue(val)
      setIsEdited(val !== value)
    },
    [value]
  )

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(localValue)
    setCopied(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }, [localValue])

  const handleReset = useCallback(() => {
    setLocalValue(value)
    setIsEdited(false)
    onReset?.()
  }, [value, onReset])

  const handleRun = useCallback(() => {
    onExecute?.(localValue)
  }, [localValue, onExecute])

  // Schema-aware GraphQL editing (autocomplete + lint/validation + hover) via
  // cm6-graphql, driven by a GraphQLSchema built from the discovered vocabulary
  // — the same discovery that drives the SPARQL compiler. See ADR 0001.
  const extensions = useMemo(
    () => (!vocabulary || readOnly ? [] : buildEditorExtensions(vocabulary)),
    [vocabulary, readOnly]
  )

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <Heading level={4}>GraphQL Query</Heading>
        <div className="flex items-center gap-2">
          {isEdited && (
            <>
              <Button onClick={handleReset} variant="secondary" size="sm">
                Reset
              </Button>
              {onExecute && (
                <Button onClick={handleRun} variant="primary" size="sm">
                  ▶ Run
                </Button>
              )}
            </>
          )}
          <Button onClick={handleCopy} variant="secondary" size="sm" ariaLabel="Copy GraphQL query">
            {copied ? '✓ Copied' : 'Copy'}
          </Button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <CodeMirror
          value={localValue}
          onChange={handleChange}
          readOnly={readOnly}
          extensions={extensions}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: !readOnly,
            autocompletion: false,
          }}
          theme="light"
          height="auto"
          minHeight="80px"
          maxHeight="300px"
          className="text-sm"
        />
      </div>

      {!readOnly && (
        <p className="mt-1 text-xs text-gray-400">
          Tip: suggestions open as you type — fields, arguments, and (unquoted) values inside{' '}
          <code>[ ]</code>. Press <kbd className="font-sans">Ctrl</kbd>+
          <kbd className="font-sans">Space</kbd> to reopen them.
        </p>
      )}

      {isEdited && !onExecute && (
        <p className="mt-1 text-xs text-amber-600">
          Modified — editing will be fully supported in the next release.
        </p>
      )}
    </div>
  )
}
