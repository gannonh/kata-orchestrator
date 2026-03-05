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
      agentRoster: {},
      specDocuments: {},
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
        agentRoster: {},
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
        agentRoster: {},
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
        agentRoster: {},
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
        agentRoster: {},
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

  test('returns default state when a run record has an invalid message entry', () => {
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
            status: 'queued',
            model: 'm',
            provider: 'p',
            createdAt: '2026-01-01T00:00:00Z',
            messages: [42]
          }
        },
        agentRoster: {},
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const store = createStateStore(filePath)
    const state = store.load()
    expect(state).toEqual(createDefaultAppState())
  })

  test('returns default state when a run message is object-shaped but invalid', () => {
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
            status: 'queued',
            model: 'm',
            provider: 'p',
            createdAt: '2026-01-01T00:00:00Z',
            messages: [{}]
          }
        },
        agentRoster: {},
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const state = createStateStore(filePath).load()
    expect(state).toEqual(createDefaultAppState())
  })

  test('returns default state when a run record has invalid optional metadata', () => {
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
            status: 'queued',
            model: 'm',
            provider: 'p',
            createdAt: '2026-01-01T00:00:00Z',
            startedAt: 123,
            messages: []
          }
        },
        agentRoster: {},
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const store = createStateStore(filePath)
    const state = store.load()
    expect(state).toEqual(createDefaultAppState())
  })

  test('returns default state when runs is defined but not an object', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {},
        sessions: {},
        runs: 'not-an-object',
        agentRoster: {},
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
      agentRoster: {},
      specDocuments: {},
      activeSpaceId: null,
      activeSessionId: null
    })
  })

  test('loads legacy state and defaults agentRoster to {} without wiping valid data', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {
          s1: {
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
        sessions: {
          sess1: {
            id: 'sess1',
            spaceId: 's1',
            label: 'Session',
            createdAt: '2026-01-01T00:00:00Z'
          }
        },
        runs: {
          run1: {
            id: 'run1',
            sessionId: 'sess1',
            prompt: 'test',
            status: 'queued',
            model: 'gpt-5',
            provider: 'openai',
            createdAt: '2026-01-01T00:00:00Z',
            messages: []
          }
        },
        activeSpaceId: 's1',
        activeSessionId: 'sess1'
      })
    )

    const store = createStateStore(filePath)
    const state = store.load()

    expect(state.spaces.s1?.name).toBe('My Space')
    expect(state.sessions.sess1?.label).toBe('Session')
    expect(state.runs.run1?.id).toBe('run1')
    expect(state.agentRoster).toEqual({})
    expect(state.activeSpaceId).toBe('s1')
    expect(state.activeSessionId).toBe('sess1')
  })

  test('returns default state when a space map key does not match the record id', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {
          'key-space': {
            id: 'different-space-id',
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
        agentRoster: {},
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const state = createStateStore(filePath).load()

    expect(state).toEqual(createDefaultAppState())
  })

  test('returns default state when a session map key does not match the record id', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {},
        sessions: {
          'key-session': {
            id: 'different-session-id',
            spaceId: 's1',
            label: 'Session',
            createdAt: '2026-01-01T00:00:00Z'
          }
        },
        runs: {},
        agentRoster: {},
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const state = createStateStore(filePath).load()

    expect(state).toEqual(createDefaultAppState())
  })

  test('returns default state when a run map key does not match the record id', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {},
        sessions: {},
        runs: {
          'key-run': {
            id: 'different-run-id',
            sessionId: 'sess1',
            prompt: 'test',
            status: 'queued',
            model: 'gpt-5',
            provider: 'openai',
            createdAt: '2026-01-01T00:00:00Z',
            messages: []
          }
        },
        agentRoster: {},
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const state = createStateStore(filePath).load()

    expect(state).toEqual(createDefaultAppState())
  })

  test('returns default state when a session activeModelId is not a string', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {},
        sessions: {
          sess1: {
            id: 'sess1',
            spaceId: 's1',
            label: 'Session',
            createdAt: '2026-01-01T00:00:00Z',
            activeModelId: 123
          }
        },
        runs: {},
        agentRoster: {},
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const state = createStateStore(filePath).load()

    expect(state).toEqual(createDefaultAppState())
  })

  test('falls back to an empty agentRoster when the top-level shape is invalid', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {},
        sessions: {},
        runs: {},
        agentRoster: 'invalid-agent-roster',
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
      agentRoster: {},
      specDocuments: {},
      activeSpaceId: null,
      activeSessionId: null
    })
  })

  test('drops malformed agent roster records while preserving valid entries', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {},
        sessions: {},
        runs: {},
        agentRoster: {
          'agent-1': {
            id: 'agent-1',
            sessionId: 'sess1',
            name: 'Planner',
            role: 'Coordinates work',
            kind: 'coordinator',
            status: 'running',
            avatarColor: '#0088cc',
            currentTask: 'Break down tasks',
            sortOrder: 0,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:01:00Z'
          },
          invalid: {
            id: 'agent-2',
            sessionId: 'sess1',
            name: 'Broken',
            role: 'Invalid status',
            kind: 'coordinator',
            status: 'unknown',
            avatarColor: '#ff0000',
            sortOrder: 1,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:01:00Z'
          }
        },
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const store = createStateStore(filePath)
    const state = store.load()

    expect(state.agentRoster).toEqual({
      'agent-1': {
        id: 'agent-1',
        sessionId: 'sess1',
        name: 'Planner',
        role: 'Coordinates work',
        kind: 'coordinator',
        status: 'running',
        avatarColor: '#0088cc',
        currentTask: 'Break down tasks',
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:01:00Z'
      }
    })
  })

  test('normalizes legacy agent status complete to completed', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {},
        sessions: {},
        runs: {},
        agentRoster: {
          a1: {
            id: 'a1',
            sessionId: 's1',
            name: 'Legacy Agent',
            role: 'legacy',
            kind: 'specialist',
            status: 'complete',
            avatarColor: '#123456',
            sortOrder: 0,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z'
          }
        },
        specDocuments: {},
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const state = createStateStore(filePath).load()
    expect(state.agentRoster.a1?.status).toBe('completed')
  })

  test('keeps extended agent metadata fields when valid', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {},
        sessions: {},
        runs: {},
        agentRoster: {
          a1: {
            id: 'a1',
            sessionId: 's1',
            name: 'Wave Agent',
            role: 'Handles wave work',
            kind: 'specialist',
            status: 'queued',
            avatarColor: '#123456',
            sortOrder: 1,
            activeRunId: 'run-1',
            waveId: 'wave-1',
            groupLabel: 'Wave 1',
            lastActivityAt: '2026-03-05T00:00:00.000Z',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z'
          }
        },
        specDocuments: {},
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const state = createStateStore(filePath).load()
    expect(state.agentRoster.a1).toMatchObject({
      activeRunId: 'run-1',
      waveId: 'wave-1',
      groupLabel: 'Wave 1',
      lastActivityAt: '2026-03-05T00:00:00.000Z'
    })
  })

  test('drops agent roster entries when extended metadata fields are invalid', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {},
        sessions: {},
        runs: {},
        agentRoster: {
          valid: {
            id: 'valid',
            sessionId: 's1',
            name: 'Valid Agent',
            role: 'Valid role',
            kind: 'specialist',
            status: 'queued',
            avatarColor: '#123456',
            sortOrder: 1,
            activeRunId: 'run-1',
            waveId: 'wave-1',
            groupLabel: 'Wave 1',
            lastActivityAt: '2026-03-05T00:00:00.000Z',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z'
          },
          invalid: {
            id: 'invalid',
            sessionId: 's1',
            name: 'Invalid Agent',
            role: 'Invalid role',
            kind: 'specialist',
            status: 'queued',
            avatarColor: '#123456',
            sortOrder: 2,
            activeRunId: 42,
            waveId: 'wave-2',
            groupLabel: 'Wave 2',
            lastActivityAt: '2026-03-05T00:00:00.000Z',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z'
          }
        },
        specDocuments: {},
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const state = createStateStore(filePath).load()
    expect(state.agentRoster.valid).toBeDefined()
    expect(state.agentRoster.invalid).toBeUndefined()
  })

  test('drops non-object agent roster entries', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {},
        sessions: {},
        runs: {},
        agentRoster: {
          'agent-1': {
            id: 'agent-1',
            sessionId: 'sess1',
            name: 'Planner',
            role: 'Coordinates work',
            kind: 'coordinator',
            status: 'running',
            avatarColor: '#0088cc',
            sortOrder: 0,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:01:00Z'
          },
          'agent-2': 42
        },
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const state = createStateStore(filePath).load()

    expect(state.agentRoster).toEqual({
      'agent-1': {
        id: 'agent-1',
        sessionId: 'sess1',
        name: 'Planner',
        role: 'Coordinates work',
        kind: 'coordinator',
        status: 'running',
        avatarColor: '#0088cc',
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:01:00Z'
      }
    })
  })

  test('drops agent roster records whose map key does not match the record id', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {},
        sessions: {},
        runs: {},
        agentRoster: {
          valid: {
            id: 'valid',
            sessionId: 'sess1',
            name: 'Planner',
            role: 'Coordinates work',
            kind: 'coordinator',
            status: 'running',
            avatarColor: '#0088cc',
            sortOrder: 0,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:01:00Z'
          },
          'bad-key': {
            id: 'different-id',
            sessionId: 'sess1',
            name: 'Mismatch',
            role: 'Key mismatch',
            kind: 'specialist',
            status: 'idle',
            avatarColor: '#00aa00',
            sortOrder: 1,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:01:00Z'
          }
        },
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const state = createStateStore(filePath).load()

    expect(state.agentRoster).toEqual({
      valid: {
        id: 'valid',
        sessionId: 'sess1',
        name: 'Planner',
        role: 'Coordinates work',
        kind: 'coordinator',
        status: 'running',
        avatarColor: '#0088cc',
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:01:00Z'
      }
    })
  })

  test('loads valid specDocuments and drops malformed entries', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {},
        sessions: {},
        runs: {},
        agentRoster: {},
        specDocuments: {
          's1:sess1': {
            markdown: '# Spec',
            updatedAt: '2026-03-03T00:00:00.000Z',
            appliedRunId: 'run-1',
            appliedAt: '2026-03-03T00:01:00.000Z'
          },
          bad_markdown: {
            markdown: 123,
            updatedAt: '2026-03-03T00:00:00.000Z'
          },
          bad_updatedAt: {
            markdown: '# Broken',
            updatedAt: 123
          },
          bad_appliedAt: {
            markdown: '# Broken',
            updatedAt: '2026-03-03T00:00:00.000Z',
            appliedAt: 123
          },
          bad_appliedRunId: {
            markdown: '# Broken',
            updatedAt: '2026-03-03T00:00:00.000Z',
            appliedRunId: 123
          },
          bad_non_object: 42
        },
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const state = createStateStore(filePath).load()

    expect(state.specDocuments).toEqual({
      's1:sess1': {
        markdown: '# Spec',
        updatedAt: '2026-03-03T00:00:00.000Z',
        appliedRunId: 'run-1',
        appliedAt: '2026-03-03T00:01:00.000Z'
      }
    })
  })

  test('drops prototype-polluting keys from specDocuments', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {},
        sessions: {},
        runs: {},
        agentRoster: {},
        specDocuments: {
          '__proto__': {
            markdown: '# Evil',
            updatedAt: '2026-03-03T00:00:00.000Z'
          },
          constructor: {
            markdown: '# Evil',
            updatedAt: '2026-03-03T00:00:00.000Z'
          },
          prototype: {
            markdown: '# Evil',
            updatedAt: '2026-03-03T00:00:00.000Z'
          },
          'safe-key': {
            markdown: '# Safe',
            updatedAt: '2026-03-03T00:00:00.000Z'
          }
        },
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const state = createStateStore(filePath).load()

    expect(Object.keys(state.specDocuments)).toEqual(['safe-key'])
    expect(state.specDocuments['safe-key']?.markdown).toBe('# Safe')
  })

  test('drops prototype-polluting keys from runs during reconciliation', () => {
    const makeRun = (id: string) =>
      `{"id":"${id}","sessionId":"s","prompt":"p","status":"running","model":"m","provider":"p","createdAt":"2026-03-03T00:00:00.000Z","messages":[]}`
    fs.writeFileSync(
      filePath,
      `{"spaces":{},"sessions":{},"runs":{"constructor":${makeRun('constructor')},"safe_run":${makeRun('safe_run')}},"agentRoster":{},"specDocuments":{},"activeSpaceId":null,"activeSessionId":null}`
    )

    const state = createStateStore(filePath).load({ reconcileInterruptedRuns: true })

    expect(state.runs.safe_run?.status).toBe('failed')
    expect(state.runs).not.toHaveProperty('constructor')
  })

  test('does not reconcile interrupted runs on default load', () => {
    const runsPayload = {
      queued_run: {
        id: 'queued_run',
        sessionId: 'sess-1',
        prompt: 'queued',
        status: 'queued',
        model: 'm',
        provider: 'p',
        createdAt: '2026-03-03T00:00:00.000Z',
        messages: []
      },
      running_run: {
        id: 'running_run',
        sessionId: 'sess-1',
        prompt: 'running',
        status: 'running',
        model: 'm',
        provider: 'p',
        createdAt: '2026-03-03T00:00:00.000Z',
        startedAt: '2026-03-03T00:00:01.000Z',
        messages: []
      }
    }

    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {},
        sessions: {},
        runs: runsPayload,
        agentRoster: {},
        specDocuments: {},
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const state = createStateStore(filePath).load()

    expect(state.runs.queued_run?.status).toBe('queued')
    expect(state.runs.running_run?.status).toBe('running')
  })

  test('reconciles queued and running runs to failed when reconcileInterruptedRuns option is true', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {},
        sessions: {},
        runs: {
          queued_run: {
            id: 'queued_run',
            sessionId: 'sess-1',
            prompt: 'queued',
            status: 'queued',
            model: 'm',
            provider: 'p',
            createdAt: '2026-03-03T00:00:00.000Z',
            messages: []
          },
          running_run: {
            id: 'running_run',
            sessionId: 'sess-1',
            prompt: 'running',
            status: 'running',
            model: 'm',
            provider: 'p',
            createdAt: '2026-03-03T00:00:00.000Z',
            startedAt: '2026-03-03T00:00:01.000Z',
            messages: [
              {
                id: 'msg-1',
                role: 'agent',
                content: 'Working...',
                createdAt: '2026-03-03T00:00:02.000Z'
              }
            ]
          },
          failed_run: {
            id: 'failed_run',
            sessionId: 'sess-1',
            prompt: 'failed',
            status: 'failed',
            model: 'm',
            provider: 'p',
            createdAt: '2026-03-03T00:00:00.000Z',
            completedAt: '2026-03-03T00:00:05.000Z',
            errorMessage: 'Original failure',
            messages: []
          },
          completed_run: {
            id: 'completed_run',
            sessionId: 'sess-1',
            prompt: 'completed',
            status: 'completed',
            model: 'm',
            provider: 'p',
            createdAt: '2026-03-03T00:00:00.000Z',
            completedAt: '2026-03-03T00:00:06.000Z',
            messages: []
          }
        },
        agentRoster: {},
        specDocuments: {},
        activeSpaceId: null,
        activeSessionId: null
      })
    )

    const state = createStateStore(filePath).load({ reconcileInterruptedRuns: true })
    const expectedError = 'Recovered after app restart: in-flight run was interrupted'

    expect(state.runs.queued_run?.status).toBe('failed')
    expect(state.runs.queued_run?.errorMessage).toBe(expectedError)
    expect(state.runs.queued_run?.completedAt).toEqual(expect.any(String))
    expect(Number.isNaN(Date.parse(state.runs.queued_run?.completedAt ?? ''))).toBe(false)

    expect(state.runs.running_run?.status).toBe('failed')
    expect(state.runs.running_run?.errorMessage).toBe(expectedError)
    expect(state.runs.running_run?.completedAt).toEqual(expect.any(String))
    expect(Number.isNaN(Date.parse(state.runs.running_run?.completedAt ?? ''))).toBe(false)
    expect(state.runs.running_run?.messages).toEqual([
      {
        id: 'msg-1',
        role: 'agent',
        content: 'Working...',
        createdAt: '2026-03-03T00:00:02.000Z'
      }
    ])

    expect(state.runs.failed_run?.status).toBe('failed')
    expect(state.runs.failed_run?.errorMessage).toBe('Original failure')
    expect(state.runs.failed_run?.completedAt).toBe('2026-03-03T00:00:05.000Z')

    expect(state.runs.completed_run?.status).toBe('completed')
    expect(state.runs.completed_run?.completedAt).toBe('2026-03-03T00:00:06.000Z')
  })

  test('nulls active ids that do not point to existing records while preserving valid state', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {
          s1: {
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
        sessions: {
          sess1: {
            id: 'sess1',
            spaceId: 's1',
            label: 'Session',
            createdAt: '2026-01-01T00:00:00Z'
          }
        },
        runs: {},
        agentRoster: {},
        activeSpaceId: 'missing-space',
        activeSessionId: 'missing-session'
      })
    )

    const state = createStateStore(filePath).load()

    expect(state.spaces.s1?.id).toBe('s1')
    expect(state.sessions.sess1?.id).toBe('sess1')
    expect(state.activeSpaceId).toBeNull()
    expect(state.activeSessionId).toBeNull()
  })

  test('resets activeSessionId when session belongs to a different space', () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        spaces: {
          s1: {
            id: 's1',
            name: 'Space One',
            repoUrl: 'https://github.com/test/repo',
            rootPath: '/tmp/repo',
            branch: 'main',
            orchestrationMode: 'single',
            createdAt: '2026-01-01T00:00:00Z',
            status: 'active'
          }
        },
        sessions: {
          sess1: {
            id: 'sess1',
            spaceId: 's2',
            label: 'Session from other space',
            createdAt: '2026-01-01T00:00:00Z'
          }
        },
        runs: {},
        agentRoster: {},
        activeSpaceId: 's1',
        activeSessionId: 'sess1'
      })
    )

    const state = createStateStore(filePath).load()

    expect(state.activeSpaceId).toBe('s1')
    expect(state.activeSessionId).toBeNull()
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
      spaces: {
        's1': {
          id: 's1',
          name: 'Test Space',
          repoUrl: 'https://github.com/test/repo',
          rootPath: '/tmp/repo',
          branch: 'main',
          orchestrationMode: 'single',
          createdAt: '2026-01-01T00:00:00Z',
          status: 'active'
        }
      },
      sessions: {
        'sess1': {
          id: 'sess1',
          spaceId: 's1',
          label: 'Test Session',
          createdAt: '2026-02-25T00:00:00Z'
        }
      },
      runs: {},
      agentRoster: {},
      specDocuments: {},
      activeSpaceId: 's1',
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
