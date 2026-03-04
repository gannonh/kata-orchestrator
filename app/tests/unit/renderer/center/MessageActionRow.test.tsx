import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MessageActionRow, type MessageAction } from '../../../../src/renderer/components/center/MessageActionRow'

describe('MessageActionRow', () => {
  afterEach(() => {
    cleanup()
  })

  const actions: MessageAction[] = [
    { id: 'retry', label: 'Retry', variant: 'default' },
    { id: 'edit', label: 'Edit', variant: 'secondary' },
    { id: 'dismiss', label: 'Dismiss', variant: 'outline' },
  ]

  it('renders all actions', () => {
    render(
      <MessageActionRow
        actions={actions}
        onAction={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy()
  })

  it('triggers onAction with the clicked action id', () => {
    const onAction = vi.fn()

    render(
      <MessageActionRow
        actions={actions}
        onAction={onAction}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    expect(onAction).toHaveBeenCalledWith('edit')
  })

  it('disables all buttons when disabled is true', () => {
    const onAction = vi.fn()

    render(
      <MessageActionRow
        actions={actions}
        disabled
        onAction={onAction}
      />
    )

    const retryButton = screen.getByRole('button', { name: 'Retry' }) as HTMLButtonElement
    const editButton = screen.getByRole('button', { name: 'Edit' }) as HTMLButtonElement
    const dismissButton = screen.getByRole('button', { name: 'Dismiss' }) as HTMLButtonElement

    expect(retryButton.disabled).toBe(true)
    expect(editButton.disabled).toBe(true)
    expect(dismissButton.disabled).toBe(true)

    fireEvent.click(editButton)
    expect(onAction).not.toHaveBeenCalled()
  })
})
