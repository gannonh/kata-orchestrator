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
      message: {
        id: 'u-1',
        role: 'user',
        content: 'Plan phase 2',
        createdAt: '2026-03-01T10:00:00.000Z'
      }
    })

    expect(nextState.runState).toBe('pending')
    expect(nextState.errorMessage).toBeUndefined()
    expect(nextState.messages).toEqual([
      {
        id: 'u-1',
        role: 'user',
        content: 'Plan phase 2',
        createdAt: '2026-03-01T10:00:00.000Z'
      }
    ])
  })

  it('pending -> idle and appends agent message on RUN_SUCCEEDED', () => {
    const pendingState = sessionConversationReducer(createInitialSessionConversationState(), {
      type: 'SUBMIT_PROMPT',
      message: {
        id: 'u-1',
        role: 'user',
        content: 'Plan phase 2',
        createdAt: '2026-03-01T10:00:00.000Z'
      }
    })

    const nextState = sessionConversationReducer(pendingState, {
      type: 'RUN_SUCCEEDED',
      message: {
        id: 'a-1',
        role: 'agent',
        content: 'Draft complete.',
        createdAt: '2026-03-01T10:00:01.000Z'
      }
    })

    expect(nextState.runState).toBe('idle')
    expect(nextState.errorMessage).toBeUndefined()
    expect(nextState.messages).toEqual([
      {
        id: 'u-1',
        role: 'user',
        content: 'Plan phase 2',
        createdAt: '2026-03-01T10:00:00.000Z'
      },
      {
        id: 'a-1',
        role: 'agent',
        content: 'Draft complete.',
        createdAt: '2026-03-01T10:00:01.000Z'
      }
    ])
  })

  it('pending -> error and stores errorMessage on RUN_FAILED', () => {
    const pendingState = sessionConversationReducer(createInitialSessionConversationState(), {
      type: 'SUBMIT_PROMPT',
      message: {
        id: 'u-1',
        role: 'user',
        content: 'Plan phase 2',
        createdAt: '2026-03-01T10:00:00.000Z'
      }
    })

    const nextState = sessionConversationReducer(pendingState, {
      type: 'RUN_FAILED',
      errorMessage: 'Network timeout'
    })

    expect(nextState.runState).toBe('error')
    expect(nextState.errorMessage).toBe('Network timeout')
    expect(nextState.messages).toEqual([
      {
        id: 'u-1',
        role: 'user',
        content: 'Plan phase 2',
        createdAt: '2026-03-01T10:00:00.000Z'
      }
    ])
  })
})
