import { useCallback, useEffect, useRef, useState } from 'react'

interface XoscPreviewProps {
  xosc: string
  /** Suggested download filename (without directory). */
  filename?: string
}

/** Duration to show "Copied" feedback before reverting. */
const COPY_FEEDBACK_MS = 2000

/**
 * Read-only view of the emitted OpenSCENARIO `.xosc` document, with copy and
 * download affordances. The `.xosc` is always derived from the editable scene
 * IR — it is never hand-edited here (the authoring-side security boundary is
 * the IR, mirroring how search keeps SPARQL read-only).
 */
export function XoscPreview({ xosc, filename = 'scenario.xosc' }: XoscPreviewProps) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(xosc)
    setCopied(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }, [xosc])

  const handleDownload = useCallback(() => {
    const blob = new Blob([xosc], { type: 'application/xml' })
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(blob)
    urlRef.current = url
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  }, [xosc, filename])

  return (
    <div className="w-full relative">
      <div className="absolute top-2 right-2 flex gap-2">
        <button
          onClick={handleDownload}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
          aria-label="Download .xosc file"
        >
          Download
        </button>
        <button
          onClick={handleCopy}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
          aria-label="Copy OpenSCENARIO document"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 bg-gray-900 text-green-300 rounded-lg text-sm overflow-x-auto font-mono leading-relaxed">
        {xosc}
      </pre>
    </div>
  )
}
