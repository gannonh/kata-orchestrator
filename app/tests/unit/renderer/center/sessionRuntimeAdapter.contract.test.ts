import { describe, expect, it } from 'vitest'

import type {
  SessionRuntimeAdapter,
  SessionRuntimeEvent
} from '../../../../src/renderer/types/session-runtime-adapter'

describe('SessionRuntimeAdapter contract', () => {
  it('is defined in an importable runtime module', async () => {
    await expect(import('../../../../src/renderer/types/session-runtime-adapter')).resolves.toBeDefined()
  })

  it('enforces runtime execution checks for subscribe, submitPrompt, and retry', () => {
    let unsubscribed = false
    const receivedEvents: SessionRuntimeEvent[] = []

    const subscribe: SessionRuntimeAdapter['subscribe'] = (
      onEvent: (event: SessionRuntimeEvent) => void
    ) => {
      onEvent({
        type: 'run_state_changed',
        runState: 'pending'
      })
      onEvent({
        type: 'run_state_changed',
        runState: 'error',
        errorMessage: 'Network timeout'
      })
      onEvent({
        type: 'message_appended',
        message: {
          id: 'agent-1',
          role: 'agent',
          content: 'hello',
          createdAt: '1970-01-01T00:00:01.000Z'
        }
      })

      return () => {
        unsubscribed = true
      }
    }

    const submitPrompt: SessionRuntimeAdapter['submitPrompt'] = (prompt: string) => {
      expect(typeof prompt).toBe('string')
    }

    const retry: SessionRuntimeAdapter['retry'] = () => Promise.resolve()

    const adapter: SessionRuntimeAdapter = {
      subscribe,
      submitPrompt,
      retry
    }

    expect(adapter.subscribe.length).toBe(1)
    expect(adapter.submitPrompt.length).toBe(1)
    expect(adapter.retry.length).toBe(0)

    const submitResult: Promise<void> | void = adapter.submitPrompt('Plan phase 2')
    const retryResult: Promise<void> | void = adapter.retry()
    const unsubscribe: () => void = adapter.subscribe((event: SessionRuntimeEvent) => {
      receivedEvents.push(event)
    })

    expect(submitResult === undefined || submitResult instanceof Promise).toBe(true)
    expect(retryResult === undefined || retryResult instanceof Promise).toBe(true)
    expect(typeof unsubscribe).toBe('function')

    expect(receivedEvents.map((event) => event.type)).toEqual([
      'run_state_changed',
      'run_state_changed',
      'message_appended'
    ])

    for (const event of receivedEvents) {
      if (event.type !== 'run_state_changed') {
        continue
      }

      if (event.runState === 'error') {
        expect(event.errorMessage).toBeTypeOf('string')
      } else {
        expect('errorMessage' in event).toBe(false)
      }
    }

    unsubscribe()
    expect(unsubscribed).toBe(true)
  })
})
