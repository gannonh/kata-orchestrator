import type {
  CoordinatorAgentListItem,
  CoordinatorContextListItem,
  CoordinatorContractState,
  CoordinatorRunContextChip,
  CoordinatorRunContextSummary
} from './contracts'

const PROMPT_PREVIEW_MAX_LENGTH = 88

function compareByOrderThenTimeThenId(
  left: { sortOrder: number; id: string },
  right: { sortOrder: number; id: string },
  leftTimestamp: string,
  rightTimestamp: string
): number {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder
  }

  if (leftTimestamp !== rightTimestamp) {
    return leftTimestamp.localeCompare(rightTimestamp)
  }

  return left.id.localeCompare(right.id)
}

function summarizeSingleLine(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (!compact) {
    return ''
  }

  if (compact.length <= PROMPT_PREVIEW_MAX_LENGTH) {
    return compact
  }

  const truncated = compact.slice(0, PROMPT_PREVIEW_MAX_LENGTH - 3).trimEnd()
  const boundaryIndex = truncated.lastIndexOf(' ')
  const safeTruncation = boundaryIndex > PROMPT_PREVIEW_MAX_LENGTH / 2
    ? truncated.slice(0, boundaryIndex)
    : truncated

  return `${safeTruncation}...`
}

function getLatestRunForSession(state: CoordinatorContractState, sessionId: string) {
  return (
    Object.values(state.runs)
      .filter((run) => run.sessionId === sessionId)
      .sort((left, right) => {
        if (left.createdAt !== right.createdAt) {
          return right.createdAt.localeCompare(left.createdAt)
        }

        return left.id.localeCompare(right.id)
      })[0] ?? null
  )
}

export function selectCoordinatorPromptPreview(
  state: CoordinatorContractState,
  sessionId: string
): string | null {
  const run = getLatestRunForSession(state, sessionId)
  if (!run) {
    return null
  }

  const preview = summarizeSingleLine(run.prompt)
  return preview || null
}

export function selectCoordinatorAgentList(
  state: CoordinatorContractState,
  sessionId: string
): CoordinatorAgentListItem[] {
  return Object.values(state.agentRoster)
    .filter((agent) => agent.sessionId === sessionId)
    .sort((left, right) => compareByOrderThenTimeThenId(left, right, left.createdAt, right.createdAt))
    .map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      kind: agent.kind,
      status: agent.status,
      avatarColor: agent.avatarColor,
      delegatedBy: agent.delegatedBy,
      currentTask: agent.currentTask,
      activeRunId: agent.activeRunId,
      waveId: agent.waveId,
      groupLabel: agent.groupLabel,
      lastActivityAt: agent.lastActivityAt,
      sortOrder: agent.sortOrder,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt
    }))
}

export function selectCoordinatorContextItems(
  state: CoordinatorContractState,
  sessionId: string
): CoordinatorContextListItem[] {
  return Object.values(state.contextResources)
    .filter((resource) => resource.sessionId === sessionId)
    .sort((left, right) =>
      compareByOrderThenTimeThenId(left, right, left.createdAt, right.createdAt)
    )
    .map((resource) => ({
      id: resource.id,
      kind: resource.kind,
      label: resource.label,
      sourcePath: resource.sourcePath,
      description: resource.description,
      sortOrder: resource.sortOrder,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt
    }))
}

export function selectCoordinatorActiveRunContextChips(
  state: CoordinatorContractState,
  sessionId: string
): CoordinatorRunContextChip[] {
  const run = getLatestRunForSession(state, sessionId)
  if (!run) {
    return []
  }

  return [...(run.contextReferences ?? [])]
    .sort((left, right) =>
      compareByOrderThenTimeThenId(left, right, left.capturedAt, right.capturedAt)
    )
    .map((reference) => ({
      id: reference.id,
      kind: reference.kind,
      label: reference.label,
      resourceId: reference.resourceId,
      excerpt: reference.excerpt,
      lineCount: reference.lineCount,
      sortOrder: reference.sortOrder,
      capturedAt: reference.capturedAt
    }))
}

export function selectCoordinatorActiveRunContextSummary(
  state: CoordinatorContractState,
  sessionId: string
): CoordinatorRunContextSummary | null {
  const chips = selectCoordinatorActiveRunContextChips(state, sessionId)
  if (chips.length === 0) {
    return null
  }

  return {
    referenceCount: chips.length,
    pastedLineCount: chips.reduce((total, chip) => {
      if (chip.kind !== 'pasted-text') {
        return total
      }

      return total + (chip.lineCount ?? 0)
    }, 0),
    labels: chips.map((chip) => chip.label)
  }
}
