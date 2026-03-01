import { describe, expect, it } from 'vitest'

import type {
  SessionRuntimeAdapter,
  SessionRuntimeEvent
} from '../../../../src/renderer/types/session-runtime-adapter'

describe('SessionRuntimeAdapter contract', () => {
  it('is defined in an importable runtime module', async () => {
    await expect(import('../../../../src/renderer/types/session-runtime-adapter')).resolves.toBeDefined()
  })

  it('enforces subscribe, submitPrompt, and retry signatures', () => {
    const subscribe: SessionRuntimeAdapter['subscribe'] = (
      onEvent: (event: SessionRuntimeEvent) => void
    ) => {
      onEvent({
        type: 'run_state_changed',
        runState: 'pending'
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

      return () => {}
    }

    const submitPrompt: SessionRuntimeAdapter['submitPrompt'] = (prompt: string) => {
      const normalizedPrompt: string = prompt
      void normalizedPrompt
    }

    const retry: SessionRuntimeAdapter['retry'] = () => Promise.resolve()

    const adapter: SessionRuntimeAdapter = {
      subscribe,
      submitPrompt,
      retry
    }

    const submitResult: Promise<void> | void = adapter.submitPrompt('Plan phase 2')
    const retryResult: Promise<void> | void = adapter.retry()
    const unsubscribe: () => void = adapter.subscribe((event: SessionRuntimeEvent) => {
      expect(['run_state_changed', 'message_appended']).toContain(event.type)
    })

    void submitResult
    void retryResult
    unsubscribe()

    const runtimeAdapter = adapter as Record<string, unknown>
    expect(typeof runtimeAdapter.subscribe).toBe('function')
    expect(typeof runtimeAdapter.submitPrompt).toBe('function')
    expect(typeof runtimeAdapter.retry).toBe('function')
  })
})
