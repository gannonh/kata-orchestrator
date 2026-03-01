// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

const { mockRandomBytes } = vi.hoisted(() => ({
  mockRandomBytes: vi.fn()
}))

vi.mock('node:crypto', async () => {
  const actual = await vi.importActual<typeof import('node:crypto')>('node:crypto')
  return {
    ...actual,
    randomBytes: mockRandomBytes
  }
})

import { resolveSpaceName } from '../../../src/main/space-name'

describe('resolveSpaceName collision fallback', () => {
  it('falls back to a unique 6-char id after repeated collisions', () => {
    let sixCharCallCount = 0
    // All 4-byte calls return [0,0,0,0] -> generates 'aaaa' and collides.
    // First 6-byte fallback call returns [1,...] -> 'bbbbbb' and collides.
    // Second 6-byte fallback call returns [2,...] -> 'cccccc' and should succeed.
    mockRandomBytes.mockImplementation((length: number) => {
      if (length === 4) {
        return Buffer.from([0, 0, 0, 0])
      }
      sixCharCallCount += 1
      if (sixCharCallCount === 1) {
        return Buffer.from([1, 1, 1, 1, 1, 1])
      }
      return Buffer.from([2, 2, 2, 2, 2, 2])
    })

    const existingNames = new Set(['repo-aaaa', 'repo-bbbbbb'])
    const name = resolveSpaceName({ repoLabel: 'repo', existingNames })

    expect(name).toBe('repo-cccccc')
  })
})
