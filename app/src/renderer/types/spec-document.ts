import type { SpecArtifactDiagnostic, SpecArtifactStatus } from '../../shared/types/spec-document'

export type SpecTaskStatus = 'not_started' | 'in_progress' | 'complete'

export interface StructuredSpecSections {
  goal: string
  acceptanceCriteria: string[]
  nonGoals: string[]
  assumptions: string[]
  verificationPlan: string[]
  rollbackPlan: string[]
}

export interface SpecTaskItem {
  id: string
  title: string
  status: SpecTaskStatus
  markdownLineIndex: number
}

export interface StructuredSpecDocument {
  sourcePath: string
  raw: string
  markdown: string
  visibleMarkdown: string
  status: SpecArtifactStatus
  diagnostics: SpecArtifactDiagnostic[]
  updatedAt: string
  sourceRunId?: string
  appliedRunId?: string
  sections?: StructuredSpecSections
  tasks?: SpecTaskItem[]
}

export type { LatestRunDraft } from '../../shared/types/spec-document'
