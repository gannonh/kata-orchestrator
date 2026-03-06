import { type ChatMessage, type ToolCallRecord } from '../../types/chat'
import type { ConversationMessage } from '../../types/session-conversation'
import {
  toCoordinatorStatusBadgeState,
  toPrimitiveMessage
} from './primitives/adapters'
import type {
  CoordinatorStatusBadgeState,
  PrimitiveMessage
} from './primitives/types'

export type MockChatViewState = 'initial' | 'pastedContext' | 'contextReading' | 'analyzing'

export type MockChatPresentationBlock =
  | {
      id: string
      type: 'message'
      message: PrimitiveMessage
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
      variant: CoordinatorStatusBadgeState
    }

export type MockChatPresentation = {
  viewState: MockChatViewState
  blocks: MockChatPresentationBlock[]
}

type DeriveMockChatPresentationInput = {
  messages: Array<ChatMessage | ConversationMessage>
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

function inferViewState(reversedUserMessages: Array<ChatMessage | ConversationMessage>, isStreaming: boolean, forceAnalyzing: boolean): MockChatViewState {
  if (forceAnalyzing) {
    return 'analyzing'
  }

  for (const message of reversedUserMessages) {
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
  const reversed = [...input.messages].reverse()
  const reversedUsers = reversed.filter((message) => message.role === 'user')
  const viewState = inferViewState(reversedUsers, input.isStreaming, input.forceAnalyzing ?? false)
  const statusVariant = toCoordinatorStatusBadgeState({
    conversationRunState: input.isStreaming ? 'pending' : 'idle'
  })
  const latestUser = reversedUsers[0]
  const latestAnalyzingUser = reversedUsers
    .find((message) => ANALYZING_TRIGGER.test(message.content))
  const analyzingTarget =
    viewState === 'analyzing' ? (input.forceAnalyzing ? latestUser : latestAnalyzingUser ?? latestUser) : undefined

  const blocks: MockChatPresentationBlock[] = []

  for (const message of input.messages) {
    const primitiveMessage = toPrimitiveMessage(message)

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
      message: primitiveMessage
    })

    if ('toolCalls' in message) {
      for (const toolCall of message.toolCalls ?? []) {
        blocks.push({
          id: `tool-${toolCall.id}`,
          type: 'toolCall',
          toolCall
        })
      }
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
