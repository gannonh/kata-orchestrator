import { randomUUID } from 'node:crypto'
import type { StateStore } from './state-store'
import type { RunRecord, RunStatus, PersistedMessage } from '../shared/types/run'

export type CreateRunInput = {
  sessionId: string
  prompt: string
  model: string
  provider: string
}

export function createRun(store: StateStore, input: CreateRunInput): RunRecord {
  const state = store.load()
  if (!state.sessions[input.sessionId]) {
    throw new Error(`Session not found: ${input.sessionId}`)
  }
  const now = new Date().toISOString()
  const run: RunRecord = {
    id: randomUUID(),
    sessionId: input.sessionId,
    prompt: input.prompt,
    status: 'queued',
    model: input.model,
    provider: input.provider,
    createdAt: now,
    messages: [
      {
        id: `user-${randomUUID().slice(0, 8)}`,
        role: 'user',
        content: input.prompt,
        createdAt: now
      }
    ]
  }

  store.save({
    ...state,
    runs: { ...state.runs, [run.id]: run }
  })

  return run
}

export function updateRunStatus(
  store: StateStore,
  runId: string,
  status: RunStatus,
  errorMessage?: string
): void {
  const state = store.load()
  const run = state.runs[runId]
  if (!run) return

  const now = new Date().toISOString()
  const updates: Partial<RunRecord> = { status }

  if (status === 'running' && !run.startedAt) {
    updates.startedAt = now
  }
  if (status === 'completed' || status === 'failed') {
    updates.completedAt = now
  }
  if (errorMessage !== undefined) {
    updates.errorMessage = errorMessage
  }

  store.save({
    ...state,
    runs: {
      ...state.runs,
      [runId]: { ...run, ...updates }
    }
  })
}

export function appendRunMessage(
  store: StateStore,
  runId: string,
  message: PersistedMessage
): void {
  const state = store.load()
  const run = state.runs[runId]
  if (!run) return

  store.save({
    ...state,
    runs: {
      ...state.runs,
      [runId]: { ...run, messages: [...run.messages, message] }
    }
  })
}

export function getRunsForSession(store: StateStore, sessionId: string): RunRecord[] {
  const state = store.load()
  return Object.values(state.runs)
    .filter((run) => run.sessionId === sessionId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
