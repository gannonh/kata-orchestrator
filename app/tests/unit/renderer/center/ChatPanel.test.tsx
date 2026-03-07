import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionConversationState } from '../../../../src/renderer/types/session-conversation'
import { ChatPanel } from '../../../../src/renderer/components/center/ChatPanel'

const { messageBubbleRenderSpy } = vi.hoisted(() => ({
  messageBubbleRenderSpy: vi.fn()
}))

const mockHook = vi.fn<
  [string | null, (string | null)?],
  {
    state: SessionConversationState
    submitPrompt: (...args: any[]) => void
    retry: (...args: any[]) => void
  }
>()

const mockModelHook = vi.fn()

vi.mock('../../../../src/renderer/hooks/useIpcSessionConversation', () => ({
  useIpcSessionConversation: (...args: [string | null, (string | null)?]) => mockHook(...args),
}))

vi.mock('../../../../src/renderer/components/center/MessageBubble', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/renderer/components/center/MessageBubble')>()

  return {
    ...actual,
    MessageBubble: (props: Parameters<typeof actual.MessageBubble>[0]) => {
      messageBubbleRenderSpy(props)

      return (
        <div
          data-message-bubble-id={props.message.id}
          data-render-mode={props.renderMode ?? 'unset'}
        >
          <actual.MessageBubble {...props} />
        </div>
      )
    }
  }
})

