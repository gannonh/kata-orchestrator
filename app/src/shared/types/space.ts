export const SPACE_STATUSES = ['active', 'idle', 'archived'] as const
export type SpaceStatus = (typeof SPACE_STATUSES)[number]

export const ORCHESTRATION_MODES = ['team', 'single'] as const
export type OrchestrationMode = (typeof ORCHESTRATION_MODES)[number]

export type SpaceRecord = {
  id: string
  name: string
  repoUrl: string
  rootPath: string
  branch: string
  orchestrationMode: OrchestrationMode
  createdAt: string
  status: SpaceStatus
}

export type SessionRecord = {
  id: string
  spaceId: string
  label: string
  createdAt: string
}

export type CreateSpaceInput = {
  name: string
  repoUrl: string
  rootPath: string
  branch: string
  orchestrationMode?: OrchestrationMode
}

export type CreateSessionInput = {
  spaceId: string
  label: string
}

export type AppState = {
  spaces: Record<string, SpaceRecord>
  sessions: Record<string, SessionRecord>
  activeSpaceId: string | null
  activeSessionId: string | null
}

export function createDefaultAppState(): AppState {
  return {
    spaces: {},
    sessions: {},
    activeSpaceId: null,
    activeSessionId: null
  }
}
