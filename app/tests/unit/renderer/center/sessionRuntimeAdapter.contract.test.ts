import { describe, expect, it } from 'vitest'

import type SessionRuntimeAdapter from '../../../../src/renderer/types/session-runtime-adapter'

describe('SessionRuntimeAdapter contract', () => {
  it('is defined in an importable runtime module', async () => {
    await expect(import('../../../../src/renderer/types/session-runtime-adapter')).resolves.toBeDefined()
  })

  it('requires subscribe, submitPrompt, and retry functions', () => {
    const candidate = {
      subscribe: () => () => {},
      submitPrompt: () => {},
      retry: () => {}
    } satisfies SessionRuntimeAdapter

    const adapter = candidate as SessionRuntimeAdapter as Record<string, unknown>

    expect(typeof adapter.subscribe).toBe('function')
    expect(typeof adapter.submitPrompt).toBe('function')
    expect(typeof adapter.retry).toBe('function')
  })
})
