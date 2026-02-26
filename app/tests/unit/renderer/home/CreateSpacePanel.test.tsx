import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { CreateSpacePanel } from '../../../../src/renderer/components/home/CreateSpacePanel'

function createBaseProps() {
  return {
    spaceName: 'kata-cloud',
    workspaceMode: 'managed' as const,
    provisioningMethod: 'copy-local' as const,
    sourceLocalPath: '/Users/me/dev/kata-cloud',
    sourceRemoteUrl: '',
    sourceBranch: 'main',
    newRepoParentDir: '/Users/me/dev',
    newRepoFolderName: '',
    workspacePath: '',
    createError: null,
    canCreate: true,
    isCreating: false,
    summaryLines: ['Editable files: /Users/me/.kata/workspaces/<id>/repo'],
    onSpaceNameChange: vi.fn(),
    onSelectWorkspaceMode: vi.fn(),
    onSelectProvisioningMethod: vi.fn(),
    onSourceLocalPathChange: vi.fn(),
    onSourceRemoteUrlChange: vi.fn(),
    onSourceBranchChange: vi.fn(),
    onNewRepoParentDirChange: vi.fn(),
    onNewRepoFolderNameChange: vi.fn(),
    onWorkspacePathChange: vi.fn(),
    onCreateSpace: vi.fn()
  }
}

describe('CreateSpacePanel', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders guided steps and removes legacy prompt-heavy controls', () => {
    render(<CreateSpacePanel {...createBaseProps()} />)

    expect(screen.getByText('Step 1 · Where work happens')).toBeTruthy()
    expect(screen.getByText('Step 2 · Source setup')).toBeTruthy()
    expect(screen.getByText('Step 3 · Space name')).toBeTruthy()
    expect(screen.getByText('Step 4 · Review and create')).toBeTruthy()
    expect(screen.queryByText('Step 3 · Execution mode')).toBeNull()

    expect(screen.queryByText("Let's get building!")).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'Space prompt' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Toggle rapid fire mode' })).toBeNull()
  })

  it('shows managed source options and summary lines in review step', () => {
    render(<CreateSpacePanel {...createBaseProps()} />)

    expect(screen.getByRole('button', { name: 'Use copy local provisioning' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Use clone github provisioning' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Use new repo provisioning' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Branch' })).toBeTruthy()
    expect(screen.getByText('Editable files: /Users/me/.kata/workspaces/<id>/repo')).toBeTruthy()
  })

  it('switches to external mode fields when workspace mode is external', () => {
    render(
      <CreateSpacePanel
        {...createBaseProps()}
        workspaceMode="external"
      />
    )

    expect(screen.getByRole('textbox', { name: 'Workspace path' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Use copy local provisioning' })).toBeNull()
  })

  it('disables create action until required fields are satisfied', () => {
    render(
      <CreateSpacePanel
        {...createBaseProps()}
        canCreate={false}
      />
    )

    expect(screen.getByRole('button', { name: 'Create space' })).toHaveProperty('disabled', true)
  })

  it('shows create progress indicator while creation is running', () => {
    render(
      <CreateSpacePanel
        {...createBaseProps()}
        isCreating={true}
      />
    )

    expect(screen.getByRole('button', { name: 'Create space' })).toHaveProperty('disabled', true)
    expect(screen.getByText('Creating space...')).toBeTruthy()
  })
})
