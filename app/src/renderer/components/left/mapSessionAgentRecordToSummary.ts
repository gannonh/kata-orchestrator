import type { SessionAgentRecord } from '../../../shared/types/space'
import type { AgentSummary } from '../../types/agent'

const DEFAULT_TASK = 'Waiting for delegated work.'

export function mapSessionAgentRecordToSummary(record: SessionAgentRecord): AgentSummary {
  return {
    id: record.id,
    name: record.name,
    role: record.role,
    status: record.status,
    avatarColor: record.avatarColor,
    delegatedBy: record.delegatedBy,
    lastUpdated: record.updatedAt,
    currentTask: record.currentTask ?? DEFAULT_TASK,
    model: 'n/a',
    tokenUsage: {
      prompt: 0,
      completion: 0,
      total: 0
    }
  }
}
