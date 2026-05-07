'use client'

import { type ReactNode } from 'react'

import { useSlides } from './SlideProvider'

interface SlideDeckProps {
  children: ReactNode
}

/**
 * Container for slides — handles scroll-snap positioning.
 * Wraps multiple <Slide> components and positions them based on current index.
 */
export function SlideDeck({ children }: SlideDeckProps) {
  const { currentSlide } = useSlides()

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div
        className="flex h-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {children}
      </div>
    </div>
  )
}
