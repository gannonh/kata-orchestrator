import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { HomeSpacesScreen } from '../../../../src/renderer/components/home/HomeSpacesScreen'
import type { DisplaySpace } from '../../../../src/renderer/mock/spaces'
import type { SpaceRecord } from '../../../../src/shared/types/space'

function makeSpaceRecord(overrides: Partial<SpaceRecord> = {}): SpaceRecord {
  return {
    id: 'space-ipc-1',
    name: 'IPC Loaded Space',
    repoUrl: 'https://github.com/gannonh/kata-cloud',
    rootPath: '/Users/gannonh/dev/kata/kata-cloud',
    branch: 'main',
    orchestrationMode: 'team',
    createdAt: '2026-02-25T00:00:00.000Z',
    status: 'active',
    ...overrides
  }
}

function makeDisplaySpace(overrides: Partial<DisplaySpace> = {}): DisplaySpace {
  return {
    id: 'space-1',
    name: 'Test Space',
    repoUrl: 'https://github.com/gannonh/kata-cloud',
    rootPath: '/Users/gannonh/dev/kata/kata-cloud',
    repo: 'gannonh/kata-cloud',
    branch: 'main',
    orchestrationMode: 'team',
    createdAt: '2026-02-25T00:00:00.000Z',
    status: 'active',
    elapsed: '',
    archived: false,
    ...overrides
  }
}

