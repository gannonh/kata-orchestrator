// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { deriveDefaultSpaceName, ensureUniqueSpaceName, resolveSpaceName } from '../../../src/shared/space-name'

describe('deriveDefaultSpaceName', () => {
  it('uses repo and branch values', () => {
    expect(deriveDefaultSpaceName('kata-cloud', 'main')).toBe('kata-cloud main')
  })

  it('falls back to safe defaults for blank values', () => {
    expect(deriveDefaultSpaceName(' ', '')).toBe('repo main')
  })
})

describe('ensureUniqueSpaceName', () => {
  it('returns base name when not taken', () => {
    expect(ensureUniqueSpaceName('kata-cloud main', new Set())).toBe('kata-cloud main')
  })

  it('adds numeric suffix when base name is taken', () => {
    const taken = new Set(['kata-cloud main', 'kata-cloud main (2)'])
    expect(ensureUniqueSpaceName('kata-cloud main', taken)).toBe('kata-cloud main (3)')
  })
})

describe('resolveSpaceName', () => {
  it('derives default name from repo + branch and applies numeric collision suffixes', () => {
    const taken = new Set(['kata-cloud main', 'kata-cloud main (2)'])
    expect(resolveSpaceName({ repoLabel: 'kata-cloud', branch: 'main', override: '', existingNames: taken }))
      .toBe('kata-cloud main (3)')
  })

  it('prefers explicit override when present', () => {
    expect(resolveSpaceName({
      repoLabel: 'kata-cloud',
      branch: 'main',
      override: 'My custom space',
      existingNames: new Set()
    })).toBe('My custom space')
  })
})
