'use client'

import { useEffect, useRef } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  fontFamily: 'Inter, system-ui, sans-serif',
})

export function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = ''
      mermaid.render(`mermaid-${Math.random().toString(36).slice(2)}`, chart).then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg
      })
    }
  }, [chart])

  return (
    <div
      ref={ref}
      className="my-6 flex justify-center overflow-x-auto rounded-lg bg-gray-50 p-4 border border-gray-100"
    />
  )
}
