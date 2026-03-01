// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { generateShortId, resolveSpaceName } from '../../../src/main/space-name'

describe('generateShortId', () => {
  it('returns a 4-character lowercase alphanumeric string', () => {
    const id = generateShortId()
    expect(id).toMatch(/^[a-z0-9]{4}$/)
  })

  it('produces different values on successive calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateShortId()))
    expect(ids.size).toBeGreaterThan(1)
  })
})

describe('resolveSpaceName (nanoid)', () => {
  it('generates repoLabel-shortId format', () => {
    const name = resolveSpaceName({ repoLabel: 'kata-cloud', existingNames: new Set() })
    expect(name).toMatch(/^kata-cloud-[a-z0-9]{4}$/)
  })

  it('retries on collision', () => {
    const name = resolveSpaceName({ repoLabel: 'repo', existingNames: new Set() })
    expect(name).toMatch(/^repo-[a-z0-9]{4}$/)
  })

  it('uses safe repo label for blank input', () => {
    const name = resolveSpaceName({ repoLabel: '  ', existingNames: new Set() })
    expect(name).toMatch(/^repo-[a-z0-9]{4}$/)
  })
})