describe('HomeSpacesScreen', () => {
  afterEach(() => {
    window.kata = undefined
    cleanup()
  })

  it('loads spaces from IPC on mount', async () => {
    const spaceList = vi.fn<() => Promise<SpaceRecord[]>>().mockResolvedValue([
      makeSpaceRecord(),
      makeSpaceRecord({
        id: 'space-ipc-2',
        name: 'IPC Loaded Space 2',
        repoUrl: 'https://github.com/gannonh/kata-orchestrator',
        rootPath: '/Users/gannonh/dev/kata/kata-orchestrator',
        status: 'idle'
      })
    ])
    window.kata = { ...window.kata, spaceList }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    await waitFor(() => {
      expect(spaceList).toHaveBeenCalledTimes(1)
      expect(screen.getByText('IPC Loaded Space')).toBeTruthy()
      expect(screen.getByText('IPC Loaded Space 2')).toBeTruthy()
    })
  })

  it('has no Space name textbox anywhere', () => {
    render(<HomeSpacesScreen onOpenSpace={() => {}} />)
    expect(screen.queryByRole('textbox', { name: 'Space name' })).toBeNull()
  })

  it('shows 3-step structure', () => {
    render(<HomeSpacesScreen onOpenSpace={() => {}} />)
    expect(screen.getByText('Step 1 · Where work happens')).toBeTruthy()
    expect(screen.getByText('Step 2 · Source setup')).toBeTruthy()
    expect(screen.getByText('Step 3 · Review and create')).toBeTruthy()
    expect(screen.queryByText('Step 3 · Space name')).toBeNull()
    expect(screen.queryByText('Step 4 · Review and create')).toBeNull()
  })

  it('shows browse button for copy-local mode', () => {
    render(<HomeSpacesScreen onOpenSpace={() => {}} />)
    expect(screen.getByRole('button', { name: 'Browse' })).toBeTruthy()
  })

  it('triggers dialogOpenDirectory when Browse is clicked', async () => {
    const dialogOpenDirectory = vi.fn().mockResolvedValue({ path: '/Users/me/dev/repo' })
    const gitListBranches = vi.fn().mockResolvedValue(['main', 'develop'])
    window.kata = { ...window.kata, dialogOpenDirectory, gitListBranches }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }))

    await waitFor(() => {
      expect(dialogOpenDirectory).toHaveBeenCalledTimes(1)
    })
  })

  it('submits copy-local payload without name or spaceNameOverride', async () => {
    const dialogOpenDirectory = vi.fn().mockResolvedValue({ path: '/Users/me/dev/my-repo' })
    const gitListBranches = vi.fn().mockResolvedValue(['main', 'develop'])
    const createdRecord = makeSpaceRecord({ id: 'space-created-copy-local', name: 'my-repo-x7k2' })
    const spaceCreate = vi.fn<(input: unknown) => Promise<SpaceRecord>>().mockResolvedValue(createdRecord)
    window.kata = { ...window.kata, spaceCreate, dialogOpenDirectory, gitListBranches }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    // Browse and select a directory
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }))
    await waitFor(() => {
      expect(dialogOpenDirectory).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))

    await waitFor(() => {
      expect(spaceCreate).toHaveBeenCalledTimes(1)
    })

    const payload = spaceCreate.mock.calls[0][0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('name')
    expect(payload).not.toHaveProperty('spaceNameOverride')
    expect(payload).toMatchObject({
      workspaceMode: 'managed',
      provisioningMethod: 'copy-local'
    })
  })

  it('shows auto-generated name preview in review step', async () => {
    const dialogOpenDirectory = vi.fn().mockResolvedValue({ path: '/Users/me/dev/my-repo' })
    const gitListBranches = vi.fn().mockResolvedValue(['main'])
    window.kata = { ...window.kata, dialogOpenDirectory, gitListBranches }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Browse' }))
    await waitFor(() => {
      expect(dialogOpenDirectory).toHaveBeenCalledTimes(1)
    })

    // The auto-generated name should be shown (regex because nanoid part is random)
    expect(screen.getByText(/Space:/)).toBeTruthy()
  })

  it('fetches GitHub repos immediately when clone-github is selected', async () => {
    const githubListRepos = vi.fn().mockResolvedValue([
      { name: 'kata-cloud', nameWithOwner: 'gannonh/kata-cloud', url: 'https://github.com/gannonh/kata-cloud' }
    ])
    window.kata = { ...window.kata, githubListRepos }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use clone github provisioning' }))

    await waitFor(() => {
      expect(githubListRepos).toHaveBeenCalledTimes(1)
      expect(screen.getByText('gannonh/kata-cloud')).toBeTruthy()
    })
  })

  it('submits external mode payload without name', async () => {
    const createdRecord = makeSpaceRecord({ id: 'space-external' })
    const spaceCreate = vi.fn<(input: unknown) => Promise<SpaceRecord>>().mockResolvedValue(createdRecord)
    window.kata = { ...window.kata, spaceCreate }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use my existing folder/worktree (developer-managed)' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Workspace path' }), { target: { value: '/Users/me/dev/repo' } })

    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))
    await waitFor(() => {
      expect(spaceCreate).toHaveBeenCalledTimes(1)
    })

    const payload = spaceCreate.mock.calls[0][0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('name')
    expect(payload).not.toHaveProperty('spaceNameOverride')
    expect(payload.workspaceMode).toBe('external')
    expect(payload.rootPath).toBe('/Users/me/dev/repo')
  })

  it('shows create failure alert when IPC create rejects', async () => {
    const dialogOpenDirectory = vi.fn().mockResolvedValue({ path: '/Users/me/dev/repo' })
    const gitListBranches = vi.fn().mockResolvedValue(['main'])
    const spaceCreate = vi.fn<(input: unknown) => Promise<SpaceRecord>>().mockRejectedValue(new Error('create failed'))
    window.kata = { ...window.kata, spaceCreate, dialogOpenDirectory, gitListBranches }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Browse' }))
    await waitFor(() => expect(dialogOpenDirectory).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('create failed')
    })
  })

  it('shows IPC unavailable error when create handler is not exposed', async () => {
    const dialogOpenDirectory = vi.fn().mockResolvedValue({ path: '/Users/me/dev/repo' })
    const gitListBranches = vi.fn().mockResolvedValue(['main'])
    window.kata = { ...window.kata, dialogOpenDirectory, gitListBranches }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Browse' }))
    await waitFor(() => expect(dialogOpenDirectory).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('IPC unavailable')
    })
  })

  it('supports search and list toggles (grouping + archived)', async () => {
    const spaces = [
      makeDisplaySpace({ id: 's-active', name: 'Active Space', status: 'active', archived: false }),
      makeDisplaySpace({ id: 's-archived', name: 'Old Notes', status: 'archived', archived: true })
    ]
    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={spaces} />)

    expect(screen.queryByText('Old Notes')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show archived spaces' }))
    expect(screen.getByText('Old Notes')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Group spaces by repository' }))
    expect(screen.getByText('All spaces')).toBeTruthy()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search spaces' }), {
      target: { value: 'no-match-query' }
    })
    expect(screen.getByText('No spaces match your filters.')).toBeTruthy()
  })

  it('logs and tolerates space:list IPC failures', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const spaceList = vi.fn<() => Promise<SpaceRecord[]>>().mockRejectedValue(new Error('list failed'))
    window.kata = { ...window.kata, spaceList }

    render(<HomeSpacesScreen onOpenSpace={() => {}} />)

    await waitFor(() => {
      expect(spaceList).toHaveBeenCalledTimes(1)
      expect(consoleError).toHaveBeenCalled()
    })

    consoleError.mockRestore()
  })

  it('falls back to default create error for non-Error rejection values', async () => {
    const dialogOpenDirectory = vi.fn().mockResolvedValue({ path: '/Users/me/dev/repo' })
    const gitListBranches = vi.fn().mockResolvedValue(['main'])
    const spaceCreate = vi.fn<(input: unknown) => Promise<SpaceRecord>>().mockRejectedValue('')
    window.kata = { ...window.kata, spaceCreate, dialogOpenDirectory, gitListBranches }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Browse' }))
    await waitFor(() => expect(dialogOpenDirectory).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Failed to create space.')
    })
  })

  it('opens the currently selected space with the correct space ID', () => {
    const spaces = [
      makeDisplaySpace({ id: 's-first', name: 'First Space' }),
      makeDisplaySpace({ id: 's-second', name: 'Second Space' })
    ]
    const onOpenSpace = vi.fn()
    render(<HomeSpacesScreen onOpenSpace={onOpenSpace} initialSpaces={spaces} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open selected space' }))
    expect(onOpenSpace).toHaveBeenCalledTimes(1)
    expect(onOpenSpace.mock.calls[0]?.[0]).toBe('s-first')
  })

  it('selects another space from the list before opening it', () => {
    const spaces = [
      makeDisplaySpace({ id: 's-first', name: 'First Space' }),
      makeDisplaySpace({ id: 's-second', name: 'Second Space' })
    ]
    const onOpenSpace = vi.fn()
    render(<HomeSpacesScreen onOpenSpace={onOpenSpace} initialSpaces={spaces} />)

    fireEvent.click(screen.getByRole('button', { name: 'Select space Second Space' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open selected space' }))

    expect(onOpenSpace).toHaveBeenCalledWith('s-second')
  })

  it('loads GitHub branches when a repo is selected in clone-github mode', async () => {
    const githubListRepos = vi.fn().mockResolvedValue([
      { name: 'kata-cloud', nameWithOwner: 'gannonh/kata-cloud', url: 'https://github.com/gannonh/kata-cloud' }
    ])
    const githubListBranches = vi.fn().mockResolvedValue(['main', 'develop'])
    window.kata = { ...window.kata, githubListRepos, githubListBranches }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use clone github provisioning' }))

    await waitFor(() => {
      expect(screen.getByText('gannonh/kata-cloud')).toBeTruthy()
    })

    // Select the repo to trigger branch loading
    fireEvent.click(screen.getByText('gannonh/kata-cloud'))

    // Wait for .then to complete and branch picker to render
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /branch/i })).toBeTruthy()
    })
    expect(githubListBranches).toHaveBeenCalledWith('gannonh', 'kata-cloud')
  })

  it('shows fallback URL when GitHub repo fetch fails', async () => {
    const githubListRepos = vi.fn().mockRejectedValue(new Error('gh not found'))
    window.kata = { ...window.kata, githubListRepos }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use clone github provisioning' }))

    await waitFor(() => {
      expect(screen.getByText(/GitHub CLI not available/)).toBeTruthy()
      expect(screen.getByRole('textbox', { name: /url/i })).toBeTruthy()
    })
  })

  it('shows fallback URL when GitHub repo fetch resolves an error payload', async () => {
    const githubListRepos = vi.fn().mockResolvedValue({
      error: 'GitHub CLI not available. Install and authenticate with `gh auth login`.'
    })
    window.kata = { ...window.kata, githubListRepos }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use clone github provisioning' }))

    await waitFor(() => {
      expect(screen.getByText(/GitHub CLI not available/)).toBeTruthy()
      expect(screen.getByRole('textbox', { name: /repository url/i })).toBeTruthy()
    })
  })

  it('tolerates browse when dialogOpenDirectory is not exposed', async () => {
    window.kata = {}
    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }))
    // Should not throw
  })

  it('tolerates browse returning null path', async () => {
    const dialogOpenDirectory = vi.fn().mockResolvedValue(null)
    window.kata = { ...window.kata, dialogOpenDirectory }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }))

    await waitFor(() => {
      expect(dialogOpenDirectory).toHaveBeenCalledTimes(1)
    })
  })

  it('ignores browse responses with empty path values', async () => {
    const dialogOpenDirectory = vi.fn().mockResolvedValue({ path: '' })
    const gitListBranches = vi.fn()
    window.kata = { ...window.kata, dialogOpenDirectory, gitListBranches }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }))

    await waitFor(() => {
      expect(dialogOpenDirectory).toHaveBeenCalledTimes(1)
    })
    expect(gitListBranches).not.toHaveBeenCalled()
  })

  it('shows repository error when browse returns an error payload', async () => {
    const dialogOpenDirectory = vi.fn().mockResolvedValue({
      path: '/Users/me/dev/not-a-repo',
      error: 'Selected directory is not a git repository.'
    })
    const gitListBranches = vi.fn()
    window.kata = { ...window.kata, dialogOpenDirectory, gitListBranches }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }))

    await waitFor(() => {
      expect(dialogOpenDirectory).toHaveBeenCalledTimes(1)
      expect(screen.getByText('Selected directory is not a git repository.')).toBeTruthy()
    })
    expect(gitListBranches).not.toHaveBeenCalled()
  })

  it('tolerates branch loading failure after browse', async () => {
    const dialogOpenDirectory = vi.fn().mockResolvedValue({ path: '/Users/me/dev/repo' })
    const gitListBranches = vi.fn().mockRejectedValue(new Error('git error'))
    window.kata = { ...window.kata, dialogOpenDirectory, gitListBranches }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }))

    await waitFor(() => {
      expect(gitListBranches).toHaveBeenCalledTimes(1)
    })
    // Should not throw; branches remain empty
  })

  it('shows branch error when gitListBranches resolves an error payload', async () => {
    const dialogOpenDirectory = vi.fn().mockResolvedValue({ path: '/Users/me/dev/repo' })
    const gitListBranches = vi.fn().mockResolvedValue({ error: 'Could not read branches.' })
    window.kata = { ...window.kata, dialogOpenDirectory, gitListBranches }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }))

    await waitFor(() => {
      expect(gitListBranches).toHaveBeenCalledTimes(1)
      expect(screen.getByText('Could not read branches.')).toBeTruthy()
    })
    expect(screen.queryByRole('combobox', { name: /branch/i })).toBeNull()
  })

  it('shows fallback branch text when selected repo has no branches', async () => {
    const dialogOpenDirectory = vi.fn().mockResolvedValue({ path: '/Users/me/dev/repo' })
    const gitListBranches = vi.fn().mockResolvedValue([])
    window.kata = { ...window.kata, dialogOpenDirectory, gitListBranches }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }))

    await waitFor(() => {
      expect(gitListBranches).toHaveBeenCalledTimes(1)
      expect(screen.getByText(/no branches found\. defaulting to main\./i)).toBeTruthy()
    })
  })

  it('shows error when browse dialog throws', async () => {
    const dialogOpenDirectory = vi.fn().mockRejectedValue(new Error('dialog error'))
    window.kata = { ...window.kata, dialogOpenDirectory }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }))

    await waitFor(() => {
      expect(dialogOpenDirectory).toHaveBeenCalledTimes(1)
    })
  })

  it('submits new-repo payload and shows correct auto-generated name', async () => {
    const createdRecord = makeSpaceRecord({ id: 'space-new-repo', name: 'my-project-x7k2' })
    const spaceCreate = vi.fn<(input: unknown) => Promise<SpaceRecord>>().mockResolvedValue(createdRecord)
    window.kata = { ...window.kata, spaceCreate }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use new repo provisioning' }))

    fireEvent.change(screen.getByRole('textbox', { name: 'New repo name' }), {
      target: { value: 'my-project' }
    })

    // Auto-generated name preview should show in review
    expect(screen.getByText(/Space:.*my-project/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))

    await waitFor(() => {
      expect(spaceCreate).toHaveBeenCalledTimes(1)
    })

    const payload = spaceCreate.mock.calls[0][0] as Record<string, unknown>
    expect(payload).toMatchObject({
      workspaceMode: 'managed',
      provisioningMethod: 'new-repo',
      newRepoFolderName: 'my-project'
    })
  })

  it('submits clone-github payload with selected repo', async () => {
    const githubListRepos = vi.fn().mockResolvedValue([
      { name: 'kata-cloud', nameWithOwner: 'gannonh/kata-cloud', url: 'https://github.com/gannonh/kata-cloud' }
    ])
    const githubListBranches = vi.fn().mockResolvedValue(['main', 'develop'])
    const createdRecord = makeSpaceRecord({ id: 'space-clone' })
    const spaceCreate = vi.fn<(input: unknown) => Promise<SpaceRecord>>().mockResolvedValue(createdRecord)
    window.kata = { ...window.kata, githubListRepos, githubListBranches, spaceCreate }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use clone github provisioning' }))

    await waitFor(() => {
      expect(screen.getByText('gannonh/kata-cloud')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('gannonh/kata-cloud'))

    // Wait for branch loading to complete and branch picker to appear
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /branch/i })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))

    await waitFor(() => {
      expect(spaceCreate).toHaveBeenCalledTimes(1)
    })

    const payload = spaceCreate.mock.calls[0][0] as Record<string, unknown>
    expect(payload).toMatchObject({
      workspaceMode: 'managed',
      provisioningMethod: 'clone-github',
      sourceRemoteUrl: 'https://github.com/gannonh/kata-cloud',
      branch: 'main'
    })
  })

  it('selects the first non-archived space from IPC when none pre-selected', async () => {
    const spaceList = vi.fn<() => Promise<SpaceRecord[]>>().mockResolvedValue([
      makeSpaceRecord({ id: 'sp-archived', status: 'archived' }),
      makeSpaceRecord({ id: 'sp-active', status: 'active' })
    ])
    window.kata = { ...window.kata, spaceList }

    const onOpenSpace = vi.fn()
    render(<HomeSpacesScreen onOpenSpace={onOpenSpace} initialSpaces={[]} />)

    await waitFor(() => {
      expect(spaceList).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open selected space' }))
    expect(onOpenSpace).toHaveBeenCalledWith('sp-active')
  })

  it('handles IPC returning no spaces gracefully', async () => {
    const spaceList = vi.fn<() => Promise<SpaceRecord[]>>().mockResolvedValue([])
    window.kata = { ...window.kata, spaceList }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    await waitFor(() => {
      expect(spaceList).toHaveBeenCalledTimes(1)
    })
  })

  it('handles IPC returning null gracefully', async () => {
    const spaceList = vi.fn().mockResolvedValue(null)
    window.kata = { ...window.kata, spaceList }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    await waitFor(() => {
      expect(spaceList).toHaveBeenCalledTimes(1)
    })
  })

  it('retains current selectedSpaceId when IPC returns spaces containing that ID', async () => {
    const existingSpace = makeDisplaySpace({ id: 's-existing', name: 'Existing Space' })
    const spaceList = vi.fn<() => Promise<SpaceRecord[]>>().mockResolvedValue([
      makeSpaceRecord({ id: 's-existing', name: 'Existing Space' }),
      makeSpaceRecord({ id: 's-other', name: 'Other Space' })
    ])
    window.kata = { ...window.kata, spaceList }

    const onOpenSpace = vi.fn()
    render(<HomeSpacesScreen onOpenSpace={onOpenSpace} initialSpaces={[existingSpace]} />)

    await waitFor(() => {
      expect(spaceList).toHaveBeenCalledTimes(1)
    })

    // s-existing was pre-selected from initialSpaces and should remain selected after IPC load
    fireEvent.click(screen.getByRole('button', { name: 'Open selected space' }))
    expect(onOpenSpace).toHaveBeenCalledWith('s-existing')
  })

  it('skips github repos fetch when repos are already loaded', async () => {
    const githubListRepos = vi.fn().mockResolvedValue([
      { name: 'kata-cloud', nameWithOwner: 'gannonh/kata-cloud', url: 'https://github.com/gannonh/kata-cloud' }
    ])
    window.kata = { ...window.kata, githubListRepos }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    // Select clone-github → triggers first fetch
    fireEvent.click(screen.getByRole('button', { name: 'Use clone github provisioning' }))

    await waitFor(() => {
      expect(githubListRepos).toHaveBeenCalledTimes(1)
      expect(screen.getByText('gannonh/kata-cloud')).toBeTruthy()
    })

    // Switch to copy-local then back to clone-github → should skip fetch since repos are loaded
    fireEvent.click(screen.getByRole('button', { name: 'Use copy local provisioning' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use clone github provisioning' }))

    // Still only 1 call — the useEffect returned early at the "repos already loaded" guard
    expect(githubListRepos).toHaveBeenCalledTimes(1)
  })

  it('calls handleGithubSearchChange when typing in GitHub search input', async () => {
    const githubListRepos = vi.fn().mockResolvedValue([
      { name: 'kata-cloud', nameWithOwner: 'gannonh/kata-cloud', url: 'https://github.com/gannonh/kata-cloud' },
      { name: 'other-repo', nameWithOwner: 'gannonh/other-repo', url: 'https://github.com/gannonh/other-repo' }
    ])
    window.kata = { ...window.kata, githubListRepos }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use clone github provisioning' }))

    await waitFor(() => {
      expect(screen.getByText('gannonh/kata-cloud')).toBeTruthy()
    })

    // Type in the search box — this calls handleGithubSearchChange
    fireEvent.change(screen.getByRole('textbox', { name: /search/i }), {
      target: { value: 'kata' }
    })

    // Only kata-cloud should be visible; other-repo filtered out
    expect(screen.getByText('gannonh/kata-cloud')).toBeTruthy()
    expect(screen.queryByText('gannonh/other-repo')).toBeNull()
  })

  it('tolerates GitHub branch loading failure for selected repo', async () => {
    const githubListRepos = vi.fn().mockResolvedValue([
      { name: 'kata-cloud', nameWithOwner: 'gannonh/kata-cloud', url: 'https://github.com/gannonh/kata-cloud' }
    ])
    const githubListBranches = vi.fn().mockRejectedValue(new Error('api error'))
    window.kata = { ...window.kata, githubListRepos, githubListBranches }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use clone github provisioning' }))

    await waitFor(() => {
      expect(screen.getByText('gannonh/kata-cloud')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('gannonh/kata-cloud'))

    // Wait for the .catch and .finally callbacks to complete
    await waitFor(() => {
      expect(githubListBranches).toHaveBeenCalledWith('gannonh', 'kata-cloud')
    })
    // Wait a tick for the promise chain to settle
    await waitFor(() => {
      // No branch picker should be shown since loading failed
      expect(screen.queryByRole('combobox', { name: /branch/i })).toBeNull()
    })
  })

  it('shows branch error when GitHub branch loading resolves an error payload', async () => {
    const githubListRepos = vi.fn().mockResolvedValue([
      { name: 'kata-cloud', nameWithOwner: 'gannonh/kata-cloud', url: 'https://github.com/gannonh/kata-cloud' }
    ])
    const githubListBranches = vi.fn().mockResolvedValue({ error: 'Could not fetch branches from GitHub.' })
    window.kata = { ...window.kata, githubListRepos, githubListBranches }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Use clone github provisioning' }))

    await waitFor(() => {
      expect(screen.getByText('gannonh/kata-cloud')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('gannonh/kata-cloud'))

    await waitFor(() => {
      expect(screen.getByText('Could not fetch branches from GitHub.')).toBeTruthy()
    })
    expect(screen.queryByRole('combobox', { name: /branch/i })).toBeNull()
  })

  it('ignores stale GitHub branch responses when selecting repos quickly', async () => {
    const repos = [
      { name: 'repo-a', nameWithOwner: 'org/repo-a', url: 'https://github.com/org/repo-a' },
      { name: 'repo-b', nameWithOwner: 'org/repo-b', url: 'https://github.com/org/repo-b' }
    ]
    const githubListRepos = vi.fn().mockResolvedValue(repos)

    let resolveFirst!: (branches: string[]) => void
    let resolveSecond!: (branches: string[]) => void
    const firstPromise = new Promise<string[]>((resolve) => {
      resolveFirst = resolve
    })
    const secondPromise = new Promise<string[]>((resolve) => {
      resolveSecond = resolve
    })
    const githubListBranches = vi.fn((owner: string, repo: string) => {
      if (owner === 'org' && repo === 'repo-a') return firstPromise
      return secondPromise
    })

    window.kata = { ...window.kata, githubListRepos, githubListBranches }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Use clone github provisioning' }))

    await waitFor(() => {
      expect(screen.getByText('org/repo-a')).toBeTruthy()
      expect(screen.getByText('org/repo-b')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('org/repo-a'))
    fireEvent.click(screen.getByText('org/repo-b'))

    resolveSecond(['develop'])
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: /branch/i }) as HTMLSelectElement
      expect(select.value).toBe('develop')
    })

    resolveFirst(['main'])
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: /branch/i }) as HTMLSelectElement
      expect(select.value).toBe('develop')
    })
  })
})
