import { describe, expect, it } from 'vitest'

import {
  buildDefaultSpecArtifact,
  parseSpecArtifactFile,
  serializeSpecArtifactFile
} from '../../../src/main/spec-artifact-service'

describe('spec-artifact-service', () => {
  it('parses valid frontmatter and markdown body', () => {
    const parsed = parseSpecArtifactFile([
      '---',
      'status: drafting',
      'updatedAt: 2026-03-06T19:33:00.000Z',
      'sourceRunId: run-123',
      '---',
      '',
      '## Goal',
      'Ship the file-backed spec.'
    ].join('\n'))

    expect(parsed.frontmatter).toEqual({
      status: 'drafting',
      updatedAt: '2026-03-06T19:33:00.000Z',
      sourceRunId: 'run-123'
    })
    expect(parsed.markdown).toBe(['## Goal', 'Ship the file-backed spec.'].join('\n'))
    expect(parsed.diagnostics).toEqual([])
  })

  it('returns diagnostics for malformed yaml without throwing', () => {
    const parsed = parseSpecArtifactFile('---\nstatus: [bad\n---\n\n## Goal\nBroken')

    expect(parsed.diagnostics[0]?.code).toBe('invalid_frontmatter_yaml')
  })

  it('serializes frontmatter and markdown body', () => {
    expect(
      serializeSpecArtifactFile({
        frontmatter: {
          status: 'ready',
          updatedAt: '2026-03-06T19:33:00.000Z',
          sourceRunId: 'run-123'
        },
        markdown: '## Goal\nShip the file-backed spec.'
      })
    ).toBe(
      [
        '---',
        'status: ready',
        'updatedAt: 2026-03-06T19:33:00.000Z',
        'sourceRunId: run-123',
        '---',
        '',
        '## Goal',
        'Ship the file-backed spec.'
      ].join('\n')
    )
  })

  it('builds a default scaffold with required sections', () => {
    const raw = buildDefaultSpecArtifact('2026-03-06T19:33:00.000Z')

    expect(raw).toContain('status: drafting')
    expect(raw).toContain('## Goal')
    expect(raw).toContain('## Tasks')
  })
})
