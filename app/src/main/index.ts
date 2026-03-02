import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { app, BrowserWindow } from 'electron'

import { createAuthStorage } from './auth-storage'
import { createCredentialResolver } from './credential-resolver'
import { registerIpcHandlers } from './ipc-handlers'
import { createStateStore } from './state-store'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getNonEmptyEnv(name: string): string | undefined {
  const value = process.env[name]
  if (!value) {
    return undefined
  }

  return value.trim() || undefined
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
    if (!process.env.KATA_E2E_HEADLESS) {
      mainWindow.show()
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  const stateFilePath = getNonEmptyEnv('KATA_STATE_FILE') ?? path.join(app.getPath('userData'), 'app-state.json')

  // Migrate legacy state from ~/.kata/state.json (copy, legacy file preserved)
  const legacyStatePath = path.join(app.getPath('home'), '.kata', 'state.json')
  if (!fs.existsSync(stateFilePath) && fs.existsSync(legacyStatePath)) {
    try {
      const dir = path.dirname(stateFilePath)
      fs.mkdirSync(dir, { recursive: true })
      fs.copyFileSync(legacyStatePath, stateFilePath)
    } catch (migrationError) {
      console.error('Failed to migrate legacy state file; starting with default state.', migrationError)
    }
  }

  const workspaceBaseDir = getNonEmptyEnv('KATA_WORKSPACE_BASE_DIR')
  const repoCacheBaseDir = getNonEmptyEnv('KATA_REPO_CACHE_BASE_DIR')
  const stateStore = createStateStore(stateFilePath)
  const authStorage = createAuthStorage(path.join(app.getPath('home'), '.kata', 'auth.json'))
  const credentialResolver = createCredentialResolver(authStorage)

  registerIpcHandlers(stateStore, { workspaceBaseDir, repoCacheBaseDir, authStorage, credentialResolver })
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
