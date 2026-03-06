import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MarkdownRenderer } from '../../../../src/renderer/components/shared/MarkdownRenderer'

describe('MarkdownRenderer', () => {
  it('renders headings, bullet lists, and fenced code', () => {
    render(
      <MarkdownRenderer
        content={[
          '# Project Goal',
          '',
          '- First item',
          '- Second item',
          '',
          '```ts',
          'const ready = true',
          '```'
        ].join('\n')}
      />
    )

    expect(screen.getByRole('heading', { name: 'Project Goal', level: 1 })).toBeTruthy()
    expect(screen.getByText('First item')).toBeTruthy()
    expect(screen.getByText('Second item')).toBeTruthy()
    expect(screen.getByText('const ready = true')).toBeTruthy()
  })

  it('renders paragraph blocks, heading size variants, and language-free code fences', () => {
    render(
      <MarkdownRenderer
        content={[
          '## Milestone',
          '',
          '#### Notes',
          '',
          'The first paragraph line',
          'continues on the next line',
          '',
          '```',
          'plain text block',
          '```'
        ].join('\n')}
      />
    )

    const milestoneHeading = screen.getByRole('heading', { name: 'Milestone', level: 2 })
    const notesHeading = screen.getByRole('heading', { name: 'Notes', level: 4 })
    const paragraph = screen.getByText('The first paragraph line continues on the next line')
    const code = screen.getByText('plain text block')

    expect(milestoneHeading.className).toContain('text-xl')
    expect(notesHeading.className).toContain('text-lg')
    expect(paragraph).toBeTruthy()
    expect(code.closest('code')?.className).toBe('')
  })

  it('handles unterminated fenced code blocks by consuming remaining lines', () => {
    render(
      <MarkdownRenderer
        content={['```bash', 'echo ready', 'echo done'].join('\n')}
      />
    )

    const codeNode = screen.getByText((_, node) => node?.tagName === 'CODE' && node.textContent?.includes('echo ready\necho done') === true)
    expect(codeNode).toBeTruthy()
  })

  it('renders ordered lists and inline emphasis markers', () => {
    const { container } = render(
      <MarkdownRenderer
        content={[
          'Please answer:',
          '',
          '1. **What problem does the product solve?**',
          '2. `Who will use it?`'
        ].join('\n')}
      />
    )

    expect(within(container).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('What problem does the product solve?').closest('strong')).toBeTruthy()
    expect(screen.getByText('Who will use it?').closest('code')).toBeTruthy()
  })

  it('renders h3, h5, and h6 heading variants', () => {
    render(
      <MarkdownRenderer
        content={[
          '### Section',
          '',
          '##### Minor heading',
          '',
          '###### Small heading'
        ].join('\n')}
      />
    )

    expect(screen.getByRole('heading', { name: 'Section', level: 3 })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Minor heading', level: 5 })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Small heading', level: 6 })).toBeTruthy()
  })
})
