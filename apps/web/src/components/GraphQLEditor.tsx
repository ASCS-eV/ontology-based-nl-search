import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete'
import CodeMirror from '@uiw/react-codemirror'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { VocabProperty } from '../hooks/useVocabulary'

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

  // Build CodeMirror autocomplete extension from vocabulary
  const extensions = useMemo(() => {
    if (!vocabulary || readOnly) return []

    const completionSource = (context: CompletionContext): CompletionResult | null => {
      // Get the text before cursor to determine context
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
              .slice(0, 20)
              .map((v) => ({ label: v, type: 'value' as const }))
            if (options.length > 0) {
              return { from: context.pos - partial.length, options }
            }
          }
        }
        return null
      }

      // At field level inside a domain block — suggest property names
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
          .slice(0, 30)
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

    return [autocompletion({ override: [completionSource], activateOnTyping: true })]
  }, [vocabulary, readOnly])

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          GraphQL Query
        </h3>
        <div className="flex items-center gap-2">
          {isEdited && (
            <>
              <button
                onClick={handleReset}
                className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 transition-colors"
              >
                Reset
              </button>
              {onExecute && (
                <button
                  onClick={handleRun}
                  className="text-xs px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 transition-colors font-medium"
                >
                  ▶ Run
                </button>
              )}
            </>
          )}
          <button
            onClick={handleCopy}
            className="text-xs px-2 py-1 bg-gray-100 text-gray-600 border border-gray-200 rounded hover:bg-gray-200 transition-colors"
            aria-label="Copy GraphQL query"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
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

      {isEdited && !onExecute && (
        <p className="mt-1 text-xs text-amber-600">
          Modified — editing will be fully supported in the next release.
        </p>
      )}
    </div>
  )
}
