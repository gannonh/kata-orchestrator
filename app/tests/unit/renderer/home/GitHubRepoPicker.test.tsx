import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GitHubRepoPicker } from '../../../../src/renderer/components/home/GitHubRepoPicker'

type Repo = { name: string; nameWithOwner: string; url: string }

const sampleRepos: Repo[] = [
  { name: 'kata-cloud', nameWithOwner: 'gannonh/kata-cloud', url: 'https://github.com/gannonh/kata-cloud' },
  { name: 'kata-tui', nameWithOwner: 'gannonh/kata-tui', url: 'https://github.com/gannonh/kata-tui' },
  { name: 'other-project', nameWithOwner: 'gannonh/other-project', url: 'https://github.com/gannonh/other-project' }
]

function baseProps() {
  return {
    repos: sampleRepos,
    selectedRepo: null as Repo | null,
    onRepoSelect: vi.fn(),
    isLoadingRepos: false,
    searchQuery: '',
    onSearchChange: vi.fn(),
    branches: [] as string[],
    selectedBranch: '',
    onBranchChange: vi.fn(),
    isLoadingBranches: false,
    error: null as string | null,
    onFallbackUrlChange: vi.fn(),
    showFallbackUrl: false,
    fallbackUrl: ''
  }
}

describe('GitHubRepoPicker', () => {
  afterEach(() => cleanup())

  it('renders search input and repo list', () => {
    render(<GitHubRepoPicker {...baseProps()} />)
    expect(screen.getByRole('textbox', { name: /search/i })).toBeTruthy()
    expect(screen.getByText('gannonh/kata-cloud')).toBeTruthy()
    expect(screen.getByText('gannonh/kata-tui')).toBeTruthy()
  })

  it('shows loading state when repos are loading', () => {
    render(<GitHubRepoPicker {...baseProps()} isLoadingRepos={true} repos={[]} />)
    expect(screen.getByText(/loading repos/i)).toBeTruthy()
  })

  it('shows error with fallback URL input', () => {
    render(<GitHubRepoPicker {...baseProps()} error="GitHub CLI not available." showFallbackUrl={true} />)
    expect(screen.getByText('GitHub CLI not available.')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /url/i })).toBeTruthy()
  })

  it('filters repos by search query', () => {
    render(<GitHubRepoPicker {...baseProps()} searchQuery="kata" />)
    expect(screen.getByText('gannonh/kata-cloud')).toBeTruthy()
    expect(screen.getByText('gannonh/kata-tui')).toBeTruthy()
    expect(screen.queryByText('gannonh/other-project')).toBeNull()
  })

  it('shows branch picker after repo selection', () => {
    render(<GitHubRepoPicker {...baseProps()} selectedRepo={sampleRepos[0]} branches={['main', 'develop']} selectedBranch="main" />)
    expect(screen.getByRole('combobox', { name: /branch/i })).toBeTruthy()
  })

  it('calls onRepoSelect when a repo is clicked', () => {
    const props = baseProps()
    render(<GitHubRepoPicker {...props} />)
    fireEvent.click(screen.getByText('gannonh/kata-cloud'))
    expect(props.onRepoSelect).toHaveBeenCalledWith(sampleRepos[0])
  })

  it('calls onSearchChange when typing in search input', () => {
    const props = baseProps()
    render(<GitHubRepoPicker {...props} />)
    fireEvent.change(screen.getByRole('textbox', { name: /search/i }), {
      target: { value: 'kata' }
    })
    expect(props.onSearchChange).toHaveBeenCalledWith('kata')
  })

  it('calls onFallbackUrlChange when typing in fallback URL input', () => {
    const props = baseProps()
    render(<GitHubRepoPicker {...props} error="GitHub CLI not available." showFallbackUrl={true} />)
    fireEvent.change(screen.getByRole('textbox', { name: /url/i }), {
      target: { value: 'https://github.com/org/repo.git' }
    })
    expect(props.onFallbackUrlChange).toHaveBeenCalledWith('https://github.com/org/repo.git')
  })

  it('renders fallback URL input as controlled value', () => {
    render(
      <GitHubRepoPicker
        {...baseProps()}
        error="GitHub CLI not available."
        showFallbackUrl={true}
        fallbackUrl="https://github.com/org/repo.git"
      />
    )
    const input = screen.getByRole('textbox', { name: /url/i })
    expect(input).toHaveProperty('value', 'https://github.com/org/repo.git')
  })

  it('calls onBranchChange when selecting a branch', () => {
    const props = baseProps()
    render(
      <GitHubRepoPicker
        {...props}
        selectedRepo={sampleRepos[0]}
        branches={['main', 'develop']}
        selectedBranch="main"
      />
    )
    fireEvent.change(screen.getByRole('combobox', { name: /branch/i }), {
      target: { value: 'develop' }
    })
    expect(props.onBranchChange).toHaveBeenCalledWith('develop')
  })

  it('shows loading branches indicator when repo is selected and branches are loading', () => {
    render(
      <GitHubRepoPicker
        {...baseProps()}
        selectedRepo={sampleRepos[0]}
        isLoadingBranches={true}
      />
    )
    expect(screen.getByText(/loading branches/i)).toBeTruthy()
  })
})
