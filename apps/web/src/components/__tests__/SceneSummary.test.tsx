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
})
