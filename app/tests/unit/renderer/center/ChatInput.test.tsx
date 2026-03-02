import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChatInput } from '../../../../src/renderer/components/center/ChatInput'

describe('ChatInput', () => {
  afterEach(() => {
    cleanup()
  })

  it('submits trimmed messages and clears the input', () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} />)

    const textarea = screen.getByLabelText('Message input')
    const sendButton = screen.getByRole('button', { name: 'Send' })

    fireEvent.change(textarea, { target: { value: '  ship Wave 4  ' } })
    fireEvent.click(sendButton)

    expect(onSend).toHaveBeenCalledWith('ship Wave 4')
    expect((textarea as HTMLTextAreaElement).value).toBe('')
  })

  it('submits on Enter and preserves new lines on Shift+Enter', () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} />)

    const textarea = screen.getByLabelText('Message input')

    fireEvent.change(textarea, { target: { value: 'first line' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()

    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('first line')
  })

  it('does not submit on Enter while IME composition is active', () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} />)

    const textarea = screen.getByLabelText('Message input')

    fireEvent.change(textarea, { target: { value: 'compose me' } })
    fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true })

    expect(onSend).not.toHaveBeenCalled()
  })

  it('does not submit empty or disabled input', () => {
    const onSend = vi.fn()

    const { rerender } = render(<ChatInput onSend={onSend} />)
    const textarea = screen.getByLabelText('Message input')
    const sendButton = screen.getByRole('button', { name: 'Send' })

    fireEvent.change(textarea, { target: { value: '   ' } })
    fireEvent.click(sendButton)
    expect(onSend).not.toHaveBeenCalled()

    rerender(
      <ChatInput
        onSend={onSend}
        disabled
      />
    )

    fireEvent.change(textarea, { target: { value: 'run now' } })
    fireEvent.submit(textarea.closest('form') as HTMLFormElement)
    expect(onSend).not.toHaveBeenCalled()
  })

  it('locks submit while pending', () => {
    render(
      <ChatInput
        onSend={vi.fn()}
        runState="pending"
      />
    )

    const textarea = screen.getByLabelText('Message input')
    const sendButton = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement

    fireEvent.change(textarea, { target: { value: 'still running' } })

    expect(sendButton.disabled).toBe(true)
  })

  it('does not submit on Enter or form submit while pending', () => {
    const onSend = vi.fn()

    render(
      <ChatInput
        onSend={onSend}
        runState="pending"
      />
    )

    const textarea = screen.getByLabelText('Message input')
    const form = textarea.closest('form') as HTMLFormElement

    fireEvent.change(textarea, { target: { value: 'still running' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    fireEvent.submit(form)

    expect(onSend).not.toHaveBeenCalled()
  })

  it('shows retry affordance when in error state', () => {
    const onRetry = vi.fn()

    render(
      <ChatInput
        onSend={vi.fn()}
        runState="error"
        onRetry={onRetry}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(onRetry).toHaveBeenCalled()
  })

  it('does not submit on Enter or form submit while error', () => {
    const onSend = vi.fn()

    render(
      <ChatInput
        onSend={onSend}
        runState="error"
        onRetry={vi.fn()}
      />
    )

    const textarea = screen.getByLabelText('Message input')
    const form = textarea.closest('form') as HTMLFormElement

    fireEvent.change(textarea, { target: { value: 'retry me' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    fireEvent.submit(form)

    expect(onSend).not.toHaveBeenCalled()
  })

  it('renders modelSlot when provided and context-first placeholder copy', () => {
    render(
      <ChatInput
        onSend={vi.fn()}
        modelSlot={<span>Claude Sonnet</span>}
      />
    )

    expect(screen.getByText('Claude Sonnet')).toBeTruthy()
    expect(screen.getByPlaceholderText('Ask anything or type @ for context')).toBeTruthy()
  })

  it('renders no model badge when modelSlot is omitted', () => {
    render(<ChatInput onSend={vi.fn()} />)

    expect(screen.queryByText('GPT-5.3 Codex')).toBeNull()
    expect(screen.getByPlaceholderText('Ask anything or type @ for context')).toBeTruthy()
  })
})