vi.mock('../../../../src/renderer/hooks/useSessionModelSelection', () => ({
  useSessionModelSelection: (...args: unknown[]) => mockModelHook(...args)
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
  beforeEach(() => {
    mockModelHook.mockReturnValue({
      models: [],

      currentModel: null,
      isHydrated: true,
      setCurrentModel: vi.fn()
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    messageBubbleRenderSpy.mockClear()
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

  it('renders pending run state with primitive status semantics', () => {
    mockHook.mockReturnValue({
      state: idleState({
        runState: 'pending',
        messages: [
          { id: 'm1', role: 'user', content: 'Plan this slice', createdAt: '2026-03-01T00:00:00Z' }
        ]
      }),
      submitPrompt: vi.fn(),
      retry: vi.fn()
    })

    render(<ChatPanel sessionId={null} />)

    expect(screen.getByRole('status', { name: 'Thinking' })).toBeTruthy()
  })

  it('keeps the visible message list and status badge after primitive wrapper changes', () => {
    mockHook.mockReturnValue({
      state: idleState({
        runState: 'pending',
        messages: [
          { id: 'm1', role: 'user', content: 'Plan the work', createdAt: '2026-03-01T00:00:00Z' },
          { id: 'm2', role: 'agent', content: 'Draft ready.', createdAt: '2026-03-01T00:00:01Z' }
        ]
      }),
      submitPrompt: vi.fn(),
      retry: vi.fn()
    })

    render(<ChatPanel sessionId={null} />)

    expect(screen.getByTestId('message-list')).toBeTruthy()
    expect(screen.getByText('Plan the work')).toBeTruthy()
    expect(screen.getByText('Draft ready.')).toBeTruthy()
    expect(screen.getByRole('status', { name: 'Thinking' })).toBeTruthy()
  })

  it('uses the explicit activity phase for the footer status badge', () => {
    mockHook.mockReturnValue({
      state: idleState({
        runState: 'idle',
        activityPhase: 'drafting',
        messages: [
          { id: 'm1', role: 'user', content: 'Create the spec', createdAt: '2026-03-01T00:00:00Z' },
          { id: 'm2', role: 'agent', content: 'Drafting', createdAt: '2026-03-01T00:00:01Z' }
        ]
      }),
      submitPrompt: vi.fn(),
      retry: vi.fn()
    })

    render(<ChatPanel sessionId={null} />)

    expect(screen.getAllByRole('status', { name: 'Drafting' })).toHaveLength(2)
  })

  it('renders the latest pending assistant message in streaming mode', () => {
    mockHook.mockReturnValue({
      state: idleState({
        runState: 'pending',
        messages: [
          { id: 'm0', role: 'agent', content: 'Previous answer', createdAt: '2026-03-01T00:00:00Z' },
          { id: 'm1', role: 'user', content: 'Show me progress', createdAt: '2026-03-01T00:00:01Z' },
          { id: 'm2', role: 'agent', content: ['```ts', 'const ready = true'].join('\n'), createdAt: '2026-03-01T00:00:02Z' }
        ]
      }),
      submitPrompt: vi.fn(),
      retry: vi.fn()
    })

    render(<ChatPanel sessionId="sess-1" />)

    expect(screen.getByRole('status', { name: 'Thinking' })).toBeTruthy()
    expect(document.querySelector('[data-message-bubble-id="m0"]')?.getAttribute('data-render-mode')).toBe('settled')
    expect(document.querySelector('[data-message-bubble-id="m1"]')?.getAttribute('data-render-mode')).toBe('settled')
    expect(document.querySelector('[data-message-bubble-id="m2"]')?.getAttribute('data-render-mode')).toBe('streaming')
    expect(
      screen.getByText((_, node) => node?.tagName === 'CODE' && node.textContent?.includes('const ready = true') === true)
    ).toBeTruthy()
  })

  it('stabilizes the same assistant message when the final append arrives', () => {
    let currentState = idleState({
      runState: 'pending',
      messages: [
        { id: 'm1', role: 'user', content: 'Show me progress', createdAt: '2026-03-01T00:00:00Z' },
        { id: 'm2', role: 'agent', content: ['## Summary', '', '```ts', 'const ready = true'].join('\n'), createdAt: '2026-03-01T00:00:01Z' }
      ]
    })

    mockHook.mockImplementation(() => ({
      state: currentState,
      submitPrompt: vi.fn(),
      retry: vi.fn()
    }))

    const { rerender } = render(<ChatPanel sessionId="sess-1" />)
    expect(document.querySelector('[data-message-id="m2"]')).toBeTruthy()

    currentState = idleState({
      runState: 'idle',
      messages: [
        { id: 'm1', role: 'user', content: 'Show me progress', createdAt: '2026-03-01T00:00:00Z' },
        { id: 'm2', role: 'agent', content: ['## Summary', '', '```ts', 'const ready = true', '```'].join('\n'), createdAt: '2026-03-01T00:00:01Z' }
      ]
    })

    rerender(<ChatPanel sessionId="sess-1" />)

    expect(screen.getByRole('status', { name: 'Stopped' })).toBeTruthy()
    expect(document.querySelector('[data-message-id="m2"]')).toBeTruthy()
    expect(document.querySelector('[data-message-bubble-id="m2"]')?.getAttribute('data-render-mode')).toBe('settled')
    expect(screen.getByRole('heading', { name: 'Summary', level: 2 })).toBeTruthy()
  })

  it('renders pasted-context affordances through the real center panel path', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-01T00:00:10Z'))

    mockHook.mockReturnValue({
      state: idleState({
        runState: 'idle',
        messages: [
          {
            id: 'm1',
            role: 'user',
            content: 'Pasted 205 lines\n\nspec text',
            createdAt: '2026-03-01T00:00:00Z'
          }
        ]
      }),
      submitPrompt: vi.fn(),
      retry: vi.fn()
    })

    render(<ChatPanel sessionId={null} />)

    expect(screen.getByText('Just now')).toBeTruthy()
    expect(screen.getByText('Pasted 205 lines')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Dismiss message' })).toBeTruthy()
    expect(screen.getByRole('status', { name: 'Stopped' })).toBeTruthy()

    vi.useRealTimers()
  })

  it('removes dismissed pasted-context messages from the rendered conversation list', () => {
    mockHook.mockReturnValue({
      state: idleState({
        runState: 'idle',
        messages: [
          {
            id: 'm1',
            role: 'user',
            content: 'Pasted 205 lines\n\nspec text',
            createdAt: '2026-03-01T00:00:00Z'
          }
        ]
      }),
      submitPrompt: vi.fn(),
      retry: vi.fn()
    })

    render(<ChatPanel sessionId={null} />)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss message' }))

    expect(screen.queryByText('spec text')).toBeNull()
    expect(document.querySelector('[data-message-id="m1"]')).toBeNull()
  })

  it('passes sessionId to useIpcSessionConversation', () => {
    mockHook.mockReturnValue({
      state: idleState(),
      submitPrompt: vi.fn(),
      retry: vi.fn(),
    })

    render(<ChatPanel sessionId="sess-42" />)

    expect(mockHook).toHaveBeenCalledWith('sess-42', null)
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

  it('calls onTaskActivitySnapshotChange when task activity snapshot changes', () => {
    const onTaskActivitySnapshotChange = vi.fn()
    const initialState = idleState({ taskActivitySnapshot: undefined })
    const nextState = idleState({
      taskActivitySnapshot: {
        sessionId: 's-1',
        runId: 'run-1',
        items: [],
        counts: { not_started: 0, in_progress: 1, blocked: 0, complete: 0 }
      }
    })

    let currentState = initialState
    mockHook.mockImplementation(() => ({
      state: currentState,
      submitPrompt: vi.fn(),
      retry: vi.fn()
    }))

    const { rerender } = render(
      <ChatPanel
        sessionId="sess-42"
        onTaskActivitySnapshotChange={onTaskActivitySnapshotChange}
      />
    )

    currentState = nextState
    rerender(
      <ChatPanel
        sessionId="sess-42"
        onTaskActivitySnapshotChange={onTaskActivitySnapshotChange}
      />
    )

    expect(onTaskActivitySnapshotChange).toHaveBeenCalledWith(undefined)
    expect(onTaskActivitySnapshotChange).toHaveBeenCalledWith(nextState.taskActivitySnapshot)
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

    render(<ChatPanel sessionId="sess-1" />)

    expect(screen.getByText('Hello world')).toBeTruthy()
    expect(screen.getByText('Hi there')).toBeTruthy()
    expect(document.querySelector('[data-message-id="m1"]')).toBeTruthy()
    expect(document.querySelector('[data-message-id="m2"]')).toBeTruthy()
  })

  it('submitting a message calls submitPrompt from the hook', () => {
    const submitPrompt = vi.fn()
    const currentModel = {
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-6-20250514',
      name: 'Claude Sonnet 4.6',
      authStatus: 'api_key'
    }
    mockModelHook.mockReturnValue({
      models: [currentModel],

      currentModel,
      isHydrated: true,
      setCurrentModel: vi.fn()
    })
    mockHook.mockReturnValue({
      state: idleState({ runState: 'empty' }),
      submitPrompt,
      retry: vi.fn(),
    })

    render(<ChatPanel sessionId="sess-1" />)

    fireEvent.change(screen.getByLabelText('Message input'), {
      target: { value: 'Build feature X' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(submitPrompt).toHaveBeenCalledWith('Build feature X', currentModel)
  })

  it('disables the chat composer when no sessionId is available yet', () => {
    const submitPrompt = vi.fn()
    mockHook.mockReturnValue({
      state: idleState({ runState: 'empty' }),
      submitPrompt,
      retry: vi.fn(),
    })

    render(<ChatPanel sessionId={null} />)

    const input = screen.getByLabelText('Message input') as HTMLTextAreaElement
    const sendButton = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement

    expect(input.disabled).toBe(true)
    expect(sendButton.disabled).toBe(true)
  })

  it('disables the chat composer while model selection is still hydrating', () => {
    const submitPrompt = vi.fn()
    mockModelHook.mockReturnValue({
      models: [],

      currentModel: null,
      isHydrated: false,
      setCurrentModel: vi.fn()
    })
    mockHook.mockReturnValue({
      state: idleState({ runState: 'empty' }),
      submitPrompt,
      retry: vi.fn()
    })

    render(<ChatPanel sessionId="sess-1" />)

    const input = screen.getByLabelText('Message input') as HTMLTextAreaElement
    const sendButton = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement

    expect(input.disabled).toBe(true)
    expect(sendButton.disabled).toBe(true)
  })

  it('error state shows retry button that calls retry from the hook', () => {
    const retry = vi.fn()
    const currentModel = {
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-6-20250514',
      name: 'Claude Sonnet 4.6',
      authStatus: 'api_key'
    }
    mockModelHook.mockReturnValue({
      models: [currentModel],

      currentModel,
      isHydrated: true,
      setCurrentModel: vi.fn()
    })
    mockHook.mockReturnValue({
      state: idleState({ runState: 'error', errorMessage: 'Something broke' }),
      submitPrompt: vi.fn(),
      retry,
    })

    render(<ChatPanel sessionId="sess-1" />)

    expect(screen.getByText('Error')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(retry).toHaveBeenCalledWith(currentModel)
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

  it('renders the selector model label from the session model hook', () => {
    mockModelHook.mockReturnValue({
      models: [
        {
          provider: 'anthropic',
          modelId: 'claude-sonnet-4-6-20250514',
          name: 'Claude Sonnet 4.6',
          authStatus: 'api_key'
        }
      ],

      currentModel: {
        provider: 'anthropic',
        modelId: 'claude-sonnet-4-6-20250514',
        name: 'Claude Sonnet 4.6',
        authStatus: 'api_key'
      },
      isHydrated: true,
      setCurrentModel: vi.fn()
    })
    mockHook.mockReturnValue({
      state: idleState({ runState: 'empty' }),
      submitPrompt: vi.fn(),
      retry: vi.fn()
    })

    render(<ChatPanel sessionId="session-1" />)

    expect(screen.getByText('Claude Sonnet 4.6')).toBeTruthy()
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
    const currentModel = {
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-6-20250514',
      name: 'Claude Sonnet 4.6',
      authStatus: 'api_key'
    }
    mockModelHook.mockReturnValue({
      models: [currentModel],

      currentModel,
      isHydrated: true,
      setCurrentModel: vi.fn()
    })
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

    expect(submitPrompt).toHaveBeenCalledWith(
      'Approve the plan and continue with this tech stack.',
      currentModel
    )
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

  it('disables inline decision actions while model selection is still hydrating', () => {
    const submitPrompt = vi.fn()
    mockModelHook.mockReturnValue({
      models: [],

      currentModel: null,
      isHydrated: false,
      setCurrentModel: vi.fn()
    })
    mockHook.mockReturnValue({
      state: idleState({
        messages: [
          { id: 'm1', role: 'agent', content: decisionProposal, createdAt: '2026-03-01T00:00:01Z' }
        ]
      }),
      submitPrompt,
      retry: vi.fn()
    })

    render(<ChatPanel sessionId="sess-1" />)

    const approveButton = screen.getByRole('button', { name: 'Approve the plan...' }) as HTMLButtonElement
    expect(approveButton.disabled).toBe(true)
    fireEvent.click(approveButton)
    expect(submitPrompt).not.toHaveBeenCalled()
  })

  it('renders decision actions only for the decision message, not for plain messages', () => {
    mockHook.mockReturnValue({
      state: idleState({
        messages: [
          { id: 'm1', role: 'agent', content: decisionProposal, createdAt: '2026-03-01T00:00:01Z' },
          { id: 'm2', role: 'agent', content: 'Hello, how can I help?', createdAt: '2026-03-01T00:00:02Z' },
        ],
      }),
      submitPrompt: vi.fn(),
      retry: vi.fn(),
    })

    render(<ChatPanel sessionId={null} />)

    const approveButtons = screen.getAllByRole('button', { name: 'Approve the plan...' })
    expect(approveButtons).toHaveLength(1)

    const keepButtons = screen.getAllByRole('button', { name: 'Keep the last switch...' })
    expect(keepButtons).toHaveLength(1)

    const clarifyButtons = screen.getAllByRole('button', { name: 'Clarifications' })
    expect(clarifyButtons).toHaveLength(1)
  })

  it('publishes derived conversation entries when messages change', () => {
    const onConversationEntriesChange = vi.fn()
    mockHook.mockReturnValue({
      state: idleState({
        messages: [
          {
            id: 'm1',
            role: 'agent',
            content: '## Spec Updated\n\nAdded tasks',
            createdAt: '2026-03-03T10:00:00Z'
          }
        ]
      }),
      submitPrompt: vi.fn(),
      retry: vi.fn()
    })

    render(
      <ChatPanel
        sessionId={null}
        onConversationEntriesChange={onConversationEntriesChange}
      />
    )

    expect(onConversationEntriesChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'entry-m1',
        messageId: 'm1',
        label: 'Spec Updated',
        role: 'agent'
      })
    ])
  })

  it('registers a jump handler from MessageList when callback is provided', () => {
    const onRegisterScrollToMessage = vi.fn()
    mockHook.mockReturnValue({
      state: idleState(),
      submitPrompt: vi.fn(),
      retry: vi.fn()
    })

    render(
      <ChatPanel
        sessionId={null}
        onRegisterScrollToMessage={onRegisterScrollToMessage}
      />
    )

    expect(onRegisterScrollToMessage).toHaveBeenCalledWith(expect.any(Function))
  })

  it('catches and logs model change persistence failures without crashing', async () => {
    const persistenceError = new Error('IPC write failed')
    const setCurrentModel = vi.fn().mockRejectedValue(persistenceError)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const currentModel = {
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-6-20250514',
      name: 'Claude Sonnet 4.6',
      authStatus: 'api_key'
    }
    const alternateModel = {
      provider: 'openai',
      modelId: 'gpt-5.3',
      name: 'GPT 5.3',
      authStatus: 'api_key'
    }
    mockModelHook.mockReturnValue({
      models: [currentModel, alternateModel],
      session: null,
      currentModel,
      isHydrated: true,
      setCurrentModel
    })
    mockHook.mockReturnValue({
      state: idleState({ runState: 'empty' }),
      submitPrompt: vi.fn(),
      retry: vi.fn()
    })

    render(<ChatPanel sessionId="sess-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Claude Sonnet 4.6' }))
    fireEvent.click(screen.getByText('GPT 5.3'))

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ChatPanel] Failed to persist session model selection:',
        persistenceError
      )
    })

    consoleSpy.mockRestore()
  })
})
