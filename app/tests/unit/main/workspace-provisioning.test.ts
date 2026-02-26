// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import {
  WorkspaceProvisioningError,
  provisionManagedWorkspace
} from '../../../src/main/workspace-provisioning'

type MockFsApi = {
  mkdir: ReturnType<typeof vi.fn>
  cp: ReturnType<typeof vi.fn>
  access: ReturnType<typeof vi.fn>
  writeFile: ReturnType<typeof vi.fn>
}

function createMockFsApi(existingPaths: string[] = []): MockFsApi {
  const existing = new Set(existingPaths)

  return {
    mkdir: vi.fn().mockResolvedValue(undefined),
    cp: vi.fn().mockResolvedValue(undefined),
    access: vi.fn(async (target: string) => {
      if (existing.has(target)) {
        return
      }
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    }),
    writeFile: vi.fn().mockResolvedValue(undefined)
  }
}

describe('provisionManagedWorkspace validation', () => {
  it('rejects non-absolute source paths for copy-local', async () => {
    await expect(provisionManagedWorkspace({
      workspaceBaseDir: '/tmp/ws',
      repoCacheBaseDir: '/tmp/cache',
      input: {
        workspaceMode: 'managed',
        provisioningMethod: 'copy-local',
        sourceLocalPath: 'relative/path',
        repoUrl: 'https://github.com/org/repo',
        branch: 'main'
      }
    })).rejects.toThrow('sourceLocalPath must be an absolute path')
  })

  it('copies local repo into cache and creates a worktree at <space>/repo', async () => {
    const mockRunGit = vi.fn().mockResolvedValue(undefined)
    const mockFsApi = createMockFsApi()

    const result = await provisionManagedWorkspace({
      workspaceBaseDir: '/tmp/workspaces',
      repoCacheBaseDir: '/tmp/repos',
      input: {
        workspaceMode: 'managed',
        provisioningMethod: 'copy-local',
        sourceLocalPath: '/Users/me/dev/kata-cloud',
        repoUrl: 'https://github.com/gannonh/kata-cloud',
        branch: 'main'
      },
      runGit: mockRunGit,
      fsApi: mockFsApi
    })

    expect(result.rootPath).toMatch(/\/tmp\/workspaces\/.+\/repo$/)
    expect(mockFsApi.cp).toHaveBeenCalledWith('/Users/me/dev/kata-cloud', expect.any(String), { recursive: true })
    expect(mockRunGit).toHaveBeenCalledWith(expect.objectContaining({
      args: ['fetch', '--all', '--prune']
    }))
    expect(mockRunGit).toHaveBeenCalledWith(expect.objectContaining({
      args: ['worktree', 'add', expect.any(String), 'main']
    }))
  })

  it('clones remote when cache is missing and fetches when cache exists', async () => {
    const runGit = vi.fn().mockResolvedValue(undefined)

    await provisionManagedWorkspace({
      workspaceBaseDir: '/tmp/workspaces',
      repoCacheBaseDir: '/tmp/repos',
      input: {
        workspaceMode: 'managed',
        provisioningMethod: 'clone-github',
        sourceRemoteUrl: 'https://github.com/org/repo.git',
        repoUrl: 'https://github.com/org/repo',
        branch: 'main'
      },
      runGit,
      fsApi: createMockFsApi()
    })

    expect(runGit).toHaveBeenCalledWith(expect.objectContaining({
      cwd: '/tmp/repos',
      args: ['clone', 'https://github.com/org/repo.git', '/tmp/repos/repo']
    }))
    expect(runGit).toHaveBeenCalledWith(expect.objectContaining({
      args: ['worktree', 'add', expect.any(String), 'main']
    }))

    runGit.mockClear()

    await provisionManagedWorkspace({
      workspaceBaseDir: '/tmp/workspaces',
      repoCacheBaseDir: '/tmp/repos',
      input: {
        workspaceMode: 'managed',
        provisioningMethod: 'clone-github',
        sourceRemoteUrl: 'https://github.com/org/repo.git',
        repoUrl: 'https://github.com/org/repo',
        branch: 'main'
      },
      runGit,
      fsApi: createMockFsApi(['/tmp/repos/repo'])
    })

    expect(runGit).not.toHaveBeenCalledWith(expect.objectContaining({
      args: ['clone', 'https://github.com/org/repo.git', '/tmp/repos/repo']
    }))
    expect(runGit).toHaveBeenCalledWith(expect.objectContaining({
      cwd: '/tmp/repos/repo',
      args: ['fetch', '--all', '--prune']
    }))
  })
})

describe('WorkspaceProvisioningError', () => {
  it('preserves category and remediation metadata', () => {
    const error = new WorkspaceProvisioningError('git', 'Clone failed', 'Check repository access')
    expect(error.category).toBe('git')
    expect(error.message).toBe('Clone failed')
    expect(error.remediation).toBe('Check repository access')
  })

  it('normalizes unknown git execution failures into a typed provisioning error', async () => {
    const runGit = vi.fn().mockRejectedValue(new Error('git exploded'))
    const mockFsApi = createMockFsApi(['/tmp/cache/kata-cloud'])

    const result = provisionManagedWorkspace({
      workspaceBaseDir: '/tmp/ws',
      repoCacheBaseDir: '/tmp/cache',
      input: {
        workspaceMode: 'managed',
        provisioningMethod: 'copy-local',
        sourceLocalPath: '/Users/me/dev/kata-cloud',
        repoUrl: 'https://github.com/org/repo',
        branch: 'main'
      },
      runGit,
      fsApi: mockFsApi
    })

    await expect(result).rejects.toMatchObject({
      category: 'git',
      remediation: expect.any(String)
    })
  })
})
