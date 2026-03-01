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
