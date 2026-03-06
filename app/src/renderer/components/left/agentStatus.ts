import type { AgentSummary } from '../../types/agent'

export const agentStatusLabel: Record<AgentSummary['status'], string> = {
  idle: 'Idle',
  queued: 'Queued',
  delegating: 'Delegating',
  running: 'Running',
  blocked: 'Blocked',
  completed: 'Completed',
  failed: 'Failed'
}

// Maps agent lifecycle states to shared status tokens (idle/queued=todo, running/delegating=in-progress, completed=done)
export const statusDotClassName: Record<AgentSummary['status'], string> = {
  idle: 'bg-status-todo/55',
  queued: 'bg-status-todo/55',
  delegating: 'bg-status-in-progress',
  running: 'bg-status-in-progress',
  blocked: 'bg-status-blocked',
  completed: 'bg-status-done',
  failed: 'bg-status-blocked'
}
