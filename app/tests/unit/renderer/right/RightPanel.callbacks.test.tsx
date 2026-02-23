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
      <button type="button" onClick={() => onActiveTabChange('right-missing')}>set-missing-active</button>
      <button type="button" onClick={() => onActiveTabChange('right-spec')}>set-base-active</button>
      <button type="button" onClick={() => onCreateNote()}>create-note</button>
      <button type="button" onClick={() => onCloseTab('right-missing')}>close-missing</button>
      <button type="button" onClick={() => onCloseTab('right-spec')}>close-base</button>
      <button type="button" onClick={() => onCloseTab('right-note-1')}>close-note-1</button>
      <button type="button" onClick={() => onCloseTab('right-note-2')}>close-note-2</button>
    </div>
  )
}))

import { RightPanel } from '../../../../src/renderer/components/layout/RightPanel'
import { mockProject } from '../../../../src/renderer/mock/project'

describe('RightPanel callback branches', () => {
  afterEach(() => {
    cleanup()
  })

  it('handles missing and synthetic close paths without crashing', () => {
    render(<RightPanel project={mockProject} />)

    fireEvent.click(screen.getByRole('button', { name: 'set-missing-active' }))
    expect(screen.getByRole('heading', { name: 'Spec' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'close-missing' }))
    expect(screen.getByRole('heading', { name: 'Spec' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'create-note' }))
    fireEvent.click(screen.getByRole('button', { name: 'set-base-active' }))
    fireEvent.click(screen.getByRole('button', { name: 'close-note-1' }))
    expect(screen.getByRole('heading', { name: 'Spec' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'create-note' }))
    fireEvent.click(screen.getByRole('button', { name: 'set-base-active' }))
    fireEvent.click(screen.getByRole('button', { name: 'close-base' }))
    fireEvent.click(screen.getByRole('button', { name: 'close-note-2' }))
    expect(screen.getByRole('heading', { name: 'Spec' })).toBeTruthy()
  })
})
