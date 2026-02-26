import { randomUUID } from 'node:crypto'
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

type ManagedCreateSpaceInput = Extract<
  CreateSpaceInput,
  { workspaceMode?: 'managed'; provisioningMethod: ProvisioningMethod }
>

export type ProvisionManagedWorkspaceArgs = {
  workspaceBaseDir: string
  repoCacheBaseDir: string
  input: ManagedCreateSpaceInput
  runGit?: GitRunner
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

export async function provisionManagedWorkspace(
  args: ProvisionManagedWorkspaceArgs
): Promise<ProvisionedWorkspace> {
  assertAbsolutePath(args.workspaceBaseDir, 'workspaceBaseDir')
  assertAbsolutePath(args.repoCacheBaseDir, 'repoCacheBaseDir')
  validateManagedInput(args.input)

  if (args.input.provisioningMethod === 'clone-github' && args.runGit) {
    try {
      await args.runGit({
        cwd: args.repoCacheBaseDir,
        args: ['ls-remote', '--heads', args.input.sourceRemoteUrl, args.input.branch]
      })
    } catch (error) {
      throw toWorkspaceProvisioningError(
        'git',
        'Git operation failed',
        'Check git availability and repository access credentials.',
        error
      )
    }
  }

  const workspaceRootPath = path.join(args.workspaceBaseDir, `workspace-${randomUUID().slice(0, 8)}`)
  const rootPath = path.join(workspaceRootPath, 'repo')
  const cacheRepoPath = path.join(args.repoCacheBaseDir, `cache-${randomUUID().slice(0, 8)}`)

  return {
    rootPath,
    cacheRepoPath,
    repoUrl: args.input.repoUrl,
    branch: args.input.branch
  }
}
