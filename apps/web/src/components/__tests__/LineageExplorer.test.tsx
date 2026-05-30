import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LineageExplorer } from '../LineageExplorer'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LineageExplorer', () => {
  it('renders a loading state while the fetch is in flight', async () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {})) // never resolves
    render(<LineageExplorer asset="did:web:example:a" />)
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)
  })

  it('renders each outgoing reference as a blue pill with predicate breadcrumb', async () => {
    // Note: the root asset is intentionally NOT rendered — it's already
    // shown in the parent AssetCard's header. The explorer only adds
    // the reachable downstream graph.
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          node: {
            asset: 'did:web:example:scenario-1',
            name: 'Scenario 1',
            type: 'https://example.org/scenario/Scenario',
            domain: 'scenario',
            truncated: false,
            references: [
              {
                predicatePath: [
                  'https://example.org/scenario/v6/hasManifest',
                  'https://example.org/manifest/v5/hasReferencedArtifacts',
                  'https://example.org/manifest/v5/iri',
                ],
                target: {
                  asset: 'did:web:example:hdmap-1',
                  name: 'HD Map 1',
                  type: 'https://example.org/hdmap/HdMap',
                  domain: 'hdmap',
                  truncated: false,
                  references: [],
                },
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    render(<LineageExplorer asset="did:web:example:scenario-1" />)
    // Child pill (the actually reachable downstream asset).
    expect(await screen.findByText('HD Map 1')).toBeInTheDocument()
    expect(screen.getByText('(hdmap)')).toBeInTheDocument()
    // Each predicate's local name appears in the breadcrumb.
    expect(screen.getByText('hasManifest')).toBeInTheDocument()
    expect(screen.getByText('hasReferencedArtifacts')).toBeInTheDocument()
    expect(screen.getByText('iri')).toBeInTheDocument()
  })

  it('collapses siblings sharing a label into one pill with ×N count', async () => {
    // The "Cologne Motorway HD Map" ×8 case in real fixture: many
    // distinct IRIs, one label. Should render as ONE pill in the
    // lineage tree, not eight identical-looking ones.
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          node: {
            asset: 'did:web:example:scenario',
            name: 'Some Scenario',
            type: '',
            domain: 'scenario',
            truncated: false,
            references: [
              {
                predicatePath: ['https://example.org/manifest/v5/iri'],
                target: {
                  asset: 'did:web:example:hdmap-1',
                  name: 'Cologne Motorway HD Map',
                  type: '',
                  domain: 'hdmap',
                  truncated: false,
                  references: [],
                },
              },
              {
                predicatePath: ['https://example.org/manifest/v5/iri'],
                target: {
                  asset: 'did:web:example:hdmap-2',
                  name: 'Cologne Motorway HD Map',
                  type: '',
                  domain: 'hdmap',
                  truncated: false,
                  references: [],
                },
              },
              {
                predicatePath: ['https://example.org/manifest/v5/iri'],
                target: {
                  asset: 'did:web:example:hdmap-3',
                  name: 'Cologne Motorway HD Map',
                  type: '',
                  domain: 'hdmap',
                  truncated: false,
                  references: [],
                },
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    render(<LineageExplorer asset="did:web:example:scenario" />)
    // ×3 badge surfaces; the label appears exactly once.
    expect(await screen.findByText('×3')).toBeInTheDocument()
    const labels = screen.getAllByText('Cologne Motorway HD Map')
    expect(labels).toHaveLength(1)
  })

  it('labels grandchildren with a "via <parent>" hint so deep nesting reads at a glance', async () => {
    // The flat-paste failure mode: when many siblings share a label
    // (e.g. several "Cologne Motorway HD Map" pills), the indentation
    // alone can be hard to read. A small italic "via <parent>" tag on
    // any node reached through an intermediate (depth ≥ 2) anchors the
    // tree shape visually.
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          node: {
            asset: 'did:web:example:scenario-1',
            name: 'Scenario 1',
            type: '',
            domain: 'scenario',
            truncated: false,
            references: [
              {
                predicatePath: ['https://example.org/manifest/v5/iri'],
                target: {
                  asset: 'did:web:example:ositrace-1',
                  name: 'OSI Trace 1',
                  type: '',
                  domain: 'ositrace',
                  truncated: false,
                  references: [
                    {
                      predicatePath: ['https://example.org/manifest/v5/iri'],
                      target: {
                        asset: 'did:web:example:hdmap-1',
                        name: 'HD Map 1',
                        type: '',
                        domain: 'hdmap',
                        truncated: false,
                        references: [],
                      },
                    },
                  ],
                },
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    render(<LineageExplorer asset="did:web:example:scenario-1" />)
    // Depth 1 pill: no "via" hint.
    expect(await screen.findByText('OSI Trace 1')).toBeInTheDocument()
    // Depth 2 grandchild: hint names the intermediate.
    expect(screen.getByText(/via OSI Trace 1/i)).toBeInTheDocument()
    expect(screen.getByText('HD Map 1')).toBeInTheDocument()
  })

  it('marks a truncated descendant with a "more…" hint', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          node: {
            asset: 'did:web:example:scenario-1',
            name: 'Scenario 1',
            type: '',
            domain: 'scenario',
            truncated: false,
            references: [
              {
                predicatePath: ['https://example.org/manifest/v5/iri'],
                target: {
                  asset: 'did:web:example:hdmap-1',
                  name: 'HD Map 1',
                  type: '',
                  domain: 'hdmap',
                  truncated: true,
                  references: [],
                },
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    render(<LineageExplorer asset="did:web:example:scenario-1" />)
    expect(await screen.findByText(/more…/i)).toBeInTheDocument()
  })

  it('renders an error state when the fetch fails', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    render(<LineageExplorer asset="did:web:example:nope" />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/lineage unavailable/i)
  })

  it('passes depth through to the request URL', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          node: {
            asset: 'did:web:example:a',
            name: 'a',
            type: '',
            domain: '',
            references: [],
            truncated: false,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    render(<LineageExplorer asset="did:web:example:a" depth={2} />)
    // Root has no references → the "no outgoing" message is the
    // resolved state we can assert on (better than waiting for a
    // pill that won't exist).
    expect(await screen.findByText(/no outgoing references/i)).toBeInTheDocument()
    const url = String(fetchMock.mock.calls[0]?.[0])
    expect(url).toContain('depth=2')
    expect(url).toContain(encodeURIComponent('did:web:example:a'))
  })
})
