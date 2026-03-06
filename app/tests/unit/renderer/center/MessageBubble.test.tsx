import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MessageBubble } from '../../../../src/renderer/components/center/MessageBubble'

describe('MessageBubble', () => {
  const decisionCard = {
    sourceMessageId: 'agent-2',
    promptLabel: 'Approve this plan with 1 check? Clarifications',
    actions: [
      { id: 'approve_tech_stack_plan', label: 'Approve the plan...', variant: 'default', followUpPrompt: 'Approve.' },
      { id: 'ask_for_clarification', label: 'Clarifications', variant: 'outline', followUpPrompt: 'Clarify.' }
    ]
  } as const

  afterEach(() => {
    cleanup()
  })

  it('renders user messages as plain text bubbles', () => {
    render(
      <MessageBubble
        message={{
          id: 'user-1',
          role: 'user',
          content: 'Please summarize the current plan.'
        }}
      />
    )

    expect(screen.getByText('You')).toBeTruthy()
    const contentArticle = screen.getByText('Please summarize the current plan.').closest('article')
    expect(contentArticle).toBeTruthy()
    expect(contentArticle?.parentElement?.closest('article')).toBeNull()
  })

  it('renders assistant messages using markdown formatting', () => {
    render(
      <MessageBubble
        message={{
          id: 'assistant-1',
          role: 'assistant',
          content: ['## Summary', '', '- Added tests', '- Added mock fixtures'].join('\n')
        }}
      />
    )

    expect(screen.getByText('Kata')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Summary', level: 2 })).toBeTruthy()
    expect(screen.getByText('Added tests')).toBeTruthy()
  })

  it('renders conversation agent messages as Kata markdown bubbles', () => {
    render(
      <MessageBubble
        message={{
          id: 'agent-1',
          role: 'agent',
          content: ['## Agent Update', '', '- Deterministic status pipeline wired'].join('\n'),
          createdAt: '1970-01-01T00:00:01.000Z'
        }}
      />
    )

    expect(screen.getByText('Kata')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Agent Update', level: 2 })).toBeTruthy()
    expect(screen.getByText('Deterministic status pipeline wired')).toBeTruthy()
  })

  it('renders collapsed summary variant for analyzing mode', () => {
    render(
      <MessageBubble
        message={{
          id: 'user-2',
          role: 'user',
          content: 'Long content that should not be shown when collapsed.'
        }}
        variant="collapsed"
        summary="I would like to build the following product..."
      />
    )

    const contentArticle = screen.getByText('I would like to build the following product...').closest('article')
    expect(contentArticle).toBeTruthy()
    expect(contentArticle?.parentElement?.closest('article')).toBeNull()
    expect(screen.queryByText('Long content that should not be shown when collapsed.')).toBeNull()
  })

  it('surfaces timestamp, pasted-content footer, and dismiss affordance for pasted user messages', () => {
    const onDismiss = vi.fn()

    render(
      <MessageBubble
        message={{
          id: 'user-paste',
          role: 'user',
          content: 'Pasted 205 lines\n\nspec text',
          createdAt: '2026-03-06T00:00:00.000Z'
        }}
        onDismiss={onDismiss}
      />
    )

    expect(screen.getByText('Just now')).toBeTruthy()
    expect(screen.getByText('Pasted 205 lines')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss message' }))
    expect(onDismiss).toHaveBeenCalledWith('user-paste')
  })

  it('falls back to full message content when collapsed summary is blank', () => {
    render(
      <MessageBubble
        message={{
          id: 'user-3',
          role: 'user',
          content: 'Use full content when summary is blank.'
        }}
        variant="collapsed"
        summary="   "
      />
    )

    expect(screen.getByText('Use full content when summary is blank.')).toBeTruthy()
  })

  it('renders decision action buttons when a decision card is provided', () => {
    const onDecisionAction = vi.fn()

    render(
      <MessageBubble
        message={{
          id: 'agent-2',
          role: 'agent',
          content: 'Decision message content',
          createdAt: '1970-01-01T00:00:02.000Z'
        }}
        decisionCard={decisionCard}
        decisionState="available"
        onDecisionAction={onDecisionAction}
      />
    )

    expect(screen.getByText('Approve this plan with 1 check? Clarifications')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Approve the plan...' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Approve the plan...' }))
    expect(onDecisionAction).toHaveBeenCalledWith('approve_tech_stack_plan')
  })

  it('renders decision actions for assistant ChatMessage after role normalization', () => {
    const onDecisionAction = vi.fn()

    render(
      <MessageBubble
        message={{
          id: 'assistant-2',
          role: 'assistant',
          content: 'Assistant decision message'
        }}
        decisionCard={decisionCard}
        decisionState="available"
        onDecisionAction={onDecisionAction}
      />
    )

    expect(screen.getByRole('button', { name: 'Approve the plan...' })).toBeTruthy()
  })

  it('does not render decision actions for user messages even when decision card is provided', () => {
    render(
      <MessageBubble
        message={{
          id: 'user-10',
          role: 'user',
          content: 'User message content'
        }}
        decisionCard={decisionCard}
        decisionState="available"
        onDecisionAction={vi.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: 'Approve the plan...' })).toBeNull()
  })

  it('disables decision buttons while decision state is pending', () => {
    const onDecisionAction = vi.fn()

    render(
      <MessageBubble
        message={{
          id: 'agent-2',
          role: 'agent',
          content: 'Decision message content',
          createdAt: '1970-01-01T00:00:02.000Z'
        }}
        decisionCard={decisionCard}
        decisionState="pending"
        onDecisionAction={onDecisionAction}
      />
    )

    const approveButton = screen.getByRole('button', { name: 'Approve the plan...' }) as HTMLButtonElement
    expect(approveButton.disabled).toBe(true)
    fireEvent.click(approveButton)
    expect(onDecisionAction).not.toHaveBeenCalled()
  })

  it('shows decision sent text and disables actions when decision state is resolved', () => {
    const onDecisionAction = vi.fn()

    render(
      <MessageBubble
        message={{
          id: 'agent-2',
          role: 'agent',
          content: 'Decision message content',
          createdAt: '1970-01-01T00:00:02.000Z'
        }}
        decisionCard={decisionCard}
        decisionState="resolved"
        onDecisionAction={onDecisionAction}
      />
    )

    expect(screen.getByText('Decision sent')).toBeTruthy()
    const approveButton = screen.getByRole('button', { name: 'Approve the plan...' }) as HTMLButtonElement
    expect(approveButton.disabled).toBe(true)
    fireEvent.click(approveButton)
    expect(onDecisionAction).not.toHaveBeenCalled()
  })
})
