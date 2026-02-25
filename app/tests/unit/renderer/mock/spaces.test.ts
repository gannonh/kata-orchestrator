import { describe, expect, it } from 'vitest'

import { toDisplaySpace } from '../../../../src/renderer/mock/spaces'
import type { SpaceRecord } from '../../../../src/shared/types/space'

function makeRecord(repoUrl: string): SpaceRecord {
  return {
    id: 'space-1',
    name: 'Test Space',
    repoUrl,
    rootPath: '/tmp/repo',
    branch: 'main',
    orchestrationMode: 'team',
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'active'
  }
}

describe('toDisplaySpace', () => {
  it('derives owner/repo from https repoUrl with trailing slash', () => {
    const display = toDisplaySpace(makeRecord('https://github.com/gannonh/kata-cloud/'))
    expect(display.repo).toBe('gannonh/kata-cloud')
  })

  it('derives owner/repo from ssh repoUrl with .git suffix', () => {
    const display = toDisplaySpace(makeRecord('git@github.com:gannonh/kata-cloud.git'))
    expect(display.repo).toBe('gannonh/kata-cloud')
  })

  it('returns empty repo for empty repoUrl', () => {
    const display = toDisplaySpace(makeRecord(''))
    expect(display.repo).toBe('')
  })

  it('returns empty repo for invalid one-segment repoUrl', () => {
    const display = toDisplaySpace(makeRecord('not-a-url'))
    expect(display.repo).toBe('')
  })
})
