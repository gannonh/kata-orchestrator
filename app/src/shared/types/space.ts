import type { RunRecord } from './run'
import type { PersistedSpecDocument } from './spec-document'

export const SPACE_STATUSES = ['active', 'idle', 'archived'] as const
export type SpaceStatus = (typeof SPACE_STATUSES)[number]

export const ORCHESTRATION_MODES = ['team', 'single'] as const
export type OrchestrationMode = (typeof ORCHESTRATION_MODES)[number]

export const WORKSPACE_MODES = ['managed', 'external'] as const
export type WorkspaceMode = (typeof WORKSPACE_MODES)[number]

export const PROVISIONING_METHODS = ['copy-local', 'clone-github', 'new-repo'] as const
export type ProvisioningMethod = (typeof PROVISIONING_METHODS)[number]

export type SpaceRecord = {
  id: string
  name: string
  repoUrl: string
  rootPath: string
  branch: string
  workspaceMode?: WorkspaceMode
  orchestrationMode: OrchestrationMode
  createdAt: string
  status: SpaceStatus
}

export type SessionRecord = {
  id: string
  spaceId: string
  label: string
  createdAt: string
  activeModelId?: string
}

export const SESSION_CONTEXT_RESOURCE_KINDS = ['spec', 'note', 'workspace-file', 'manual'] as const
export type SessionContextResourceKind = (typeof SESSION_CONTEXT_RESOURCE_KINDS)[number]

export type SessionContextResourceRecord = {
  id: string
  sessionId: string
  kind: SessionContextResourceKind
  label: string
  sourcePath?: string
  description?: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export const SESSION_AGENT_STATUSES = [
  'idle',
  'queued',
  'delegating',
  'running',
  'blocked',
  'completed',
  'failed'
] as const
export type SessionAgentStatus = (typeof SESSION_AGENT_STATUSES)[number]

export const SESSION_AGENT_KINDS = ['system', 'coordinator', 'specialist'] as const
export type SessionAgentKind = (typeof SESSION_AGENT_KINDS)[number]

export type SessionAgentRecord = {
  id: string
  sessionId: string
  name: string
  role: string
  kind: SessionAgentKind
  status: SessionAgentStatus
  avatarColor: string
  delegatedBy?: string
  currentTask?: string
  sortOrder: number
  activeRunId?: string
  waveId?: string
  groupLabel?: string
  lastActivityAt?: string
  createdAt: string
  updatedAt: string
}

export type CreateSpaceInput = {
  repoUrl: string
  branch: string
  workspaceMode?: WorkspaceMode
  orchestrationMode?: OrchestrationMode
} & (
  | {
      workspaceMode?: 'managed'
      provisioningMethod: 'copy-local'
      sourceLocalPath: string
    }
  | {
      workspaceMode?: 'managed'
      provisioningMethod: 'clone-github'
      sourceRemoteUrl: string
    }
  | {
      workspaceMode?: 'managed'
      provisioningMethod: 'new-repo'
      newRepoParentDir: string
      newRepoFolderName: string
    }
  | {
      workspaceMode: 'external'
      rootPath: string
      provisioningMethod?: never
    }
)

export type CreateSessionInput = {
  spaceId: string
  label: string
}

export type AppState = {
  spaces: Record<string, SpaceRecord>
  sessions: Record<string, SessionRecord>
  runs: Record<string, RunRecord>
  agentRoster: Record<string, SessionAgentRecord>
  specDocuments: Record<string, PersistedSpecDocument>
  contextResources: Record<string, SessionContextResourceRecord>
  activeSpaceId: string | null
  activeSessionId: string | null
}

export function createDefaultAppState(): AppState {
  return {
    spaces: {},
    sessions: {},
    runs: {},
    agentRoster: {},
    specDocuments: {},
    contextResources: {},
    activeSpaceId: null,
    activeSessionId: null
  }
}
