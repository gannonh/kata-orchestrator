import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppState,
  CreateSessionInput,
  CreateSpaceInput,
  SessionAgentRecord,
  SessionContextResourceRecord,
  SessionRecord,
  SpaceRecord
} from '../shared/types/space'
import type { RunRecord } from '../shared/types/run'
import type { SessionRuntimeEvent } from '../renderer/types/session-runtime-adapter'
import type { PersistedSpecDocument, SpecArtifactStatus } from '../shared/types/spec-document'

const OPEN_EXTERNAL_URL_CHANNEL = 'kata:openExternalUrl'
const APP_BOOTSTRAP_CHANNEL = 'app:bootstrap'
const SPACE_CREATE_CHANNEL = 'space:create'
const SPACE_LIST_CHANNEL = 'space:list'
const SPACE_GET_CHANNEL = 'space:get'
const SPACE_SET_ACTIVE_CHANNEL = 'space:setActive'
const SESSION_CREATE_CHANNEL = 'session:create'
const SESSION_AGENT_ROSTER_LIST_CHANNEL = 'session-agent-roster:list'
const SESSION_CONTEXT_RESOURCES_LIST_CHANNEL = 'session-context-resources:list'
const SESSION_LIST_BY_SPACE_CHANNEL = 'session:listBySpace'
const SESSION_GET_CHANNEL = 'session:get'
const SESSION_SET_ACTIVE_CHANNEL = 'session:setActive'
const SESSION_SET_ACTIVE_MODEL_CHANNEL = 'session:setActiveModel'
const SPEC_GET_CHANNEL = 'spec:get'
const SPEC_SAVE_CHANNEL = 'spec:save'
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

function invokeTyped<TResult>(channel: string, ...args: unknown[]): Promise<TResult> {
  return ipcRenderer.invoke(channel, ...args) as Promise<TResult>
}

type AppBootstrapState = Pick<
  AppState,
  'spaces' | 'sessions' | 'specDocuments' | 'activeSpaceId' | 'activeSessionId'
>

