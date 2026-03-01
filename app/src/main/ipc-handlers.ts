import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { dialog, ipcMain, shell } from 'electron'

const execFileAsync = promisify(execFile)

import {
  ORCHESTRATION_MODES,
  PROVISIONING_METHODS,
  WORKSPACE_MODES,
  createDefaultAppState
} from '../shared/types/space'
import { resolveSpaceName } from './space-name'
import type { StateStore } from './state-store'
import {
  WorkspaceProvisioningError,
  provisionManagedWorkspace
} from './workspace-provisioning'

import type {
  AppState,
  CreateSessionInput,
  CreateSpaceInput,
  OrchestrationMode,
  ProvisioningMethod,
  SessionRecord,
  SpaceRecord,
  WorkspaceMode
} from '../shared/types/space'

const OPEN_EXTERNAL_URL_CHANNEL = 'kata:openExternalUrl'
const SPACE_CREATE_CHANNEL = 'space:create'
const SPACE_LIST_CHANNEL = 'space:list'
const SPACE_GET_CHANNEL = 'space:get'
const SESSION_CREATE_CHANNEL = 'session:create'
const DIALOG_OPEN_DIR_CHANNEL = 'dialog:openDirectory'
const GIT_LIST_BRANCHES_CHANNEL = 'git:listBranches'
const GITHUB_LIST_REPOS_CHANNEL = 'github:listRepos'
const GITHUB_LIST_BRANCHES_CHANNEL = 'github:listBranches'

let inMemoryState = createDefaultAppState()

function getFallbackStore(): StateStore {
  return {
    load: () => inMemoryState,
    save: (nextState: AppState) => {
      inMemoryState = nextState
    }
  }
}

