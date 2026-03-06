export type LatestRunDraft = {
  runId: string
  generatedAt: string
  content: string
}

export type SpecArtifactStatus = 'drafting' | 'ready'

export type SpecArtifactFrontmatter = {
  status: SpecArtifactStatus
  updatedAt: string
  sourceRunId?: string
}

export type SpecArtifactDiagnostic = {
  code: 'invalid_frontmatter_yaml' | 'invalid_frontmatter_shape' | 'invalid_task_reference'
  message: string
  line?: number
}

export type PersistedSpecDocument = {
  markdown: string
  updatedAt: string
  appliedRunId?: string
  appliedAt?: string
  sourcePath?: string
  raw?: string
  frontmatter?: SpecArtifactFrontmatter
  diagnostics?: SpecArtifactDiagnostic[]
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
    (candidate.appliedAt === undefined || typeof candidate.appliedAt === 'string') &&
    (candidate.sourcePath === undefined || typeof candidate.sourcePath === 'string') &&
    (candidate.raw === undefined || typeof candidate.raw === 'string') &&
    (candidate.frontmatter === undefined || isSpecArtifactFrontmatter(candidate.frontmatter)) &&
    (candidate.diagnostics === undefined || isSpecArtifactDiagnosticList(candidate.diagnostics))
  )
}

function isSpecArtifactFrontmatter(value: unknown): value is SpecArtifactFrontmatter {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    (candidate.status === 'drafting' || candidate.status === 'ready') &&
    typeof candidate.updatedAt === 'string' &&
    (candidate.sourceRunId === undefined || typeof candidate.sourceRunId === 'string')
  )
}

function isSpecArtifactDiagnosticList(value: unknown): value is SpecArtifactDiagnostic[] {
  return Array.isArray(value) && value.every((item) => isSpecArtifactDiagnostic(item))
}

function isSpecArtifactDiagnostic(value: unknown): value is SpecArtifactDiagnostic {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    (candidate.code === 'invalid_frontmatter_yaml' ||
      candidate.code === 'invalid_frontmatter_shape' ||
      candidate.code === 'invalid_task_reference') &&
    typeof candidate.message === 'string' &&
    (candidate.line === undefined || typeof candidate.line === 'number')
  )
}
