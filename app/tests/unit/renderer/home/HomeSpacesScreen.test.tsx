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

  it('opens the currently selected space with the correct space ID', () => {
    const onOpenSpace = vi.fn()
    render(<HomeSpacesScreen onOpenSpace={onOpenSpace} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open selected space' }))
    expect(onOpenSpace).toHaveBeenCalledTimes(1)
    expect(onOpenSpace.mock.calls[0]?.[0]).toBe('space-wave-1')
  })
})
