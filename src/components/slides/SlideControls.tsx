'use client'

import { useSlides } from './SlideProvider'

/**
 * Slide navigation controls: progress dots, arrow buttons, and slide counter.
 * Fixed at the bottom of the viewport.
 */
export function SlideControls() {
  const { currentSlide, totalSlides, next, prev, goTo, isFirst, isLast } = useSlides()

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between bg-white/80 px-6 py-3 backdrop-blur-sm border-t border-gray-100">
      {/* Previous button */}
      <button
        onClick={prev}
        disabled={isFirst}
        aria-label="Previous slide"
        className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:invisible"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Progress indicator */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5" aria-label="Slide navigation">
          {Array.from({ length: totalSlides }, (_, i) => (
            <button
              key={i}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === currentSlide ? 'step' : undefined}
              onClick={() => goTo(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === currentSlide ? 'w-6 bg-blue-600' : 'w-2 bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
        <span className="ml-3 text-xs tabular-nums text-gray-400">
          {currentSlide + 1} / {totalSlides}
        </span>
      </div>

      {/* Next button */}
      <button
        onClick={next}
        disabled={isLast}
        aria-label="Next slide"
        className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:invisible"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
