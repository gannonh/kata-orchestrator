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
import { createRun, updateRunStatus, appendRunMessage, getRunsForSession } from './orchestrator'
import { createAgentRunner } from './agent-runner'
import type { AgentRunner } from './agent-runner'
import type { AuthStorage } from './auth-storage'
import type { CredentialResolver } from './credential-resolver'
import type { SessionRuntimeEvent } from '../renderer/types/session-runtime-adapter'

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
const RUN_SUBMIT_CHANNEL = 'run:submit'
const RUN_ABORT_CHANNEL = 'run:abort'
const RUN_LIST_CHANNEL = 'run:list'
const RUN_EVENT_CHANNEL = 'run:event'
const AUTH_STATUS_CHANNEL = 'auth:status'
const AUTH_LOGIN_CHANNEL = 'auth:login'
const AUTH_LOGOUT_CHANNEL = 'auth:logout'
const MODEL_LIST_CHANNEL = 'model:list'

const SUPPORTED_MODELS = [
  { provider: 'openai-codex', modelId: 'gpt-5.3-codex', name: 'GPT-5.3 Codex' },
  { provider: 'anthropic', modelId: 'claude-sonnet-4-6-20250514', name: 'Claude Sonnet 4.6' },
  { provider: 'anthropic', modelId: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
  { provider: 'openai', modelId: 'gpt-4.1-2025-04-14', name: 'GPT-4.1' },
  { provider: 'openai', modelId: 'gpt-4.1-mini-2025-04-14', name: 'GPT-4.1 Mini' }
]

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
  authStorage?: AuthStorage
  credentialResolver?: CredentialResolver
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

  // Run/Auth/Model handlers

  const activeRunners = new Map<string, AgentRunner>()

  ipcMain.removeHandler(RUN_SUBMIT_CHANNEL)
  ipcMain.handle(RUN_SUBMIT_CHANNEL, async (event, input: unknown) => {
    if (!isObjectRecord(input)) throw new Error('run:submit input must be an object')
    const { sessionId, prompt, model, provider } = input
    if (
      typeof sessionId !== 'string' ||
      typeof prompt !== 'string' ||
      typeof model !== 'string' ||
      typeof provider !== 'string'
    ) {
      throw new Error('run:submit requires sessionId, prompt, model, provider strings')
    }

    const credResolver = options?.credentialResolver
    if (!credResolver) throw new Error('No credential resolver configured')

    const apiKey = await credResolver.getApiKey(provider)
    if (!apiKey) throw new Error(`No credentials available for provider: ${provider}`)

    const run = createRun(stateStore, { sessionId, prompt, model, provider })

    const runner = createAgentRunner({
      model,
      provider,
      apiKey,
      systemPrompt: 'You are a helpful AI assistant.',
      onEvent: (runtimeEvent: SessionRuntimeEvent) => {
        try {
          event.sender.send(RUN_EVENT_CHANNEL, runtimeEvent)
        } catch {
          /* sender may be destroyed */
        }

        if (runtimeEvent.type === 'message_appended') {
          const msg = runtimeEvent.message
          appendRunMessage(stateStore, run.id, {
            id: msg.id,
            role: msg.role as 'user' | 'agent',
            content: msg.content,
            createdAt: msg.createdAt
          })
        }
        if (runtimeEvent.type === 'run_state_changed') {
          if (runtimeEvent.runState === 'pending') {
            updateRunStatus(stateStore, run.id, 'running')
          } else if (runtimeEvent.runState === 'idle') {
            updateRunStatus(stateStore, run.id, 'completed')
            activeRunners.delete(run.id)
          } else if (runtimeEvent.runState === 'error') {
            updateRunStatus(stateStore, run.id, 'failed', runtimeEvent.errorMessage)
            activeRunners.delete(run.id)
          }
        }
      }
    })

    activeRunners.set(run.id, runner)
    runner.execute(prompt).catch(() => {
      updateRunStatus(stateStore, run.id, 'failed', 'Run execution failed unexpectedly')
      activeRunners.delete(run.id)
    })

    return { runId: run.id }
  })

  ipcMain.removeHandler(RUN_ABORT_CHANNEL)
  ipcMain.handle(RUN_ABORT_CHANNEL, async (_event, input: unknown) => {
    if (!isObjectRecord(input) || typeof input.runId !== 'string') {
      throw new Error('run:abort requires a string runId')
    }
    const runner = activeRunners.get(input.runId)
    if (runner) {
      runner.abort()
      activeRunners.delete(input.runId)
      return true
    }
    return false
  })

  ipcMain.removeHandler(RUN_LIST_CHANNEL)
  ipcMain.handle(RUN_LIST_CHANNEL, async (_event, input: unknown) => {
    if (!isObjectRecord(input) || typeof input.sessionId !== 'string') {
      throw new Error('run:list requires a string sessionId')
    }
    return getRunsForSession(stateStore, input.sessionId)
  })

  ipcMain.removeHandler(AUTH_STATUS_CHANNEL)
  ipcMain.handle(AUTH_STATUS_CHANNEL, async (_event, input: unknown) => {
    if (!isObjectRecord(input) || typeof input.provider !== 'string') {
      throw new Error('auth:status requires a string provider')
    }
    const credResolver = options?.credentialResolver
    if (!credResolver) return 'none'
    return credResolver.getAuthStatus(input.provider)
  })

  ipcMain.removeHandler(AUTH_LOGIN_CHANNEL)
  ipcMain.handle(AUTH_LOGIN_CHANNEL, async (_event, input: unknown) => {
    if (!isObjectRecord(input) || typeof input.provider !== 'string') {
      throw new Error('auth:login requires a string provider')
    }
    // OAuth flow will be implemented in a later task
    return false
  })

  ipcMain.removeHandler(AUTH_LOGOUT_CHANNEL)
  ipcMain.handle(AUTH_LOGOUT_CHANNEL, async (_event, input: unknown) => {
    if (!isObjectRecord(input) || typeof input.provider !== 'string') {
      throw new Error('auth:logout requires a string provider')
    }
    const authStore = options?.authStorage
    if (!authStore) return false
    await authStore.remove(input.provider)
    return true
  })

  ipcMain.removeHandler(MODEL_LIST_CHANNEL)
  ipcMain.handle(MODEL_LIST_CHANNEL, async () => {
    const credResolver = options?.credentialResolver
    if (!credResolver) {
      return SUPPORTED_MODELS.map((m) => ({ ...m, authStatus: 'none' as const }))
    }

    const results = await Promise.all(
      SUPPORTED_MODELS.map(async (m) => ({
        ...m,
        authStatus: await credResolver.getAuthStatus(m.provider)
      }))
    )
    return results
  })
}
