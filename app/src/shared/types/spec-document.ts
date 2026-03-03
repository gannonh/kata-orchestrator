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

export function isPersistedSpecDocument(value: unknown): value is PersistedSpecDocument {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.markdown === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    (candidate.appliedRunId === undefined || typeof candidate.appliedRunId === 'string') &&
    (candidate.appliedAt === undefined || typeof candidate.appliedAt === 'string')
  )
}
