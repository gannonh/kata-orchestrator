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
})
