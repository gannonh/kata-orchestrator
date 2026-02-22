import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { FilesTab } from '../../../../src/renderer/components/left/FilesTab'
import { mockFiles, type MockFileNode } from '../../../../src/renderer/mock/files'

describe('FilesTab', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders a recursive tree with expand and collapse controls', () => {
    render(<FilesTab files={mockFiles} />)

    expect(screen.getByRole('heading', { name: 'Files' })).toBeTruthy()
    expect(screen.getByText(/Your copy of the repo lives in/)).toBeTruthy()
    expect(screen.getByText('/tui-app/repo.')).toBeTruthy()
    const searchInput = screen.getByLabelText('Search files')
    expect(searchInput).toBeTruthy()
    expect(searchInput.className).toContain('dark:!bg-transparent')
    const searchContainer = screen.getByRole('search')
    expect(searchContainer.className).toContain('border-border/70')
    expect(searchContainer.className).toContain('bg-muted/20')
    expect(searchContainer.className).toContain('rounded-[min(var(--radius-md),10px)]')
    expect(screen.getByRole('button', { name: 'New file' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rename file' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open file actions' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Toggle src' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Toggle src' }))
    fireEvent.click(screen.getByRole('button', { name: 'Toggle src/renderer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Toggle src/renderer/components' }))
    fireEvent.click(screen.getByRole('button', { name: 'Toggle src/renderer/components/shared' }))

    expect(screen.getByText('TabBar.tsx')).toBeTruthy()
    expect(screen.getByText('StatusBadge.tsx')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Toggle src' }))

    expect(screen.queryByRole('button', { name: 'Toggle src/renderer' })).toBeNull()
  })

  it('renders file rows with baseline icon metadata and diff stats', () => {
    render(<FilesTab files={mockFiles} />)

    expect(screen.getByText('.gitignore')).toBeTruthy()
    expect(screen.getByText('Cargo.lock')).toBeTruthy()
    expect(screen.getByText('Cargo.toml')).toBeTruthy()
    expect(screen.getByText('README.md')).toBeTruthy()

    expect(screen.getByText('+3')).toBeTruthy()
    expect(screen.getByText('-9')).toBeTruthy()
    expect(screen.getByText('+12')).toBeTruthy()
  })

  it('supports the draft file row flow from the new-file action', () => {
    render(<FilesTab files={mockFiles} />)

    fireEvent.click(screen.getByRole('button', { name: 'New file' }))

    const draftInput = screen.getByRole('textbox', { name: 'New file name' })
    expect(draftInput).toBeTruthy()
    expect((draftInput as HTMLInputElement).value).toBe('filename')

    fireEvent.change(draftInput, { target: { value: 'my-file.txt' } })
    expect((draftInput as HTMLInputElement).value).toBe('my-file.txt')
  })

  it('filters tree results based on search input', () => {
    render(<FilesTab files={mockFiles} />)

    fireEvent.change(screen.getByLabelText('Search files'), {
      target: { value: 'status' }
    })

    expect(screen.getByText('StatusBadge.tsx')).toBeTruthy()
    expect(screen.queryByText('TabBar.tsx')).toBeNull()
  })

  it('hides all nodes when the search query has no matches', () => {
    render(<FilesTab files={mockFiles} />)

    fireEvent.change(screen.getByLabelText('Search files'), {
      target: { value: 'does-not-exist' }
    })

    expect(screen.queryByRole('button', { name: 'Toggle src' })).toBeNull()
    expect(screen.queryByText('StatusBadge.tsx')).toBeNull()
  })

  it('keeps matching directories without children when filtering', () => {
    const nodes: MockFileNode[] = [
      {
        id: 'empty-dir',
        name: 'empty-dir',
        path: 'empty-dir',
        type: 'directory'
      }
    ]

    render(<FilesTab files={nodes} />)

    fireEvent.change(screen.getByLabelText('Search files'), {
      target: { value: 'empty' }
    })

    expect(screen.getByRole('button', { name: 'Toggle empty-dir' })).toBeTruthy()
  })
})
