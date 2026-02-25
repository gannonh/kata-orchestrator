import { randomUUID } from 'node:crypto'

import { ipcMain, shell } from 'electron'

import {
  ORCHESTRATION_MODES,
  createDefaultAppState
} from '../shared/types/space'
import type { StateStore } from './state-store'

import type {
  AppState,
  CreateSessionInput,
  CreateSpaceInput,
  OrchestrationMode,
  SessionRecord,
  SpaceRecord
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

function parseCreateSpaceInput(input: unknown): CreateSpaceInput {
  if (!isObjectRecord(input)) {
    throw new Error('Space input must be an object')
  }

  const { name, repoUrl, rootPath, branch, orchestrationMode } = input
  if (typeof name !== 'string' || typeof repoUrl !== 'string' || typeof rootPath !== 'string' || typeof branch !== 'string') {
    throw new Error('Space input is missing required string fields')
  }

  if (orchestrationMode !== undefined && !isOrchestrationMode(orchestrationMode)) {
    throw new Error('Space input has an invalid orchestrationMode')
  }

  return {
    name,
    repoUrl,
    rootPath,
    branch,
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

export function registerIpcHandlers(store?: StateStore): void {
  const stateStore = store ?? getFallbackStore()

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
    const createdSpace: SpaceRecord = {
      id: randomUUID(),
      name: parsedInput.name,
      repoUrl: parsedInput.repoUrl,
      rootPath: parsedInput.rootPath,
      branch: parsedInput.branch,
      orchestrationMode: parsedInput.orchestrationMode ?? 'team',
      createdAt: new Date().toISOString(),
      status: 'active'
    }

    stateStore.save({
      ...state,
      spaces: { ...state.spaces, [createdSpace.id]: createdSpace },
      activeSpaceId: state.activeSpaceId ?? createdSpace.id
    })

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
