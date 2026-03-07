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
    expect(code.closest('code')?.className).toContain('bg-muted')
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

  it('renders blockquotes with readable structure', () => {
    render(
      <MarkdownRenderer
        content={['> Review the current spec draft.', '>', '> Keep the layout stable.'].join(
          '\n'
        )}
      />
    )

    const quote = screen
      .getByText('Review the current spec draft.')
      .closest('blockquote')

    expect(quote).toBeTruthy()
    expect(quote?.className).toContain('border-l')
  })

  it('renders GFM checklist items as disabled checkboxes without disc markers', () => {
    const { container } = render(
      <MarkdownRenderer
        content={[
          '- [x] Capture screenshot evidence',
          '- [ ] Verify streaming readability'
        ].join('\n')}
      />
    )

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]

    expect(checkboxes).toHaveLength(2)
    expect(checkboxes[0]?.checked).toBe(true)
    expect(checkboxes[1]?.checked).toBe(false)
    expect(checkboxes[0]?.disabled).toBe(true)
    expect(checkboxes[1]?.disabled).toBe(true)

    const taskList = container.querySelector('ul.contains-task-list')
    expect(taskList).toBeTruthy()
    expect(taskList?.className).toContain('list-none')
    expect(taskList?.className).not.toContain('list-disc')

    const taskItems = container.querySelectorAll('li.task-list-item')
    expect(taskItems).toHaveLength(2)
    expect(taskItems[0]?.className).toContain('list-none')
    expect(taskItems[0]?.className).not.toContain('marker:text-muted-foreground')
  })

  it('normalizes unterminated fences when renderMode is streaming', () => {
    const { container } = render(
      <MarkdownRenderer
        renderMode="streaming"
        content={['```ts', 'const ready = true'].join('\n')}
      />
    )

    expect(
      within(container).getByText(
        (_, node) =>
          node?.tagName === 'CODE' &&
          node.textContent?.includes('const ready = true') === true
      )
    ).toBeTruthy()
  })
})