function isExternalHttpUrl(url: unknown): url is string {
  if (typeof url !== 'string') {
    return false
  }

  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch {
    return false
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isOrchestrationMode(value: unknown): value is OrchestrationMode {
  return typeof value === 'string' && ORCHESTRATION_MODES.includes(value as OrchestrationMode)
}

function isWorkspaceMode(value: unknown): value is WorkspaceMode {
  return typeof value === 'string' && WORKSPACE_MODES.includes(value as WorkspaceMode)
}

function isProvisioningMethod(value: unknown): value is ProvisioningMethod {
  return typeof value === 'string' && PROVISIONING_METHODS.includes(value as ProvisioningMethod)
}

type ParsedExternalCreateSpaceInput = Extract<CreateSpaceInput, { workspaceMode: 'external' }> & {
  workspaceMode: 'external'
  orchestrationMode?: OrchestrationMode
}

type ParsedManagedCreateSpaceInput = Extract<
  CreateSpaceInput,
  { workspaceMode?: 'managed'; provisioningMethod: ProvisioningMethod }
> & {
  workspaceMode: 'managed'
  orchestrationMode?: OrchestrationMode
}

type ParsedCreateSpaceInput = ParsedExternalCreateSpaceInput | ParsedManagedCreateSpaceInput

function parseCreateSpaceInput(input: unknown): ParsedCreateSpaceInput {
  if (!isObjectRecord(input)) {
    throw new Error('Space input must be an object')
  }

  const repoUrlValue = input.repoUrl
  const branchValue = input.branch
  if (typeof repoUrlValue !== 'string' || typeof branchValue !== 'string') {
    throw new Error('Space input is missing required string fields')
  }

  const workspaceModeValue = input.workspaceMode
  if (workspaceModeValue !== undefined && !isWorkspaceMode(workspaceModeValue)) {
    throw new Error('Space input has an invalid workspaceMode')
  }

  const orchestrationModeValue = input.orchestrationMode
  if (orchestrationModeValue !== undefined && !isOrchestrationMode(orchestrationModeValue)) {
    throw new Error('Space input has an invalid orchestrationMode')
  }

  const baseInput = {
    repoUrl: repoUrlValue,
    branch: branchValue,
    workspaceMode: (workspaceModeValue ?? 'managed') as WorkspaceMode,
    orchestrationMode: orchestrationModeValue
  }

  if (baseInput.workspaceMode === 'external') {
    const rootPathValue = input.rootPath
    if (typeof rootPathValue !== 'string' || !rootPathValue.trim()) {
      throw new Error('External workspace mode requires a non-empty rootPath')
    }
    const normalizedRootPath = rootPathValue.trim()
    if (!path.isAbsolute(normalizedRootPath)) {
      throw new Error('External workspace rootPath must be an absolute path')
    }

    return {
      ...baseInput,
      workspaceMode: 'external',
      rootPath: normalizedRootPath
    }
  }

  const provisioningMethodValue = input.provisioningMethod
  if (!isProvisioningMethod(provisioningMethodValue)) {
    throw new Error('Space input has an invalid provisioningMethod')
  }

  switch (provisioningMethodValue) {
    case 'copy-local': {
      const sourceLocalPath = input.sourceLocalPath
      if (typeof sourceLocalPath !== 'string' || !sourceLocalPath.trim()) {
        throw new Error('Space input sourceLocalPath must be a non-empty string')
      }
      return {
        ...baseInput,
        workspaceMode: 'managed',
        provisioningMethod: 'copy-local',
        sourceLocalPath: sourceLocalPath.trim()
      }
    }
    case 'clone-github': {
      const sourceRemoteUrl = input.sourceRemoteUrl
      if (typeof sourceRemoteUrl !== 'string' || !sourceRemoteUrl.trim()) {
        throw new Error('Space input sourceRemoteUrl must be a non-empty string')
      }
      return {
        ...baseInput,
        workspaceMode: 'managed',
        provisioningMethod: 'clone-github',
        sourceRemoteUrl: sourceRemoteUrl.trim()
      }
    }
    case 'new-repo': {
      const newRepoParentDir = input.newRepoParentDir
      const newRepoFolderName = input.newRepoFolderName
      if (typeof newRepoParentDir !== 'string') {
        throw new Error('Space input newRepoParentDir must be a string')
      }
      if (typeof newRepoFolderName !== 'string' || !newRepoFolderName.trim()) {
        throw new Error('Space input newRepoFolderName must be a non-empty string')
      }
      const normalizedParentDir = newRepoParentDir.trim() || path.join(os.homedir(), 'dev')
      return {
        ...baseInput,
        workspaceMode: 'managed',
        provisioningMethod: 'new-repo',
        newRepoParentDir: normalizedParentDir,
        newRepoFolderName: newRepoFolderName.trim()
      }
    }
  }
}

function parseSpaceGetInput(input: unknown): { id: string } {
  if (!isObjectRecord(input) || typeof input.id !== 'string') {
    throw new Error('space:get input must be an object with string id')
  }
  return { id: input.id }
}

function parseCreateSessionInput(input: unknown): CreateSessionInput {
  if (!isObjectRecord(input)) {
    throw new Error('Session input must be an object')
  }

  const { spaceId, label } = input
  if (typeof spaceId !== 'string' || typeof label !== 'string') {
    throw new Error('Session input is missing required string fields')
  }

  return { spaceId, label }
}

function extractRepoLabel(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '').replace(/\.git$/i, '')
  const segments = normalized.split(/[/:]/)
  return segments[segments.length - 1] || 'repo'
}

function deriveRepoLabel(input: ParsedCreateSpaceInput): string {
  if (input.workspaceMode === 'external') {
    return extractRepoLabel(input.repoUrl)
  }

  switch (input.provisioningMethod) {
    case 'copy-local':
      return path.basename(input.sourceLocalPath.trim()) || extractRepoLabel(input.repoUrl)
    case 'clone-github':
      return extractRepoLabel(input.sourceRemoteUrl) || extractRepoLabel(input.repoUrl)
    case 'new-repo':
      return input.newRepoFolderName.trim() || extractRepoLabel(input.repoUrl)
  }
}

export type RegisterIpcOptions = {
  workspaceBaseDir?: string
  repoCacheBaseDir?: string
}

export function registerIpcHandlers(store?: StateStore, options?: RegisterIpcOptions): void {
  const stateStore = store ?? getFallbackStore()
  const workspaceBaseDir = options?.workspaceBaseDir ?? path.join(os.homedir(), '.kata', 'workspaces')
  const repoCacheBaseDir = options?.repoCacheBaseDir ?? path.join(os.homedir(), '.kata', 'repos')

  ipcMain.removeHandler(OPEN_EXTERNAL_URL_CHANNEL)
  ipcMain.removeHandler(SPACE_CREATE_CHANNEL)
  ipcMain.removeHandler(SPACE_LIST_CHANNEL)
  ipcMain.removeHandler(SPACE_GET_CHANNEL)
  ipcMain.removeHandler(SESSION_CREATE_CHANNEL)

  ipcMain.handle(OPEN_EXTERNAL_URL_CHANNEL, async (_event, url: unknown) => {
    if (!isExternalHttpUrl(url)) {
      return false
    }

    await shell.openExternal(url)
    return true
  })

  ipcMain.handle(SPACE_CREATE_CHANNEL, async (_event, input: unknown) => {
    const parsedInput = parseCreateSpaceInput(input)
    const state = stateStore.load()
    const spaceId = randomUUID()

    const resolvedSpace = await (async () => {
      if (parsedInput.workspaceMode === 'external') {
        return {
          repoUrl: parsedInput.repoUrl,
          branch: parsedInput.branch,
          rootPath: parsedInput.rootPath
        }
      }

      try {
        const provisioned = await provisionManagedWorkspace({
          workspaceBaseDir,
          repoCacheBaseDir,
          input: parsedInput
        })
        return {
          repoUrl: provisioned.repoUrl,
          branch: provisioned.branch,
          rootPath: provisioned.rootPath
        }
      } catch (error) {
        if (error instanceof WorkspaceProvisioningError) {
          const remediation = error.remediation ? ` Remediation: ${error.remediation}` : ''
          throw new Error(
            `Managed provisioning failed (${error.category}): ${error.message}.${remediation}`.trim()
          )
        }
        throw error
      }
    })()

    const existingNames = new Set(Object.values(state.spaces).map((space) => space.name))
    const resolvedName = resolveSpaceName({
      repoLabel: deriveRepoLabel(parsedInput),
      existingNames
    })

    const createdSpace: SpaceRecord = {
      id: spaceId,
      name: resolvedName,
      repoUrl: resolvedSpace.repoUrl,
      rootPath: resolvedSpace.rootPath,
      branch: resolvedSpace.branch,
      workspaceMode: parsedInput.workspaceMode,
      orchestrationMode: parsedInput.orchestrationMode ?? 'team',
      createdAt: new Date().toISOString(),
      status: 'active'
    }

    try {
      stateStore.save({
        ...state,
        spaces: { ...state.spaces, [createdSpace.id]: createdSpace },
        activeSpaceId: state.activeSpaceId ?? createdSpace.id
      })
    } catch (saveError) {
      const code = (saveError as NodeJS.ErrnoException).code ?? 'UNKNOWN'
      throw new Error(`Space created but failed to save state (${code})`)
    }

    return createdSpace
  })

  ipcMain.handle(SPACE_LIST_CHANNEL, async () => Object.values(stateStore.load().spaces))

  ipcMain.handle(SPACE_GET_CHANNEL, async (_event, input: unknown) => {
    const { id } = parseSpaceGetInput(input)
    return stateStore.load().spaces[id] ?? null
  })

  ipcMain.handle(SESSION_CREATE_CHANNEL, async (_event, input: unknown) => {
    const parsedInput = parseCreateSessionInput(input)
    const state = stateStore.load()
    if (!state.spaces[parsedInput.spaceId]) {
      throw new Error(`Cannot create session for unknown space: ${parsedInput.spaceId}`)
    }

    const createdSession: SessionRecord = {
      id: randomUUID(),
      spaceId: parsedInput.spaceId,
      label: parsedInput.label,
      createdAt: new Date().toISOString()
    }

    stateStore.save({
      ...state,
      sessions: { ...state.sessions, [createdSession.id]: createdSession },
      activeSpaceId: parsedInput.spaceId,
      activeSessionId: createdSession.id
    })

    return createdSession
  })

  ipcMain.removeHandler(DIALOG_OPEN_DIR_CHANNEL)
  ipcMain.removeHandler(GIT_LIST_BRANCHES_CHANNEL)
  ipcMain.removeHandler(GITHUB_LIST_REPOS_CHANNEL)
  ipcMain.removeHandler(GITHUB_LIST_BRANCHES_CHANNEL)

  ipcMain.handle(DIALOG_OPEN_DIR_CHANNEL, async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    const selectedPath = result.filePaths[0]
    try {
      await fs.promises.access(path.join(selectedPath, '.git'))
    } catch {
      return { error: 'Selected directory is not a git repository.', path: selectedPath }
    }
    return { path: selectedPath }
  })

  ipcMain.handle(GIT_LIST_BRANCHES_CHANNEL, async (_event, repoPath: unknown) => {
    if (typeof repoPath !== 'string') {
      return { error: 'repoPath must be a string' }
    }
    try {
      const { stdout } = await execFileAsync('git', ['branch', '--list', '--format=%(refname:short)'], { cwd: repoPath })
      return stdout.trim().split('\n').filter(Boolean)
    } catch {
      return { error: 'Could not read branches.' }
    }
  })

  ipcMain.handle(GITHUB_LIST_REPOS_CHANNEL, async () => {
    try {
      const { stdout } = await execFileAsync('gh', [
        'repo', 'list', '--json', 'name,nameWithOwner,url', '--limit', '100'
      ])
      try {
        return JSON.parse(stdout)
      } catch {
        return { error: 'Failed to parse GitHub CLI response.' }
      }
    } catch {
      return { error: 'GitHub CLI not available. Install and authenticate with `gh auth login`.' }
    }
  })

  ipcMain.handle(GITHUB_LIST_BRANCHES_CHANNEL, async (_event, input: unknown) => {
    if (!isObjectRecord(input) || typeof input.owner !== 'string' || typeof input.repo !== 'string') {
      return { error: 'input must have string owner and repo fields' }
    }
    try {
      const { stdout } = await execFileAsync('gh', [
        'api', `repos/${input.owner}/${input.repo}/branches`, '--jq', '.[].name'
      ])
      return stdout.trim().split('\n').filter(Boolean)
    } catch {
      return { error: 'Could not fetch branches from GitHub.' }
    }
  })
}
