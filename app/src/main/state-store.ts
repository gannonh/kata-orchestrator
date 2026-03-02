import fs from 'node:fs'
import path from 'node:path'
import {
  ORCHESTRATION_MODES,
  SESSION_AGENT_KINDS,
  SESSION_AGENT_STATUSES,
  SPACE_STATUSES,
  WORKSPACE_MODES,
  createDefaultAppState
} from '../shared/types/space'
import type { AppState, SessionAgentRecord } from '../shared/types/space'
import { RUN_STATUSES } from '../shared/types/run'
import type { PersistedMessage } from '../shared/types/run'

export type StateStore = {
  load(): AppState
  save(state: AppState): void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSpaceRecord(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.repoUrl === 'string' &&
    typeof value.rootPath === 'string' &&
    typeof value.branch === 'string' &&
    (value.workspaceMode === undefined ||
      (typeof value.workspaceMode === 'string' &&
        WORKSPACE_MODES.includes(value.workspaceMode as (typeof WORKSPACE_MODES)[number]))) &&
    typeof value.orchestrationMode === 'string' &&
    ORCHESTRATION_MODES.includes(
      value.orchestrationMode as (typeof ORCHESTRATION_MODES)[number]
    ) &&
    typeof value.createdAt === 'string' &&
    typeof value.status === 'string' &&
    SPACE_STATUSES.includes(value.status as (typeof SPACE_STATUSES)[number])
  )
}

function isSessionRecord(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.spaceId === 'string' &&
    typeof value.label === 'string' &&
    typeof value.createdAt === 'string' &&
    (value.activeModelId === undefined || typeof value.activeModelId === 'string')
  )
}

function isPersistedMessage(value: unknown): value is PersistedMessage {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    (value.role === 'user' || value.role === 'agent') &&
    typeof value.content === 'string' &&
    typeof value.createdAt === 'string'
  )
}

function isRunRecord(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.prompt === 'string' &&
    typeof value.status === 'string' &&
    RUN_STATUSES.includes(value.status as (typeof RUN_STATUSES)[number]) &&
    typeof value.model === 'string' &&
    typeof value.provider === 'string' &&
    typeof value.createdAt === 'string' &&
    (value.startedAt === undefined || typeof value.startedAt === 'string') &&
    (value.completedAt === undefined || typeof value.completedAt === 'string') &&
    (value.errorMessage === undefined || typeof value.errorMessage === 'string') &&
    Array.isArray(value.messages) &&
    value.messages.every(isPersistedMessage)
  )
}

function isSessionAgentRecord(value: unknown): value is SessionAgentRecord {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.role === 'string' &&
    typeof value.kind === 'string' &&
    SESSION_AGENT_KINDS.includes(value.kind as (typeof SESSION_AGENT_KINDS)[number]) &&
    typeof value.status === 'string' &&
    SESSION_AGENT_STATUSES.includes(value.status as (typeof SESSION_AGENT_STATUSES)[number]) &&
    typeof value.avatarColor === 'string' &&
    (value.delegatedBy === undefined || typeof value.delegatedBy === 'string') &&
    (value.currentTask === undefined || typeof value.currentTask === 'string') &&
    typeof value.sortOrder === 'number' &&
    Number.isFinite(value.sortOrder) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function areValidRecordEntries(
  value: Record<string, unknown>,
  isValueValid: (entry: unknown) => boolean
): boolean {
  return Object.entries(value).every(
    ([key, entry]) => isValueValid(entry) && isRecord(entry) && entry.id === key
  )
}

type PersistedAppState = {
  spaces: AppState['spaces']
  sessions: AppState['sessions']
  runs?: AppState['runs']
  agentRoster?: unknown
  activeSpaceId: string | null
  activeSessionId: string | null
}

function isPersistedAppState(value: unknown): value is PersistedAppState {
  if (!isRecord(value)) {
    return false
  }

  if (!isRecord(value.spaces) || !isRecord(value.sessions)) {
    return false
  }

  // Tolerate state files that predate the runs field (backward compat).
  if (value.runs !== undefined && !isRecord(value.runs)) {
    return false
  }

  if (!isStringOrNull(value.activeSpaceId) || !isStringOrNull(value.activeSessionId)) {
    return false
  }

  const runs = value.runs ?? {}

  return (
    areValidRecordEntries(value.spaces, isSpaceRecord) &&
    areValidRecordEntries(value.sessions, isSessionRecord) &&
    areValidRecordEntries(runs, isRunRecord)
  )
}

function normalizeAgentRoster(value: unknown): AppState['agentRoster'] {
  if (!isRecord(value)) {
    return {}
  }

  const normalized: AppState['agentRoster'] = {}

  for (const [key, record] of Object.entries(value)) {
    if (isSessionAgentRecord(record) && record.id === key) {
      normalized[key] = record
    }
  }

  return normalized
}

function isErrnoCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  )
}

export function createStateStore(filePath: string): StateStore {
  return {
    load(): AppState {
      let raw: string

      try {
        raw = fs.readFileSync(filePath, 'utf-8')
      } catch (error) {
        if (isErrnoCode(error, 'ENOENT')) {
          return createDefaultAppState()
        }

        throw error
      }

      let parsed: unknown

      try {
        parsed = JSON.parse(raw)
      } catch (parseError) {
        console.error('[StateStore] Failed to parse state file, returning default state:', filePath, parseError)
        return createDefaultAppState()
      }

      if (!isPersistedAppState(parsed)) {
        console.warn('[StateStore] State file failed schema validation, returning default state:', filePath)
        return createDefaultAppState()
      }

      const activeSpaceId =
        parsed.activeSpaceId !== null && parsed.spaces[parsed.activeSpaceId]
          ? parsed.activeSpaceId
          : null
      const activeSessionId =
        parsed.activeSessionId !== null && parsed.sessions[parsed.activeSessionId]
          ? parsed.activeSessionId
          : null

      return {
        spaces: parsed.spaces,
        sessions: parsed.sessions,
        runs: parsed.runs ?? {},
        agentRoster: normalizeAgentRoster(parsed.agentRoster),
        activeSpaceId,
        activeSessionId
      }
    },

    save(state: AppState): void {
      const dir = path.dirname(filePath)
      fs.mkdirSync(dir, { recursive: true })
      const tmpPath = path.join(dir, `.state-${Date.now()}.tmp`)
      fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2))
      fs.renameSync(tmpPath, filePath)
    }
  }
}
