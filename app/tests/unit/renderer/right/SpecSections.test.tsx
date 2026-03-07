import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SpecSections } from '../../../../src/renderer/components/right/SpecSections'

const markdownFixture = [
  '# Spec Title',
  '',
  '## Goal',
  'Publish a clear `spec` surface.',
  '',
  '## Tasks',
  '- [ ] Keep task pointers as markdown'
].join('\n')

const baseDocument = {
  sourcePath: '/tmp/repo/.kata/sessions/session-1/notes/spec.md',
  raw: markdownFixture,
  markdown: markdownFixture,
  visibleMarkdown: markdownFixture,
  status: 'drafting' as const,
  diagnostics: [],
  updatedAt: '2026-03-04T00:00:00.000Z'
}

describe('SpecSections', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the markdown document itself instead of structured section cards', () => {
    render(
      <SpecSections
        document={baseDocument as any}
        onEditMarkdown={vi.fn()}
        commentStatusNote="Auto-saved"
      />
    )

    expect(screen.getByRole('heading', { name: 'Spec Title', level: 1 })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Goal', level: 2 })).toBeTruthy()
    expect(screen.getByText((_, node) => node?.textContent === 'Publish a clear spec surface.')).toBeTruthy()
    expect(screen.getByText('spec').tagName).toBe('CODE')
    expect(screen.getByText('Keep task pointers as markdown')).toBeTruthy()
    expect(screen.getByRole('checkbox')).toBeTruthy()
    expect(screen.queryByText('No items yet.')).toBeNull()
    expect(screen.getByText(/Source of truth:/)).toBeTruthy()
    expect(screen.getByText('drafting')).toBeTruthy()
    expect(screen.getByText('Auto-saved')).toBeTruthy()
  })

  it('renders diagnostics while preserving the last-good visible markdown body', () => {
    render(
      <SpecSections
        document={{
          ...baseDocument,
          markdown: '## Goal\nBroken replacement',
          visibleMarkdown: '## Goal\nLast good visible markdown',
          diagnostics: [
            {
              code: 'invalid_frontmatter_yaml',
              message: 'Frontmatter must contain valid key:value entries'
            }
          ]
        } as any}
        onEditMarkdown={vi.fn()}
        commentStatusNote=""
      />
    )

    expect(screen.getByText('Spec artifact issue')).toBeTruthy()
    expect(screen.getByText(/invalid_frontmatter_yaml/i)).toBeTruthy()
    expect(screen.getByText('Last good visible markdown')).toBeTruthy()
    expect(screen.queryByText('Broken replacement')).toBeNull()
  })

  it('shows trace badge when source run id is present', () => {
    render(
      <SpecSections
        document={{ ...baseDocument, sourceRunId: 'run-42', appliedRunId: 'run-42' } as any}
        onEditMarkdown={vi.fn()}
        commentStatusNote=""
      />
    )

    expect(screen.getByText('Trace: run-42')).toBeTruthy()
  })

  it('calls onEditMarkdown when edit button is clicked', () => {
    const onEditMarkdown = vi.fn()

    render(
      <SpecSections
        document={baseDocument as any}
        onEditMarkdown={onEditMarkdown}
        commentStatusNote=""
      />
    )

    fireEvent.click(screen.getByText('Edit markdown'))
    expect(onEditMarkdown).toHaveBeenCalledOnce()
  })
})
