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
import { extractRepoLabel } from '../shared/repo-label'
import { toStableTaskId } from '../shared/task-id'
import { resolveSpaceName } from './space-name'
import type { StateStore } from './state-store'
import {
  WorkspaceProvisioningError,
  provisionManagedWorkspace
} from './workspace-provisioning'
import {
  createRun,
  updateRunStatus,
  appendRunMessage,
  setRunDraft,
  getRunsForSession
} from './orchestrator'
import {
  createTaskActivityProjector,
  type TaskActivitySeedItem
} from './task-activity-projector'
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
  SessionAgentRecord,
  SessionRecord,
  SpaceRecord,
  WorkspaceMode
} from '../shared/types/space'
import type { PersistedSpecDocument } from '../shared/types/spec-document'

const OPEN_EXTERNAL_URL_CHANNEL = 'kata:openExternalUrl'
const APP_BOOTSTRAP_CHANNEL = 'app:bootstrap'
const SPACE_CREATE_CHANNEL = 'space:create'
const SPACE_LIST_CHANNEL = 'space:list'
const SPACE_GET_CHANNEL = 'space:get'
const SPACE_SET_ACTIVE_CHANNEL = 'space:setActive'
const SESSION_CREATE_CHANNEL = 'session:create'
const SESSION_AGENT_ROSTER_LIST_CHANNEL = 'session-agent-roster:list'
const SESSION_LIST_BY_SPACE_CHANNEL = 'session:listBySpace'
const SESSION_SET_ACTIVE_CHANNEL = 'session:setActive'
const SPEC_GET_CHANNEL = 'spec:get'
const SPEC_SAVE_CHANNEL = 'spec:save'
const SPEC_APPLY_DRAFT_CHANNEL = 'spec:applyDraft'
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

function parseSessionAgentRosterListInput(input: unknown): { sessionId: string } {
  if (!isObjectRecord(input) || typeof input.sessionId !== 'string') {
    throw new Error('session-agent-roster:list input must be an object with string sessionId')
  }

  return { sessionId: input.sessionId }
}

function parseSessionListBySpaceInput(input: unknown): { spaceId: string } {
  if (!isObjectRecord(input) || typeof input.spaceId !== 'string') {
    throw new Error('session:listBySpace input must be an object with string spaceId')
  }

  return { spaceId: input.spaceId }
}

function parseSpaceSetActiveInput(input: unknown): { spaceId: string } {
  if (!isObjectRecord(input) || typeof input.spaceId !== 'string') {
    throw new Error('space:setActive input must be an object with string spaceId')
  }

  return { spaceId: input.spaceId }
}

function parseSessionSetActiveInput(input: unknown): { sessionId: string } {
  if (!isObjectRecord(input) || typeof input.sessionId !== 'string') {
    throw new Error('session:setActive input must be an object with string sessionId')
  }

  return { sessionId: input.sessionId }
}

function parseSpecGetInput(input: unknown): { spaceId: string; sessionId: string } {
  if (
    !isObjectRecord(input) ||
    typeof input.spaceId !== 'string' ||
    typeof input.sessionId !== 'string'
  ) {
    throw new Error('spec:get input must be an object with string spaceId and sessionId')
  }

  return { spaceId: input.spaceId, sessionId: input.sessionId }
}

function parseSpecSaveInput(input: unknown): {
  spaceId: string
  sessionId: string
  markdown: string
  appliedRunId?: string
  appliedAt?: string
} {
  if (
    !isObjectRecord(input) ||
    typeof input.spaceId !== 'string' ||
    typeof input.sessionId !== 'string' ||
    typeof input.markdown !== 'string'
  ) {
    throw new Error('spec:save input must include string spaceId, sessionId, and markdown')
  }

  if (input.appliedRunId !== undefined && typeof input.appliedRunId !== 'string') {
    throw new Error('spec:save appliedRunId must be a string when provided')
  }
  if (input.appliedAt !== undefined && typeof input.appliedAt !== 'string') {
    throw new Error('spec:save appliedAt must be a string when provided')
  }

  return {
    spaceId: input.spaceId,
    sessionId: input.sessionId,
    markdown: input.markdown,
    appliedRunId: input.appliedRunId,
    appliedAt: input.appliedAt
  }
}

