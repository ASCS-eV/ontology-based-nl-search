import { useEffect, useState } from 'react'

interface TypewriterTextProps {
  text: string
  /** Average delay per character in ms (randomized ±30%) */
  speed?: number
  className?: string
}

/**
 * Renders text character-by-character with randomized timing
 * to simulate human typing. Includes a blinking cursor at the end.
 */
export function TypewriterText({ text, speed = 40, className = '' }: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    setDisplayed('')
    let i = 0
    let timeout: ReturnType<typeof setTimeout>

    const tick = () => {
      if (i < text.length) {
        i++
        setDisplayed(text.slice(0, i))
        const jitter = speed * (0.7 + Math.random() * 0.6)
        timeout = setTimeout(tick, jitter)
      }
    }

    timeout = setTimeout(tick, speed)
    return () => clearTimeout(timeout)
  }, [text, speed])

  return (
    <span className={className}>
      {displayed}
      <span className="animate-pulse">|</span>
    </span>
  )
}
