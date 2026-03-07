import fs from 'node:fs'
import path from 'node:path'
import {
  ORCHESTRATION_MODES,
  SESSION_CONTEXT_RESOURCE_KINDS,
  SESSION_AGENT_KINDS,
  SESSION_AGENT_STATUSES,
  SPACE_STATUSES,
  WORKSPACE_MODES,
  createDefaultAppState
} from '../shared/types/space'
import type { AppState, SessionAgentRecord, SessionContextResourceRecord } from '../shared/types/space'
import {
  INTERRUPTED_RUN_ERROR_MESSAGE,
  RUN_CONTEXT_REFERENCE_KINDS,
  RUN_STATUSES
} from '../shared/types/run'
import type { PersistedMessage, RunContextReferenceRecord, RunRecord } from '../shared/types/run'
import { isPersistedSpecDocument } from '../shared/types/spec-document'
import type { PersistedSpecDocument } from '../shared/types/spec-document'

export type StateStoreLoadOptions = {
  reconcileInterruptedRuns?: boolean
}

export type StateStore = {
  load(options?: StateStoreLoadOptions): AppState
  save(state: AppState): void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUnsafeRecordKey(key: string): boolean {
  return key === '__proto__' || key === 'constructor' || key === 'prototype'
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

function isRunContextReferenceRecord(value: unknown): value is RunContextReferenceRecord {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.kind === 'string' &&
    RUN_CONTEXT_REFERENCE_KINDS.includes(value.kind as RunContextReferenceRecord['kind']) &&
    typeof value.label === 'string' &&
    (value.resourceId === undefined || typeof value.resourceId === 'string') &&
    (value.excerpt === undefined || typeof value.excerpt === 'string') &&
    (value.lineCount === undefined ||
      (typeof value.lineCount === 'number' && Number.isFinite(value.lineCount))) &&
    typeof value.sortOrder === 'number' &&
    Number.isFinite(value.sortOrder) &&
    typeof value.capturedAt === 'string'
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

function isSessionContextResourceRecord(value: unknown): value is SessionContextResourceRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.kind === 'string' &&
    SESSION_CONTEXT_RESOURCE_KINDS.includes(value.kind as SessionContextResourceRecord['kind']) &&
    typeof value.label === 'string' &&
    (value.sourcePath === undefined || typeof value.sourcePath === 'string') &&
    (value.description === undefined || typeof value.description === 'string') &&
    typeof value.sortOrder === 'number' &&
    Number.isFinite(value.sortOrder) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

function isSessionAgentRecord(value: unknown): value is SessionAgentRecord {
  return (
    isRecord(value) &&
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
    (value.activeRunId === undefined || typeof value.activeRunId === 'string') &&
    (value.waveId === undefined || typeof value.waveId === 'string') &&
    (value.groupLabel === undefined || typeof value.groupLabel === 'string') &&
    (value.lastActivityAt === undefined || typeof value.lastActivityAt === 'string') &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

function normalizeSessionAgentStatus(value: unknown): SessionAgentRecord['status'] | null {
  if (value === 'complete') {
    return 'completed'
  }

  if (
    typeof value === 'string' &&
    SESSION_AGENT_STATUSES.includes(value as SessionAgentRecord['status'])
  ) {
    return value as SessionAgentRecord['status']
  }

  return null
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
  contextResources?: unknown
  specDocuments?: unknown
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

  const normalized = Object.create(null) as AppState['agentRoster']

  for (const [key, record] of Object.entries(value)) {
    if (isUnsafeRecordKey(key)) {
      console.warn('[StateStore] Dropping unsafe agent roster key:', key)
      continue
    }

    if (!isRecord(record) || record.id !== key) {
      console.warn('[StateStore] Dropping invalid agent roster entry:', key)
      continue
    }

    const status = normalizeSessionAgentStatus(record.status)
    if (status === null) {
      console.warn('[StateStore] Dropping invalid agent roster entry:', key)
      continue
    }

    const candidate: unknown = {
      ...record,
      status
    }

    if (isSessionAgentRecord(candidate)) {
      normalized[key] = candidate
    } else {
      console.warn('[StateStore] Dropping invalid agent roster entry:', key)
    }
  }

  return normalized
}

function normalizeContextResources(value: unknown): AppState['contextResources'] {
  if (!isRecord(value)) {
    return {}
  }

  const normalized = Object.create(null) as AppState['contextResources']

  for (const [key, record] of Object.entries(value)) {
    if (isUnsafeRecordKey(key)) {
      console.warn('[StateStore] Dropping unsafe context resource key:', key)
      continue
    }

    if (!isRecord(record) || record.id !== key) {
      console.warn('[StateStore] Dropping invalid context resource entry:', key)
      continue
    }

    if (isSessionContextResourceRecord(record)) {
      normalized[key] = record
    } else {
      console.warn('[StateStore] Dropping invalid context resource entry:', key)
    }
  }

  return normalized
}

function normalizeRunContextReferences(value: unknown): RunRecord['contextReferences'] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item) => {
    if (isRunContextReferenceRecord(item)) {
      return true
    }
    console.warn('[StateStore] Dropping invalid run context reference:', item)
    return false
  })
}

function normalizeRunRecord(value: RunRecord & { contextReferences?: unknown }): RunRecord {
  return {
    ...value,
    contextReferences: normalizeRunContextReferences(value.contextReferences)
  }
}

function normalizeRuns(value: Record<string, unknown>): AppState['runs'] {
  const normalized = Object.create(null) as AppState['runs']

  for (const [key, record] of Object.entries(value)) {
    if (isUnsafeRecordKey(key)) {
      console.warn('[StateStore] Dropping unsafe run key:', key)
      continue
    }

    normalized[key] = normalizeRunRecord(record as RunRecord & { contextReferences?: unknown })
  }

  return normalized
}

function normalizeSpecDocuments(value: unknown): AppState['specDocuments'] {
  if (!isRecord(value)) {
    return {}
  }

  const normalized = Object.create(null) as AppState['specDocuments']

  for (const [key, record] of Object.entries(value)) {
    if (isUnsafeRecordKey(key)) {
      console.warn('[StateStore] Dropping unsafe spec document key:', key)
      continue
    }
    if (isPersistedSpecDocument(record)) {
      normalized[key] = {
        ...record,
        appliedRunId: record.frontmatter.sourceRunId
      }
    } else if (isLegacySpecDocumentRecord(record)) {
      normalized[key] = migrateLegacySpecDocument(record)
    } else {
      console.warn('[StateStore] Dropping invalid spec document entry:', key)
    }
  }

  return normalized
}

function isLegacySpecDocumentRecord(value: unknown): value is {
  markdown: string
  updatedAt: string
  appliedRunId?: string
  appliedAt?: string
} {
  return (
    isRecord(value) &&
    typeof value.markdown === 'string' &&
    typeof value.updatedAt === 'string' &&
    (value.appliedRunId === undefined || typeof value.appliedRunId === 'string') &&
    (value.appliedAt === undefined || typeof value.appliedAt === 'string')
  )
}

function migrateLegacySpecDocument(record: {
  markdown: string
  updatedAt?: string
  appliedRunId?: string
  appliedAt?: string
}): PersistedSpecDocument {
  const updatedAt = record.updatedAt ?? record.appliedAt ?? ''
  const sourceRunId = record.appliedRunId

  return {
    sourcePath: '',
    raw: record.markdown,
    markdown: record.markdown,
    frontmatter: {
      status: 'drafting',
      updatedAt,
      ...(sourceRunId !== undefined && { sourceRunId })
    },
    diagnostics: [],
    updatedAt,
    ...(sourceRunId !== undefined && { appliedRunId: sourceRunId })
  }
}

function reconcileInterruptedRuns(runs: AppState['runs']): AppState['runs'] {
  const reconciled = Object.create(null) as AppState['runs']
  const completedAt = new Date().toISOString()

  for (const [key, run] of Object.entries(runs)) {
    if (run.status === 'queued' || run.status === 'running') {
      reconciled[key] = {
        ...run,
        status: 'failed',
        completedAt,
        errorMessage: INTERRUPTED_RUN_ERROR_MESSAGE
      }
      continue
    }

    reconciled[key] = run
  }

  return reconciled
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
    load(options?: StateStoreLoadOptions): AppState {
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
      const candidateSession =
        parsed.activeSessionId !== null ? parsed.sessions[parsed.activeSessionId] : undefined
      const activeSessionId =
        candidateSession && candidateSession.spaceId === activeSpaceId
          ? parsed.activeSessionId
          : null

      const runs = normalizeRuns(parsed.runs ?? {})

      return {
        spaces: parsed.spaces,
        sessions: parsed.sessions,
        runs: options?.reconcileInterruptedRuns ? reconcileInterruptedRuns(runs) : runs,
        agentRoster: normalizeAgentRoster(parsed.agentRoster),
        contextResources: normalizeContextResources(parsed.contextResources),
        specDocuments: normalizeSpecDocuments(parsed.specDocuments),
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
