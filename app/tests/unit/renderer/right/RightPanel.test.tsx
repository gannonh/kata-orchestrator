import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RightPanel } from '../../../../src/renderer/components/layout/RightPanel'
import { mockProject } from '../../../../src/renderer/mock/project'

afterEach(() => {
  window.kata = undefined
  cleanup()
})

describe('RightPanel', () => {
  it('shows spec content by default', () => {
    render(<RightPanel project={mockProject} />)

    expect(screen.getByRole('tablist', { name: 'Right panel tabs' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Spec/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { level: 3, name: 'Goal' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Architecture' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Tasks' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Acceptance Criteria' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Non-Goals' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Assumptions' })).toBeTruthy()
  })

  it('creates and activates a New Note tab from the right panel menu', () => {
    render(<RightPanel project={mockProject} />)

    fireEvent.click(screen.getByRole('button', { name: 'New tab' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'New Note' }))

    expect(screen.getByRole('tab', { name: /New Note/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText(/Start drafting a specification for what you want to build\./i)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Spec' })).toBeNull()
    expect(screen.queryByText(mockProject.name)).toBeNull()
  })

  it('closes active right-panel note tabs and falls back to spec', () => {
    render(<RightPanel project={mockProject} />)

    fireEvent.click(screen.getByRole('button', { name: 'New tab' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'New Note' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close New Note tab' }))

    expect(screen.getByRole('tab', { name: /Spec/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { level: 3, name: 'Goal' })).toBeTruthy()
  })

  it('renames a right-panel note tab via inline edit', () => {
    render(<RightPanel project={mockProject} />)

    fireEvent.click(screen.getByRole('button', { name: 'New tab' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'New Note' }))
    fireEvent.doubleClick(screen.getByRole('tab', { name: /New Note/ }))

    const renameInput = screen.getByLabelText('Rename New Note tab')
    fireEvent.change(renameInput, { target: { value: 'Spec scratchpad' } })
    fireEvent.keyDown(renameInput, { key: 'Enter', code: 'Enter' })

    expect(screen.getByRole('tab', { name: /Spec scratchpad/ })).toBeTruthy()
  })

  it('keeps the base Spec tab non-closable and non-renamable', () => {
    render(<RightPanel project={mockProject} />)

    expect(screen.queryByRole('button', { name: 'Close Spec tab' })).toBeNull()

    fireEvent.doubleClick(screen.getByRole('tab', { name: /Spec/ }))

    expect(screen.queryByLabelText('Rename Spec tab')).toBeNull()
  })

  it('renders the new-tab trigger in the right-panel header area', () => {
    render(<RightPanel project={mockProject} />)

    const header = screen.getByTestId('right-panel-header')
    const newTabButton = screen.getByRole('button', { name: 'New tab' })

    expect(header.contains(newTabButton)).toBe(true)
  })

  it('resets to the base Spec tab when the active project changes', () => {
    const projectA = { ...mockProject, id: 'project-a' }
    const projectB = { ...mockProject, id: 'project-b' }
    const { rerender } = render(<RightPanel project={projectA} />)

    fireEvent.click(screen.getByRole('button', { name: 'New tab' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'New Note' }))
    expect(screen.getByRole('tab', { name: /New Note/ })).toBeTruthy()

    rerender(<RightPanel project={projectB} />)

    expect(screen.queryByRole('tab', { name: /New Note/ })).toBeNull()
    expect(screen.getByRole('tab', { name: /Spec/ }).getAttribute('aria-selected')).toBe('true')
  })

  it('toggles right column collapse state', () => {
    const { getByTestId } = render(<RightPanel project={mockProject} />)

    const collapseButton = screen.getByRole('button', { name: 'Collapse right column' })
    const content = getByTestId('right-panel-content')

    expect(content).toBeTruthy()
    expect(content?.className).toContain('opacity-100')

    fireEvent.click(collapseButton)

    expect(screen.getByRole('button', { name: 'Expand right column' })).toBeTruthy()
    expect(content?.className).toContain('opacity-0')
    expect(content?.className).toContain('pointer-events-none')

    fireEvent.click(screen.getByRole('button', { name: 'Expand right column' }))

    expect(screen.getByRole('button', { name: 'Collapse right column' })).toBeTruthy()
    expect(content?.className).toContain('opacity-100')
  })

  it('does not call specGet when no active space/session is selected', async () => {
    const specGet = vi.fn().mockResolvedValue(null)
    window.kata = { ...window.kata, specGet }

    render(<RightPanel project={mockProject} />)

    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 0)
    })

    expect(specGet).not.toHaveBeenCalled()
  })
})