const kataApi = {
  getAgents: async () => [],
  getMessages: async () => [],
  getProject: async () => null,
  getGitStatus: async () => null,
  openExternalUrl: async (url: string): Promise<boolean> => {
    try {
      return await ipcRenderer.invoke(OPEN_EXTERNAL_URL_CHANNEL, url) as boolean
    } catch (err) {
      console.error('[preload] Failed to open external URL:', url, err)
      return false
    }
  },
  appBootstrap: (): Promise<AppBootstrapState> =>
    invokeTyped<AppBootstrapState>(APP_BOOTSTRAP_CHANNEL),
  spaceCreate: (input: CreateSpaceInput): Promise<SpaceRecord> =>
    invokeTyped<SpaceRecord>(SPACE_CREATE_CHANNEL, input),
  spaceList: (): Promise<SpaceRecord[]> =>
    invokeTyped<SpaceRecord[]>(SPACE_LIST_CHANNEL),
  spaceGet: (id: string): Promise<SpaceRecord | null> =>
    invokeTyped<SpaceRecord | null>(SPACE_GET_CHANNEL, { id }),
  spaceSetActive: (spaceId: string): Promise<{ activeSpaceId: string; activeSessionId: string | null }> =>
    invokeTyped<{ activeSpaceId: string; activeSessionId: string | null }>(SPACE_SET_ACTIVE_CHANNEL, {
      spaceId
    }),
  sessionCreate: (input: CreateSessionInput): Promise<SessionRecord> =>
    invokeTyped<SessionRecord>(SESSION_CREATE_CHANNEL, input),
  sessionAgentRosterList: (input: { sessionId: string }): Promise<SessionAgentRecord[]> =>
    invokeTyped<SessionAgentRecord[]>(SESSION_AGENT_ROSTER_LIST_CHANNEL, input),
  sessionContextResourcesList: (input: { sessionId: string }): Promise<SessionContextResourceRecord[]> =>
    invokeTyped<SessionContextResourceRecord[]>(SESSION_CONTEXT_RESOURCES_LIST_CHANNEL, input),
  sessionListBySpace: (input: { spaceId: string }): Promise<SessionRecord[]> =>
    invokeTyped<SessionRecord[]>(SESSION_LIST_BY_SPACE_CHANNEL, input),
  sessionGet: (sessionId: string): Promise<SessionRecord | null> =>
    invokeTyped<SessionRecord | null>(SESSION_GET_CHANNEL, { sessionId }),
  sessionSetActive: (sessionId: string): Promise<{ activeSpaceId: string; activeSessionId: string }> =>
    invokeTyped<{ activeSpaceId: string; activeSessionId: string }>(SESSION_SET_ACTIVE_CHANNEL, {
      sessionId
    }),
  sessionSetActiveModel: (input: { sessionId: string; activeModelId: string }): Promise<SessionRecord> =>
    invokeTyped<SessionRecord>(SESSION_SET_ACTIVE_MODEL_CHANNEL, input),
  specGet: (input: { spaceId: string; sessionId: string }): Promise<PersistedSpecDocument | null> =>
    invokeTyped<PersistedSpecDocument | null>(SPEC_GET_CHANNEL, input),
  specSave: (input: {
    spaceId: string
    sessionId: string
    markdown: string
    status?: SpecArtifactStatus
    sourceRunId?: string
    appliedRunId?: string
    appliedAt?: string
  }): Promise<PersistedSpecDocument> =>
    invokeTyped<PersistedSpecDocument>(SPEC_SAVE_CHANNEL, input),
  dialogOpenDirectory: (): Promise<{ path: string } | { error: string; path: string } | null> =>
    invokeTyped(DIALOG_OPEN_DIR_CHANNEL),
  gitListBranches: (repoPath: string): Promise<string[] | { error: string }> =>
    invokeTyped(GIT_LIST_BRANCHES_CHANNEL, repoPath),
  githubListRepos: (): Promise<Array<{ name: string; nameWithOwner: string; url: string }> | { error: string }> =>
    invokeTyped(GITHUB_LIST_REPOS_CHANNEL),
  githubListBranches: (owner: string, repo: string): Promise<string[] | { error: string }> =>
    invokeTyped(GITHUB_LIST_BRANCHES_CHANNEL, { owner, repo }),

  // Run channels
  runSubmit: (input: { sessionId: string; prompt: string; model: string; provider: string }) =>
    invokeTyped<{ runId: string }>(RUN_SUBMIT_CHANNEL, input),
  runAbort: (input: { runId: string }) =>
    invokeTyped<boolean>(RUN_ABORT_CHANNEL, input),
  runList: (sessionId: string) =>
    invokeTyped<RunRecord[]>(RUN_LIST_CHANNEL, { sessionId }),
  onRunEvent: (callback: (event: SessionRuntimeEvent) => void) => {
    const handler = (_event: unknown, data: SessionRuntimeEvent) => callback(data)
    ipcRenderer.on(RUN_EVENT_CHANNEL, handler)
    return () => {
      ipcRenderer.removeListener(RUN_EVENT_CHANNEL, handler)
    }
  },

  // Auth channels
  authStatus: (provider: string) =>
    invokeTyped<'oauth' | 'api_key' | 'none'>(AUTH_STATUS_CHANNEL, { provider }),
  authLogin: (provider: string) =>
    invokeTyped<boolean>(AUTH_LOGIN_CHANNEL, { provider }),
  authLogout: (provider: string) =>
    invokeTyped<boolean>(AUTH_LOGOUT_CHANNEL, { provider }),

  // Model channel
  modelList: () =>
    invokeTyped<Array<{ provider: string; modelId: string; name: string; authStatus: 'oauth' | 'api_key' | 'none' }>>(MODEL_LIST_CHANNEL)
}

contextBridge.exposeInMainWorld('kata', kataApi)

export type KataApi = typeof kataApi
