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
    invokeTyped<SessionRecord>(SESSION_CREATE_CHANNEL, input)
}

contextBridge.exposeInMainWorld('kata', kataApi)

export type KataApi = typeof kataApi
