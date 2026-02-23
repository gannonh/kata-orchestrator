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

  it('renders the open menu outside the tablist scrolling container to avoid clipping', () => {
    render(
      <DynamicPanelTabs
        ariaLabel="Center tabs"
        tabs={baseTabs}
        activeTabId="base"
        onActiveTabChange={() => {}}
        onCreateNote={() => {}}
        onCloseTab={() => {}}
        onRenameTab={() => {}}
      />
    )

    openMenu()

    const tablist = screen.getByRole('tablist', { name: 'Center tabs' })
    const menu = screen.getByRole('menu')
    expect(tablist.contains(menu)).toBe(false)
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

  it('closes menu on outside click and Escape, while ignoring non-Escape keys', () => {
    render(
      <DynamicPanelTabs
        ariaLabel="Center tabs"
        tabs={baseTabs}
        activeTabId="base"
        onActiveTabChange={() => {}}
        onCreateNote={() => {}}
        onCloseTab={() => {}}
        onRenameTab={() => {}}
      />
    )

    openMenu()
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'New Agent' }))
    expect(screen.getByRole('menu')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Enter', code: 'Enter' })
    expect(screen.getByRole('menu')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()

    openMenu()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
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

  it('ignores non-left pointer tab activation and suppresses close-button mousedown bubbling', () => {
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

    fireEvent.mouseDown(screen.getByRole('tab', { name: /New Note/ }), { button: 1 })
    expect(onActiveTabChange).not.toHaveBeenCalled()

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Close New Note tab' }))
    expect(onActiveTabChange).not.toHaveBeenCalled()
  })

  it('handles missing tab/input state during rename commit and blank/unchanged labels', () => {
    const onRenameTab = vi.fn()
    const { rerender } = render(
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
    const detachedInput = screen.getByLabelText('Rename New Note tab')

    rerender(
      <DynamicPanelTabs
        ariaLabel="Center tabs"
        tabs={[baseTabs[0]]}
        activeTabId="base"
        onActiveTabChange={() => {}}
        onCreateNote={() => {}}
        onCloseTab={() => {}}
        onRenameTab={onRenameTab}
      />
    )

    fireEvent.blur(detachedInput)
    expect(onRenameTab).not.toHaveBeenCalled()

    rerender(
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

    const whitespaceInput = screen.getByLabelText('Rename New Note tab')
    fireEvent.change(whitespaceInput, { target: { value: '   ' } })
    fireEvent.keyDown(whitespaceInput, { key: 'Enter', code: 'Enter' })
    expect(onRenameTab).not.toHaveBeenCalled()

    fireEvent.doubleClick(screen.getByRole('tab', { name: /New Note/ }))
    const unchangedInput = screen.getByLabelText('Rename New Note tab')
    fireEvent.change(unchangedInput, { target: { value: 'New Note' } })
    fireEvent.blur(unchangedInput)
    expect(onRenameTab).not.toHaveBeenCalled()

    fireEvent.doubleClick(screen.getByRole('tab', { name: /New Note/ }))
    const escapeInput = screen.getByLabelText('Rename New Note tab')
    fireEvent.keyDown(escapeInput, { key: 'Escape', code: 'Escape' })
    fireEvent.blur(escapeInput)
    expect(onRenameTab).not.toHaveBeenCalled()
  })

  it('cancels active rename state when closing the edited tab', () => {
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

    fireEvent.doubleClick(screen.getByRole('tab', { name: /New Note/ }))
    expect(screen.getByLabelText('Rename New Note tab')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Close New Note tab' }))
    expect(onCloseTab).toHaveBeenCalledWith('note')
    expect(screen.queryByLabelText('Rename New Note tab')).toBeNull()
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
