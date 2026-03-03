import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { type ReactNode, useEffect } from 'react'

const mockScrollToMessage = vi.fn(() => true)

vi.mock('../../../src/renderer/components/layout/LeftPanel', () => ({
  LeftPanel: ({ conversationEntries, onJumpToMessage }: { conversationEntries?: Array<{ label: string }>; onJumpToMessage?: (messageId: string) => void }) => (
    <aside>
      <span data-testid="left-entry-count">{conversationEntries?.length ?? 0}</span>
      <span data-testid="left-entry-label">{conversationEntries?.[0]?.label ?? ''}</span>
      <button
        type="button"
        aria-label="jump-from-left"
        onClick={() => onJumpToMessage?.('m-1')}
      >
        jump
      </button>
    </aside>
  )
}))

vi.mock('../../../src/renderer/components/layout/PanelResizer', () => ({
  PanelResizer: () => <div data-testid="panel-resizer" />
}))

vi.mock('../../../src/renderer/components/layout/RightPanel', () => ({
  RightPanel: () => <div data-testid="right-panel-mock" />
}))

vi.mock('../../../src/renderer/components/center/CenterPanel', () => ({
  CenterPanel: ({ children }: { children: ReactNode }) => <section>{children}</section>
}))

vi.mock('../../../src/renderer/components/center/ChatPanel', () => ({
  ChatPanel: ({
    onConversationEntriesChange,
    onRegisterScrollToMessage
  }: {
    onConversationEntriesChange?: (entries: Array<{ id: string; messageId: string; label: string; timestamp: string; role: 'user' | 'agent' }>) => void
    onRegisterScrollToMessage?: (handler: (messageId: string) => boolean) => void
  }) => {
    useEffect(() => {
      onConversationEntriesChange?.([
        {
          id: 'entry-m-1',
          messageId: 'm-1',
          label: 'Spec Updated',
          timestamp: '10:00 AM',
          role: 'agent'
        }
      ])
      onRegisterScrollToMessage?.(mockScrollToMessage)
    }, [onConversationEntriesChange, onRegisterScrollToMessage])

    return <div data-testid="chat-panel-mock">chat</div>
  }
}))

import { AppShell } from '../../../src/renderer/components/layout/AppShell'

describe('AppShell conversation jump wiring', () => {
  it('passes conversation entries to LeftPanel and forwards jump requests to registered center scroll handler', async () => {
    render(<AppShell activeSessionId="session-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('left-entry-count').textContent).toBe('1')
    })
    expect(screen.getByTestId('left-entry-label').textContent).toBe('Spec Updated')

    fireEvent.click(screen.getByRole('button', { name: 'jump-from-left' }))
    expect(mockScrollToMessage).toHaveBeenCalledWith('m-1')
  })
})
