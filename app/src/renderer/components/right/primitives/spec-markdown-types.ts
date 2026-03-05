export type ParsedSpecTaskStatus = 'not_started' | 'in_progress' | 'complete'

export type ParsedSpecSections = {
  goal: string
  acceptanceCriteria: string[]
  nonGoals: string[]
  assumptions: string[]
  verificationPlan: string[]
  rollbackPlan: string[]
}

export type ParsedSpecTaskItem = {
  id: string
  title: string
  status: ParsedSpecTaskStatus
  markdownLineIndex: number
}

export type ParsedSpecMarkdownDocument = {
  markdown: string
  sections: ParsedSpecSections
  tasks: ParsedSpecTaskItem[]
  updatedAt: string
  appliedRunId?: string
}
