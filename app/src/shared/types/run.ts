import type { LatestRunDraft } from './spec-document'

export const RUN_STATUSES = ['queued', 'running', 'completed', 'failed'] as const

export const INTERRUPTED_RUN_ERROR_MESSAGE =
  'Recovered after app restart: in-flight run was interrupted'
export type RunStatus = (typeof RUN_STATUSES)[number]

export type PersistedMessage = {
  id: string
  role: 'user' | 'agent'
  content: string
  createdAt: string
}

export type RunRecord = {
  id: string
  sessionId: string
  prompt: string
  status: RunStatus
  model: string
  provider: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  draft?: LatestRunDraft
  draftAppliedAt?: string
  messages: PersistedMessage[]
}
