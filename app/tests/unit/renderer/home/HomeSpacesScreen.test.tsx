import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { HomeSpacesScreen } from '../../../../src/renderer/components/home/HomeSpacesScreen'
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
    const dialogOpenDirectory = vi.fn().mockResolvedValue({ path: '/Users/me/dev/repo' })
    const gitListBranches = vi.fn().mockResolvedValue(['main'])
    const createdRecord = makeSpaceRecord({ id: 'space-external' })
    const spaceCreate = vi.fn<(input: unknown) => Promise<SpaceRecord>>().mockResolvedValue(createdRecord)
    window.kata = { ...window.kata, spaceCreate, dialogOpenDirectory, gitListBranches }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use my existing folder/worktree (developer-managed)' }))
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
    expect(payload.workspaceMode).toBe('external')
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
    render(<HomeSpacesScreen onOpenSpace={() => {}} />)

    expect(screen.queryByText('Archived migration notes')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show archived spaces' }))
    expect(screen.getByText('Archived migration notes')).toBeTruthy()

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
    const onOpenSpace = vi.fn()
    render(<HomeSpacesScreen onOpenSpace={onOpenSpace} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open selected space' }))
    expect(onOpenSpace).toHaveBeenCalledTimes(1)
    expect(onOpenSpace.mock.calls[0]?.[0]).toBe('space-wave-1')
  })

  it('selects another space from the list before opening it', () => {
    const onOpenSpace = vi.fn()
    render(<HomeSpacesScreen onOpenSpace={onOpenSpace} />)

    fireEvent.click(screen.getByRole('button', { name: 'Select space Left panel parity follow-ups' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open selected space' }))

    expect(onOpenSpace).toHaveBeenCalledWith('space-left-panel')
  })
})