function parseSpecApplyDraftInput(input: unknown): {
  spaceId: string
  sessionId: string
  draft: { runId: string; content: string }
} {
  if (
    !isObjectRecord(input) ||
    typeof input.spaceId !== 'string' ||
    typeof input.sessionId !== 'string' ||
    !isObjectRecord(input.draft)
  ) {
    throw new Error('spec:applyDraft input must include a draft object')
  }

  if (typeof input.draft.runId !== 'string' || typeof input.draft.content !== 'string') {
    throw new Error('spec:applyDraft draft must include string runId and content')
  }

  return {
    spaceId: input.spaceId,
    sessionId: input.sessionId,
    draft: {
      runId: input.draft.runId,
      content: input.draft.content
    }
  }
}

function assertSpecScope(state: AppState, spaceId: string, sessionId: string): void {
  if (!state.spaces[spaceId]) {
    throw new Error(`Unknown spaceId: ${spaceId}`)
  }
  const session = state.sessions[sessionId]
  if (!session) {
    throw new Error(`Unknown sessionId: ${sessionId}`)
  }
  if (session.spaceId !== spaceId) {
    throw new Error(`Session ${sessionId} does not belong to space ${spaceId}`)
  }
}

function buildSpecDocumentKey(spaceId: string, sessionId: string): string {
  return `${spaceId}:${sessionId}`
}

function parseTaskSeedItemsFromMarkdown(markdown: string): TaskActivitySeedItem[] {
  const lines = markdown.split(/\r?\n/)
  const taskLines: string[] = []
  let isTasksSection = false

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+?)\s*$/)
    if (headingMatch) {
      const normalizedHeading = headingMatch[1].trim().replace(/\s+/g, ' ').toLowerCase()
      isTasksSection = normalizedHeading === 'tasks'
      if (isTasksSection) {
        // Keep only the latest Tasks section to avoid duplicating instructional scaffolding.
        taskLines.length = 0
      }
      continue
    }

    if (!isTasksSection) {
      continue
    }

    taskLines.push(line)
  }

  const seeds: TaskActivitySeedItem[] = []
  const seenIds = new Map<string, number>()

  for (const line of taskLines) {
    const taskMatch = line.match(/^\s*(?:(?:[-*+]\s+|\d+[.)]\s+))?\[( |\/|x|X)\]\s+(.*?)\s*$/)
    if (!taskMatch) {
      continue
    }

    const title = taskMatch[2]
    const marker = taskMatch[1]

    seeds.push({
      id: toStableTaskId(title, seenIds),
      title,
      status: taskStatusForMarker(marker)
    })
  }

  return seeds
}

function taskStatusForMarker(marker: string): 'not_started' | 'in_progress' | 'complete' {
  if (marker === '/') {
    return 'in_progress'
  }

  if (marker.toLowerCase() === 'x') {
    return 'complete'
  }

  return 'not_started'
}

function resolveTaskSeedItemsForRun(
  state: AppState,
  runId: string,
  sessionId: string
): TaskActivitySeedItem[] {
  const session = state.sessions[sessionId]
  if (!session) {
    console.warn(`[task-seed] Session ${sessionId} not found in state during run ${runId}; task tracking will be empty`)
    return []
  }

  const specDocument = state.specDocuments[buildSpecDocumentKey(session.spaceId, sessionId)]
  if (specDocument?.markdown) {
    return parseTaskSeedItemsFromMarkdown(specDocument.markdown)
  }

  const run = state.runs[runId]
  if (run?.draft?.content) {
    return parseTaskSeedItemsFromMarkdown(run.draft.content)
  }

  return []
}

