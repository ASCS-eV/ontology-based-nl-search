import type { AuthoringIR } from '@ontology-search/authoring-ir'
import type { CatalogRoad } from '@ontology-search/road-catalog'
import { getRoad } from '@ontology-search/road-catalog'
import type { EsminiScenario } from '@ontology-search/scenario-viewer-wasm'
import { loadScenario } from '@ontology-search/scenario-viewer-wasm'
import { useEffect, useMemo, useRef, useState } from 'react'

import { loadEsminiFactory } from '../lib/esmini-loader'
import { ScenarioRenderer } from '../lib/scenario-renderer'

type ViewerStatus = 'loading' | 'playing' | 'error'

interface ScenarioViewerProps {
  /** The emitted `.xosc` to play (read-only, derived from the scene IR). */
  readonly xosc: string | null
  /** The authored scene IR — its `roadNetwork.logicFile` selects the road. */
  readonly scene: AuthoringIR | null
  /** Only a scenario that passed the gates is previewed. */
  readonly valid: boolean | null
}

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * Live preview of an authored scenario, played in an endless loop below the
 * authoring result. It renders exactly what the engine that validated the
 * scenario computes — the SAME `.xodr` bytes the gates used are resolved from
 * the road catalog by the scene's `logicFile` and mounted into esmini
 * ("what you validate is what you see"). It is a preview, not a validator:
 * authoritative correctness stays with the gates. If no bundled road matches
 * the scenario it degrades honestly instead of substituting geometry.
 */
export function ScenarioViewer({ xosc, scene, valid }: ScenarioViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<ViewerStatus>('loading')
  const [message, setMessage] = useState<string | null>(null)

  const logicFile = scene?.roadNetwork?.logicFile
  const road: CatalogRoad | undefined = useMemo(
    () => (logicFile ? getRoad(logicFile) : undefined),
    [logicFile]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !xosc || !valid || !logicFile || !road) return

    let cancelled = false
    let renderer: ScenarioRenderer | null = null
    let scenario: EsminiScenario | null = null
    const reduced = prefersReducedMotion()

    setStatus('loading')
    setMessage(null)
    ;(async () => {
      try {
        const factory = await loadEsminiFactory()
        if (cancelled) return
        scenario = await loadScenario(factory, { xosc, files: { [logicFile]: road.xodr } })
        if (cancelled) {
          scenario.dispose()
          return
        }
        renderer = new ScenarioRenderer(canvas, {
          onContextLost: () => {
            setStatus('error')
            setMessage('The graphics context was lost. Reload to resume the preview.')
          },
        })
        renderer.load(scenario.roadGeometry(), scenario)
        if (reduced) renderer.renderOnce()
        else renderer.play()
        setStatus('playing')
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Failed to load the scenario preview.')
      }
    })()

    const resizeObserver = new ResizeObserver(() => renderer?.resize())
    resizeObserver.observe(canvas)

    const onVisibility = () => {
      if (!renderer) return
      if (document.hidden) renderer.pause()
      else if (!reduced) renderer.play()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      resizeObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      renderer?.dispose()
      scenario?.dispose()
    }
  }, [xosc, valid, logicFile, road])

  if (!valid || !xosc || !scene) return null

  return (
    <section
      className="mt-8 w-full max-w-3xl"
      aria-label="Scenario preview"
      data-viewer-status={road ? status : 'no-road'}
    >
      <h2 className="text-sm font-semibold text-gray-700 mb-2">Scenario preview</h2>
      {road ? (
        <div className="relative">
          <canvas
            ref={canvasRef}
            aria-label="OpenSCENARIO playback"
            className="w-full h-80 rounded-lg block bg-[#eaeef3] border border-gray-200"
          />
          {status !== 'playing' && (
            <div className="absolute inset-0 flex items-center justify-center text-center px-4">
              <p className={status === 'error' ? 'text-red-600 text-sm' : 'text-gray-500 text-sm'}>
                {message ?? 'Loading the scenario preview…'}
              </p>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Rendered by the esmini engine from <code className="font-mono">{road.logicFile}</code> —
            a looping preview of the validated scenario, not an authoritative check.
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          No bundled road matches <code className="font-mono">{logicFile}</code>, so a
          geometry-accurate preview is not available for this scenario.
        </p>
      )}
    </section>
  )
}
