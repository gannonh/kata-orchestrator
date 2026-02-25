import { contextBridge, ipcRenderer } from 'electron'
import type { CreateSessionInput, CreateSpaceInput } from '../shared/types/space'

const OPEN_EXTERNAL_URL_CHANNEL = 'kata:openExternalUrl'

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
  spaceCreate: (input: CreateSpaceInput) => ipcRenderer.invoke('space:create', input),
  spaceList: () => ipcRenderer.invoke('space:list'),
  spaceGet: (id: string) => ipcRenderer.invoke('space:get', { id }),
  sessionCreate: (input: CreateSessionInput) => ipcRenderer.invoke('session:create', input)
}

contextBridge.exposeInMainWorld('kata', kataApi)

export type KataApi = typeof kataApi
