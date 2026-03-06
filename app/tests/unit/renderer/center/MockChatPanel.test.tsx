import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

    const status = screen.getByRole('status', { name: 'Ready' })
    const messageList = screen.getByTestId('message-list')

    expect(status).toBeTruthy()
    expect(within(messageList).queryByRole('status')).toBeNull()
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

  it('renders analyzing preview context chips during pending runs', () => {
    render(<MockChatPanel />)

    fireEvent.change(screen.getByLabelText('Message input'), {
      target: { value: 'I would like to build the following product for my team' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(screen.getByRole('status', { name: 'Thinking' })).toBeTruthy()
    expect(screen.getByText('# Kata Cloud (Kata V2)')).toBeTruthy()
    expect(screen.getByText('## Context...')).toBeTruthy()
  })

  it('renders collapsed analyzing summary and a thinking badge', () => {
    render(<MockChatPanel forceAnalyzing />)

    fireEvent.change(screen.getByLabelText('Message input'), {
      target: {
        value:
          'I would like to build the following product for which I have created an overview document.'
      }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(screen.getByRole('status', { name: 'Thinking' })).toBeTruthy()
    expect(screen.getByText('Pasted content text')).toBeTruthy()
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

  it('renders the deterministic error state and retries through completion', () => {
    render(<MockChatPanel />)

    fireEvent.change(screen.getByLabelText('Message input'), {
      target: { value: '/error trigger deterministic failure' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(screen.getByText('Error')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(screen.getByText('Thinking')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(900)
    })

    expect(screen.getByText('Stopped')).toBeTruthy()
    expect(screen.getByText('Draft ready for review.')).toBeTruthy()
  })
})
