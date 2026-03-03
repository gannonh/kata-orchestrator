import type { ConversationMessage } from '../../types/session-conversation'

export type InlineDecisionActionId =
  | 'approve_tech_stack_plan'
  | 'keep_last_stack_switch'
  | 'ask_for_clarification'

export type InlineDecisionAction = {
  id: InlineDecisionActionId
  label: string
  followUpPrompt: string
  variant: 'default' | 'secondary' | 'outline'
}

export type InlineDecisionCard = {
  sourceMessageId: string
  promptLabel: string
  actions: InlineDecisionAction[]
}

const PROMPT_LABEL = 'Approve this plan with 1 check? Clarifications'
const APPROVE_ACTION_LABEL = 'Approve the plan...'
const KEEP_SWITCH_ACTION_LABEL = 'Keep the last switch...'

const BASE_ACTIONS: InlineDecisionAction[] = [
  {
    id: 'approve_tech_stack_plan',
    label: APPROVE_ACTION_LABEL,
    followUpPrompt: 'Approve the plan and continue with this tech stack.',
    variant: 'default'
  },
  {
    id: 'keep_last_stack_switch',
    label: KEEP_SWITCH_ACTION_LABEL,
    followUpPrompt: 'Keep the last switch and apply the revised views.',
    variant: 'secondary'
  },
  {
    id: 'ask_for_clarification',
    label: 'Clarifications',
    followUpPrompt: 'I need clarifications before approving this plan.',
    variant: 'outline'
  }
]

function normalizeSemanticLine(content: string): string {
  return content
    .toLowerCase()
    .replace(/[`'"!?.,:;()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeHeadingLine(content: string): string {
  return normalizeSemanticLine(content.replace(/^\s*#{1,6}\s*/, ''))
}

function hasStableLaterHeading(contentLines: string[]): boolean {
  return contentLines.some((line) =>
    /^how\b.*\bkeep\b.*\btech\b.*\bstable\b.*\blater\b/.test(normalizeHeadingLine(line))
  )
}

function hasPromptLine(contentLines: string[]): boolean {
  return contentLines.some((line) =>
    /\bapprove\b.*\bthis\b.*\bplan\b.*\b1\b.*\bcheck\b.*\bclarifications\b/.test(normalizeSemanticLine(line))
  )
}

function hasListActionLine(contentLines: string[], expectedPrefix: string): boolean {
  return contentLines.some((line) => {
    if (!/^\s*(?:[-*+]|\d+[.)])\s+/.test(line)) {
      return false
    }

    const normalizedLine = normalizeSemanticLine(line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ''))
    return normalizedLine === expectedPrefix
  })
}

function normalizeDecisionReply(content: string): string {
  return content.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function extractInlineDecisionCard(
  message: Pick<ConversationMessage, 'id' | 'role' | 'content'>
): InlineDecisionCard | undefined {
  if (message.role !== 'agent') {
    return undefined
  }

  const contentLines = message.content.split(/\r?\n/)
  const hasWhySection = contentLines.some((line) => normalizeHeadingLine(line) === 'why')
  const hasStabilitySection = hasStableLaterHeading(contentLines)
  const hasPrompt = hasPromptLine(contentLines)
  const hasApproveAction = hasListActionLine(contentLines, normalizeSemanticLine(APPROVE_ACTION_LABEL))
  const hasKeepSwitchAction = hasListActionLine(contentLines, normalizeSemanticLine(KEEP_SWITCH_ACTION_LABEL))

  if (!hasWhySection || !hasStabilitySection || !hasPrompt || !hasApproveAction || !hasKeepSwitchAction) {
    return undefined
  }

  return {
    sourceMessageId: message.id,
    promptLabel: PROMPT_LABEL,
    actions: BASE_ACTIONS.map((action) => ({ ...action }))
  }
}

const ACTION_NORMALIZED_LABELS = BASE_ACTIONS.map((action) => normalizeSemanticLine(action.label))

function isActionBulletLine(line: string): boolean {
  if (!/^\s*(?:[-*+]|\d+[.)])\s+/.test(line)) return false
  const normalized = normalizeSemanticLine(line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ''))
  return ACTION_NORMALIZED_LABELS.some((label) => normalized === label)
}

export function stripDecisionActionLines(content: string): string {
  return content
    .split(/\r?\n/)
    .filter((line) => {
      if (isActionBulletLine(line)) return false
      if (/\bapprove\b.*\bthis\b.*\bplan\b.*\b1\b.*\bcheck\b.*\bclarifications\b/.test(normalizeSemanticLine(line)))
        return false
      return true
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()
}

export function isDecisionResolved(messages: ConversationMessage[], card: InlineDecisionCard): boolean {
  const sourceIndex = messages.findIndex((message) => message.id === card.sourceMessageId)
  if (sourceIndex < 0) {
    return false
  }

  const followUpPrompts = new Set(card.actions.map((action) => normalizeDecisionReply(action.followUpPrompt)))

  return messages
    .slice(sourceIndex + 1)
    .some((message) => message.role === 'user' && followUpPrompts.has(normalizeDecisionReply(message.content)))
}
