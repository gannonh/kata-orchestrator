// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'

type LoadMainOptions = {
  platform?: NodeJS.Platform
  rendererUrl?: string
  whenReadyReject?: Error
  userDataPath?: string
  homePath?: string
  kataStateFile?: string
  kataWorkspaceBaseDir?: string
  kataRepoCacheBaseDir?: string
  legacyStateExists?: boolean
  newStateExists?: boolean
}

type WindowInstance = {
  options: {
    webPreferences: {
      preload: string
    }
  }
  show: ReturnType<typeof vi.fn>
  loadURL: ReturnType<typeof vi.fn>
  loadFile: ReturnType<typeof vi.fn>
  triggerReadyToShow: () => void
}

async function loadMainModule(options: LoadMainOptions = {}) {
  vi.resetModules()

  const listeners = new Map<string, () => void>()
  const instances: WindowInstance[] = []
  let visibleWindows: WindowInstance[] = []

  class MockBrowserWindow {
    static getAllWindows = vi.fn(() => visibleWindows)

    private readyToShowHandler: (() => void) | undefined
    options: WindowInstance['options']
    show = vi.fn()
    loadURL = vi.fn(async () => undefined)
    loadFile = vi.fn(async () => undefined)

    constructor(windowOptions: WindowInstance['options']) {
      this.options = windowOptions
      const instance = this as unknown as WindowInstance
      instance.triggerReadyToShow = () => {
        this.readyToShowHandler?.()
      }
      instances.push(instance)
      visibleWindows = instances
    }

    once(event: string, callback: () => void): void {
      if (event === 'ready-to-show') {
        this.readyToShowHandler = callback
      }
    }
  }

  const userDataPath = options.userDataPath ?? '/tmp/kata-user-data'
  const homePath = options.homePath ?? '/tmp/kata-home'

  const appMock = {
    whenReady: vi.fn(() =>
      options.whenReadyReject ? Promise.reject(options.whenReadyReject) : Promise.resolve()
    ),
    getPath: vi.fn((name: string) => {
      if (name === 'userData') {
        return userDataPath
      }

      if (name === 'home') {
        return homePath
      }

      throw new Error(`Unexpected app path key: ${name}`)
    }),
    on: vi.fn((event: string, callback: () => void) => {
      listeners.set(event, callback)
      return appMock
    }),
    quit: vi.fn()
  }

  const registerIpcHandlers = vi.fn()
  const mockStateStore = {
    load: vi.fn(),
    save: vi.fn()
  }
  const createStateStore = vi.fn(() => mockStateStore)

  const newStatePath = options.kataStateFile ?? `${userDataPath}/app-state.json`
  const legacyStatePath = `${homePath}/.kata/state.json`

  const existsSyncMock = vi.fn((p: string) => {
    if (p === newStatePath) {
      return options.newStateExists ?? false
    }

    if (p === legacyStatePath) {
      return options.legacyStateExists ?? false
    }

    return false
  })
  const mkdirSyncMock = vi.fn()
  const copyFileSyncMock = vi.fn()

  vi.doMock('node:fs', () => ({
    default: { existsSync: existsSyncMock, mkdirSync: mkdirSyncMock, copyFileSync: copyFileSyncMock }
  }))
  vi.doMock('electron', () => ({
    app: appMock,
    BrowserWindow: MockBrowserWindow
  }))
  vi.doMock('../../../src/main/ipc-handlers', () => ({
    registerIpcHandlers
  }))
  vi.doMock('../../../src/main/state-store', () => ({
    createStateStore
  }))

  const previousRendererUrl = process.env.ELECTRON_RENDERER_URL
  const previousKataStateFile = process.env.KATA_STATE_FILE
  const previousKataWorkspaceBaseDir = process.env.KATA_WORKSPACE_BASE_DIR
  const previousKataRepoCacheBaseDir = process.env.KATA_REPO_CACHE_BASE_DIR
  if (options.rendererUrl) {
    process.env.ELECTRON_RENDERER_URL = options.rendererUrl
  } else {
    delete process.env.ELECTRON_RENDERER_URL
  }
  if (options.kataStateFile !== undefined) {
    process.env.KATA_STATE_FILE = options.kataStateFile
  } else {
    delete process.env.KATA_STATE_FILE
  }
  if (options.kataWorkspaceBaseDir !== undefined) {
    process.env.KATA_WORKSPACE_BASE_DIR = options.kataWorkspaceBaseDir
  } else {
    delete process.env.KATA_WORKSPACE_BASE_DIR
  }
  if (options.kataRepoCacheBaseDir !== undefined) {
    process.env.KATA_REPO_CACHE_BASE_DIR = options.kataRepoCacheBaseDir
  } else {
    delete process.env.KATA_REPO_CACHE_BASE_DIR
  }

  const previousPlatform = process.platform
  Object.defineProperty(process, 'platform', {
    value: options.platform ?? previousPlatform,
    configurable: true
  })

  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

  await import('../../../src/main/index')
  await new Promise((resolve) => setTimeout(resolve, 0))

  const restore = () => {
    if (previousRendererUrl === undefined) {
      delete process.env.ELECTRON_RENDERER_URL
    } else {
      process.env.ELECTRON_RENDERER_URL = previousRendererUrl
    }
    if (previousKataStateFile === undefined) {
      delete process.env.KATA_STATE_FILE
    } else {
      process.env.KATA_STATE_FILE = previousKataStateFile
    }
    if (previousKataWorkspaceBaseDir === undefined) {
      delete process.env.KATA_WORKSPACE_BASE_DIR
    } else {
      process.env.KATA_WORKSPACE_BASE_DIR = previousKataWorkspaceBaseDir
    }
    if (previousKataRepoCacheBaseDir === undefined) {
      delete process.env.KATA_REPO_CACHE_BASE_DIR
    } else {
      process.env.KATA_REPO_CACHE_BASE_DIR = previousKataRepoCacheBaseDir
    }
    Object.defineProperty(process, 'platform', {
      value: previousPlatform,
      configurable: true
    })
    consoleErrorSpy.mockRestore()
    vi.unmock('node:fs')
    vi.unmock('electron')
    vi.unmock('../../../src/main/ipc-handlers')
    vi.unmock('../../../src/main/state-store')
  }

  return {
    appMock,
    registerIpcHandlers,
    createStateStore,
    mockStateStore,
    listeners,
    instances,
    setVisibleWindows(next: WindowInstance[]) {
      visibleWindows = next
    },
    existsSyncMock,
    mkdirSyncMock,
    copyFileSyncMock,
    consoleErrorSpy,
    restore
  }
}

