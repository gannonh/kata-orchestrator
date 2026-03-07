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
  sourcePath: string
  raw: string
  markdown: string
  frontmatter: SpecArtifactFrontmatter
  diagnostics: SpecArtifactDiagnostic[]
  updatedAt: string
  lastGoodMarkdown?: string
  lastGoodFrontmatter?: SpecArtifactFrontmatter
  appliedRunId?: string
}

export function isPersistedSpecDocument(value: unknown): value is PersistedSpecDocument {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.sourcePath === 'string' &&
    typeof candidate.raw === 'string' &&
    typeof candidate.markdown === 'string' &&
    isSpecArtifactFrontmatter(candidate.frontmatter) &&
    isSpecArtifactDiagnosticList(candidate.diagnostics) &&
    typeof candidate.updatedAt === 'string' &&
    (candidate.appliedRunId === undefined || typeof candidate.appliedRunId === 'string') &&
    (candidate.lastGoodMarkdown === undefined || typeof candidate.lastGoodMarkdown === 'string') &&
    (candidate.lastGoodFrontmatter === undefined ||
      isSpecArtifactFrontmatter(candidate.lastGoodFrontmatter))
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
