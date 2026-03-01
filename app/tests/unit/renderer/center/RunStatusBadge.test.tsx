import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { RunStatusBadge } from '../../../../src/renderer/components/center/RunStatusBadge'

describe('RunStatusBadge', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders pending as Thinking', () => {
    render(<RunStatusBadge runState="pending" />)

    expect(screen.getByText('Thinking')).toBeTruthy()
  })

  it('renders error state copy', () => {
    render(<RunStatusBadge runState="error" />)

    expect(screen.getByText('Error')).toBeTruthy()
  })
})
