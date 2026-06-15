import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { PipelineStep } from '../PipelineStepper'
import { PipelineStepper } from '../PipelineStepper'

function makeSteps(overrides: Partial<PipelineStep>[] = []): PipelineStep[] {
  const defaults: PipelineStep[] = [
    { id: 'step-1', label: 'Step One', hasContent: true, content: <p>Content 1</p> },
    { id: 'step-2', label: 'Step Two', hasContent: true, content: <p>Content 2</p> },
    { id: 'step-3', label: 'Step Three', hasContent: false, content: null },
  ]
  return defaults.map((s, i) => ({ ...s, ...overrides[i] }))
}

describe('PipelineStepper', () => {
  it('renders visible steps (those with hasContent or content)', () => {
    const steps = makeSteps()
    render(<PipelineStepper steps={steps} activeStep={0} />)

    expect(screen.getByText('Step One')).toBeInTheDocument()
    expect(screen.getByText('Step Two')).toBeInTheDocument()
    // Step Three has no content, should not be rendered
    expect(screen.queryByText('Step Three')).not.toBeInTheDocument()
  })

  it('auto-expands the active step', () => {
    const steps = makeSteps()
    render(<PipelineStepper steps={steps} activeStep={0} />)

    expect(screen.getByText('Content 1')).toBeVisible()
    expect(screen.getByText('Content 2')).not.toBeVisible()
  })

  it('allows manual toggle of steps', async () => {
    const user = userEvent.setup()
    const steps = makeSteps()
    render(<PipelineStepper steps={steps} activeStep={0} />)

    // Content 2 is not shown (not active step)
    expect(screen.getByText('Content 2')).not.toBeVisible()

    // Click on Step Two header to expand it
    await user.click(screen.getByText('Step Two'))
    expect(screen.getByText('Content 2')).toBeVisible()

    // Click again to collapse
    await user.click(screen.getByText('Step Two'))
    expect(screen.getByText('Content 2')).not.toBeVisible()
  })

  it('shows summary when step is collapsed', () => {
    const steps = makeSteps([{ summary: 'Query submitted' }])
    render(<PipelineStepper steps={steps} activeStep={1} />)

    // Step 1 is not the active step and should show summary
    expect(screen.getByText('Query submitted')).toBeInTheDocument()
  })

  it('shows "Start with GraphQL" button and calls handler', async () => {
    const user = userEvent.setup()
    const onSkip = vi.fn()
    const steps = makeSteps()
    render(
      <PipelineStepper steps={steps} activeStep={0} onSkipToGraphQL={onSkip} showGraphQLEntry />
    )

    const btn = screen.getByRole('button', { name: /start with graphql/i })
    expect(btn).toBeInTheDocument()

    await user.click(btn)
    expect(onSkip).toHaveBeenCalledOnce()
  })

  it('hides "Start with GraphQL" when showGraphQLEntry is false', () => {
    const steps = makeSteps()
    render(
      <PipelineStepper
        steps={steps}
        activeStep={0}
        onSkipToGraphQL={vi.fn()}
        showGraphQLEntry={false}
      />
    )

    expect(screen.queryByRole('button', { name: /start with graphql/i })).not.toBeInTheDocument()
  })

  it('shows checkmark for completed steps', () => {
    const steps = makeSteps([{ hasContent: true }, { hasContent: true }])
    render(<PipelineStepper steps={steps} activeStep={1} />)

    // Step 1 (index 0) is before activeStep, so it should show ✓
    expect(screen.getByText('✓')).toBeInTheDocument()
  })
})
