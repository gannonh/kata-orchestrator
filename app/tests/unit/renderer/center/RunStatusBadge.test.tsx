import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { RunStatusBadge } from '../../../../src/renderer/components/center/RunStatusBadge'

describe('RunStatusBadge', () => {
  afterEach(() => {
    cleanup()
  })

  it.each([
    ['empty', 'Ready'],
    ['pending', 'Thinking'],
    ['idle', 'Stopped'],
    ['error', 'Error']
  ] as const)('renders %s with an accessible status region', (runState, label) => {
    render(<RunStatusBadge runState={runState} />)

    const statusRegion = screen.getByRole('status', { name: label })

    expect(statusRegion.getAttribute('aria-live')).toBe('polite')
    expect(statusRegion.textContent).toContain(label)
  })

  it('uses motion-safe pulse styling for the pending dot', () => {
    const { container } = render(<RunStatusBadge runState="pending" />)

    const dot = container.querySelector('[aria-hidden="true"]')
    const classes = dot?.className.split(/\s+/) ?? []

    expect(classes).toContain('motion-safe:animate-pulse')
    expect(classes).not.toContain('animate-pulse')
  })
})
