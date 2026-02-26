// @vitest-environment node

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
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

  it('rejects empty branch and invalid source values', async () => {
    await expect(provisionManagedWorkspace({
      workspaceBaseDir: '/tmp/ws',
      repoCacheBaseDir: '/tmp/cache',
      input: {
        workspaceMode: 'managed',
        provisioningMethod: 'copy-local',
        sourceLocalPath: '/Users/me/dev/repo',
        repoUrl: 'https://github.com/org/repo',
        branch: ''
      }
    })).rejects.toThrow('branch must be a non-empty string')

    await expect(provisionManagedWorkspace({
      workspaceBaseDir: '/tmp/ws',
      repoCacheBaseDir: '/tmp/cache',
      input: {
        workspaceMode: 'managed',
        provisioningMethod: 'clone-github',
        sourceRemoteUrl: '',
        repoUrl: 'https://github.com/org/repo',
        branch: 'main'
      }
    })).rejects.toThrow('sourceRemoteUrl must be a non-empty string')

    await expect(provisionManagedWorkspace({
      workspaceBaseDir: '/tmp/ws',
      repoCacheBaseDir: '/tmp/cache',
      input: {
        workspaceMode: 'managed',
        provisioningMethod: 'new-repo',
        newRepoParentDir: '/Users/me/dev',
        newRepoFolderName: '',
        repoUrl: '',
        branch: 'main'
      }
    })).rejects.toThrow('newRepoFolderName must be a non-empty string')

    await expect(provisionManagedWorkspace({
      workspaceBaseDir: '/tmp/ws',
      repoCacheBaseDir: '/tmp/cache',
      input: {
        workspaceMode: 'managed',
        provisioningMethod: 'not-supported' as never,
        repoUrl: '',
        branch: 'main'
      } as never
    })).rejects.toThrow('Unsupported provisioning method')
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

  it('falls back to repo key when copy-local basename is blank-ish', async () => {
    const runGit = vi.fn().mockResolvedValue(undefined)
    const fsApi = createMockFsApi(['/tmp/repos/repo'])

    await provisionManagedWorkspace({
      workspaceBaseDir: '/tmp/workspaces',
      repoCacheBaseDir: '/tmp/repos',
      input: {
        workspaceMode: 'managed',
        provisioningMethod: 'copy-local',
        sourceLocalPath: '/tmp/   ',
        repoUrl: 'https://github.com/org/repo-fallback',
        branch: 'main'
      },
      runGit,
      fsApi
    })

    expect(runGit).toHaveBeenCalledWith(expect.objectContaining({
      cwd: '/tmp/repos/repo',
      args: ['fetch', '--all', '--prune']
    }))
  })

  it('treats missing remotes as non-fatal for copy-local cache refresh', async () => {
    const runGit = vi.fn(async ({ args }: { cwd: string, args: string[] }) => {
      if (args[0] === 'fetch') {
        throw new Error('No remote repository specified')
      }
    })
    await provisionManagedWorkspace({
      workspaceBaseDir: '/tmp/workspaces',
      repoCacheBaseDir: '/tmp/repos',
      input: {
        workspaceMode: 'managed',
        provisioningMethod: 'copy-local',
        sourceLocalPath: '/Users/me/dev/kata-cloud',
        repoUrl: 'https://github.com/gannonh/kata-cloud',
        branch: 'main'
      },
      runGit,
      fsApi: createMockFsApi(['/tmp/repos/kata-cloud'])
    })

    expect(runGit).toHaveBeenCalledWith(expect.objectContaining({
      cwd: '/tmp/repos/kata-cloud',
      args: ['fetch', '--all', '--prune']
    }))
    expect(runGit).toHaveBeenCalledWith(expect.objectContaining({
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

  it('falls back to repo key when clone remote last segment is .git', async () => {
    const runGit = vi.fn().mockResolvedValue(undefined)
    await provisionManagedWorkspace({
      workspaceBaseDir: '/tmp/workspaces',
      repoCacheBaseDir: '/tmp/repos',
      input: {
        workspaceMode: 'managed',
        provisioningMethod: 'clone-github',
        sourceRemoteUrl: 'https://github.com/org/.git',
        repoUrl: 'https://github.com/org/repo',
        branch: 'main'
      },
      runGit,
      fsApi: createMockFsApi()
    })

    expect(runGit).toHaveBeenCalledWith(expect.objectContaining({
      cwd: '/tmp/repos',
      args: ['clone', 'https://github.com/org/.git', '/tmp/repos/repo']
    }))
  })

  it('initializes new managed repo and provisions requested branch worktree', async () => {
    const runGit = vi.fn().mockResolvedValue(undefined)
    const fsApi = createMockFsApi()
    const sourceRepoPath = '/Users/me/dev/new-project'

    const result = await provisionManagedWorkspace({
      workspaceBaseDir: '/tmp/workspaces',
      repoCacheBaseDir: '/tmp/repos',
      input: {
        workspaceMode: 'managed',
        provisioningMethod: 'new-repo',
        newRepoParentDir: '/Users/me/dev',
        newRepoFolderName: 'new-project',
        repoUrl: '',
        branch: 'main'
      },
      runGit,
      fsApi
    })

    expect(result.rootPath).toMatch(/\/tmp\/workspaces\/.+\/repo$/)
    expect(runGit).toHaveBeenCalledWith(expect.objectContaining({
      cwd: sourceRepoPath,
      args: ['init']
    }))
    expect(fsApi.writeFile).toHaveBeenCalledWith(`${sourceRepoPath}/README.md`, expect.any(String))
    expect(runGit).toHaveBeenCalledWith(expect.objectContaining({
      cwd: sourceRepoPath,
      args: ['add', 'README.md']
    }))
    expect(runGit).toHaveBeenCalledWith(expect.objectContaining({
      cwd: sourceRepoPath,
      args: expect.arrayContaining(['commit', '-m', 'Initial commit'])
    }))
    expect(result.cacheRepoPath).toBe(sourceRepoPath)
    expect(runGit).toHaveBeenCalledWith(expect.objectContaining({
      args: ['worktree', 'add', expect.any(String), 'main']
    }))
  })

  it('creates local tracking branch when only remote branch exists', async () => {
    const runGit = vi.fn(async ({ args }: { cwd: string, args: string[] }) => {
      if (args[0] === 'show-ref' && args[2] === 'refs/heads/main') {
        throw new Error('missing local branch')
      }
      if (args[0] === 'show-ref' && args[2] === 'refs/remotes/origin/main') {
        return
      }
    })

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

    expect(runGit).toHaveBeenCalledWith(expect.objectContaining({
      cwd: '/tmp/repos/repo',
      args: ['checkout', '-b', 'main', '--track', 'origin/main']
    }))
  })

  it('creates a local branch when neither local nor remote refs exist', async () => {
    const runGit = vi.fn(async ({ args }: { cwd: string, args: string[] }) => {
      if (args[0] === 'show-ref') {
        throw new Error('missing ref')
      }
    })

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

    expect(runGit).toHaveBeenCalledWith(expect.objectContaining({
      cwd: '/tmp/repos/repo',
      args: ['checkout', '-b', 'main']
    }))
  })

  it('wraps filesystem failures for cache copy/bootstrap operations', async () => {
    const copyFailureFs = createMockFsApi()
    copyFailureFs.cp.mockRejectedValueOnce(new Error('cp failed'))
    await expect(provisionManagedWorkspace({
      workspaceBaseDir: '/tmp/workspaces',
      repoCacheBaseDir: '/tmp/repos',
      input: {
        workspaceMode: 'managed',
        provisioningMethod: 'copy-local',
        sourceLocalPath: '/Users/me/dev/kata-cloud',
        repoUrl: 'https://github.com/org/repo',
        branch: 'main'
      },
      runGit: vi.fn().mockResolvedValue(undefined),
      fsApi: copyFailureFs
    })).rejects.toMatchObject({
      category: 'filesystem',
      message: expect.stringContaining('Failed to materialize local repository cache')
    })

    const mkdirFailureFs = createMockFsApi()
    mkdirFailureFs.mkdir.mockRejectedValueOnce(new Error('mkdir denied'))
    await expect(provisionManagedWorkspace({
      workspaceBaseDir: '/tmp/workspaces',
      repoCacheBaseDir: '/tmp/repos',
      input: {
        workspaceMode: 'managed',
        provisioningMethod: 'new-repo',
        newRepoParentDir: '/Users/me/dev',
        newRepoFolderName: 'new-project',
        repoUrl: '',
        branch: 'main'
      },
      runGit: vi.fn().mockResolvedValue(undefined),
      fsApi: mkdirFailureFs
    })).rejects.toMatchObject({
      category: 'filesystem',
      message: expect.stringContaining('Failed to create new repository directory')
    })

    const writeFailureFs = createMockFsApi()
    writeFailureFs.writeFile.mockRejectedValueOnce(new Error('write denied'))
    await expect(provisionManagedWorkspace({
      workspaceBaseDir: '/tmp/workspaces',
      repoCacheBaseDir: '/tmp/repos',
      input: {
        workspaceMode: 'managed',
        provisioningMethod: 'new-repo',
        newRepoParentDir: '/Users/me/dev',
        newRepoFolderName: 'new-project',
        repoUrl: '',
        branch: 'main'
      },
      runGit: vi.fn().mockResolvedValue(undefined),
      fsApi: writeFailureFs
    })).rejects.toMatchObject({
      category: 'filesystem',
      message: expect.stringContaining('Failed to write repository bootstrap files')
    })
  })

  it('uses default git/fs implementations when runGit/fsApi are not provided', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'kata-managed-workspace-'))
    const workspaceBaseDir = path.join(tempRoot, 'workspaces')
    const repoCacheBaseDir = path.join(tempRoot, 'repos')

    const result = await provisionManagedWorkspace({
      workspaceBaseDir,
      repoCacheBaseDir,
      input: {
        workspaceMode: 'managed',
        provisioningMethod: 'new-repo',
        newRepoParentDir: repoCacheBaseDir,
        newRepoFolderName: 'from-default-fs',
        repoUrl: '',
        branch: 'main'
      }
    })

    const readmePath = path.join(repoCacheBaseDir, 'from-default-fs', 'README.md')
    await expect(fs.access(readmePath)).resolves.toBeUndefined()
    expect(result.rootPath).toContain(path.join('workspaces', 'from-default-fs-'))

    await fs.rm(tempRoot, { recursive: true, force: true })
  })

  it('wraps runGitChecked failures during worktree creation', async () => {
    const runGit = vi.fn(async ({ args }: { cwd: string, args: string[] }) => {
      if (args[0] === 'worktree' && args[1] === 'add') {
        throw new Error('worktree add failed')
      }
    })
    await expect(provisionManagedWorkspace({
      workspaceBaseDir: '/tmp/workspaces',
      repoCacheBaseDir: '/tmp/repos',
      input: {
        workspaceMode: 'managed',
        provisioningMethod: 'copy-local',
        sourceLocalPath: '/Users/me/dev/kata-cloud',
        repoUrl: 'https://github.com/org/repo',
        branch: 'main'
      },
      runGit,
      fsApi: createMockFsApi(['/tmp/repos/kata-cloud'])
    })).rejects.toMatchObject({
      category: 'git',
      message: expect.stringContaining('Failed to create workspace worktree')
    })
  })

  it('uses default fs cp path for copy-local provisioning', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'kata-managed-workspace-copy-'))
    const sourceRepoPath = path.join(tempRoot, 'source-repo')
    const workspaceBaseDir = path.join(tempRoot, 'workspaces')
    const repoCacheBaseDir = path.join(tempRoot, 'repos')

    await fs.mkdir(sourceRepoPath, { recursive: true })
    execFileSync('git', ['init'], { cwd: sourceRepoPath })
    await fs.writeFile(path.join(sourceRepoPath, 'README.md'), '# source\n')
    execFileSync('git', ['add', 'README.md'], { cwd: sourceRepoPath })
    execFileSync(
      'git',
      ['-c', 'user.name=Kata', '-c', 'user.email=kata@local', 'commit', '-m', 'Initial commit'],
      { cwd: sourceRepoPath }
    )

    const result = await provisionManagedWorkspace({
      workspaceBaseDir,
      repoCacheBaseDir,
      input: {
        workspaceMode: 'managed',
        provisioningMethod: 'copy-local',
        sourceLocalPath: sourceRepoPath,
        repoUrl: 'https://github.com/org/source-repo',
        branch: 'main'
      }
    })

    await expect(fs.access(path.join(repoCacheBaseDir, 'source-repo'))).resolves.toBeUndefined()
    expect(result.rootPath).toContain(path.join('workspaces', 'source-repo-'))
    await fs.rm(tempRoot, { recursive: true, force: true })
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

  it('preserves already-typed provisioning errors and handles non-Error failures', async () => {
    const typedError = new WorkspaceProvisioningError('git', 'typed failure', 'fix it')
    const typedRunGit = vi.fn().mockRejectedValue(typedError)
    await expect(provisionManagedWorkspace({
      workspaceBaseDir: '/tmp/ws',
      repoCacheBaseDir: '/tmp/cache',
      input: {
        workspaceMode: 'managed',
        provisioningMethod: 'copy-local',
        sourceLocalPath: '/Users/me/dev/kata-cloud',
        repoUrl: 'https://github.com/org/repo',
        branch: 'main'
      },
      runGit: typedRunGit,
      fsApi: createMockFsApi(['/tmp/cache/kata-cloud'])
    })).rejects.toBe(typedError)

    const nonErrorRunGit = vi.fn().mockRejectedValue('no-remote-as-string')
    await expect(provisionManagedWorkspace({
      workspaceBaseDir: '/tmp/ws',
      repoCacheBaseDir: '/tmp/cache',
      input: {
        workspaceMode: 'managed',
        provisioningMethod: 'clone-github',
        sourceRemoteUrl: 'https://github.com/org/repo.git',
        repoUrl: 'https://github.com/org/repo',
        branch: 'main'
      },
      runGit: nonErrorRunGit,
      fsApi: createMockFsApi(['/tmp/cache/repo'])
    })).rejects.toThrow('Failed to refresh cached repository: Unknown failure')
  })
})
