import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { ipcMain, shell } from 'electron'

import {
  ORCHESTRATION_MODES,
  WORKSPACE_MODES,
  createDefaultAppState
} from '../shared/types/space'
import type { StateStore } from './state-store'

import type {
  AppState,
  CreateSessionInput,
  OrchestrationMode,
  SessionRecord,
  SpaceRecord,
  WorkspaceMode
} from '../shared/types/space'

const OPEN_EXTERNAL_URL_CHANNEL = 'kata:openExternalUrl'
const SPACE_CREATE_CHANNEL = 'space:create'
const SPACE_LIST_CHANNEL = 'space:list'
const SPACE_GET_CHANNEL = 'space:get'
const SESSION_CREATE_CHANNEL = 'session:create'

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

function slugifyWorkspaceName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')

  return slug || 'workspace'
}

type ParsedCreateSpaceInput = {
  name: string
  repoUrl: string
  branch: string
  rootPath?: string
  workspaceMode: WorkspaceMode
  orchestrationMode?: OrchestrationMode
}

function parseCreateSpaceInput(input: unknown): ParsedCreateSpaceInput {
  if (!isObjectRecord(input)) {
    throw new Error('Space input must be an object')
  }

  const {
    name,
    repoUrl,
    rootPath,
    branch,
    workspaceMode,
    orchestrationMode
  } = input
  if (typeof name !== 'string' || typeof repoUrl !== 'string' || typeof branch !== 'string') {
    throw new Error('Space input is missing required string fields')
  }

  if (rootPath !== undefined && typeof rootPath !== 'string') {
    throw new Error('Space input rootPath must be a string when provided')
  }

  if (orchestrationMode !== undefined && !isOrchestrationMode(orchestrationMode)) {
    throw new Error('Space input has an invalid orchestrationMode')
  }

  if (workspaceMode !== undefined && !isWorkspaceMode(workspaceMode)) {
    throw new Error('Space input has an invalid workspaceMode')
  }

  const normalizedWorkspaceMode = workspaceMode ?? 'managed'
  const normalizedRootPath = rootPath?.trim()
  if (normalizedWorkspaceMode === 'external') {
    if (!normalizedRootPath) {
      throw new Error('External workspace mode requires a non-empty rootPath')
    }
    if (!path.isAbsolute(normalizedRootPath)) {
      throw new Error('External workspace rootPath must be an absolute path')
    }
  }

  return {
    name,
    repoUrl,
    branch,
    rootPath: normalizedRootPath,
    workspaceMode: normalizedWorkspaceMode,
    orchestrationMode
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

export type RegisterIpcOptions = {
  workspaceBaseDir?: string
}

export function registerIpcHandlers(store?: StateStore, options?: RegisterIpcOptions): void {
  const stateStore = store ?? getFallbackStore()
  const workspaceBaseDir = options?.workspaceBaseDir ?? path.join(os.homedir(), '.kata', 'workspaces')

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

    const rootPath = await (async () => {
      if (parsedInput.workspaceMode === 'external') {
        return parsedInput.rootPath as string
      }

      const workspaceSlug = slugifyWorkspaceName(parsedInput.name)
      const workspaceRootPath = path.join(workspaceBaseDir, `${workspaceSlug}-${spaceId.slice(0, 8)}`)
      const workspaceRepoPath = path.join(workspaceRootPath, 'repo')
      const workspaceMetadataPath = path.join(workspaceRootPath, '.kata')

      try {
        await fs.promises.mkdir(workspaceRepoPath, { recursive: true })
        await fs.promises.mkdir(workspaceMetadataPath, { recursive: true })
      } catch (fsError) {
        const code = (fsError as NodeJS.ErrnoException).code ?? 'UNKNOWN'
        throw new Error(`Failed to create managed workspace directory (${code}): ${workspaceRootPath}`)
      }

      return workspaceRepoPath
    })()

    const createdSpace: SpaceRecord = {
      id: spaceId,
      name: parsedInput.name,
      repoUrl: parsedInput.repoUrl,
      rootPath,
      branch: parsedInput.branch,
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
}
