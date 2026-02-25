import { type ChatMessage, type ToolCallRecord } from '../../types/chat'

export type MockChatViewState = 'initial' | 'pastedContext' | 'contextReading' | 'analyzing'
export type StatusBadgeVariant = 'thinking' | 'stopped'

export type MockChatPresentationBlock =
  | {
      id: string
      type: 'message'
      message: ChatMessage
    }
  | {
      id: string
      type: 'collapsedSummary'
      summary: string
    }
  | {
      id: string
      type: 'toolCall'
      toolCall: ToolCallRecord
    }
  | {
      id: string
      type: 'contextChipRow'
      chips: string[]
    }
  | {
      id: string
      type: 'statusBadge'
      variant: StatusBadgeVariant
    }

export type MockChatPresentation = {
  viewState: MockChatViewState
  blocks: MockChatPresentationBlock[]
}

type DeriveMockChatPresentationInput = {
  messages: ChatMessage[]
  isStreaming: boolean
  forceAnalyzing?: boolean
}

const CONTEXT_CHIPS = ['# Kata Cloud (Kata V2)', '## Context...']
const ANALYZING_TRIGGER = /(overview|analyz|following product)/i

function summarizeContent(content: string): string {
  const compact = content.replace(/\s+/g, ' ').trim()
  if (compact.length <= 88) {
    return compact
  }

  return `${compact.slice(0, 85).trimEnd()}...`
}

function inferViewState({ messages, isStreaming, forceAnalyzing = false }: DeriveMockChatPresentationInput): MockChatViewState {
  if (forceAnalyzing) {
    return 'analyzing'
  }

  const userMessages = [...messages].reverse().filter((message) => message.role === 'user')

  for (const message of userMessages) {
    const userContent = message.content

    if (/pasted\s+\d+\s+lines/i.test(userContent)) {
      return 'pastedContext'
    }

    if (/(#\s?kata cloud|##\s?context|\bcontext\b)/i.test(userContent)) {
      return 'contextReading'
    }

    if (isStreaming && ANALYZING_TRIGGER.test(userContent)) {
      return 'analyzing'
    }
  }

  return 'initial'
}

export function deriveMockChatPresentation(input: DeriveMockChatPresentationInput): MockChatPresentation {
  const viewState = inferViewState(input)
  const statusVariant: StatusBadgeVariant = input.isStreaming ? 'thinking' : 'stopped'
  const latestUser = [...input.messages].reverse().find((message) => message.role === 'user')
  const latestAnalyzingUser = [...input.messages]
    .reverse()
    .find((message) => message.role === 'user' && ANALYZING_TRIGGER.test(message.content))
  const analyzingTarget =
    viewState === 'analyzing' ? (input.forceAnalyzing ? latestUser : latestAnalyzingUser ?? latestUser) : undefined

  const blocks: MockChatPresentationBlock[] = []

  for (const message of input.messages) {
    if (viewState === 'analyzing' && analyzingTarget && message.id === analyzingTarget.id) {
      blocks.push({
        id: `summary-${message.id}`,
        type: 'collapsedSummary',
        summary: summarizeContent(message.content)
      })
      continue
    }

    blocks.push({
      id: `message-${message.id}`,
      type: 'message',
      message
    })

    for (const toolCall of message.toolCalls ?? []) {
      blocks.push({
        id: `tool-${toolCall.id}`,
        type: 'toolCall',
        toolCall
      })
    }
  }

  if (viewState === 'contextReading' || viewState === 'analyzing') {
    blocks.push({
      id: 'context-chips',
      type: 'contextChipRow',
      chips: CONTEXT_CHIPS
    })
  }

  blocks.push({
    id: `status-${statusVariant}`,
    type: 'statusBadge',
    variant: statusVariant
  })

  return { viewState, blocks }
}
