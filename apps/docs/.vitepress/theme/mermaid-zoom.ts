// Pan/zoom canvas for mermaid diagrams inside slides.
//
// The architecture diagrams carry more nodes than fit on one screen at a
// legible scale. Rather than shrink a diagram until its text is unreadable,
// each slide diagram is mounted in a bounded "canvas": the whole diagram is
// fit-to-view on load, then the viewer can drag to pan, wheel / pinch to
// zoom, double-click to zoom in, and reset to the fitted view. Mouse (wheel +
// drag) and touch (pinch + drag) both work via Pointer Events.
//
// The deck's own swipe-to-navigate (SlideProvider listens for touch events on
// window) is suppressed while a pointer is interacting with a diagram, so a
// pan gesture never flips the slide.
//
// Client-side only. A MutationObserver wraps diagrams as mermaid renders them
// (async) and on VitePress SPA navigation; a WeakSet prevents re-wrapping.

const MIN_FIT_FACTOR = 0.6 // allow zooming out to 0.6× the fitted scale
const MAX_SCALE = 8 // absolute zoom-in ceiling
const BUTTON_STEP = 1.4 // zoom in/out button / double-click multiplier
const WHEEL_SENSITIVITY = 0.0016 // wheel delta → zoom factor

function svgButton(label: string, path: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'diagram-btn'
  btn.setAttribute('aria-label', label)
  btn.title = label
  btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`
  return btn
}

/**
 * Wrap one rendered mermaid container in a pan/zoom canvas.
 * Returns false when the SVG has not rendered yet (caller retries later).
 */
function setupCanvas(container: HTMLElement): boolean {
  const svg = container.querySelector<SVGSVGElement>('svg')
  const viewBox = svg?.viewBox?.baseVal
  if (!svg || !viewBox || !viewBox.width || !viewBox.height) return false

  const natW = viewBox.width
  const natH = viewBox.height

  // Force the SVG to its natural pixel size so the stage's untransformed box
  // is exactly natW×natH; the transform alone then governs scale. Inline
  // !important beats both the slide's max-height cap and the global svg rules.
  svg.style.setProperty('width', `${natW}px`, 'important')
  svg.style.setProperty('height', `${natH}px`, 'important')
  svg.style.setProperty('max-width', 'none', 'important')
  svg.style.setProperty('max-height', 'none', 'important')
  svg.style.display = 'block'

  const parent = container.parentNode
  if (!parent) return false

  const canvas = document.createElement('div')
  canvas.className = 'diagram-canvas'
  const stage = document.createElement('div')
  stage.className = 'diagram-stage'
  // Pin the stage to the diagram's natural size so the transform is the only
  // thing that scales it (no shrink-to-fit against the canvas width).
  stage.style.width = `${natW}px`
  stage.style.height = `${natH}px`
  parent.insertBefore(canvas, container)
  stage.appendChild(container) // move the .mermaid into the stage
  canvas.appendChild(stage)

  let scale = 1
  let tx = 0
  let ty = 0
  let fitScale = 1
  let touched = false // user has panned/zoomed since the last fit

  const clamp = (s: number): number => Math.min(MAX_SCALE, Math.max(fitScale * MIN_FIT_FACTOR, s))

  const apply = (): void => {
    stage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
  }

  const fit = (): void => {
    const cw = canvas.clientWidth
    const ch = canvas.clientHeight
    if (cw <= 0 || ch <= 0) return
    fitScale = Math.min(cw / natW, ch / natH)
    scale = Math.min(fitScale, 1) // show large diagrams whole; never upscale small ones
    tx = (cw - natW * scale) / 2
    ty = (ch - natH * scale) / 2
    touched = false
    apply()
  }

  const zoomAbout = (clientX: number, clientY: number, next: number): void => {
    const rect = canvas.getBoundingClientRect()
    const px = clientX - rect.left
    const py = clientY - rect.top
    const ns = clamp(next)
    // Keep the content point under the cursor fixed while zooming.
    tx = px - ((px - tx) / scale) * ns
    ty = py - ((py - ty) / scale) * ns
    scale = ns
    touched = true
    apply()
  }

  const zoomCenter = (factor: number): void => {
    const rect = canvas.getBoundingClientRect()
    zoomAbout(rect.left + rect.width / 2, rect.top + rect.height / 2, scale * factor)
  }

  // ── controls ──
  const controls = document.createElement('div')
  controls.className = 'diagram-controls'
  const zoomIn = svgButton(
    'Zoom in',
    '<path d="M11 8v6M8 11h6"/><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'
  )
  const zoomOut = svgButton(
    'Zoom out',
    '<path d="M8 11h6"/><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'
  )
  const reset = svgButton('Reset view', '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>')
  zoomIn.addEventListener('click', () => zoomCenter(BUTTON_STEP))
  zoomOut.addEventListener('click', () => zoomCenter(1 / BUTTON_STEP))
  reset.addEventListener('click', () => fit())
  controls.append(zoomIn, zoomOut, reset)
  // Clicks on the controls must not start a pan or reach the canvas.
  controls.addEventListener('pointerdown', (e) => e.stopPropagation())
  canvas.appendChild(controls)

  const hint = document.createElement('div')
  hint.className = 'diagram-hint'
  hint.textContent = 'Drag to pan · scroll to zoom'
  canvas.appendChild(hint)

  // ── wheel zoom ──
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      zoomAbout(e.clientX, e.clientY, scale * Math.exp(-e.deltaY * WHEEL_SENSITIVITY))
    },
    { passive: false }
  )

  canvas.addEventListener('dblclick', (e) => {
    e.preventDefault()
    zoomAbout(e.clientX, e.clientY, scale * BUTTON_STEP * 1.3)
  })

  // ── pointer pan + pinch ──
  const pointers = new Map<number, { x: number; y: number }>()
  let pinchDist = 0

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    canvas.classList.add('is-grabbing')
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      pinchDist = Math.hypot(a!.x - b!.x, a!.y - b!.y)
    }
  })

  canvas.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId)
    if (!prev) return
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 1) {
      tx += e.clientX - prev.x
      ty += e.clientY - prev.y
      touched = true
      apply()
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y)
      const midX = (a!.x + b!.x) / 2
      const midY = (a!.y + b!.y) / 2
      if (pinchDist > 0) zoomAbout(midX, midY, scale * (dist / pinchDist))
      pinchDist = dist
    }
  })

  const endPointer = (e: PointerEvent): void => {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) pinchDist = 0
    if (pointers.size === 0) canvas.classList.remove('is-grabbing')
  }
  canvas.addEventListener('pointerup', endPointer)
  canvas.addEventListener('pointercancel', endPointer)

  // Stop touch gestures over the diagram from triggering the deck's
  // swipe-to-navigate (which listens for touch events bubbling to window).
  const stop = (e: Event): void => e.stopPropagation()
  for (const type of ['touchstart', 'touchmove', 'touchend'] as const) {
    canvas.addEventListener(type, stop, { passive: true })
  }

  // Re-fit on resize, but only while the viewer hasn't taken over the view.
  new ResizeObserver(() => {
    if (!touched) fit()
  }).observe(canvas)

  fit()
  return true
}

export function installMermaidZoom(): void {
  if (typeof window === 'undefined') return

  const done = new WeakSet<Element>()
  const scan = (): void => {
    document.querySelectorAll<HTMLElement>('.slide div.mermaid').forEach((container) => {
      if (done.has(container)) return
      if (container.closest('.diagram-stage')) {
        done.add(container) // already wrapped (or a re-scan after our own mutation)
        return
      }
      if (setupCanvas(container)) done.add(container) // only mark done once actually wrapped
    })
  }

  const start = (): void => {
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true })
    scan()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
}
