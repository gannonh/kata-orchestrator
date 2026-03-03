import type { SessionAgentStatus } from '../../shared/types/space'

export type AgentStatus = SessionAgentStatus

export type AgentTokenUsage = {
  prompt: number
  completion: number
  total: number
}

export type AgentSummary = {
  id: string
  name: string
  role: string
  status: AgentStatus
  model: string
  tokenUsage: AgentTokenUsage
  currentTask: string
  lastUpdated: string
  avatarColor?: string
  delegatedBy?: string
  children?: AgentSummary[]
}
