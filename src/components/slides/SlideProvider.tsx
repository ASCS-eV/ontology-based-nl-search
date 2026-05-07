'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

interface SlideContextValue {
  currentSlide: number
  totalSlides: number
  next: () => void
  prev: () => void
  goTo: (index: number) => void
  isFirst: boolean
  isLast: boolean
}

const SlideContext = createContext<SlideContextValue | null>(null)

export function useSlides(): SlideContextValue {
  const ctx = useContext(SlideContext)
  if (!ctx) throw new Error('useSlides must be used within a SlideProvider')
  return ctx
}

interface SlideProviderProps {
  children: ReactNode
  totalSlides: number
  initialSlide?: number
  onComplete?: () => void
}

/**
 * Provides slide navigation state and keyboard/touch controls.
 * Handles: arrow keys, space, swipe gestures, and click navigation.
 */
export function SlideProvider({
  children,
  totalSlides,
  initialSlide = 0,
  onComplete,
}: SlideProviderProps) {
  const [currentSlide, setCurrentSlide] = useState(initialSlide)

  const next = useCallback(() => {
    setCurrentSlide((prev) => {
      if (prev >= totalSlides - 1) {
        onComplete?.()
        return prev
      }
      return prev + 1
    })
  }, [totalSlides, onComplete])

  const prev = useCallback(() => {
    setCurrentSlide((p) => Math.max(0, p - 1))
  }, [])

  const goTo = useCallback(
    (index: number) => {
      setCurrentSlide(Math.max(0, Math.min(totalSlides - 1, index)))
    },
    [totalSlides]
  )

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault()
          next()
          break
        case 'ArrowLeft':
          e.preventDefault()
          prev()
          break
        case 'Home':
          e.preventDefault()
          goTo(0)
          break
        case 'End':
          e.preventDefault()
          goTo(totalSlides - 1)
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, prev, goTo, totalSlides])

  // Touch/swipe navigation
  useEffect(() => {
    let startX = 0
    let startY = 0

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!touch) return
      startX = touch.clientX
      startY = touch.clientY
    }

    const onTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0]
      if (!touch) return
      const deltaX = touch.clientX - startX
      const deltaY = touch.clientY - startY

      // Only trigger if horizontal swipe is dominant
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX < 0) next()
        else prev()
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [next, prev])

  const value = useMemo(
    (): SlideContextValue => ({
      currentSlide,
      totalSlides,
      next,
      prev,
      goTo,
      isFirst: currentSlide === 0,
      isLast: currentSlide === totalSlides - 1,
    }),
    [currentSlide, totalSlides, next, prev, goTo]
  )

  return <SlideContext.Provider value={value}>{children}</SlideContext.Provider>
}
