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
})
