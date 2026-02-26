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

  it('removes legacy prompt-focused UI from create panel', () => {
    render(<HomeSpacesScreen onOpenSpace={() => {}} />)

    expect(screen.queryByRole('textbox', { name: 'Space prompt' })).toBeNull()
    expect(screen.queryByText("Let's get building!")).toBeNull()
    expect(screen.queryByRole('button', { name: 'Toggle rapid fire mode' })).toBeNull()
  })

  it('defaults space name to repo label only in UI', () => {
    render(<HomeSpacesScreen onOpenSpace={() => {}} />)
    expect(screen.getByRole('textbox', { name: 'Space name' })).toHaveProperty('value', 'kata-cloud')
  })

  it('falls back to selected space repoUrl when selected repo label is blank', () => {
    render(<HomeSpacesScreen
      onOpenSpace={() => {}}
      initialSpaces={[
        {
          ...makeSpaceRecord({
            id: 'space-repo-url-fallback',
            repoUrl: 'https://github.com/acme/repo-fallback.git'
          }),
          repo: '',
          elapsed: '',
          archived: false
        }
      ]}
    />)
    expect(screen.getByRole('textbox', { name: 'Space name' })).toHaveProperty('value', 'repo-fallback')
  })

  it('submits copy-local payload with selected-space root fallback', async () => {
    const createdRecord = makeSpaceRecord({
      id: 'space-created-copy-local',
      name: 'Copy Local Space'
    })
    const spaceCreate = vi.fn<(input: unknown) => Promise<SpaceRecord>>().mockResolvedValue(createdRecord)
    window.kata = { ...window.kata, spaceCreate }

    render(<HomeSpacesScreen onOpenSpace={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))

    await waitFor(() => {
      expect(spaceCreate).toHaveBeenCalledTimes(1)
    })

    expect(spaceCreate).toHaveBeenCalledWith(expect.objectContaining({
      workspaceMode: 'managed',
      provisioningMethod: 'copy-local',
      sourceLocalPath: '/Users/gannonh/dev/kata/kata-cloud',
      branch: 'main'
    }))
  })

  it('submits clone-github payload with selected branch', async () => {
    const createdRecord = makeSpaceRecord({
      id: 'space-created-clone-branch',
      name: 'Clone Branch Space'
    })
    const spaceCreate = vi.fn<(input: unknown) => Promise<SpaceRecord>>().mockResolvedValue(createdRecord)
    window.kata = { ...window.kata, spaceCreate }

    render(<HomeSpacesScreen onOpenSpace={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use clone github provisioning' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Remote repo URL' }), {
      target: { value: 'https://github.com/gannonh/kata-cloud.git' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Branch' }), {
      target: { value: 'feature/demo-branch' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))

    await waitFor(() => {
      expect(spaceCreate).toHaveBeenCalledTimes(1)
    })

    expect(spaceCreate).toHaveBeenCalledWith(expect.objectContaining({
      workspaceMode: 'managed',
      provisioningMethod: 'clone-github',
      sourceRemoteUrl: 'https://github.com/gannonh/kata-cloud.git',
      branch: 'feature/demo-branch'
    }))
  })

  it('submits developer-managed mode with explicit workspace path', async () => {
    const createdRecord = makeSpaceRecord({
      id: 'space-created-external',
      name: 'External Path Space',
      rootPath: '/Users/gannonh/dev/custom/worktree'
    })
    const spaceCreate = vi.fn<(input: unknown) => Promise<SpaceRecord>>().mockResolvedValue(createdRecord)
    window.kata = { ...window.kata, spaceCreate }

    render(<HomeSpacesScreen onOpenSpace={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use my existing folder/worktree (developer-managed)' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Workspace path' }), {
      target: { value: '/Users/gannonh/dev/custom/worktree' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Space name' }), {
      target: { value: 'External Path Space' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))

    await waitFor(() => {
      expect(spaceCreate).toHaveBeenCalledTimes(1)
    })

    expect(spaceCreate).toHaveBeenCalledWith(expect.objectContaining({
      workspaceMode: 'external',
      rootPath: '/Users/gannonh/dev/custom/worktree',
      spaceNameOverride: 'External Path Space'
    }))
  })

  it('submits new-repo payload with derived parent dir when parent input is blank', async () => {
    const createdRecord = makeSpaceRecord({
      id: 'space-created-new-repo-default-parent',
      name: 'Managed New Repo Default Parent'
    })
    const spaceCreate = vi.fn<(input: unknown) => Promise<SpaceRecord>>().mockResolvedValue(createdRecord)
    window.kata = { ...window.kata, spaceCreate }

    render(<HomeSpacesScreen onOpenSpace={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use new repo provisioning' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Space name' }), {
      target: { value: 'Managed New Repo Default Parent' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Source repo folder name' }), {
      target: { value: 'managed-new-project' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))

    await waitFor(() => {
      expect(spaceCreate).toHaveBeenCalledTimes(1)
    })

    expect(spaceCreate).toHaveBeenCalledWith(expect.objectContaining({
      workspaceMode: 'managed',
      provisioningMethod: 'new-repo',
      newRepoFolderName: 'managed-new-project',
      newRepoParentDir: '/Users/gannonh/dev/kata'
    }))
  })

  it('shows create failure alert when IPC create rejects', async () => {
    const spaceCreate = vi.fn<(input: unknown) => Promise<SpaceRecord>>().mockRejectedValue(new Error('create failed'))
    window.kata = { ...window.kata, spaceCreate }

    render(<HomeSpacesScreen onOpenSpace={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('create failed')
    })
  })

  it('shows IPC unavailable error when create handler is not exposed', async () => {
    render(<HomeSpacesScreen onOpenSpace={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('IPC unavailable')
    })
  })

  it('shows validation error for external mode when no workspace path is available', async () => {
    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use my existing folder/worktree (developer-managed)' }))
    expect(screen.getByText('Editable files path: (required).')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create space' })).toHaveProperty('disabled', true)
  })

  it('shows validation error for clone mode when remote URL is missing', async () => {
    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use clone github provisioning' }))
    expect(screen.getByText('Source repo action: clone (required) on branch main.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create space' })).toHaveProperty('disabled', true)
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
    const spaceCreate = vi.fn<(input: unknown) => Promise<SpaceRecord>>().mockRejectedValue('')
    window.kata = { ...window.kata, spaceCreate }

    render(<HomeSpacesScreen onOpenSpace={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Failed to create space.')
    })
  })

  it('preserves selected space when refreshed list still contains it', async () => {
    const selected = makeSpaceRecord({
      id: 'space-keep',
      name: 'Keep Selected',
      repoUrl: 'https://github.com/gannonh/kata-cloud',
      rootPath: '/Users/gannonh/dev/kata/kata-cloud'
    })
    const spaceList = vi.fn<() => Promise<SpaceRecord[]>>().mockResolvedValue([
      selected,
      makeSpaceRecord({
        id: 'space-other',
        name: 'Other Space',
        repoUrl: 'https://github.com/gannonh/kata-orchestrator',
        rootPath: '/Users/gannonh/dev/kata/kata-orchestrator'
      })
    ])
    window.kata = { ...window.kata, spaceList }
    const onOpenSpace = vi.fn()

    render(<HomeSpacesScreen onOpenSpace={onOpenSpace} initialSpaces={[
      {
        ...selected,
        repo: 'gannonh/kata-cloud',
        elapsed: '',
        archived: false
      }
    ]} />)

    await waitFor(() => {
      expect(screen.getByText('Keep Selected')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open selected space' }))
    expect(onOpenSpace).toHaveBeenCalledWith('space-keep')
  })

  it('falls back to first fetched id when refreshed list has only archived spaces', async () => {
    const archived = makeSpaceRecord({
      id: 'space-archived-only',
      name: 'Archived Only',
      status: 'archived'
    })
    const spaceList = vi.fn<() => Promise<SpaceRecord[]>>().mockResolvedValue([archived])
    window.kata = { ...window.kata, spaceList }
    const onOpenSpace = vi.fn()

    render(<HomeSpacesScreen onOpenSpace={onOpenSpace} />)

    await waitFor(() => {
      expect(spaceList).toHaveBeenCalledTimes(1)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Show archived spaces' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open selected space' }))
    expect(onOpenSpace).toHaveBeenCalledWith('space-archived-only')
  })

  it('derives empty parent dir from root-only paths for managed new repo input', async () => {
    const spaceCreate = vi.fn<(input: unknown) => Promise<SpaceRecord>>().mockResolvedValue(
      makeSpaceRecord({ id: 'space-root-only' })
    )
    window.kata = { ...window.kata, spaceCreate }

    render(<HomeSpacesScreen
      onOpenSpace={() => {}}
      initialSpaces={[
        {
          ...makeSpaceRecord({
            id: 'space-root-path',
            rootPath: '/repo'
          }),
          repo: 'acme/repo',
          elapsed: '',
          archived: false
        }
      ]}
    />)

    fireEvent.click(screen.getByRole('button', { name: 'Use new repo provisioning' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Source repo folder name' }), {
      target: { value: 'root-only-repo' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))

    await waitFor(() => {
      expect(spaceCreate).toHaveBeenCalledTimes(1)
    })
    expect(spaceCreate).toHaveBeenCalledWith(expect.objectContaining({
      newRepoParentDir: ''
    }))
  })

  it('derives Windows drive root parent dir for managed new repo input', async () => {
    const spaceCreate = vi.fn<(input: unknown) => Promise<SpaceRecord>>().mockResolvedValue(
      makeSpaceRecord({ id: 'space-windows-parent' })
    )
    window.kata = { ...window.kata, spaceCreate }

    render(<HomeSpacesScreen
      onOpenSpace={() => {}}
      initialSpaces={[
        {
          ...makeSpaceRecord({
            id: 'space-windows-root',
            rootPath: 'C:\\repo'
          }),
          repo: 'acme/windows-repo',
          elapsed: '',
          archived: false
        }
      ]}
    />)

    fireEvent.click(screen.getByRole('button', { name: 'Use new repo provisioning' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Source repo folder name' }), {
      target: { value: 'windows-repo' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))

    await waitFor(() => {
      expect(spaceCreate).toHaveBeenCalledTimes(1)
    })
    expect(spaceCreate).toHaveBeenCalledWith(expect.objectContaining({
      newRepoParentDir: 'C:\\'
    }))
  })

  it('creates managed new-repo payload from empty initial state with default repoUrl/branch', async () => {
    const createdRecord = makeSpaceRecord({
      id: 'space-empty-initial-state',
      name: 'Empty Initial State'
    })
    const spaceCreate = vi.fn<(input: unknown) => Promise<SpaceRecord>>().mockResolvedValue(createdRecord)
    window.kata = { ...window.kata, spaceCreate }

    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use new repo provisioning' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Source repo folder name' }), {
      target: { value: 'empty-state-repo' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))

    await waitFor(() => {
      expect(spaceCreate).toHaveBeenCalledTimes(1)
    })
    expect(spaceCreate).toHaveBeenCalledWith(expect.objectContaining({
      repoUrl: '',
      branch: 'main',
      newRepoFolderName: 'empty-state-repo'
    }))
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