function createBaselineSessionAgentRoster(sessionId: string, createdAt: string): SessionAgentRecord[] {
  return [
    {
      id: randomUUID(),
      sessionId,
      name: 'Kata Agents',
      role: 'System-managed agent group',
      kind: 'system',
      status: 'idle',
      avatarColor: '#334155',
      sortOrder: 0,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: randomUUID(),
      sessionId,
      name: 'MVP Planning Coordinator',
      role: 'Coordinates MVP planning tasks',
      kind: 'coordinator',
      status: 'idle',
      avatarColor: '#0f766e',
      sortOrder: 1,
      createdAt,
      updatedAt: createdAt
    }
  ]
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

export function registerIpcHandlers(store: StateStore, options?: RegisterIpcOptions): void {
  if (!store) throw new Error('registerIpcHandlers requires a StateStore')
  const stateStore = store
  const workspaceBaseDir = options?.workspaceBaseDir ?? path.join(os.homedir(), '.kata', 'workspaces')
  const repoCacheBaseDir = options?.repoCacheBaseDir ?? path.join(os.homedir(), '.kata', 'repos')

  ipcMain.removeHandler(OPEN_EXTERNAL_URL_CHANNEL)
  ipcMain.removeHandler(APP_BOOTSTRAP_CHANNEL)
  ipcMain.removeHandler(SPACE_CREATE_CHANNEL)
  ipcMain.removeHandler(SPACE_LIST_CHANNEL)
  ipcMain.removeHandler(SPACE_GET_CHANNEL)
  ipcMain.removeHandler(SPACE_SET_ACTIVE_CHANNEL)
  ipcMain.removeHandler(SESSION_CREATE_CHANNEL)
  ipcMain.removeHandler(SESSION_AGENT_ROSTER_LIST_CHANNEL)
  ipcMain.removeHandler(SESSION_LIST_BY_SPACE_CHANNEL)
  ipcMain.removeHandler(SESSION_SET_ACTIVE_CHANNEL)
  ipcMain.removeHandler(SPEC_GET_CHANNEL)
  ipcMain.removeHandler(SPEC_SAVE_CHANNEL)
  ipcMain.removeHandler(SPEC_APPLY_DRAFT_CHANNEL)

  ipcMain.handle(OPEN_EXTERNAL_URL_CHANNEL, async (_event, url: unknown) => {
    if (!isExternalHttpUrl(url)) {
      return false
    }

    await shell.openExternal(url)
    return true
  })

  let bootstrapCompleted = false
  ipcMain.handle(APP_BOOTSTRAP_CHANNEL, async () => {
    const needsReconcile = !bootstrapCompleted
    const state = stateStore.load(needsReconcile ? { reconcileInterruptedRuns: true } : undefined)
    if (needsReconcile) {
      stateStore.save(state)
      bootstrapCompleted = true
    }
    return {
      spaces: state.spaces,
      sessions: state.sessions,
      specDocuments: state.specDocuments,
      activeSpaceId: state.activeSpaceId,
      activeSessionId: state.activeSessionId
    }
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

  ipcMain.handle(SPACE_SET_ACTIVE_CHANNEL, async (_event, input: unknown) => {
    const { spaceId } = parseSpaceSetActiveInput(input)
    const state = stateStore.load()
    if (!state.spaces[spaceId]) {
      throw new Error(`Cannot set active space to unknown id: ${spaceId}`)
    }

    // First check if the current active session belongs to this space.
    const currentSession = state.activeSessionId ? state.sessions[state.activeSessionId] : undefined
    let activeSessionId = currentSession && currentSession.spaceId === spaceId ? state.activeSessionId : null

    // If not, find the most recent session for this space so reopening
    // a workspace restores where the user left off.
    if (!activeSessionId) {
      const spaceSessions = Object.values(state.sessions)
        .filter((s) => s.spaceId === spaceId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      if (spaceSessions.length > 0) {
        activeSessionId = spaceSessions[0].id
      }
    }

    stateStore.save({
      ...state,
      activeSpaceId: spaceId,
      activeSessionId
    })

    return {
      activeSpaceId: spaceId,
      activeSessionId
    }
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
    const baselineRosterEntries = createBaselineSessionAgentRoster(
      createdSession.id,
      createdSession.createdAt
    )

    try {
      stateStore.save({
        ...state,
        sessions: { ...state.sessions, [createdSession.id]: createdSession },
        agentRoster: {
          ...state.agentRoster,
          ...Object.fromEntries(baselineRosterEntries.map((entry) => [entry.id, entry]))
        },
        activeSpaceId: parsedInput.spaceId,
        activeSessionId: createdSession.id
      })
    } catch (saveError) {
      const code = (saveError as NodeJS.ErrnoException).code ?? 'UNKNOWN'
      throw new Error(`Session created but failed to save state (${code})`)
    }

    return createdSession
  })

  ipcMain.handle(SESSION_AGENT_ROSTER_LIST_CHANNEL, async (_event, input: unknown) => {
    const { sessionId } = parseSessionAgentRosterListInput(input)

    return Object.values(stateStore.load().agentRoster)
      .filter((entry) => entry.sessionId === sessionId)
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder
        }

        return left.createdAt.localeCompare(right.createdAt)
      })
  })

  ipcMain.handle(SESSION_LIST_BY_SPACE_CHANNEL, async (_event, input: unknown) => {
    const { spaceId } = parseSessionListBySpaceInput(input)

    return Object.values(stateStore.load().sessions)
      .filter((session) => session.spaceId === spaceId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  })

  ipcMain.handle(SESSION_SET_ACTIVE_CHANNEL, async (_event, input: unknown) => {
    const { sessionId } = parseSessionSetActiveInput(input)
    const state = stateStore.load()
    const session = state.sessions[sessionId]
    if (!session) {
      throw new Error(`Cannot set active session to unknown id: ${sessionId}`)
    }

    stateStore.save({
      ...state,
      activeSpaceId: session.spaceId,
      activeSessionId: sessionId
    })

    return {
      activeSpaceId: session.spaceId,
      activeSessionId: sessionId
    }
  })

  ipcMain.handle(SPEC_GET_CHANNEL, async (_event, input: unknown) => {
    const { spaceId, sessionId } = parseSpecGetInput(input)
    const state = stateStore.load()
    assertSpecScope(state, spaceId, sessionId)
    const key = buildSpecDocumentKey(spaceId, sessionId)
    return state.specDocuments[key] ?? null
  })

  ipcMain.handle(SPEC_SAVE_CHANNEL, async (_event, input: unknown) => {
    const parsedInput = parseSpecSaveInput(input)
    const state = stateStore.load()
    assertSpecScope(state, parsedInput.spaceId, parsedInput.sessionId)
    const key = buildSpecDocumentKey(parsedInput.spaceId, parsedInput.sessionId)
    const existing = state.specDocuments[key]
    const updatedAt = new Date().toISOString()

    const specDocument: PersistedSpecDocument = {
      markdown: parsedInput.markdown,
      updatedAt,
      ...(existing?.appliedRunId !== undefined && { appliedRunId: existing.appliedRunId }),
      ...(existing?.appliedAt !== undefined && { appliedAt: existing.appliedAt }),
      ...(parsedInput.appliedRunId !== undefined && { appliedRunId: parsedInput.appliedRunId }),
      ...(parsedInput.appliedAt !== undefined && { appliedAt: parsedInput.appliedAt })
    }

    stateStore.save({
      ...state,
      specDocuments: {
        ...state.specDocuments,
        [key]: specDocument
      }
    })

    return specDocument
  })

  ipcMain.handle(SPEC_APPLY_DRAFT_CHANNEL, async (_event, input: unknown) => {
    const parsedInput = parseSpecApplyDraftInput(input)
    const state = stateStore.load()
    assertSpecScope(state, parsedInput.spaceId, parsedInput.sessionId)
    const run = state.runs[parsedInput.draft.runId]
    if (!run || run.sessionId !== parsedInput.sessionId) {
      throw new Error(
        `Draft run ${parsedInput.draft.runId} does not belong to session ${parsedInput.sessionId}`
      )
    }
    const key = buildSpecDocumentKey(parsedInput.spaceId, parsedInput.sessionId)
    const appliedAt = new Date().toISOString()

    const specDocument: PersistedSpecDocument = {
      markdown: parsedInput.draft.content,
      updatedAt: appliedAt,
      appliedRunId: parsedInput.draft.runId,
      appliedAt
    }

    const existingRun = state.runs[parsedInput.draft.runId]
    stateStore.save({
      ...state,
      specDocuments: {
        ...state.specDocuments,
        [key]: specDocument
      },
      ...(existingRun && {
        runs: {
          ...state.runs,
          [parsedInput.draft.runId]: { ...existingRun, draftAppliedAt: appliedAt }
        }
      })
    })

    return specDocument
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
    } catch (err) {
      console.error('[IPC] git:listBranches failed:', err)
      const detail = err instanceof Error ? err.message : 'Unknown error'
      return { error: `Could not read branches: ${detail}` }
    }
  })

  ipcMain.handle(GITHUB_LIST_REPOS_CHANNEL, async () => {
    try {
      const { stdout } = await execFileAsync('gh', [
        'repo', 'list', '--json', 'name,nameWithOwner,url', '--limit', '100'
      ])
      try {
        return JSON.parse(stdout)
      } catch (parseErr) {
        console.error('[IPC] github:listRepos JSON parse failed:', parseErr)
        return { error: 'Failed to parse GitHub CLI response.' }
      }
    } catch (err) {
      console.error('[IPC] github:listRepos failed:', err)
      const detail = err instanceof Error ? err.message : 'Unknown error'
      return { error: `GitHub CLI error: ${detail}` }
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
    } catch (err) {
      console.error('[IPC] github:listBranches failed:', err)
      const detail = err instanceof Error ? err.message : 'Unknown error'
      return { error: `Could not fetch branches from GitHub: ${detail}` }
    }
  })

  // Run/Auth/Model handlers

  const activeRunners = new Map<string, AgentRunner>()
  const taskActivityProjector = createTaskActivityProjector()

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
        const sendRuntimeEventToRenderer = (nextEvent: SessionRuntimeEvent) => {
          try {
            const enrichedEvent =
              nextEvent.type === 'message_appended' || nextEvent.type === 'message_updated'
                ? { ...nextEvent, runId: run.id }
                : nextEvent
            event.sender.send(RUN_EVENT_CHANNEL, enrichedEvent)
            return true
          } catch (err) {
            if (event.sender.isDestroyed()) {
              const orphanedRunner = activeRunners.get(run.id)
              if (orphanedRunner) {
                orphanedRunner.abort()
                activeRunners.delete(run.id)
                updateRunStatus(stateStore, run.id, 'failed', 'Renderer window closed')
              }
              return false
            }
            console.error('[IPC] Failed to send run event to renderer:', err)
            return false
          }
        }

        const emitTaskSnapshot = (snapshot: ReturnType<typeof taskActivityProjector.getSnapshot>) => {
          if (!snapshot) {
            return
          }

          sendRuntimeEventToRenderer({
            type: 'task_activity_snapshot',
            snapshot
          })
        }

        if (!sendRuntimeEventToRenderer(runtimeEvent)) {
          return
        }

        if (runtimeEvent.type === 'run_state_changed' && runtimeEvent.runState === 'pending') {
          const currentState = stateStore.load()
          const taskSeedItems = resolveTaskSeedItemsForRun(currentState, run.id, sessionId)
          const snapshot = taskActivityProjector.onRunPending({
            sessionId,
            runId: run.id,
            tasks: taskSeedItems
          })
          emitTaskSnapshot(snapshot)
        } else if (
          runtimeEvent.type === 'run_state_changed' &&
          (runtimeEvent.runState === 'idle' || runtimeEvent.runState === 'error')
        ) {
          emitTaskSnapshot(
            taskActivityProjector.onRunSettled({
              sessionId,
              runId: run.id
            })
          )
        } else if (
          runtimeEvent.type === 'message_updated' ||
          runtimeEvent.type === 'message_appended'
        ) {
          emitTaskSnapshot(
            taskActivityProjector.onMessageActivity({
              sessionId,
              runId: run.id,
              detail: runtimeEvent.message.content?.slice(0, 200) ?? ''
            })
          )
        }

        if (runtimeEvent.type === 'message_appended') {
          const msg = runtimeEvent.message
          appendRunMessage(stateStore, run.id, {
            id: msg.id,
            role: msg.role as 'user' | 'agent',
            content: msg.content,
            createdAt: msg.createdAt
          })
          if (msg.role === 'agent') {
            setRunDraft(stateStore, run.id, {
              runId: run.id,
              generatedAt: msg.createdAt,
              content: msg.content
            })
          }
        }
        // Map runtime ConversationRunState to persisted RunStatus:
        // 'pending' (agent starting) -> 'running'
        // 'idle' (agent done) -> 'completed'
        // 'error' -> 'failed'
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
    runner.execute(prompt).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Run execution failed unexpectedly'
      updateRunStatus(stateStore, run.id, 'failed', message)
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
      updateRunStatus(stateStore, input.runId, 'failed', 'Aborted by user')
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
    if (!credResolver) throw new Error('No credential resolver configured')
    return credResolver.getAuthStatus(input.provider)
  })

  ipcMain.removeHandler(AUTH_LOGIN_CHANNEL)
  ipcMain.handle(AUTH_LOGIN_CHANNEL, async (_event, input: unknown) => {
    if (!isObjectRecord(input) || typeof input.provider !== 'string') {
      throw new Error('auth:login requires a string provider')
    }
    // TODO: implement OAuth flow with provider-specific redirect URI
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
