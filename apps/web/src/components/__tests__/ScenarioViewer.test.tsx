import type { AuthoringIR } from '@ontology-search/authoring-ir'
import type { CatalogRoad } from '@ontology-search/road-catalog'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ScenarioViewer } from '../ScenarioViewer'

// --- Mocks: none of the real WASM/WebGL/road machinery runs in jsdom. ---
const getRoad = vi.fn()
vi.mock('@ontology-search/road-catalog', () => ({
  getRoad: (logicFile: string) => getRoad(logicFile),
}))

const loadScenario = vi.fn()
vi.mock('@ontology-search/scenario-viewer-wasm', () => ({
  loadScenario: (...args: unknown[]) => loadScenario(...args),
}))

const loadEsminiFactory = vi.fn()
vi.mock('../../lib/esmini-loader', () => ({
  loadEsminiFactory: () => loadEsminiFactory(),
}))

const rendererLoad = vi.fn()
const rendererPlay = vi.fn()
const rendererRenderOnce = vi.fn()
const rendererDispose = vi.fn()
const rendererResize = vi.fn()
const rendererPause = vi.fn()
const rendererCtor = vi.fn()
vi.mock('../../lib/scenario-renderer', () => ({
  ScenarioRenderer: class {
    constructor(canvas: HTMLCanvasElement, opts?: unknown) {
      rendererCtor(canvas, opts)
    }
    load = rendererLoad
    play = rendererPlay
    renderOnce = rendererRenderOnce
    dispose = rendererDispose
    resize = rendererResize
    pause = rendererPause
  },
}))

const ROAD: CatalogRoad = {
  id: 'german_highway_short',
  logicFile: 'german_highway_short.xodr',
  description: 'test road',
  xodr: '<OpenDRIVE/>',
  topology: {} as CatalogRoad['topology'],
  provenance: {} as CatalogRoad['provenance'],
}

const SCENE: AuthoringIR = {
  entities: [],
  actions: [],
  roadNetwork: { logicFile: 'german_highway_short.xodr' },
}

const XOSC = '<OpenSCENARIO/>'

function makeScenario() {
  return {
    roadGeometry: vi.fn(() => ({ laneSurfaces: [], roadMarks: [], laneCenters: [] })),
    dispose: vi.fn(),
  }
}

describe('ScenarioViewer', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
    loadEsminiFactory.mockResolvedValue({})
    getRoad.mockReturnValue(ROAD)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing until the scenario is valid', () => {
    const { container } = render(<ScenarioViewer xosc={XOSC} scene={SCENE} valid={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing without a .xosc', () => {
    const { container } = render(<ScenarioViewer xosc={null} scene={SCENE} valid={true} />)
    expect(container.firstChild).toBeNull()
  })

  it('mounts the canvas and loads the scenario with the resolved road bytes', async () => {
    const scenario = makeScenario()
    loadScenario.mockResolvedValue(scenario)

    render(<ScenarioViewer xosc={XOSC} scene={SCENE} valid={true} />)

    expect(screen.getByLabelText('OpenSCENARIO playback')).toBeInTheDocument()

    await waitFor(() => expect(loadScenario).toHaveBeenCalledOnce())
    expect(loadScenario).toHaveBeenCalledWith(
      {},
      { xosc: XOSC, files: { 'german_highway_short.xodr': '<OpenDRIVE/>' } }
    )
    await waitFor(() => expect(rendererPlay).toHaveBeenCalledOnce())
    expect(rendererLoad).toHaveBeenCalledOnce()
  })

  it('renders a single frame instead of looping under prefers-reduced-motion', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, media: '', addEventListener() {}, removeEventListener() {} }))
    )
    const scenario = makeScenario()
    loadScenario.mockResolvedValue(scenario)

    render(<ScenarioViewer xosc={XOSC} scene={SCENE} valid={true} />)

    await waitFor(() => expect(rendererRenderOnce).toHaveBeenCalledOnce())
    expect(rendererPlay).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('shows an honest fallback (no substitution) when no bundled road matches', () => {
    getRoad.mockReturnValue(undefined)
    const scene: AuthoringIR = {
      entities: [],
      actions: [],
      roadNetwork: { logicFile: 'unknown_road.xodr' },
    }

    render(<ScenarioViewer xosc={XOSC} scene={scene} valid={true} />)

    expect(screen.getByText(/no bundled road matches/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('OpenSCENARIO playback')).not.toBeInTheDocument()
    expect(loadScenario).not.toHaveBeenCalled()
  })

  it('disposes the renderer and scenario on unmount', async () => {
    const scenario = makeScenario()
    loadScenario.mockResolvedValue(scenario)

    const { unmount } = render(<ScenarioViewer xosc={XOSC} scene={SCENE} valid={true} />)
    await waitFor(() => expect(rendererPlay).toHaveBeenCalledOnce())

    unmount()
    expect(rendererDispose).toHaveBeenCalledOnce()
    expect(scenario.dispose).toHaveBeenCalledOnce()
  })

  it('surfaces a load error without crashing', async () => {
    loadScenario.mockRejectedValue(new Error('boom parsing xosc'))

    render(<ScenarioViewer xosc={XOSC} scene={SCENE} valid={true} />)

    expect(await screen.findByText('boom parsing xosc')).toBeInTheDocument()
    expect(rendererPlay).not.toHaveBeenCalled()
  })
})
