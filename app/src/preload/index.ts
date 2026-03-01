import { contextBridge, ipcRenderer } from 'electron'
import type {
  CreateSessionInput,
  CreateSpaceInput,
  SessionRecord,
  SpaceRecord
} from '../shared/types/space'

const OPEN_EXTERNAL_URL_CHANNEL = 'kata:openExternalUrl'
const SPACE_CREATE_CHANNEL = 'space:create'
const SPACE_LIST_CHANNEL = 'space:list'
const SPACE_GET_CHANNEL = 'space:get'
const SESSION_CREATE_CHANNEL = 'session:create'
const DIALOG_OPEN_DIR_CHANNEL = 'dialog:openDirectory'
const GIT_LIST_BRANCHES_CHANNEL = 'git:listBranches'
const GITHUB_LIST_REPOS_CHANNEL = 'github:listRepos'
const GITHUB_LIST_BRANCHES_CHANNEL = 'github:listBranches'

function invokeTyped<TResult>(channel: string, ...args: unknown[]): Promise<TResult> {
  return ipcRenderer.invoke(channel, ...args) as Promise<TResult>
}

const kataApi = {
  getAgents: async () => [],
  getMessages: async () => [],
  getProject: async () => null,
  getGitStatus: async () => null,
  openExternalUrl: async (url: string): Promise<boolean> => {
    try {
      return await ipcRenderer.invoke(OPEN_EXTERNAL_URL_CHANNEL, url) as boolean
    } catch {
      return false
    }
  },
  spaceCreate: (input: CreateSpaceInput): Promise<SpaceRecord> =>
    invokeTyped<SpaceRecord>(SPACE_CREATE_CHANNEL, input),
  spaceList: (): Promise<SpaceRecord[]> =>
    invokeTyped<SpaceRecord[]>(SPACE_LIST_CHANNEL),
  spaceGet: (id: string): Promise<SpaceRecord | null> =>
    invokeTyped<SpaceRecord | null>(SPACE_GET_CHANNEL, { id }),
  sessionCreate: (input: CreateSessionInput): Promise<SessionRecord> =>
    invokeTyped<SessionRecord>(SESSION_CREATE_CHANNEL, input),
  dialogOpenDirectory: (): Promise<{ path: string } | { error: string; path: string } | null> =>
    invokeTyped(DIALOG_OPEN_DIR_CHANNEL),
  gitListBranches: (repoPath: string): Promise<string[] | { error: string }> =>
    invokeTyped(GIT_LIST_BRANCHES_CHANNEL, repoPath),
  githubListRepos: (): Promise<Array<{ name: string; nameWithOwner: string; url: string }> | { error: string }> =>
    invokeTyped(GITHUB_LIST_REPOS_CHANNEL),
  githubListBranches: (owner: string, repo: string): Promise<string[] | { error: string }> =>
    invokeTyped(GITHUB_LIST_BRANCHES_CHANNEL, { owner, repo })
}

contextBridge.exposeInMainWorld('kata', kataApi)

export type KataApi = typeof kataApi
