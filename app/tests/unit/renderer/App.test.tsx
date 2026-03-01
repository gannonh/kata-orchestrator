import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { App } from '../../../src/renderer/App'
import type { SpaceRecord } from '../../../src/shared/types/space'

const testSpace: SpaceRecord = {
  id: 'space-test-1',
  name: 'Test Space',
  repoUrl: 'https://github.com/test/repo',
  rootPath: '/tmp/repo',
  branch: 'main',
  orchestrationMode: 'team',
  createdAt: '2026-01-01T00:00:00.000Z',
  status: 'active'
}

describe('App', () => {
  afterEach(() => {
    window.kata = undefined
    cleanup()
  })

  it('renders home view by default on startup', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Home' })).toBeTruthy()
    expect(screen.queryByRole('tablist', { name: 'Center panel tabs' })).toBeNull()
  })

  it('switches from home view to workspace shell and back, wiring activeSpaceId into the shell', async () => {
    const spaceList = vi.fn().mockResolvedValue([testSpace])
    window.kata = { ...window.kata, spaceList }

    render(<App />)

    expect(screen.getByRole('heading', { name: 'Home' })).toBeTruthy()

    // Wait for IPC spaces to load
    await waitFor(() => {
      expect(screen.getByText('Test Space')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open selected space' }))
    expect(screen.getByRole('tablist', { name: 'Center panel tabs' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Coordinator/ })).toBeTruthy()

    // The selected space ID must be threaded into AppShell after navigation
    const shell = screen.getByTestId('app-shell-root')
    expect(shell.getAttribute('data-active-space-id')).toBeTruthy()
    expect(shell.getAttribute('data-active-space-id')).not.toBe('')

    fireEvent.click(screen.getAllByRole('button', { name: 'Open Home spaces view' })[0])
    expect(screen.getByRole('heading', { name: 'Home' })).toBeTruthy()
  })
})
