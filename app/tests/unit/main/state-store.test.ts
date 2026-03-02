import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
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
      runs: {},
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

  test('returns default state when JSON has wrong shape', () => {
    fs.writeFileSync(filePath, JSON.stringify({ foo: 'bar' }))

    const store = createStateStore(filePath)
    const state = store.load()
    expect(state).toEqual(createDefaultAppState())
  })

  test('returns default state when JSON root is not an object', () => {
    fs.writeFileSync(filePath, JSON.stringify(42))

    const store = createStateStore(filePath)
    const state = store.load()
    expect(state).toEqual(createDefaultAppState())
  })

  test('returns default state when active ids are not string or null', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {},
        sessions: {},
        runs: {},
        activeSpaceId: 123,
        activeSessionId: false
      })
    )

    const store = createStateStore(filePath)
    const state = store.load()
    expect(state).toEqual(createDefaultAppState())
  })

  test('returns default state when a space record is not an object', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: { s1: 'invalid-space-record' },
        sessions: {},
        runs: {},
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const store = createStateStore(filePath)
    const state = store.load()
    expect(state).toEqual(createDefaultAppState())
  })

  test('returns default state when a session record is not an object', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {},
        sessions: { sess1: 'invalid-session-record' },
        runs: {},
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const store = createStateStore(filePath)
    const state = store.load()
    expect(state).toEqual(createDefaultAppState())
  })

  test('returns default state when a run record is not an object', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {},
        sessions: {},
        runs: { r1: 'invalid-run-record' },
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const store = createStateStore(filePath)
    const state = store.load()
    expect(state).toEqual(createDefaultAppState())
  })

  test('returns default state when a run record has invalid status', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {},
        sessions: {},
        runs: {
          r1: {
            id: 'r1',
            sessionId: 's1',
            prompt: 'test',
            status: 'invalid-status',
            model: 'm',
            provider: 'p',
            createdAt: '2026-01-01T00:00:00Z',
            messages: []
          }
        },
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const store = createStateStore(filePath)
    const state = store.load()
    expect(state).toEqual(createDefaultAppState())
  })

  test('loads state and defaults runs to {} when runs field is missing', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {},
        sessions: {},
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const store = createStateStore(filePath)
    const state = store.load()
    expect(state).toEqual({
      spaces: {},
      sessions: {},
      runs: {},
      activeSpaceId: null,
      activeSessionId: null
    })
  })

  test('rethrows non-ENOENT file system errors when loading', () => {
    const store = createStateStore(filePath)
    const readError = Object.assign(new Error('permission denied'), {
      code: 'EACCES'
    })

    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw readError
    })

    expect(() => store.load()).toThrow(readError)
    readSpy.mockRestore()
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
      runs: {},
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

  test('creates parent directory if it does not exist before saving', () => {
    const nestedPath = path.join(tmpDir, 'nested', 'state.json')
    const store = createStateStore(nestedPath)

    store.save(createDefaultAppState())

    expect(fs.existsSync(nestedPath)).toBe(true)
  })
})
