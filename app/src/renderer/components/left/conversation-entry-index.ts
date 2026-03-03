import type { ConversationMessage } from '../../types/session-conversation'

export type ConversationEntry = {
  id: string
  messageId: string
  label: string
  timestamp: string
  role: ConversationMessage['role']
}

const FALLBACK_LABEL = 'Message'
const FALLBACK_TIMESTAMP = '--:--'
const LABEL_MAX_LENGTH = 72

function normalizeLabel(content: string): string {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const headingLine = lines.find((line) => line.startsWith('#'))
  const source = headingLine ?? lines[0]
  if (!source) {
    return FALLBACK_LABEL
  }

  const withoutHeadingPrefix = source.replace(/^#+\s*/, '').trim()
  const normalized = withoutHeadingPrefix.length > 0 ? withoutHeadingPrefix : source

  if (normalized.length <= LABEL_MAX_LENGTH) {
    return normalized
  }

  return `${normalized.slice(0, LABEL_MAX_LENGTH - 1).trimEnd()}…`
}

function formatEntryTimestamp(createdAt: string): string {
  const timestamp = Date.parse(createdAt)
  if (!Number.isFinite(timestamp)) {
    return FALLBACK_TIMESTAMP
  }

  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  })
}

export function buildConversationEntries(messages: ConversationMessage[]): ConversationEntry[] {
  return messages.map((message) => ({
    id: `entry-${message.id}`,
    messageId: message.id,
    label: normalizeLabel(message.content),
    timestamp: formatEntryTimestamp(message.createdAt),
    role: message.role
  }))
}
