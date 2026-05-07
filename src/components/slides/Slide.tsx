'use client'

import { type ReactNode } from 'react'

import { useSlides } from './SlideProvider'

interface SlideProps {
  index: number
  children: ReactNode
  className?: string
  /** Visual variant for different content types */
  variant?: 'default' | 'title' | 'diagram' | 'code' | 'cta'
}

const VARIANT_STYLES: Record<NonNullable<SlideProps['variant']>, string> = {
  default: 'justify-center',
  title: 'justify-center items-center text-center',
  diagram: 'justify-center items-center',
  code: 'justify-center',
  cta: 'justify-center items-center text-center',
}

/**
 * A single full-screen slide. Only renders content when active (±1 for transitions).
 * Uses CSS scroll-snap for smooth navigation.
 */
export function Slide({ index, children, className = '', variant = 'default' }: SlideProps) {
  const { currentSlide, totalSlides } = useSlides()

  // Only render content for nearby slides (performance)
  const isNearby = Math.abs(currentSlide - index) <= 1

  return (
    <section
      id={`slide-${index}`}
      aria-hidden={currentSlide !== index}
      aria-roledescription="slide"
      aria-label={`Slide ${index + 1} of ${totalSlides}`}
      className={`flex h-dvh w-full flex-shrink-0 snap-start snap-always flex-col overflow-hidden px-8 py-12 transition-opacity duration-300 sm:px-16 lg:px-24 ${VARIANT_STYLES[variant]} ${
        currentSlide === index ? 'opacity-100' : 'opacity-0'
      } ${className}`}
    >
      {isNearby && <div className="mx-auto w-full max-w-4xl animate-fade-in">{children}</div>}
    </section>
  )
}
