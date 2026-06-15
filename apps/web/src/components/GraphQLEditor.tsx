import CodeMirror from '@uiw/react-codemirror'
import { useCallback, useEffect, useRef, useState } from 'react'

interface GraphQLEditorProps {
  /** The auto-generated GraphQL query from slots */
  value: string
  /** Called when user wants to reset to the auto-generated value */
  onReset?: () => void
  /** Called when user clicks "Run" with the edited GraphQL query */
  onExecute?: (graphql: string) => void
  /** Whether the editor is read-only (display mode) */
  readOnly?: boolean
}

/** Duration to show "Copied" feedback before reverting */
const COPY_FEEDBACK_MS = 2000

/**
 * Inline GraphQL editor with syntax highlighting and edit→run support.
 * Users can modify the query and click "Run" to re-execute with their changes.
 */
export function GraphQLEditor({ value, onReset, onExecute, readOnly = false }: GraphQLEditorProps) {
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
