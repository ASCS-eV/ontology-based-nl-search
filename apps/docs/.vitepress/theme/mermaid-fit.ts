// Readability-aware sizing for rendered mermaid diagrams.
//
// VitePress pins the content column to ~640px and the right-hand outline
// aside leaves no horizontal gutter to break out into. Left alone, wide
// diagrams (multi-participant sequence diagrams, dense flowcharts) get
// scaled down by `useMaxWidth` until their text is unreadable (<7px).
//
// Strategy: let each diagram shrink to fit the column, but never below a
// readability floor (~11px text). Past that floor the diagram keeps a
// legible size and its container scrolls horizontally instead. Only the
// genuinely oversized diagrams ever gain a scrollbar — anything that
// already fits is left exactly as mermaid laid it out.
//
// Client-side only. A ResizeObserver re-fits at the *settled* column
// width (covering the async aside mount and window resizes), and a
// MutationObserver registers diagrams as they render / on SPA navigation.

// mermaid text is ~16px at natural scale. We tolerate shrinking down to
// SOFT_MIN before introducing a scrollbar (avoids a scrollbar for diagrams
// that are only slightly too wide); once fitting would fall below that, we
// stop at SCROLL_FLOOR and let the container scroll instead.
const SOFT_MIN = 10 / 16
const SCROLL_FLOOR = 11 / 16

function fit(container: HTMLElement): void {
  const svg = container.querySelector<SVGSVGElement>('svg')
  const viewBox = svg?.viewBox?.baseVal
  if (!svg || !viewBox || !viewBox.width) return

  // Inner content width = client width minus the card's horizontal padding.
  // (Using the border-box here would oversize the svg by the padding and
  // produce a spurious scrollbar.) clientWidth already excludes any
  // scrollbar, so a prior fit cannot feed back into the next pass.
  const style = getComputedStyle(container)
  const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
  const columnWidth = container.clientWidth - padding
  if (columnWidth <= 0) return

  // Fit to the column while text stays legible; once fitting would fall
  // below SOFT_MIN, hold at SCROLL_FLOOR and let the container scroll.
  let width: number
  if (viewBox.width <= columnWidth) {
    width = viewBox.width // renders at natural size
  } else if (columnWidth / viewBox.width >= SOFT_MIN) {
    width = columnWidth // shrink to fit, no scrollbar
  } else {
    width = viewBox.width * SCROLL_FLOOR // legible + horizontal scroll
  }

  svg.style.maxWidth = 'none'
  svg.style.width = `${Math.round(width)}px`
  svg.style.height = 'auto'
  // Centre when it fits; left-align when it scrolls so the start of the
  // diagram is reachable (margin auto would push the left edge off-screen).
  svg.style.margin = width > columnWidth ? '0' : '0 auto'
}

export function installMermaidFit(): void {
  if (typeof window === 'undefined') return

  // Re-fit whenever a diagram's column width settles or changes.
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) fit(entry.target as HTMLElement)
  })

  const registered = new WeakSet<Element>()
  const scan = (): void => {
    document
      .querySelectorAll<HTMLElement>('.vp-doc div.mermaid, .slide div.mermaid')
      .forEach((container) => {
        if (registered.has(container)) return
        registered.add(container)
        resizeObserver.observe(container) // fires once immediately, then on resize
      })
  }

  const start = (): void => {
    // childList/subtree only — we never observe attributes, so our own
    // style writes cannot retrigger the observer. Catches async mermaid
    // renders and VitePress client-side navigation.
    new MutationObserver(scan).observe(document.body, {
      childList: true,
      subtree: true,
    })
    scan()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
}