describe('main process startup', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('creates a window, loads renderer URL, and handles activation/close events', async () => {
    const harness = await loadMainModule({
      rendererUrl: 'http://localhost:5173',
      platform: 'linux'
    })

    try {
      expect(harness.createStateStore).toHaveBeenCalledTimes(1)
      expect(harness.appMock.getPath).toHaveBeenCalledWith('userData')
      expect(harness.createStateStore).toHaveBeenCalledWith('/tmp/kata-user-data/app-state.json')
      expect(harness.registerIpcHandlers).toHaveBeenCalledTimes(1)
      expect(harness.registerIpcHandlers).toHaveBeenCalledWith(harness.mockStateStore)
      expect(harness.instances).toHaveLength(1)

      const mainWindow = harness.instances[0]
      expect(mainWindow.options.webPreferences.preload).toMatch(/preload[\\/]+index\.mjs$/)
      expect(mainWindow.loadURL).toHaveBeenCalledWith('http://localhost:5173')
      expect(mainWindow.loadFile).not.toHaveBeenCalled()

      mainWindow.triggerReadyToShow()
      expect(mainWindow.show).toHaveBeenCalledTimes(1)

      const activateHandler = harness.listeners.get('activate')
      expect(activateHandler).toBeTypeOf('function')

      harness.setVisibleWindows([])
      activateHandler?.()
      expect(harness.instances).toHaveLength(2)

      harness.setVisibleWindows([harness.instances[0]])
      activateHandler?.()
      expect(harness.instances).toHaveLength(2)

      const closeHandler = harness.listeners.get('window-all-closed')
      closeHandler?.()
      expect(harness.appMock.quit).toHaveBeenCalledTimes(1)
    } finally {
      harness.restore()
    }
  })

  it('loads local renderer html and keeps app open on darwin close event', async () => {
    const harness = await loadMainModule({ platform: 'darwin' })

    try {
      expect(harness.instances).toHaveLength(1)

      const mainWindow = harness.instances[0]
      expect(mainWindow.loadURL).not.toHaveBeenCalled()
      expect(mainWindow.loadFile).toHaveBeenCalledTimes(1)
      expect(mainWindow.loadFile.mock.calls[0]?.[0]).toMatch(/renderer[\\/]+index\.html$/)

      const closeHandler = harness.listeners.get('window-all-closed')
      closeHandler?.()
      expect(harness.appMock.quit).not.toHaveBeenCalled()
    } finally {
      harness.restore()
    }
  })

  it('uses userData/app-state.json for state store path', async () => {
    const harness = await loadMainModule({
      userDataPath: '/tmp/custom-user-data'
    })

    try {
      expect(harness.appMock.getPath).toHaveBeenCalledWith('userData')
      expect(harness.createStateStore).toHaveBeenCalledWith('/tmp/custom-user-data/app-state.json')
      expect(harness.registerIpcHandlers).toHaveBeenCalledWith(harness.mockStateStore)
    } finally {
      harness.restore()
    }
  })

  it('prefers KATA_* path overrides when provided', async () => {
    const harness = await loadMainModule({
      kataStateFile: '/tmp/custom-state/state.json',
      kataWorkspaceBaseDir: '/tmp/custom-workspaces',
      kataRepoCacheBaseDir: '/tmp/custom-repos'
    })

    try {
      expect(harness.createStateStore).toHaveBeenCalledWith('/tmp/custom-state/state.json')
      expect(harness.registerIpcHandlers).toHaveBeenCalledWith(harness.mockStateStore, {
        workspaceBaseDir: '/tmp/custom-workspaces',
        repoCacheBaseDir: '/tmp/custom-repos'
      })
    } finally {
      harness.restore()
    }
  })

  it('passes only provided KATA_* base dir overrides', async () => {
    const harness = await loadMainModule({
      kataWorkspaceBaseDir: '/tmp/custom-workspaces'
    })

    try {
      expect(harness.registerIpcHandlers).toHaveBeenCalledWith(harness.mockStateStore, {
        workspaceBaseDir: '/tmp/custom-workspaces'
      })
    } finally {
      harness.restore()
    }
  })

  it('migrates legacy ~/.kata/state.json when new state file does not exist', async () => {
    const harness = await loadMainModule({
      legacyStateExists: true,
      newStateExists: false
    })

    try {
      expect(harness.mkdirSyncMock).toHaveBeenCalledWith('/tmp/kata-user-data', { recursive: true })
      expect(harness.copyFileSyncMock).toHaveBeenCalledWith(
        '/tmp/kata-home/.kata/state.json',
        '/tmp/kata-user-data/app-state.json'
      )
    } finally {
      harness.restore()
    }
  })

  it('skips migration when new state file already exists', async () => {
    const harness = await loadMainModule({
      legacyStateExists: true,
      newStateExists: true
    })

    try {
      expect(harness.copyFileSyncMock).not.toHaveBeenCalled()
    } finally {
      harness.restore()
    }
  })

  it('logs startup failures and quits when whenReady rejects', async () => {
    const startupError = new Error('boom')
    const harness = await loadMainModule({
      whenReadyReject: startupError,
      platform: 'linux'
    })

    try {
      expect(harness.registerIpcHandlers).not.toHaveBeenCalled()
      expect(harness.instances).toHaveLength(0)
      expect(harness.consoleErrorSpy).toHaveBeenCalledWith('Kata desktop failed to start:', startupError)
      expect(harness.appMock.quit).toHaveBeenCalledTimes(1)
    } finally {
      harness.restore()
    }
  })
})
