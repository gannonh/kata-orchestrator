import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionConversationState } from '../../../../src/renderer/types/session-conversation'

const mockHook = vi.fn<
  [string | null],
  {
    state: SessionConversationState
    submitPrompt: (prompt: string) => void
    retry: () => void
  }
>()

vi.mock('../../../../src/renderer/hooks/useIpcSessionConversation', () => ({
  useIpcSessionConversation: (...args: [string | null]) => mockHook(...args),
}))

function idleState(
  overrides: Partial<SessionConversationState> = {},
): SessionConversationState {
  return {
    runState: 'idle',
    messages: [],
    ...overrides,
  }
}

describe('ChatPanel', () => {
  let ChatPanel: typeof import('../../../../src/renderer/components/center/ChatPanel').ChatPanel

  beforeEach(async () => {
    const mod = await import('../../../../src/renderer/components/center/ChatPanel')
    ChatPanel = mod.ChatPanel
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders message list, run status badge, and chat input', () => {
    mockHook.mockReturnValue({
      state: idleState({ runState: 'empty' }),
      submitPrompt: vi.fn(),
      retry: vi.fn(),
    })

    render(<ChatPanel sessionId={null} />)

    expect(screen.getByTestId('message-list')).toBeTruthy()
    expect(screen.getByRole('status', { name: 'Ready' })).toBeTruthy()
    expect(screen.getByLabelText('Message input')).toBeTruthy()
  })

  it('passes sessionId to useIpcSessionConversation', () => {
    mockHook.mockReturnValue({
      state: idleState(),
      submitPrompt: vi.fn(),
      retry: vi.fn(),
    })

    render(<ChatPanel sessionId="sess-42" />)

    expect(mockHook).toHaveBeenCalledWith('sess-42')
  })

  it('renders messages from hook state', () => {
    mockHook.mockReturnValue({
      state: idleState({
        messages: [
          { id: 'm1', role: 'user', content: 'Hello world', createdAt: '2026-03-01T00:00:00Z' },
          { id: 'm2', role: 'agent', content: 'Hi there', createdAt: '2026-03-01T00:00:01Z' },
        ],
      }),
      submitPrompt: vi.fn(),
      retry: vi.fn(),
    })

    render(<ChatPanel sessionId={null} />)

    expect(screen.getByText('Hello world')).toBeTruthy()
    expect(screen.getByText('Hi there')).toBeTruthy()
  })

  it('submitting a message calls submitPrompt from the hook', () => {
    const submitPrompt = vi.fn()
    mockHook.mockReturnValue({
      state: idleState({ runState: 'empty' }),
      submitPrompt,
      retry: vi.fn(),
    })

    render(<ChatPanel sessionId={null} />)

    fireEvent.change(screen.getByLabelText('Message input'), {
      target: { value: 'Build feature X' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(submitPrompt).toHaveBeenCalledWith('Build feature X')
  })

  it('error state shows retry button that calls retry from the hook', () => {
    const retry = vi.fn()
    mockHook.mockReturnValue({
      state: idleState({ runState: 'error', errorMessage: 'Something broke' }),
      submitPrompt: vi.fn(),
      retry,
    })

    render(<ChatPanel sessionId={null} />)

    expect(screen.getByText('Error')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(retry).toHaveBeenCalled()
  })

  it('does not render hardcoded model badge', () => {
    mockHook.mockReturnValue({
      state: idleState({ runState: 'empty' }),
      submitPrompt: vi.fn(),
      retry: vi.fn(),
    })

    render(<ChatPanel sessionId={null} />)

    expect(screen.queryByText('GPT-5.3 Codex')).toBeNull()
  })
})
