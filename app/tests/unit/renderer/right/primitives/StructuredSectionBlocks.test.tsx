import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StructuredSectionBlocks } from '../../../../../src/renderer/components/right/primitives/StructuredSectionBlocks'

describe('StructuredSectionBlocks', () => {
  it('renders all canonical section headings in stable order', () => {
    render(
      <StructuredSectionBlocks
        sections={{
          goal: 'Goal text',
          acceptanceCriteria: ['AC1'],
          nonGoals: ['NG1'],
          assumptions: ['A1'],
          verificationPlan: ['V1'],
          rollbackPlan: ['R1']
        }}
        renderTasks={() => null}
      />
    )

    expect(screen.getByRole('heading', { name: 'Goal' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Acceptance Criteria' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Non-goals' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Assumptions' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Verification Plan' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Rollback Plan' })).toBeTruthy()
  })

  it('renders inline code inside the Goal section', () => {
    render(
      <StructuredSectionBlocks
        sections={{
          goal: 'Ship `stable ids` now.',
          acceptanceCriteria: [],
          nonGoals: [],
          assumptions: [],
          verificationPlan: [],
          rollbackPlan: []
        }}
        renderTasks={() => null}
      />
    )

    expect(screen.getByText('stable ids').tagName).toBe('CODE')
  })

  it('renders fenced code blocks inside multiline section content', () => {
    render(
      <StructuredSectionBlocks
        sections={{
          goal: ['Use this snippet:', '', '```ts', 'const value = 1', '```'].join('\n'),
          acceptanceCriteria: [],
          nonGoals: [],
          assumptions: [],
          verificationPlan: [],
          rollbackPlan: []
        }}
        renderTasks={() => null}
      />
    )

    expect(screen.getByText('const value = 1')).toBeTruthy()
  })

  it('renders markdown inside canonical list items', () => {
    render(
      <StructuredSectionBlocks
        sections={{
          goal: '',
          acceptanceCriteria: ['Support `markdown` list items'],
          nonGoals: [],
          assumptions: [],
          verificationPlan: [],
          rollbackPlan: []
        }}
        renderTasks={() => null}
      />
    )

    expect(screen.getByText('markdown').tagName).toBe('CODE')
  })
})
