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

const decisionProposal = [
  '## Why',
  '- Electron + TypeScript keeps desktop iteration stable',
  '',
  '## How to keep Tech stable later',
  '- Keep provider adapter boundaries explicit',
  '',
  'Approve this plan with 1 check? Clarifications',
  '- Approve the plan...',
  '- Keep the last switch...'
].join('\n')

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

  it('calls onLatestDraftChange when latestDraft changes', () => {
    const onLatestDraftChange = vi.fn()
    const initialState = idleState({ latestDraft: undefined })
    const nextState = idleState({
      latestDraft: {
        runId: 'run-1',
        generatedAt: '2026-03-03T00:00:01Z',
        content: '## Goal\nDraft'
      }
    })

    let currentState = initialState
    mockHook.mockImplementation(() => ({
      state: currentState,
      submitPrompt: vi.fn(),
      retry: vi.fn(),
    }))

    const { rerender } = render(
      <ChatPanel
        sessionId="sess-42"
        onLatestDraftChange={onLatestDraftChange}
      />
    )

    currentState = nextState
    rerender(
      <ChatPanel
        sessionId="sess-42"
        onLatestDraftChange={onLatestDraftChange}
      />
    )

    expect(onLatestDraftChange).toHaveBeenCalledWith(undefined)
    expect(onLatestDraftChange).toHaveBeenCalledWith(nextState.latestDraft)
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

  it('renders inline decision actions for an eligible agent message', () => {
    mockHook.mockReturnValue({
      state: idleState({
        messages: [
          { id: 'm1', role: 'agent', content: decisionProposal, createdAt: '2026-03-01T00:00:01Z' },
        ],
      }),
      submitPrompt: vi.fn(),
      retry: vi.fn(),
    })

    render(<ChatPanel sessionId={null} />)

    expect(screen.getByRole('button', { name: 'Approve the plan...' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Keep the last switch...' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Clarifications' })).toBeTruthy()
  })

  it('clicking a decision action submits the canonical follow-up prompt', () => {
    const submitPrompt = vi.fn()
    mockHook.mockReturnValue({
      state: idleState({
        messages: [
          { id: 'm1', role: 'agent', content: decisionProposal, createdAt: '2026-03-01T00:00:01Z' },
        ],
      }),
      submitPrompt,
      retry: vi.fn(),
    })

    render(<ChatPanel sessionId={null} />)

    fireEvent.click(screen.getByRole('button', { name: 'Approve the plan...' }))

    expect(submitPrompt).toHaveBeenCalledWith('Approve the plan and continue with this tech stack.')
  })

  it('disables inline decision actions while runState is pending', () => {
    const submitPrompt = vi.fn()
    mockHook.mockReturnValue({
      state: idleState({
        runState: 'pending',
        messages: [
          { id: 'm1', role: 'agent', content: decisionProposal, createdAt: '2026-03-01T00:00:01Z' },
        ],
      }),
      submitPrompt,
      retry: vi.fn(),
    })

    render(<ChatPanel sessionId={null} />)

    const approveButton = screen.getByRole('button', { name: 'Approve the plan...' }) as HTMLButtonElement
    expect(approveButton.disabled).toBe(true)
    fireEvent.click(approveButton)
    expect(submitPrompt).not.toHaveBeenCalled()
  })
})
