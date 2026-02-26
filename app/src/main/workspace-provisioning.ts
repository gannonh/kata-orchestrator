import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

import type { CreateSpaceInput, ProvisioningMethod } from '../shared/types/space'

export type WorkspaceProvisioningErrorCategory = 'validation' | 'git' | 'filesystem'

export class WorkspaceProvisioningError extends Error {
  constructor(
    public readonly category: WorkspaceProvisioningErrorCategory,
    message: string,
    public readonly remediation?: string
  ) {
    super(message)
    this.name = 'WorkspaceProvisioningError'
  }
}

export type GitRunner = (input: { cwd: string, args: string[] }) => Promise<unknown>
export type FsApi = {
  mkdir: (target: string, options?: { recursive?: boolean }) => Promise<void>
  cp: (source: string, target: string, options?: { recursive?: boolean }) => Promise<void>
  access: (target: string) => Promise<void>
  writeFile: (target: string, data: string) => Promise<void>
}

type ManagedCreateSpaceInput = Extract<
  CreateSpaceInput,
  { workspaceMode?: 'managed'; provisioningMethod: ProvisioningMethod }
>

export type ProvisionManagedWorkspaceArgs = {
  workspaceBaseDir: string
  repoCacheBaseDir: string
  input: ManagedCreateSpaceInput
  runGit?: GitRunner
  fsApi?: FsApi
}

export type ProvisionedWorkspace = {
  rootPath: string
  cacheRepoPath: string
  repoUrl: string
  branch: string
}

const execFileAsync = promisify(execFile)

function assertAbsolutePath(value: string, fieldName: string): void {
  if (!path.isAbsolute(value)) {
    throw new WorkspaceProvisioningError(
      'validation',
      `${fieldName} must be an absolute path`,
      `Provide an absolute filesystem path for ${fieldName}.`
    )
  }
}

function toWorkspaceProvisioningError(
  category: WorkspaceProvisioningErrorCategory,
  message: string,
  remediation: string,
  error: unknown
): WorkspaceProvisioningError {
  if (error instanceof WorkspaceProvisioningError) {
    return error
  }

  const details = error instanceof Error ? error.message : 'Unknown failure'
  return new WorkspaceProvisioningError(category, `${message}: ${details}`, remediation)
}

function validateManagedInput(input: ManagedCreateSpaceInput): void {
  if (!input.branch.trim()) {
    throw new WorkspaceProvisioningError('validation', 'branch must be a non-empty string', 'Provide a branch name.')
  }

  switch (input.provisioningMethod) {
    case 'copy-local':
      assertAbsolutePath(input.sourceLocalPath, 'sourceLocalPath')
      break
    case 'clone-github':
      if (!input.sourceRemoteUrl.trim()) {
        throw new WorkspaceProvisioningError(
          'validation',
          'sourceRemoteUrl must be a non-empty string',
          'Provide a valid remote repository URL.'
        )
      }
      break
    case 'new-repo':
      assertAbsolutePath(input.newRepoParentDir, 'newRepoParentDir')
      if (!input.newRepoFolderName.trim()) {
        throw new WorkspaceProvisioningError(
          'validation',
          'newRepoFolderName must be a non-empty string',
          'Provide a folder name for the new repository.'
        )
      }
      break
    default:
      throw new WorkspaceProvisioningError(
        'validation',
        'Unsupported provisioning method',
        'Use one of: copy-local, clone-github, new-repo.'
      )
  }
}

function getRepoKey(input: ManagedCreateSpaceInput): string {
  switch (input.provisioningMethod) {
    case 'copy-local':
      return path.basename(input.sourceLocalPath).trim() || 'repo'
    case 'clone-github': {
      const normalized = input.sourceRemoteUrl.trim().replace(/\/+$/, '')
      const lastSegment = normalized.split('/').pop() ?? 'repo'
      return lastSegment.replace(/\.git$/i, '') || 'repo'
    }
    case 'new-repo':
      return input.newRepoFolderName.trim() || 'repo'
    default:
      return 'repo'
  }
}

async function pathExists(fsApi: FsApi, target: string): Promise<boolean> {
  try {
    await fsApi.access(target)
    return true
  } catch {
    return false
  }
}

async function runGitChecked(
  runGit: GitRunner,
  input: { cwd: string, args: string[] },
  message: string,
  remediation: string
): Promise<void> {
  try {
    await runGit(input)
  } catch (error) {
    throw toWorkspaceProvisioningError('git', message, remediation, error)
  }
}

