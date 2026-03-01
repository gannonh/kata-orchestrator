import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MockChatPanel } from '../../../../src/renderer/components/center/MockChatPanel'

describe('MockChatPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    cleanup()
  })

  it('renders empty pre-run state', () => {
    render(<MockChatPanel />)

    expect(screen.getByText('Ready')).toBeTruthy()
    expect(screen.getByLabelText('Message input')).toBeTruthy()
  })

  it('renders pending immediately after submit', () => {
    render(<MockChatPanel />)

    fireEvent.change(screen.getByLabelText('Message input'), {
      target: { value: 'Ship slice A' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(screen.getByText('Thinking')).toBeTruthy()
    expect(screen.getByText('Ship slice A')).toBeTruthy()
  })

  it('renders the deterministic agent response after the pending run completes', () => {
    render(<MockChatPanel />)

    fireEvent.change(screen.getByLabelText('Message input'), {
      target: { value: 'Ship slice A' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    act(() => {
      vi.advanceTimersByTime(900)
    })

    expect(screen.getByText('Stopped')).toBeTruthy()
    expect(screen.getByText('Draft ready for review.')).toBeTruthy()
  })

  it('renders the deterministic error state and retries back to pending', () => {
    render(<MockChatPanel />)

    fireEvent.change(screen.getByLabelText('Message input'), {
      target: { value: '/error trigger deterministic failure' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(screen.getByText('Error')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(screen.getByText('Thinking')).toBeTruthy()
  })
})
