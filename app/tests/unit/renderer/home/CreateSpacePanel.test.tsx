import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

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

  it('wires workspace/provisioning selection and input handlers', () => {
    const props = createBaseProps()
    render(<CreateSpacePanel {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use managed workspace' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use my existing folder/worktree (developer-managed)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use copy local provisioning' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use clone github provisioning' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use new repo provisioning' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Local repo path' }), {
      target: { value: '/Users/me/dev/updated' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Branch' }), {
      target: { value: 'feature/test' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Space name' }), {
      target: { value: 'updated-space' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))

    expect(props.onSelectWorkspaceMode).toHaveBeenCalledWith('managed')
    expect(props.onSelectWorkspaceMode).toHaveBeenCalledWith('external')
    expect(props.onSelectProvisioningMethod).toHaveBeenCalledWith('copy-local')
    expect(props.onSelectProvisioningMethod).toHaveBeenCalledWith('clone-github')
    expect(props.onSelectProvisioningMethod).toHaveBeenCalledWith('new-repo')
    expect(props.onSourceLocalPathChange).toHaveBeenCalledWith('/Users/me/dev/updated')
    expect(props.onSourceBranchChange).toHaveBeenCalledWith('feature/test')
    expect(props.onSpaceNameChange).toHaveBeenCalledWith('updated-space')
    expect(props.onCreateSpace).toHaveBeenCalledTimes(1)
  })

  it('renders and wires clone-github and new-repo specific fields', () => {
    const cloneProps = createBaseProps()
    render(
      <CreateSpacePanel
        {...cloneProps}
        provisioningMethod="clone-github"
        sourceRemoteUrl="https://github.com/org/repo.git"
      />
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Remote repo URL' }), {
      target: { value: 'https://github.com/org/updated.git' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Branch' }), {
      target: { value: 'release/v1' }
    })
    expect(cloneProps.onSourceRemoteUrlChange).toHaveBeenCalledWith('https://github.com/org/updated.git')
    expect(cloneProps.onSourceBranchChange).toHaveBeenCalledWith('release/v1')

    cleanup()

    const newRepoProps = createBaseProps()
    render(
      <CreateSpacePanel
        {...newRepoProps}
        provisioningMethod="new-repo"
      />
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Source repo parent directory' }), {
      target: { value: '/Users/me/dev2' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Source repo folder name' }), {
      target: { value: 'my-repo' }
    })
    expect(newRepoProps.onNewRepoParentDirChange).toHaveBeenCalledWith('/Users/me/dev2')
    expect(newRepoProps.onNewRepoFolderNameChange).toHaveBeenCalledWith('my-repo')
  })

  it('renders create error message and external workspace path callback', () => {
    const props = createBaseProps()
    render(
      <CreateSpacePanel
        {...props}
        workspaceMode="external"
        workspacePath="/Users/me/worktrees/repo"
        createError="Boom"
      />
    )

    expect(screen.getByRole('alert').textContent).toContain('Boom')
    fireEvent.change(screen.getByRole('textbox', { name: 'Workspace path' }), {
      target: { value: '/Users/me/worktrees/next' }
    })
    expect(props.onWorkspacePathChange).toHaveBeenCalledWith('/Users/me/worktrees/next')
  })
})
