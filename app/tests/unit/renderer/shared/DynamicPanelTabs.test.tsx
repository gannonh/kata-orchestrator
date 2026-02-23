import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DynamicPanelTabs } from '../../../../src/renderer/components/shared/DynamicPanelTabs'

describe('DynamicPanelTabs', () => {
  afterEach(() => {
    cleanup()
  })

  const baseTabs = [
    { id: 'base', label: 'Coordinator', kind: 'base' as const, closable: false, renamable: false },
    { id: 'note', label: 'New Note', kind: 'note' as const, closable: true, renamable: true }
  ]

  const openMenu = () => {
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }))
  }

  it('creates a New Note tab and calls onCreateNote for the owning panel', () => {
    const onCreateNote = vi.fn()

    render(
      <DynamicPanelTabs
        ariaLabel="Center tabs"
        tabs={baseTabs}
        activeTabId="base"
        onActiveTabChange={() => {}}
        onCreateNote={onCreateNote}
        onCloseTab={() => {}}
        onRenameTab={() => {}}
      />
    )

    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'New Note' }))

    expect(onCreateNote).toHaveBeenCalledTimes(1)
  })

  it('keeps non-note menu items enabled but does not trigger note creation', () => {
    const onCreateNote = vi.fn()

    render(
      <DynamicPanelTabs
        ariaLabel="Center tabs"
        tabs={baseTabs}
        activeTabId="base"
        onActiveTabChange={() => {}}
        onCreateNote={onCreateNote}
        onCloseTab={() => {}}
        onRenameTab={() => {}}
      />
    )

    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'New Agent' }))
    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'New Terminal' }))
    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'New Browser' }))

    expect(onCreateNote).not.toHaveBeenCalled()
  })

  it('renders close button only for closable tabs and reports close action', () => {
    const onCloseTab = vi.fn()

    render(
      <DynamicPanelTabs
        ariaLabel="Center tabs"
        tabs={baseTabs}
        activeTabId="note"
        onActiveTabChange={() => {}}
        onCreateNote={() => {}}
        onCloseTab={onCloseTab}
        onRenameTab={() => {}}
      />
    )

    expect(screen.queryByRole('button', { name: 'Close Coordinator tab' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Close New Note tab' }))

    expect(onCloseTab).toHaveBeenCalledWith('note')
  })

  it('updates active tab on pointer interaction', () => {
    const onActiveTabChange = vi.fn()

    render(
      <DynamicPanelTabs
        ariaLabel="Center tabs"
        tabs={baseTabs}
        activeTabId="base"
        onActiveTabChange={onActiveTabChange}
        onCreateNote={() => {}}
        onCloseTab={() => {}}
        onRenameTab={() => {}}
      />
    )

    fireEvent.mouseDown(screen.getByRole('tab', { name: /New Note/ }), { button: 0 })

    expect(onActiveTabChange).toHaveBeenCalledWith('note')
  })

  it('supports rename commit on Enter and blur, with Escape cancel', () => {
    const onRenameTab = vi.fn()

    render(
      <DynamicPanelTabs
        ariaLabel="Center tabs"
        tabs={baseTabs}
        activeTabId="note"
        onActiveTabChange={() => {}}
        onCreateNote={() => {}}
        onCloseTab={() => {}}
        onRenameTab={onRenameTab}
      />
    )

    fireEvent.doubleClick(screen.getByRole('tab', { name: /New Note/ }))

    const renameInput = screen.getByLabelText('Rename New Note tab')
    fireEvent.change(renameInput, { target: { value: 'Renamed note' } })
    fireEvent.keyDown(renameInput, { key: 'Enter', code: 'Enter' })

    expect(onRenameTab).toHaveBeenCalledWith('note', 'Renamed note')

    fireEvent.doubleClick(screen.getByRole('tab', { name: /New Note/ }))
    const escapeInput = screen.getByLabelText('Rename New Note tab')
    fireEvent.change(escapeInput, { target: { value: 'Canceled rename' } })
    fireEvent.keyDown(escapeInput, { key: 'Escape', code: 'Escape' })

    expect(onRenameTab).toHaveBeenCalledTimes(1)

    fireEvent.doubleClick(screen.getByRole('tab', { name: /New Note/ }))
    const blurInput = screen.getByLabelText('Rename New Note tab')
    fireEvent.change(blurInput, { target: { value: 'Blur rename' } })
    fireEvent.blur(blurInput)

    expect(onRenameTab).toHaveBeenCalledWith('note', 'Blur rename')
  })
})
