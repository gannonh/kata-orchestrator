import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import { createStateStore } from '../../../src/main/state-store'
import { createDefaultAppState } from '@shared/types/space'
import type { AppState } from '@shared/types/space'

let tmpDir: string
let filePath: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-store-test-'))
  filePath = path.join(tmpDir, 'state.json')
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('createStateStore', () => {
  test('returns default empty state when file does not exist', () => {
    const store = createStateStore(filePath)
    const state = store.load()
    expect(state).toEqual(createDefaultAppState())
  })

  test('loads existing state from disk', () => {
    const saved: AppState = {
      spaces: {
        's1': {
          id: 's1',
          name: 'My Space',
          repoUrl: 'https://github.com/test/repo',
          rootPath: '/tmp/repo',
          branch: 'main',
          orchestrationMode: 'single',
          createdAt: '2026-01-01T00:00:00Z',
          status: 'active'
        }
      },
      sessions: {},
      activeSpaceId: 's1',
      activeSessionId: null
    }
    fs.writeFileSync(filePath, JSON.stringify(saved))

    const store = createStateStore(filePath)
    const state = store.load()
    expect(state).toEqual(saved)
  })

  test('recovers from corrupt JSON by returning default state', () => {
    fs.writeFileSync(filePath, '{not valid json!!!')

    const store = createStateStore(filePath)
    const state = store.load()
    expect(state).toEqual(createDefaultAppState())
  })

  test('writes state to disk and can reload it', () => {
    const store = createStateStore(filePath)

    const state: AppState = {
      spaces: {},
      sessions: {
        'sess1': {
          id: 'sess1',
          spaceId: 's1',
          label: 'Test Session',
          createdAt: '2026-02-25T00:00:00Z'
        }
      },
      activeSpaceId: null,
      activeSessionId: 'sess1'
    }

    store.save(state)

    const reloaded = createStateStore(filePath).load()
    expect(reloaded).toEqual(state)
  })

  test('writes atomically using temp file and rename', () => {
    const store = createStateStore(filePath)
    const state = createDefaultAppState()
    state.activeSpaceId = 'atomic-test'

    store.save(state)

    // The final file should exist with correct content
    const raw = fs.readFileSync(filePath, 'utf-8')
    expect(JSON.parse(raw)).toEqual(state)

    // No leftover temp files in the directory
    const files = fs.readdirSync(tmpDir)
    expect(files).toEqual(['state.json'])
  })
})
