import { describe, expect, it } from 'vitest'

import {
  createInitialSessionConversationState,
  sessionConversationReducer
} from '../../../../src/renderer/components/center/sessionConversationState'

describe('sessionConversationReducer', () => {
  it('empty -> pending and appends user message on SUBMIT_PROMPT', () => {
    const initialState = createInitialSessionConversationState()

    const nextState = sessionConversationReducer(initialState, {
      type: 'SUBMIT_PROMPT',
      prompt: 'Plan phase 2'
    })

    expect(nextState.runState).toBe('pending')
    expect(nextState.errorMessage).toBeUndefined()
    expect(nextState.messages).toEqual([
      {
        id: 'user-1',
        role: 'user',
        content: 'Plan phase 2',
        createdAt: '1970-01-01T00:00:01.000Z'
      }
    ])
  })

  it('pending -> idle and appends agent message on RUN_SUCCEEDED', () => {
    const pendingState = sessionConversationReducer(createInitialSessionConversationState(), {
      type: 'SUBMIT_PROMPT',
      prompt: 'Plan phase 2'
    })

    const nextState = sessionConversationReducer(pendingState, {
      type: 'RUN_SUCCEEDED',
      response: 'Draft complete.'
    })

    expect(nextState.runState).toBe('idle')
    expect(nextState.errorMessage).toBeUndefined()
    expect(nextState.messages).toEqual([
      {
        id: 'user-1',
        role: 'user',
        content: 'Plan phase 2',
        createdAt: '1970-01-01T00:00:01.000Z'
      },
      {
        id: 'agent-2',
        role: 'agent',
        content: 'Draft complete.',
        createdAt: '1970-01-01T00:00:02.000Z'
      }
    ])
  })

  it('keeps pending state and appends an agent message on RUN_STREAM_UPDATED', () => {
    const pendingState = sessionConversationReducer(createInitialSessionConversationState(), {
      type: 'SUBMIT_PROMPT',
      prompt: 'Plan phase 2'
    })

    const nextState = sessionConversationReducer(pendingState, {
      type: 'RUN_STREAM_UPDATED',
      response: 'Draft'
    })

    expect(nextState.runState).toBe('pending')
    expect(nextState.messages).toEqual([
      {
        id: 'user-1',
        role: 'user',
        content: 'Plan phase 2',
        createdAt: '1970-01-01T00:00:01.000Z'
      },
      {
        id: 'agent-2',
        role: 'agent',
        content: 'Draft',
        createdAt: '1970-01-01T00:00:02.000Z'
      }
    ])
  })

  it('updates the existing streamed agent message and avoids duplicate append on RUN_SUCCEEDED', () => {
    const pendingState = sessionConversationReducer(createInitialSessionConversationState(), {
      type: 'SUBMIT_PROMPT',
      prompt: 'Plan phase 2'
    })
    const streamingState = sessionConversationReducer(pendingState, {
      type: 'RUN_STREAM_UPDATED',
      response: 'Draft'
    })
    const updatedStreamingState = sessionConversationReducer(streamingState, {
      type: 'RUN_STREAM_UPDATED',
      response: 'Draft complete'
    })

    expect(updatedStreamingState.messages).toHaveLength(2)
    expect(updatedStreamingState.messages[1]?.content).toBe('Draft complete')

    const nextState = sessionConversationReducer(updatedStreamingState, {
      type: 'RUN_SUCCEEDED',
      response: 'Draft complete.'
    })

    expect(nextState.runState).toBe('idle')
    expect(nextState.messages).toHaveLength(2)
    expect(nextState.messages[1]?.content).toBe('Draft complete.')
  })

  it('pending -> idle without appending messages on RUN_COMPLETED', () => {
    const pendingState = sessionConversationReducer(createInitialSessionConversationState(), {
      type: 'SUBMIT_PROMPT',
      prompt: 'Plan phase 2'
    })

    const nextState = sessionConversationReducer(pendingState, {
      type: 'RUN_COMPLETED'
    })

    expect(nextState.runState).toBe('idle')
    expect(nextState.errorMessage).toBeUndefined()
    expect(nextState.messages).toEqual([
      {
        id: 'user-1',
        role: 'user',
        content: 'Plan phase 2',
        createdAt: '1970-01-01T00:00:01.000Z'
      }
    ])
  })

  it('ignores RUN_COMPLETED when state is not pending', () => {
    const initialState = createInitialSessionConversationState()

    const nextState = sessionConversationReducer(initialState, {
      type: 'RUN_COMPLETED'
    })

    expect(nextState).toBe(initialState)
  })

  it('pending -> error and stores errorMessage on RUN_FAILED', () => {
    const pendingState = sessionConversationReducer(createInitialSessionConversationState(), {
      type: 'SUBMIT_PROMPT',
      prompt: 'Plan phase 2'
    })

    const nextState = sessionConversationReducer(pendingState, {
      type: 'RUN_FAILED',
      error: 'Network timeout'
    })

    expect(nextState.runState).toBe('error')
    expect(nextState.errorMessage).toBe('Network timeout')
    expect(nextState.messages).toEqual([
      {
        id: 'user-1',
        role: 'user',
        content: 'Plan phase 2',
        createdAt: '1970-01-01T00:00:01.000Z'
      }
    ])
  })

  it('error -> pending and clears errorMessage on RETRY_FROM_ERROR', () => {
    const errorState = sessionConversationReducer(
      sessionConversationReducer(createInitialSessionConversationState(), {
        type: 'SUBMIT_PROMPT',
        prompt: 'Plan phase 2'
      }),
      {
        type: 'RUN_FAILED',
        error: 'Network timeout'
      }
    )

    const nextState = sessionConversationReducer(errorState, {
      type: 'RETRY_FROM_ERROR'
    })

    expect(nextState.runState).toBe('pending')
    expect(nextState.errorMessage).toBeUndefined()
    expect(nextState.messages).toEqual([
      {
        id: 'user-1',
        role: 'user',
        content: 'Plan phase 2',
        createdAt: '1970-01-01T00:00:01.000Z'
      }
    ])
  })

  it('ignores RETRY_FROM_ERROR when state is not error', () => {
    const pendingState = sessionConversationReducer(createInitialSessionConversationState(), {
      type: 'SUBMIT_PROMPT',
      prompt: 'Plan phase 2'
    })

    const nextState = sessionConversationReducer(pendingState, {
      type: 'RETRY_FROM_ERROR'
    })

    expect(nextState).toBe(pendingState)
  })

  it('ignores RUN_SUCCEEDED when state is not pending', () => {
    const initialState = createInitialSessionConversationState()

    const nextState = sessionConversationReducer(initialState, {
      type: 'RUN_SUCCEEDED',
      response: 'Draft complete.'
    })

    expect(nextState).toBe(initialState)
  })

  it('ignores RUN_STREAM_UPDATED when state is not pending', () => {
    const initialState = createInitialSessionConversationState()

    const nextState = sessionConversationReducer(initialState, {
      type: 'RUN_STREAM_UPDATED',
      response: 'Draft'
    })

    expect(nextState).toBe(initialState)
  })

  it('ignores RUN_FAILED when state is not pending', () => {
    const initialState = createInitialSessionConversationState()

    const nextState = sessionConversationReducer(initialState, {
      type: 'RUN_FAILED',
      error: 'Network timeout'
    })

    expect(nextState).toBe(initialState)
  })

  it('ignores duplicate RUN_SUCCEEDED after state returns to idle', () => {
    const idleState = sessionConversationReducer(
      sessionConversationReducer(createInitialSessionConversationState(), {
        type: 'SUBMIT_PROMPT',
        prompt: 'Plan phase 2'
      }),
      {
        type: 'RUN_SUCCEEDED',
        response: 'Draft complete.'
      }
    )

    const nextState = sessionConversationReducer(idleState, {
      type: 'RUN_SUCCEEDED',
      response: 'Second response should be ignored.'
    })

    expect(nextState).toBe(idleState)
  })

  it('ignores SUBMIT_PROMPT from error because retry has an explicit event', () => {
    const errorState = sessionConversationReducer(
      sessionConversationReducer(createInitialSessionConversationState(), {
        type: 'SUBMIT_PROMPT',
        prompt: 'Plan phase 2'
      }),
      {
        type: 'RUN_FAILED',
        error: 'Network timeout'
      }
    )

    const nextState = sessionConversationReducer(errorState, {
      type: 'SUBMIT_PROMPT',
      prompt: 'Retry this prompt'
    })

    expect(nextState).toBe(errorState)
  })

  it('resets to initial state on RESET_CONVERSATION', () => {
    const errorState = sessionConversationReducer(
      sessionConversationReducer(createInitialSessionConversationState(), {
        type: 'SUBMIT_PROMPT',
        prompt: 'Plan phase 2'
      }),
      {
        type: 'RUN_FAILED',
        error: 'Network timeout'
      }
    )

    expect(errorState.runState).toBe('error')

    const nextState = sessionConversationReducer(errorState, {
      type: 'RESET_CONVERSATION'
    })

    expect(nextState.runState).toBe('empty')
    expect(nextState.messages).toEqual([])
    expect(nextState.errorMessage).toBeUndefined()
  })

  it('appends externally supplied messages without rewriting id or timestamp', () => {
    const initialState = createInitialSessionConversationState()

    const withUserPrompt = sessionConversationReducer(initialState, {
      type: 'SUBMIT_PROMPT',
      prompt: 'Plan phase 2'
    })

    const persistedMessage = {
      id: 'agent-msg-42',
      role: 'agent' as const,
      content: 'Spec Updated',
      createdAt: '2026-03-03T10:00:00.000Z'
    }

    const nextState = sessionConversationReducer(withUserPrompt, {
      type: 'APPEND_MESSAGE',
      message: persistedMessage
    })

    expect(nextState.messages[nextState.messages.length - 1]).toEqual(persistedMessage)
  })

  it('ignores APPEND_MESSAGE when the message id already exists', () => {
    const withUserPrompt = sessionConversationReducer(createInitialSessionConversationState(), {
      type: 'SUBMIT_PROMPT',
      prompt: 'Plan phase 2'
    })

    const persistedMessage = {
      id: 'agent-msg-42',
      role: 'agent' as const,
      content: 'Spec Updated',
      createdAt: '2026-03-03T10:00:00.000Z'
    }

    const withMessage = sessionConversationReducer(withUserPrompt, {
      type: 'APPEND_MESSAGE',
      message: persistedMessage
    })

    const duplicateAttempt = sessionConversationReducer(withMessage, {
      type: 'APPEND_MESSAGE',
      message: persistedMessage
    })

    expect(duplicateAttempt.messages.filter((message) => message.id === persistedMessage.id)).toHaveLength(1)
  })

  it('updates an existing message by id on UPDATE_MESSAGE', () => {
    const withUserPrompt = sessionConversationReducer(createInitialSessionConversationState(), {
      type: 'SUBMIT_PROMPT',
      prompt: 'Plan phase 2'
    })

    const persistedMessage = {
      id: 'agent-msg-42',
      role: 'agent' as const,
      content: 'Draft',
      createdAt: '2026-03-03T10:00:00.000Z'
    }

    const withMessage = sessionConversationReducer(withUserPrompt, {
      type: 'APPEND_MESSAGE',
      message: persistedMessage
    })

    const updated = sessionConversationReducer(withMessage, {
      type: 'UPDATE_MESSAGE',
      message: {
        ...persistedMessage,
        content: 'Draft complete'
      }
    })

    expect(updated.messages.find((message) => message.id === persistedMessage.id)?.content).toBe('Draft complete')
  })

  it('returns current state when UPDATE_MESSAGE target id is missing', () => {
    const withUserPrompt = sessionConversationReducer(createInitialSessionConversationState(), {
      type: 'SUBMIT_PROMPT',
      prompt: 'Plan phase 2'
    })

    const nextState = sessionConversationReducer(withUserPrompt, {
      type: 'UPDATE_MESSAGE',
      message: {
        id: 'missing-message',
        role: 'agent',
        content: 'No-op update',
        createdAt: '2026-03-03T10:00:00.000Z'
      }
    })

    expect(nextState).toBe(withUserPrompt)
  })

  it('returns current state for unknown events', () => {
    const initialState = createInitialSessionConversationState()

    const nextState = sessionConversationReducer(initialState, {
      type: 'UNKNOWN_EVENT'
    } as unknown as Parameters<typeof sessionConversationReducer>[1])

    expect(nextState).toBe(initialState)
  })
})
