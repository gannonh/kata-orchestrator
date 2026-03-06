import type { AppState, SessionAgentRecord, SessionContextResourceRecord } from '@shared/types/space'
import type { RunContextReferenceRecord } from '@shared/types/run'

export type CoordinatorContractState = Pick<AppState, 'agentRoster' | 'contextResources' | 'runs'>

export type CoordinatorAgentListItem = Pick<
  SessionAgentRecord,
  | 'id'
  | 'name'
  | 'role'
  | 'kind'
  | 'status'
  | 'avatarColor'
  | 'delegatedBy'
  | 'currentTask'
  | 'activeRunId'
  | 'waveId'
  | 'groupLabel'
  | 'lastActivityAt'
  | 'sortOrder'
  | 'createdAt'
  | 'updatedAt'
>

export type CoordinatorContextListItem = Pick<
  SessionContextResourceRecord,
  'id' | 'kind' | 'label' | 'sourcePath' | 'description' | 'sortOrder' | 'createdAt' | 'updatedAt'
>

export type CoordinatorRunContextChip = Pick<
  RunContextReferenceRecord,
  'id' | 'kind' | 'label' | 'resourceId' | 'excerpt' | 'lineCount' | 'sortOrder' | 'capturedAt'
>

export type CoordinatorRunContextSummary = {
  referenceCount: number
  pastedLineCount: number
  labels: string[]
}
