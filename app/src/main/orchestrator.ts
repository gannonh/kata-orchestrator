import { randomUUID } from 'node:crypto'
import type { StateStore } from './state-store'
import type { RunRecord, RunStatus, PersistedMessage } from '../shared/types/run'
import type { LatestRunDraft } from '../shared/types/spec-document'

const VALID_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  queued: ['running', 'failed'],
  running: ['completed', 'failed'],
  completed: [],
  failed: []
}

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
  if (!run) {
    console.error(`[Orchestrator] Cannot update status for unknown run: ${runId}`)
    return
  }

  if (!VALID_TRANSITIONS[run.status].includes(status)) {
    console.error(`[Orchestrator] Invalid transition: ${run.status} -> ${status} for run ${runId}`)
    return
  }

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
  if (!run) {
    console.error(`[Orchestrator] Cannot append message to unknown run: ${runId}`)
    return
  }

  store.save({
    ...state,
    runs: {
      ...state.runs,
      [runId]: { ...run, messages: [...run.messages, message] }
    }
  })
}

export function setRunDraft(store: StateStore, runId: string, draft: LatestRunDraft): void {
  const state = store.load()
  const run = state.runs[runId]
  if (!run) {
    console.error(`[Orchestrator] Cannot set draft for unknown run: ${runId}`)
    return
  }
  if (draft.runId !== runId) {
    console.error(
      `[Orchestrator] Draft runId mismatch: expected ${runId}, received ${draft.runId}`
    )
    return
  }

  store.save({
    ...state,
    runs: {
      ...state.runs,
      [runId]: { ...run, draft }
    }
  })
}

export function markRunDraftApplied(store: StateStore, runId: string, appliedAt: string): void {
  const state = store.load()
  const run = state.runs[runId]
  if (!run) {
    console.error(`[Orchestrator] Cannot mark draft-applied for unknown run: ${runId}`)
    return
  }

  store.save({
    ...state,
    runs: {
      ...state.runs,
      [runId]: { ...run, draftAppliedAt: appliedAt }
    }
  })
}

export function getRunsForSession(store: StateStore, sessionId: string): RunRecord[] {
  const state = store.load()
  return Object.values(state.runs)
    .filter((run) => run.sessionId === sessionId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
