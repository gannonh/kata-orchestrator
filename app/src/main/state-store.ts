import fs from 'node:fs'
import path from 'node:path'
import { ORCHESTRATION_MODES, SPACE_STATUSES, WORKSPACE_MODES, createDefaultAppState } from '@shared/types/space'
import type { AppState } from '@shared/types/space'

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
    typeof value.createdAt === 'string'
  )
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isAppState(value: unknown): value is AppState {
  if (!isRecord(value)) {
    return false
  }

  if (!isRecord(value.spaces) || !isRecord(value.sessions)) {
    return false
  }

  if (!isStringOrNull(value.activeSpaceId) || !isStringOrNull(value.activeSessionId)) {
    return false
  }

  return (
    Object.values(value.spaces).every(isSpaceRecord) &&
    Object.values(value.sessions).every(isSessionRecord)
  )
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

      if (!isAppState(parsed)) {
        console.warn('[StateStore] State file failed schema validation, returning default state:', filePath)
        return createDefaultAppState()
      }

      return parsed
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
