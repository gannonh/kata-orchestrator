import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { StructuredSectionBlocks } from '../../../../../src/renderer/components/right/primitives/StructuredSectionBlocks'

describe('StructuredSectionBlocks', () => {
  afterEach(() => {
    cleanup()
  })

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
    const { container } = render(
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

  it('renders fenced code blocks inside canonical list items without splitting them into extra rows', () => {
    const { container } = render(
      <StructuredSectionBlocks
        sections={{
          goal: '',
          acceptanceCriteria: [
            [
              'Illustrate the expected task markers.',
              '',
              '```ts',
              "type TaskState = '[ ]' | '[/]' | '[x]'",
              '```'
            ].join('\n')
          ],
          nonGoals: [],
          assumptions: [],
          verificationPlan: [],
          rollbackPlan: []
        }}
        renderTasks={() => null}
      />
    )

    expect(screen.getByText("type TaskState = '[ ]' | '[/]' | '[x]'")).toBeTruthy()
    const acceptanceCriteriaList = Array.from(container.querySelectorAll('[data-slot="card"]'))
      .find((card) =>
        within(card as HTMLElement).queryByRole('heading', { name: 'Acceptance Criteria' }) !== null
      )
      ?.querySelector('ol')

    expect(acceptanceCriteriaList).toBeTruthy()
    expect(within(acceptanceCriteriaList as HTMLElement).getAllByRole('listitem')).toHaveLength(1)
  })
})
