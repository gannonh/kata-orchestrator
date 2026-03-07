import { describe, expect, it } from 'vitest'

import {
  buildSpecArtifactPath,
  buildDefaultSpecArtifact,
  parseSpecArtifactFile,
  serializeSpecArtifactFile
} from '../../../src/main/spec-artifact-service'

describe('spec-artifact-service', () => {
  it('builds the canonical session-scoped spec artifact path', () => {
    expect(buildSpecArtifactPath('/tmp/repo', 'session-123')).toBe(
      '/tmp/repo/.kata/sessions/session-123/notes/spec.md'
    )
  })

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

  it('returns diagnostics for invalid frontmatter shape without throwing', () => {
    const parsed = parseSpecArtifactFile(
      '---\nstatus: drafting\nupdatedAt: 2026-03-06T19:33:00.000Z\nextra: nope\n---\n\n## Goal\nBroken'
    )

    expect(parsed.diagnostics[0]?.code).toBe('invalid_frontmatter_shape')
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

  it('accepts a closing frontmatter delimiter at EOF with no trailing content', () => {
    const parsed = parseSpecArtifactFile(
      '---\nstatus: drafting\nupdatedAt: 2026-03-06T19:33:00.000Z\n---'
    )

    expect(parsed.frontmatter).toEqual({
      status: 'drafting',
      updatedAt: '2026-03-06T19:33:00.000Z'
    })
    expect(parsed.markdown).toBe('')
    expect(parsed.diagnostics).toEqual([])
  })

  it('builds a default scaffold with required sections', () => {
    const raw = buildDefaultSpecArtifact('2026-03-06T19:33:00.000Z')

    expect(raw).toContain('status: drafting')
    expect(raw).toContain('## Goal')
    expect(raw).toContain('## Tasks')
  })
})
