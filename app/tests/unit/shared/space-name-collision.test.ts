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
  it('falls back to 6-char id after 10 collisions', () => {
    // Make randomBytes return deterministic values:
    // All 4-byte calls return [0,0,0,0] -> generates 'aaaa'
    // The final 6-byte call returns [1,1,1,1,1,1] -> generates 'bbbbbb'
    mockRandomBytes.mockImplementation((length: number) => {
      if (length === 4) {
        return Buffer.from([0, 0, 0, 0])
      }
      return Buffer.from([1, 1, 1, 1, 1, 1])
    })

    const existingNames = new Set(['repo-aaaa'])
    const name = resolveSpaceName({ repoLabel: 'repo', existingNames })

    expect(name).toBe('repo-bbbbbb')
  })
})