async function fetchAllRemotes(runGit: GitRunner, cacheRepoPath: string, required: boolean): Promise<void> {
  try {
    await runGit({ cwd: cacheRepoPath, args: ['fetch', '--all', '--prune'] })
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)
    const noRemotePattern = /No remote repository specified|No such remote|does not appear to be a git repository/i
    if (!required && noRemotePattern.test(details)) {
      return
    }

    throw toWorkspaceProvisioningError(
      'git',
      'Failed to refresh cached repository',
      'Check git availability and repository configuration.',
      error
    )
  }
}

async function detachCacheHead(runGit: GitRunner, cacheRepoPath: string): Promise<void> {
  await runGitChecked(
    runGit,
    { cwd: cacheRepoPath, args: ['checkout', '--detach'] },
    'Failed to detach cache repository HEAD',
    'Check repository branch state before provisioning.'
  )
}

async function gitRefExists(runGit: GitRunner, cwd: string, ref: string): Promise<boolean> {
  try {
    await runGit({ cwd, args: ['show-ref', '--verify', ref] })
    return true
  } catch {
    return false
  }
}

async function ensureBranchInCache(runGit: GitRunner, cacheRepoPath: string, branch: string): Promise<void> {
  const localRef = `refs/heads/${branch}`
  if (await gitRefExists(runGit, cacheRepoPath, localRef)) {
    return
  }

  const remoteRef = `refs/remotes/origin/${branch}`
  if (await gitRefExists(runGit, cacheRepoPath, remoteRef)) {
    await runGitChecked(
      runGit,
      { cwd: cacheRepoPath, args: ['checkout', '-b', branch, '--track', `origin/${branch}`] },
      `Failed to create local tracking branch ${branch}`,
      `Check whether origin/${branch} exists and is accessible.`
    )
    return
  }

  await runGitChecked(
    runGit,
    { cwd: cacheRepoPath, args: ['checkout', '-b', branch] },
    `Failed to create local branch ${branch}`,
    'Create the branch manually or verify repository HEAD is valid.'
  )
}

