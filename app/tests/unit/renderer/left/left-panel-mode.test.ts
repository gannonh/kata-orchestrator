import { describe, expect, it } from 'vitest'

import { resolveLeftPanelMode } from '../../../../src/renderer/components/left/left-panel-mode'

describe('resolveLeftPanelMode', () => {
  it('resolves coordinator mode when no task activity snapshot is present', () => {
    expect(resolveLeftPanelMode({ taskActivitySnapshot: undefined })).toBe('coordinator')
  })

  it('resolves build mode when a task activity snapshot is present', () => {
    expect(
      resolveLeftPanelMode({
        taskActivitySnapshot: {
          sessionId: 'session-1',
          runId: 'run-1',
          items: [],
          counts: {
            not_started: 0,
            in_progress: 0,
            blocked: 0,
            complete: 0
          }
        }
      })
    ).toBe('build')
  })
})
