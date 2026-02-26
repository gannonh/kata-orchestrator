import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { app, BrowserWindow } from 'electron'

import { registerIpcHandlers } from './ipc-handlers'
import { createStateStore } from './state-store'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getNonEmptyEnv(name: string): string | undefined {
  const value = process.env[name]
  if (!value) {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 600,
    show: false,
    backgroundColor: '#0a0d11',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox: false allows the preload script to import Electron modules
      // (contextBridge, ipcRenderer) via standard imports. The renderer stays
      // isolated: contextIsolation is true and nodeIntegration is false.
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  const stateFilePath = getNonEmptyEnv('KATA_STATE_FILE') ?? path.join(app.getPath('userData'), 'app-state.json')
  const workspaceBaseDir = getNonEmptyEnv('KATA_WORKSPACE_BASE_DIR')
  const repoCacheBaseDir = getNonEmptyEnv('KATA_REPO_CACHE_BASE_DIR')
  const stateStore = createStateStore(stateFilePath)

  if (workspaceBaseDir || repoCacheBaseDir) {
    registerIpcHandlers(stateStore, {
      ...(workspaceBaseDir ? { workspaceBaseDir } : {}),
      ...(repoCacheBaseDir ? { repoCacheBaseDir } : {})
    })
  } else {
    registerIpcHandlers(stateStore)
  }
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
}).catch((error: unknown) => {
  console.error('Kata desktop failed to start:', error)
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
