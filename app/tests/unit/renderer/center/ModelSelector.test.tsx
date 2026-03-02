import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ModelSelector } from '../../../../src/renderer/components/center/ModelSelector'
import type { ModelInfo } from '../../../../src/renderer/components/center/ModelSelector'

const anthropicModel: ModelInfo = {
  provider: 'anthropic',
  modelId: 'claude-sonnet-4-6-20250514',
  name: 'Claude Sonnet 4.6',
  authStatus: 'api_key',
}

const openaiAuthed: ModelInfo = {
  provider: 'openai',
  modelId: 'gpt-4.1-2025-04-14',
  name: 'GPT-4.1',
  authStatus: 'api_key',
}

const openaiUnauthed: ModelInfo = {
  provider: 'openai',
  modelId: 'gpt-4.1-2025-04-14',
  name: 'GPT-4.1',
  authStatus: 'none',
}

describe('ModelSelector', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the current model name', () => {
    render(
      <ModelSelector
        currentModel={anthropicModel}
        models={[anthropicModel, openaiAuthed]}
        onModelChange={vi.fn()}
      />
    )

    expect(screen.getByText('Claude Sonnet 4.6')).toBeDefined()
  })

  it('calls onModelChange when a model is selected', () => {
    const onModelChange = vi.fn()

    render(
      <ModelSelector
        currentModel={anthropicModel}
        models={[anthropicModel, openaiAuthed]}
        onModelChange={onModelChange}
      />
    )

    fireEvent.click(screen.getByText('Claude Sonnet 4.6'))
    fireEvent.click(screen.getByText('GPT-4.1'))

    expect(onModelChange).toHaveBeenCalledWith(openaiAuthed)
  })

  it('shows login indicator for models without auth', () => {
    render(
      <ModelSelector
        currentModel={anthropicModel}
        models={[anthropicModel, openaiUnauthed]}
        onModelChange={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Claude Sonnet 4.6'))

    expect(screen.getByText(/log in/i)).toBeDefined()
  })

  it('does not call onModelChange for unauthenticated models', () => {
    const onModelChange = vi.fn()

    render(
      <ModelSelector
        currentModel={anthropicModel}
        models={[anthropicModel, openaiUnauthed]}
        onModelChange={onModelChange}
      />
    )

    fireEvent.click(screen.getByText('Claude Sonnet 4.6'))
    fireEvent.click(screen.getByText('GPT-4.1'))

    expect(onModelChange).not.toHaveBeenCalled()
  })

  it('renders disabled state', () => {
    render(
      <ModelSelector
        currentModel={anthropicModel}
        models={[]}
        onModelChange={vi.fn()}
        disabled
      />
    )

    const button = screen.getByRole('button')
    expect(button.getAttribute('disabled')).not.toBeNull()
  })

  it('closes the dropdown after selecting a model', () => {
    render(
      <ModelSelector
        currentModel={anthropicModel}
        models={[anthropicModel, openaiAuthed]}
        onModelChange={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Claude Sonnet 4.6'))
    expect(screen.getByText('GPT-4.1')).toBeDefined()

    fireEvent.click(screen.getByText('GPT-4.1'))

    // Dropdown items should no longer be visible (only the badge remains)
    const items = screen.queryAllByText('GPT-4.1')
    expect(items.length).toBe(0)
  })

  it('closes the dropdown on click outside', () => {
    render(
      <ModelSelector
        currentModel={anthropicModel}
        models={[anthropicModel, openaiAuthed]}
        onModelChange={vi.fn()}
      />
    )

    // Open dropdown
    fireEvent.click(screen.getByText('Claude Sonnet 4.6'))
    expect(screen.getByText('GPT-4.1')).toBeDefined()

    // Click outside the dropdown
    fireEvent.mouseDown(document.body)

    // Dropdown should be closed
    expect(screen.queryByText('GPT-4.1')).toBeNull()
  })

  it('closes the dropdown on Escape key', () => {
    render(
      <ModelSelector
        currentModel={anthropicModel}
        models={[anthropicModel, openaiAuthed]}
        onModelChange={vi.fn()}
      />
    )

    // Open dropdown
    fireEvent.click(screen.getByText('Claude Sonnet 4.6'))
    expect(screen.getByText('GPT-4.1')).toBeDefined()

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' })

    // Dropdown should be closed
    expect(screen.queryByText('GPT-4.1')).toBeNull()
  })
})
