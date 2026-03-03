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
  markdown: string
  sections: StructuredSpecSections
  tasks: SpecTaskItem[]
  updatedAt: string
  appliedRunId?: string
}

export type { LatestRunDraft } from '../../shared/types/spec-document'
