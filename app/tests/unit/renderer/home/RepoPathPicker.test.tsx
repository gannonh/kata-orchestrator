import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RepoPathPicker } from '../../../../src/renderer/components/home/RepoPathPicker'

function baseProps() {
  return {
    path: '',
    onPathChange: vi.fn(),
    onBrowse: vi.fn(),
    branches: [] as string[],
    selectedBranch: '',
    onBranchChange: vi.fn(),
    isLoadingBranches: false,
    error: null as string | null
  }
}

describe('RepoPathPicker', () => {
  afterEach(() => cleanup())

  it('renders browse button and empty path placeholder', () => {
    render(<RepoPathPicker {...baseProps()} />)
    expect(screen.getByRole('button', { name: 'Browse' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Local repo path' })).toBeTruthy()
  })

  it('shows selected path in text input', () => {
    render(<RepoPathPicker {...baseProps()} path="/Users/me/dev/repo" />)
    expect(screen.getByRole('textbox', { name: 'Local repo path' })).toHaveProperty('value', '/Users/me/dev/repo')
  })

  it('calls onPathChange when text input value changes', () => {
    const props = baseProps()
    render(<RepoPathPicker {...props} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Local repo path' }), { target: { value: '/new/path' } })
    expect(props.onPathChange).toHaveBeenCalledWith('/new/path')
  })

  it('calls onBrowse when browse button is clicked', () => {
    const props = baseProps()
    render(<RepoPathPicker {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }))
    expect(props.onBrowse).toHaveBeenCalledTimes(1)
  })

  it('shows branch picker when branches are available', () => {
    render(<RepoPathPicker {...baseProps()} path="/repo" branches={['main', 'develop', 'feature/ui']} selectedBranch="main" />)
    expect(screen.getByRole('combobox', { name: /branch/i })).toBeTruthy()
  })

  it('hides branch picker when no path is selected', () => {
    render(<RepoPathPicker {...baseProps()} branches={['main']} />)
    expect(screen.queryByRole('combobox', { name: /branch/i })).toBeNull()
  })

  it('shows loading state for branches', () => {
    render(<RepoPathPicker {...baseProps()} path="/repo" isLoadingBranches={true} />)
    expect(screen.getByText(/loading branches/i)).toBeTruthy()
  })

  it('shows error message', () => {
    render(<RepoPathPicker {...baseProps()} error="Selected directory is not a git repository." />)
    expect(screen.getByText('Selected directory is not a git repository.')).toBeTruthy()
  })

  it('calls onBranchChange when branch is selected', () => {
    const props = baseProps()
    render(<RepoPathPicker {...props} path="/repo" branches={['main', 'develop']} selectedBranch="main" />)
    fireEvent.change(screen.getByRole('combobox', { name: /branch/i }), { target: { value: 'develop' } })
    expect(props.onBranchChange).toHaveBeenCalledWith('develop')
  })
})
