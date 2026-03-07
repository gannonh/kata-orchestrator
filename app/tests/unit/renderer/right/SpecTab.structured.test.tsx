import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SpecTab } from '../../../../src/renderer/components/right/SpecTab'
import { mockProject } from '../../../../src/renderer/mock/project'

const markdownDocument = {
  sourcePath: '/tmp/repo/.kata/sessions/session-1/notes/spec.md',
  raw: [
    '# Live spec',
    '',
    '## Goal',
    'Ship the markdown-first panel.',
    '',
    '## Tasks',
    '- [ ] Leave task pointers in markdown'
  ].join('\n'),
  markdown: [
    '# Live spec',
    '',
    '## Goal',
    'Ship the markdown-first panel.',
    '',
    '## Tasks',
    '- [ ] Leave task pointers in markdown'
  ].join('\n'),
  visibleMarkdown: [
    '# Live spec',
    '',
    '## Goal',
    'Ship the markdown-first panel.',
    '',
    '## Tasks',
    '- [ ] Leave task pointers in markdown'
  ].join('\n'),
  status: 'drafting' as const,
  diagnostics: [],
  updatedAt: '2026-03-06T00:00:00.000Z',
  appliedRunId: 'run-1'
}

afterEach(() => {
  cleanup()
})

describe('SpecTab markdown-first states', () => {
  it('shows animated generation progress while thinking', () => {
    render(
      <SpecTab
        project={mockProject}
        specState={{ mode: 'generating', phase: 'thinking' } as any}
      />
    )

    expect(screen.getByRole('status', { name: 'Thinking' })).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Spec generation in progress' })).toBeTruthy()
    expect(screen.getByText('Drafting')).toBeTruthy()
    expect(screen.getByTestId('spec-generation-indicator').getAttribute('class')).toContain('animate-spin')
    expect(screen.getByText(/intentionally deferred in this release/i)).toBeTruthy()
  })

  it('advances the animated generation progress to drafting', () => {
    render(
      <SpecTab
        project={mockProject}
        specState={{ mode: 'generating', phase: 'drafting' } as any}
      />
    )

    expect(screen.getByRole('status', { name: 'Drafting' })).toBeTruthy()
    expect(screen.getByText('Thinking')).toBeTruthy()
    expect(screen.getAllByText('Drafting')).toHaveLength(2)
    expect(screen.getByTestId('spec-generation-indicator').getAttribute('class')).toContain('animate-spin')
  })

  it('renders the markdown artifact directly and does not show a draft-apply state', () => {
    const onEditMarkdown = vi.fn()

    render(
      <SpecTab
        project={mockProject}
        specState={{
          mode: 'viewing',
          document: markdownDocument,
          onEditMarkdown,
          commentStatusNote: 'Comments are deferred.'
        } as any}
      />
    )

    expect(screen.getByRole('heading', { name: 'Live spec', level: 1 })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Goal', level: 2 })).toBeTruthy()
    expect(screen.getByText('Ship the markdown-first panel.')).toBeTruthy()
    expect(screen.getByText('Leave task pointers in markdown')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Apply Draft to Spec' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Edit markdown' }))
    expect(onEditMarkdown).toHaveBeenCalledTimes(1)
  })

  it('renders markdown editing controls and delegates editor callbacks', () => {
    const onDraftMarkdownChange = vi.fn()
    const onSaveMarkdown = vi.fn()
    const onCancelEditing = vi.fn()

    render(
      <SpecTab
        project={mockProject}
        specState={{
          mode: 'editing',
          document: markdownDocument,
          draftMarkdown: markdownDocument.markdown,
          onDraftMarkdownChange,
          onSaveMarkdown,
          onCancelEditing,
          commentStatusNote: 'Comments are deferred.'
        } as any}
      />
    )

    fireEvent.change(screen.getByLabelText('Spec markdown editor'), {
      target: { value: ['# Live spec', '', '## Goal', 'Edited goal'].join('\n') }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('heading', { name: 'Edit Spec Markdown' })).toBeTruthy()
    expect(onDraftMarkdownChange).toHaveBeenCalledWith(['# Live spec', '', '## Goal', 'Edited goal'].join('\n'))
    expect(onCancelEditing).toHaveBeenCalledTimes(1)
    expect(onSaveMarkdown).toHaveBeenCalledTimes(1)
  })
})
