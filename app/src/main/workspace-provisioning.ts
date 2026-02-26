import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

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
  if (input.workspaceMode === 'external') {
    throw new WorkspaceProvisioningError(
      'validation',
      'workspaceMode must be managed for managed provisioning',
      'Set workspaceMode to managed and provide a managed provisioning method.'
    )
  }

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

export async function provisionManagedWorkspace(
  args: ProvisionManagedWorkspaceArgs
): Promise<ProvisionedWorkspace> {
  assertAbsolutePath(args.workspaceBaseDir, 'workspaceBaseDir')
  assertAbsolutePath(args.repoCacheBaseDir, 'repoCacheBaseDir')
  validateManagedInput(args.input)

  const runGit = args.runGit
  const fsApi: FsApi = args.fsApi ?? {
    mkdir: fs.promises.mkdir,
    cp: fs.promises.cp,
    access: fs.promises.access,
    writeFile: fs.promises.writeFile
  }

  const repoKey = getRepoKey(args.input)
  const cacheRepoPath = path.join(args.repoCacheBaseDir, repoKey)
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

    if (runGit) {
      await runGitChecked(
        runGit,
        { cwd: cacheRepoPath, args: ['fetch', '--all', '--prune'] },
        'Failed to refresh cached repository',
        'Check git availability and repository health.'
      )

      await fsApi.mkdir(workspaceRootPath, { recursive: true })
      await runGitChecked(
        runGit,
        { cwd: cacheRepoPath, args: ['worktree', 'add', workspaceRepoPath, args.input.branch] },
        'Failed to create workspace worktree',
        'Verify branch exists or create it before provisioning.'
      )
    }

    return {
      rootPath: workspaceRepoPath,
      cacheRepoPath,
      repoUrl: args.input.repoUrl,
      branch: args.input.branch
    }
  }

  return {
    rootPath: workspaceRepoPath,
    cacheRepoPath,
    repoUrl: args.input.repoUrl,
    branch: args.input.branch
  }
}
