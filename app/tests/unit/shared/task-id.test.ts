import { describe, expect, it } from 'vitest'

import { toStableTaskId } from '../../../src/shared/task-id'

describe('toStableTaskId', () => {
  it('generates a slug-based id from a title', () => {
    const seenIds = new Map<string, number>()
    expect(toStableTaskId('Build the parser', seenIds)).toBe('task-build-the-parser')
  })

  it('disambiguates duplicate titles with a numeric suffix', () => {
    const seenIds = new Map<string, number>()
    expect(toStableTaskId('Build', seenIds)).toBe('task-build')
    expect(toStableTaskId('Build', seenIds)).toBe('task-build-2')
    expect(toStableTaskId('Build', seenIds)).toBe('task-build-3')
  })

  it('falls back to "task" when title slugifies to an empty string', () => {
    const seenIds = new Map<string, number>()
    expect(toStableTaskId('---', seenIds)).toBe('task-task')
    expect(toStableTaskId('!!!', seenIds)).toBe('task-task-2')
  })
})
