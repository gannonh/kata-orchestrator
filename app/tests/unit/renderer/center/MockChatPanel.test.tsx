import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MockChatPanel } from '../../../../src/renderer/components/center/MockChatPanel'

const mockSendMessage = vi.fn()
let mockMessages = [
  {
    id: 'assistant-1',
    role: 'assistant' as const,
    content: '## Existing context',
    toolCalls: [{ id: 'tool-1', name: 'read_file', args: { path: 'foo' }, output: 'ok' }]
  }
]
let mockIsStreaming = true

vi.mock('../../../../src/renderer/hooks/useMockChat', () => ({
  useMockChat: () => ({
    messages: mockMessages,
    isStreaming: mockIsStreaming,
    sendMessage: mockSendMessage
  })
}))

describe('MockChatPanel', () => {
  afterEach(() => {
    cleanup()
  })

  it('composes messages, tool call records, streaming indicator, and input', () => {
    mockMessages = [
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '## Existing context',
        toolCalls: [{ id: 'tool-1', name: 'read_file', args: { path: 'foo' }, output: 'ok' }]
      }
    ]
    mockIsStreaming = true

    render(<MockChatPanel />)

    expect(screen.getByRole('heading', { name: 'Existing context', level: 2 })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tool: read_file' })).toBeTruthy()
    expect(screen.getByText('Kata is streaming a response...')).toBeTruthy()
    expect(screen.getByLabelText('Message input')).toBeTruthy()
  })

  it('renders context chips and thinking status in context-reading state', () => {
    mockMessages = [{ id: 'user-1', role: 'user', content: 'Read ## Context now for # Kata Cloud (Kata V2)' }]
    mockIsStreaming = true

    render(<MockChatPanel />)

    expect(screen.getByText('# Kata Cloud (Kata V2)')).toBeTruthy()
    expect(screen.getByText('## Context...')).toBeTruthy()
    expect(screen.getByText('Thinking')).toBeTruthy()
  })

  it('renders stopped status after streaming ends', () => {
    mockMessages = [{ id: 'user-2', role: 'user', content: 'Pasted 205 lines' }]
    mockIsStreaming = false

    render(<MockChatPanel />)

    expect(screen.getByText('Stopped')).toBeTruthy()
  })
})
