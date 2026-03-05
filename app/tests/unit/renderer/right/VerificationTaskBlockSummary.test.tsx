import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { VerificationTaskBlockSummary } from '../../../../src/renderer/components/right/VerificationTaskBlockSummary'

describe('VerificationTaskBlockSummary', () => {
  it('renders readonly task blocks using shared primitive contracts', () => {
    render(
      <VerificationTaskBlockSummary
        title="Wave 1 Verification"
        tasks={[
          { id: 'a', title: 'Run tests', status: 'complete', markdownLineIndex: 0 },
          { id: 'b', title: 'Review blockers', status: 'in_progress', markdownLineIndex: 1 }
        ]}
      />
    )

    expect(screen.getByText('Wave 1 Verification')).toBeTruthy()
    expect(screen.getByText('Run tests')).toBeTruthy()
    expect(screen.getByText('Complete')).toBeTruthy()
    expect(screen.queryByRole('checkbox', { name: 'Run tests' })).toBeTruthy()
  })
})
