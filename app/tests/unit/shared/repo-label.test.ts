import { describe, expect, it } from 'vitest'

import { extractRepoLabel } from '../../../src/shared/repo-label'

describe('extractRepoLabel', () => {
  it('extracts repo name from HTTPS URL', () => {
    expect(extractRepoLabel('https://github.com/org/my-repo')).toBe('my-repo')
  })

  it('strips trailing slashes and .git suffix', () => {
    expect(extractRepoLabel('https://github.com/org/my-repo.git')).toBe('my-repo')
    expect(extractRepoLabel('https://github.com/org/my-repo/')).toBe('my-repo')
    expect(extractRepoLabel('https://github.com/org/my-repo.GIT/')).toBe('my-repo')
  })

  it('extracts repo name from SSH-style URL', () => {
    expect(extractRepoLabel('git@github.com:org/my-repo')).toBe('my-repo')
  })

  it('falls back to "repo" for empty or root-only input', () => {
    expect(extractRepoLabel('')).toBe('repo')
  })
})