export async function provisionManagedWorkspace(
  args: ProvisionManagedWorkspaceArgs
): Promise<ProvisionedWorkspace> {
  assertAbsolutePath(args.workspaceBaseDir, 'workspaceBaseDir')
  assertAbsolutePath(args.repoCacheBaseDir, 'repoCacheBaseDir')
  validateManagedInput(args.input)

  const runGit: GitRunner = args.runGit ?? (async ({ cwd, args: gitArgs }) => {
    try {
      await execFileAsync('git', gitArgs, { cwd })
    } catch (error) {
      const maybeError = error as NodeJS.ErrnoException & { stderr?: string | Buffer }
      const stderr = typeof maybeError.stderr === 'string'
        ? maybeError.stderr
        : maybeError.stderr?.toString('utf8')
      const message = stderr?.trim() || maybeError.message || 'git command failed'
      throw new Error(message)
    }
  })
  const fsApi: FsApi = args.fsApi ?? {
    mkdir: async (target, options) => {
      await fs.promises.mkdir(target, options)
    },
    cp: async (source, target, options) => {
      await fs.promises.cp(source, target, options)
    },
    access: async (target) => {
      await fs.promises.access(target)
    },
    writeFile: async (target, data) => {
      await fs.promises.writeFile(target, data)
    }
  }

  const repoKey = getRepoKey(args.input)
  const cacheRepoPath = args.input.provisioningMethod === 'new-repo'
    ? path.join(args.input.newRepoParentDir, args.input.newRepoFolderName.trim())
    : path.join(args.repoCacheBaseDir, repoKey)
  const workspaceRootPath = path.join(args.workspaceBaseDir, `${repoKey}-${randomUUID().slice(0, 8)}`)
  const workspaceRepoPath = path.join(workspaceRootPath, 'repo')

  if (args.input.provisioningMethod === 'copy-local') {
    const cacheExists = await pathExists(fsApi, cacheRepoPath)
    if (!cacheExists) {
      await fsApi.mkdir(args.repoCacheBaseDir, { recursive: true })
      try {
        await fsApi.cp(args.input.sourceLocalPath, cacheRepoPath, { recursive: true })
      } catch (error) {
        throw toWorkspaceProvisioningError(
          'filesystem',
          'Failed to materialize local repository cache',
          'Verify the source repository path is accessible.',
          error
        )
      }
    }

    await fetchAllRemotes(runGit, cacheRepoPath, false)
    await ensureBranchInCache(runGit, cacheRepoPath, args.input.branch)
    await detachCacheHead(runGit, cacheRepoPath)

    await fsApi.mkdir(workspaceRootPath, { recursive: true })
    await runGitChecked(
      runGit,
      { cwd: cacheRepoPath, args: ['worktree', 'add', workspaceRepoPath, args.input.branch] },
      'Failed to create workspace worktree',
      'Verify branch exists or create it before provisioning.'
    )

    return {
      rootPath: workspaceRepoPath,
      cacheRepoPath,
      repoUrl: args.input.repoUrl,
      branch: args.input.branch
    }
  }

  if (args.input.provisioningMethod === 'clone-github') {
    const cacheExists = await pathExists(fsApi, cacheRepoPath)
    if (!cacheExists) {
      await fsApi.mkdir(args.repoCacheBaseDir, { recursive: true })
      await runGitChecked(
        runGit,
        { cwd: args.repoCacheBaseDir, args: ['clone', args.input.sourceRemoteUrl, cacheRepoPath] },
        'Failed to clone remote repository into cache',
        'Check repository URL and GitHub authentication.'
      )
    } else {
      await fetchAllRemotes(runGit, cacheRepoPath, true)
    }
    await ensureBranchInCache(runGit, cacheRepoPath, args.input.branch)
    await detachCacheHead(runGit, cacheRepoPath)

    await fsApi.mkdir(workspaceRootPath, { recursive: true })
    await runGitChecked(
      runGit,
      { cwd: cacheRepoPath, args: ['worktree', 'add', workspaceRepoPath, args.input.branch] },
      'Failed to create workspace worktree',
      'Verify branch exists or create it before provisioning.'
    )

    return {
      rootPath: workspaceRepoPath,
      cacheRepoPath,
      repoUrl: args.input.repoUrl,
      branch: args.input.branch
    }
  }

  if (args.input.provisioningMethod === 'new-repo') {
    const repoAlreadyInitialized = await pathExists(fsApi, path.join(cacheRepoPath, '.git'))
    if (!repoAlreadyInitialized) {
      try {
        await fsApi.mkdir(cacheRepoPath, { recursive: true })
      } catch (error) {
        throw toWorkspaceProvisioningError(
          'filesystem',
          'Failed to create new repository directory',
          'Verify write permission to the requested source repository directory.',
          error
        )
      }

      await runGitChecked(
        runGit,
        { cwd: cacheRepoPath, args: ['init'] },
        'Failed to initialize new repository',
        'Check git installation and cache directory permissions.'
      )

      try {
        await fsApi.writeFile(
          path.join(cacheRepoPath, 'README.md'),
          `# ${args.input.newRepoFolderName.trim() || 'New Repository'}\n`
        )
      } catch (error) {
        throw toWorkspaceProvisioningError(
          'filesystem',
          'Failed to write repository bootstrap files',
          'Verify write permission to the requested source repository directory.',
          error
        )
      }

      await runGitChecked(
        runGit,
        { cwd: cacheRepoPath, args: ['add', 'README.md'] },
        'Failed to stage bootstrap files',
        'Check repository state before provisioning.'
      )
      await runGitChecked(
        runGit,
        {
          cwd: cacheRepoPath,
          args: [
            '-c',
            'user.name=Kata',
            '-c',
            'user.email=kata@local',
            'commit',
            '-m',
            'Initial commit'
          ]
        },
        'Failed to create bootstrap commit',
        'Check git commit configuration for managed repositories.'
      )
    }

    await ensureBranchInCache(runGit, cacheRepoPath, args.input.branch)
    await detachCacheHead(runGit, cacheRepoPath)

    await fsApi.mkdir(workspaceRootPath, { recursive: true })
    await runGitChecked(
      runGit,
      { cwd: cacheRepoPath, args: ['worktree', 'add', workspaceRepoPath, args.input.branch] },
      'Failed to create workspace worktree',
      'Verify branch exists or create it before provisioning.'
    )

    return {
      rootPath: workspaceRepoPath,
      cacheRepoPath,
      repoUrl: args.input.repoUrl,
      branch: args.input.branch
    }
  }

  throw new WorkspaceProvisioningError(
    'validation',
    'Unsupported provisioning method',
    'Use one of: copy-local, clone-github, new-repo.'
  )
}
