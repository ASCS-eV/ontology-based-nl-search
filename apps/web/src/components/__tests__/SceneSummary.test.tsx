import type { AuthoringIR } from '@ontology-search/authoring-ir'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SceneSummary } from '../SceneSummary'

const SCENE: AuthoringIR = {
  roadNetwork: { logicFile: 'road.xodr' },
  parameters: { HostVehicle: 'Ego' },
  entities: [
    { ref: 'Ego', type: 'Vehicle', properties: { speed: '27.78' } },
    { ref: 'A2', type: 'Vehicle', properties: { categories: ['car', 'van'] } },
  ],
  actions: [
    {
      actor: 'A2',
      kind: 'LaneChangeAction',
      properties: { dynamics: 'linear' },
      references: { entityRef: 'Ego' },
    },
  ],
}

describe('SceneSummary', () => {
  it('renders the road network, parameters, entities and actions', () => {
    render(<SceneSummary scene={SCENE} />)

    expect(screen.getByText('road.xodr')).toBeInTheDocument()
    expect(screen.getByText('HostVehicle = Ego')).toBeInTheDocument()
    expect(screen.getByText('Entities (2)')).toBeInTheDocument()
    expect(screen.getByText('Actions (1)')).toBeInTheDocument()
    expect(screen.getAllByText('Ego').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('LaneChangeAction')).toBeInTheDocument()
  })

  it('renders array-valued properties as a joined list without hardcoding keys', () => {
    render(<SceneSummary scene={SCENE} />)
    expect(screen.getByText('car, van')).toBeInTheDocument()
  })

  it('renders an action reference target', () => {
    render(<SceneSummary scene={SCENE} />)
    // "entityRef → Ego" — Ego appears both as an entity and as the reference target.
    expect(screen.getAllByText('Ego').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/entityRef/)).toBeInTheDocument()
  })

  /**
   * Regression: a speed the model assumed and a length the lowering filled in
   * rendered like the values the user stated, or not at all.
   */
  it('marks an assumed value and lists the lowering defaults apart from stated values', () => {
    render(
      <SceneSummary
        scene={SCENE}
        assumptions={[{ path: 'entity.Ego.speed', reason: 'no speed was given' }]}
        loweringDefaults={[
          { path: 'entity.A2.length', value: '4.5', reason: 'standard passenger car' },
          { path: 'stopTime', value: '30', reason: 'default simulation end' },
        ]}
      />
    )

    const assumed = screen.getByTitle('no speed was given')
    expect(assumed).toHaveTextContent('assumed')
    expect(assumed.parentElement).toHaveTextContent('27.78')
    // A stated value carries no mark.
    expect(screen.getByText('linear').textContent).toBe('linear')
    const length = screen.getByText('length')
    expect(length.nextElementSibling).toHaveTextContent('4.5')
    expect(length.nextElementSibling).toHaveTextContent('default')
    expect(screen.getByText('30 s')).toBeInTheDocument()
  })

  it('shows no marks and no legend when nothing was assumed or filled in', () => {
    render(<SceneSummary scene={SCENE} />)
    expect(screen.queryByText('assumed')).not.toBeInTheDocument()
    expect(screen.queryByText('default')).not.toBeInTheDocument()
  })
})
