// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

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

import { generateShortId, resolveSpaceName } from '../../../src/main/space-name'

describe('generateShortId', () => {
  beforeEach(() => {
    mockRandomBytes.mockReset()
  })

  it('returns a 4-character lowercase alphanumeric string', () => {
    mockRandomBytes.mockReturnValue(Buffer.from([0, 1, 2, 3]))
    const id = generateShortId()
    expect(id).toMatch(/^[a-z0-9]{4}$/)
  })

  it('produces different values on successive calls', () => {
    mockRandomBytes
      .mockReturnValueOnce(Buffer.from([0, 0, 0, 0]))
      .mockReturnValueOnce(Buffer.from([1, 1, 1, 1]))

    const ids = new Set([generateShortId(), generateShortId()])
    expect(ids.size).toBe(2)
  })
})

describe('resolveSpaceName (nanoid)', () => {
  beforeEach(() => {
    mockRandomBytes.mockReset()
  })

  it('generates repoLabel-shortId format', () => {
    mockRandomBytes.mockReturnValue(Buffer.from([0, 1, 2, 3]))
    const name = resolveSpaceName({ repoLabel: 'kata-cloud', existingNames: new Set() })
    expect(name).toMatch(/^kata-cloud-[a-z0-9]{4}$/)
  })

  it('retries on collision', () => {
    mockRandomBytes
      .mockReturnValueOnce(Buffer.from([0, 0, 0, 0])) // aaaa
      .mockReturnValueOnce(Buffer.from([0, 0, 0, 1])) // aaab

    const existingNames = new Set(['repo-aaaa'])
    const name = resolveSpaceName({ repoLabel: 'repo', existingNames })
    expect(name).toBe('repo-aaab')
  })

  it('uses safe repo label for blank input', () => {
    mockRandomBytes.mockReturnValue(Buffer.from([0, 1, 2, 3]))
    const name = resolveSpaceName({ repoLabel: '  ', existingNames: new Set() })
    expect(name).toMatch(/^repo-[a-z0-9]{4}$/)
  })
})
