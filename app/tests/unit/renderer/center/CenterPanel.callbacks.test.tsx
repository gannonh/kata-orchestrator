import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../src/renderer/components/shared/DynamicPanelTabs', () => ({
  DynamicPanelTabs: ({
    onActiveTabChange,
    onCloseTab,
    onCreateNote
  }: {
    onActiveTabChange: (tabId: string) => void
    onCloseTab: (tabId: string) => void
    onCreateNote: () => void
  }) => (
    <div>
      <button type="button" onClick={() => onActiveTabChange('center-missing')}>set-missing-active</button>
      <button type="button" onClick={() => onActiveTabChange('center-coordinator')}>set-base-active</button>
      <button type="button" onClick={() => onCreateNote()}>create-note</button>
      <button type="button" onClick={() => onCloseTab('center-missing')}>close-missing</button>
      <button type="button" onClick={() => onCloseTab('center-coordinator')}>close-base</button>
      <button type="button" onClick={() => onCloseTab('center-note-1')}>close-note-1</button>
      <button type="button" onClick={() => onCloseTab('center-note-2')}>close-note-2</button>
    </div>
  )
}))

import { CenterPanel } from '../../../../src/renderer/components/center/CenterPanel'

describe('CenterPanel callback branches', () => {
  afterEach(() => {
    cleanup()
  })

  it('handles missing and synthetic close paths without crashing', () => {
    render(
      <CenterPanel>
        <div>chat content</div>
      </CenterPanel>
    )

    fireEvent.click(screen.getByRole('button', { name: 'set-missing-active' }))
    expect(screen.getByText('chat content')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'close-missing' }))
    expect(screen.getByText('chat content')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'create-note' }))
    fireEvent.click(screen.getByRole('button', { name: 'set-base-active' }))
    fireEvent.click(screen.getByRole('button', { name: 'close-note-1' }))
    expect(screen.getByText('chat content')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'create-note' }))
    fireEvent.click(screen.getByRole('button', { name: 'set-base-active' }))
    fireEvent.click(screen.getByRole('button', { name: 'close-base' }))
    fireEvent.click(screen.getByRole('button', { name: 'close-note-2' }))
    expect(screen.getByText('chat content')).toBeTruthy()
  })
})
