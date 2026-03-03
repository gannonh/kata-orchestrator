export type LatestRunDraft = {
  runId: string
  generatedAt: string
  content: string
}

export type PersistedSpecDocument = {
  markdown: string
  updatedAt: string
  appliedRunId?: string
  appliedAt?: string
}
