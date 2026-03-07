import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LeftSection } from '../../../../src/renderer/components/left/LeftSection'

describe('LeftSection', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders section title, subtitle, and a disabled icon add action by default', () => {
    render(
      <LeftSection
        title="Agents"
        description="Agents write code, maintain notes, and coordinate tasks."
        addActionLabel="Add agent"
      >
        <div>Body content</div>
      </LeftSection>
    )

    expect(screen.getByRole('heading', { name: 'Agents' })).toBeTruthy()
    expect(screen.getByText('Agents write code, maintain notes, and coordinate tasks.')).toBeTruthy()
    const addActionButton = screen.getByRole('button', { name: 'Add agent' })
    expect(addActionButton.hasAttribute('disabled')).toBe(true)
    expect(addActionButton.textContent).toBe('')
    expect(screen.queryByText('Add agent')).toBeNull()
    expect(screen.getByText('Body content')).toBeTruthy()
  })

  it('runs add action callback when provided', () => {
    const onAddAction = vi.fn()

    render(
      <LeftSection
        title="Agents"
        description="Agents write code, maintain notes, and coordinate tasks."
        addActionLabel="Add agent"
        onAddAction={onAddAction}
      >
        <div>Body content</div>
      </LeftSection>
    )

    const addActionButton = screen.getByRole('button', { name: 'Add agent' })
    expect(addActionButton.hasAttribute('disabled')).toBe(false)

    fireEvent.click(addActionButton)

    expect(onAddAction).toHaveBeenCalledTimes(1)
  })

  it('renders an inline text action when actionVariant is inline', () => {
    const onAddAction = vi.fn()

    render(
      <LeftSection
        title="Agents"
        description="Agents write code, maintain notes, and coordinate tasks."
        addActionLabel="Create new agent"
        actionVariant="inline"
        onAddAction={onAddAction}
      >
        <div>Body content</div>
      </LeftSection>
    )

    const inlineActionButton = screen.getByRole('button', { name: 'Create new agent' })

    expect(inlineActionButton.textContent).toBe('+ Create new agent')
    expect(inlineActionButton.className).toContain('focus-visible:border-ring')
    expect(inlineActionButton.className).toContain('focus-visible:ring-ring/50')
    expect(inlineActionButton.className).toContain('focus-visible:ring-3')
    expect(screen.queryByRole('button', { name: 'Add agent' })).toBeNull()

    fireEvent.click(inlineActionButton)

    expect(onAddAction).toHaveBeenCalledTimes(1)
  })

  it('renders a disabled inline text action when no add callback is provided', () => {
    render(
      <LeftSection
        title="Agents"
        description="Agents write code, maintain notes, and coordinate tasks."
        addActionLabel="Create new agent"
        actionVariant="inline"
      >
        <div>Body content</div>
      </LeftSection>
    )

    const inlineActionButton = screen.getByRole('button', { name: 'Create new agent' })

    expect(inlineActionButton.textContent).toBe('+ Create new agent')
    expect(inlineActionButton.hasAttribute('disabled')).toBe(true)
  })

  it('does not render an empty description paragraph when description is omitted', () => {
    const { container } = render(
      <LeftSection
        title="Agents"
        addActionLabel="Add agent"
      >
        <div>Body content</div>
      </LeftSection>
    )

    expect(screen.getByRole('heading', { name: 'Agents' })).toBeTruthy()
    expect(screen.getByText('Body content')).toBeTruthy()
    expect(container.querySelectorAll('section > p')).toHaveLength(0)
  })
})
