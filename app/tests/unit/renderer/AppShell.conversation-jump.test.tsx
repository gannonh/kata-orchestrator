import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { type ReactNode, useEffect } from 'react'

const mockScrollToMessage = vi.fn(() => true)

vi.mock('../../../src/renderer/components/layout/LeftPanel', () => ({
  LeftPanel: ({
    conversationEntries,
    onJumpToMessage,
    taskActivitySnapshot
  }: {
    conversationEntries?: Array<{ label: string }>
    onJumpToMessage?: (messageId: string) => void
    taskActivitySnapshot?: { runId: string }
  }) => (
    <aside>
      <span data-testid="left-entry-count">{conversationEntries?.length ?? 0}</span>
      <span data-testid="left-entry-label">{conversationEntries?.[0]?.label ?? ''}</span>
      <span data-testid="left-snapshot-run-id">{taskActivitySnapshot?.runId ?? ''}</span>
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
    onRegisterScrollToMessage,
    onTaskActivitySnapshotChange
  }: {
    onConversationEntriesChange?: (entries: Array<{ id: string; messageId: string; label: string; timestamp: string; role: 'user' | 'agent' }>) => void
    onRegisterScrollToMessage?: (handler: (messageId: string) => boolean) => void
    onTaskActivitySnapshotChange?: (snapshot: { sessionId: string; runId: string; items: []; counts: { not_started: number; in_progress: number; blocked: number; complete: number } }) => void
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
      onTaskActivitySnapshotChange?.({
        sessionId: 'session-1',
        runId: 'run-1',
        items: [],
        counts: { not_started: 0, in_progress: 0, blocked: 0, complete: 0 }
      })
      onRegisterScrollToMessage?.(mockScrollToMessage)
    }, [onConversationEntriesChange, onRegisterScrollToMessage, onTaskActivitySnapshotChange])

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
    expect(screen.getByTestId('left-snapshot-run-id').textContent).toBe('run-1')

    fireEvent.click(screen.getByRole('button', { name: 'jump-from-left' }))
    expect(mockScrollToMessage).toHaveBeenCalledWith('m-1')
  })
})
