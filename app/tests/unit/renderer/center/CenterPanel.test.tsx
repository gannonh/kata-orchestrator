import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { CenterPanel } from '../../../../src/renderer/components/center/CenterPanel'

describe('CenterPanel', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders coordinator tab content by default', () => {
    const { getByTestId } = render(
      <CenterPanel>
        <div>chat content</div>
      </CenterPanel>
    )

    expect(screen.getByRole('tablist', { name: 'Center panel tabs' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Coordinator/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('chat content')).toBeTruthy()
    expect(getByTestId('center-panel').className).toContain('h-full')
  })

  it('creates and activates a New Note tab from the center panel menu', () => {
    render(
      <CenterPanel>
        <div>chat content</div>
      </CenterPanel>
    )

    fireEvent.click(screen.getByRole('button', { name: 'New tab' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'New Note' }))

    expect(screen.getByRole('tab', { name: /New Note/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText(/Start drafting a specification for what you want to build\./i)).toBeTruthy()
  })

  it('closes active note tab and falls back to coordinator', () => {
    render(
      <CenterPanel>
        <div>chat content</div>
      </CenterPanel>
    )

    fireEvent.click(screen.getByRole('button', { name: 'New tab' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'New Note' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close New Note tab' }))

    expect(screen.getByRole('tab', { name: /Coordinator/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('chat content')).toBeTruthy()
  })

  it('renames a center note tab via inline edit', () => {
    render(
      <CenterPanel>
        <div>chat content</div>
      </CenterPanel>
    )

    fireEvent.click(screen.getByRole('button', { name: 'New tab' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'New Note' }))
    fireEvent.doubleClick(screen.getByRole('tab', { name: /New Note/ }))

    const renameInput = screen.getByLabelText('Rename New Note tab')
    fireEvent.change(renameInput, { target: { value: 'Center note' } })
    fireEvent.keyDown(renameInput, { key: 'Enter', code: 'Enter' })

    expect(screen.getByRole('tab', { name: /Center note/ })).toBeTruthy()
  })
})
