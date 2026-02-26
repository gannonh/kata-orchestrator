import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { CreateSpacePanel } from '../../../../src/renderer/components/home/CreateSpacePanel'

function createBaseProps() {
  return {
    isActive: true,
    prompt: '',
    spaceName: 'kata-cloud main',
    selectedMode: 'team' as const,
    workspaceMode: 'managed' as const,
    provisioningMethod: 'copy-local' as const,
    sourceLocalPath: '/Users/me/dev/kata-cloud',
    sourceRemoteUrl: '',
    newRepoParentDir: '',
    newRepoFolderName: '',
    workspacePath: '',
    rapidFire: false,
    repoName: 'gannonh/kata-cloud',
    branchName: 'main',
    createError: null,
    onPromptChange: vi.fn(),
    onSpaceNameChange: vi.fn(),
    onPromptFocus: vi.fn(),
    onSelectMode: vi.fn(),
    onSelectWorkspaceMode: vi.fn(),
    onSelectProvisioningMethod: vi.fn(),
    onSourceLocalPathChange: vi.fn(),
    onSourceRemoteUrlChange: vi.fn(),
    onNewRepoParentDirChange: vi.fn(),
    onNewRepoFolderNameChange: vi.fn(),
    onWorkspacePathChange: vi.fn(),
    onToggleRapidFire: vi.fn(),
    onCreateSpace: vi.fn()
  }
}

describe('CreateSpacePanel', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows copy-local input by default and allows selecting other methods', () => {
    const props = createBaseProps()
    render(<CreateSpacePanel {...props} />)

    expect(screen.getByRole('textbox', { name: 'Local repo path' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Use clone github provisioning' }))
    expect(props.onSelectProvisioningMethod).toHaveBeenCalledWith('clone-github')
  })

  it('shows clone-github remote URL input when selected', () => {
    const props = {
      ...createBaseProps(),
      provisioningMethod: 'clone-github' as const,
      sourceRemoteUrl: 'https://github.com/org/repo.git'
    }
    render(<CreateSpacePanel {...props} />)

    expect(screen.getByRole('textbox', { name: 'Remote repo URL' })).toBeTruthy()
  })

  it('shows new-repo parent and folder fields when selected', () => {
    const props = {
      ...createBaseProps(),
      provisioningMethod: 'new-repo' as const
    }
    render(<CreateSpacePanel {...props} />)

    expect(screen.getByRole('textbox', { name: 'New repo parent directory' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'New repo folder name' })).toBeTruthy()
  })

  it('updates space name through callback', () => {
    const props = createBaseProps()
    render(<CreateSpacePanel {...props} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Space name' }), {
      target: { value: 'My custom space' }
    })

    expect(props.onSpaceNameChange).toHaveBeenCalledWith('My custom space')
  })
})
