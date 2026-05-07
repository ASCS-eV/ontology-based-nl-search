'use client'

import mermaid from 'mermaid'
import { useEffect, useId, useRef } from 'react'

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  fontFamily: 'Inter, system-ui, sans-serif',
})

export function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const id = useId().replace(/:/g, '')

  useEffect(() => {
    const container = ref.current
    if (!container) return

    let cancelled = false

    mermaid.render(`mermaid-${id}`, chart).then(({ svg }) => {
      if (!cancelled && container) {
        container.replaceChildren()
        container.insertAdjacentHTML('afterbegin', svg)
      }
    })

    return () => {
      cancelled = true
    }
  }, [chart, id])

  return (
    <div
      ref={ref}
      className="my-6 flex justify-center overflow-x-auto rounded-lg bg-gray-50 p-4 border border-gray-100"
    />
  )
}
