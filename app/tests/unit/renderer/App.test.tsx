import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { App } from '../../../src/renderer/App'
import type { SpaceRecord } from '../../../src/shared/types/space'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

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

  it('starts directly in workspace with persisted active IDs from bootstrap', async () => {
    const appBootstrap = vi.fn().mockResolvedValue({
      spaces: {},
      sessions: {},
      specDocuments: {},
      activeSpaceId: 'space-test-1',
      activeSessionId: 'session-persisted-1'
    })
    const sessionCreate = vi.fn()
    window.kata = { ...window.kata, appBootstrap, sessionCreate }

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('app-shell-root')).toBeTruthy()
    })
    expect(appBootstrap).toHaveBeenCalledOnce()
  })

  it('does not create a new session on startup when bootstrap restores active session', async () => {
    const appBootstrap = vi.fn().mockResolvedValue({
      spaces: {},
      sessions: {},
      specDocuments: {},
      activeSpaceId: 'space-test-1',
      activeSessionId: 'session-persisted-1'
    })
    const sessionCreate = vi.fn()
    window.kata = { ...window.kata, appBootstrap, sessionCreate }

    render(<App />)

    await waitFor(() => {
      expect(appBootstrap).toHaveBeenCalledOnce()
      expect(screen.getByTestId('app-shell-root')).toBeTruthy()
    })
    expect(sessionCreate).not.toHaveBeenCalled()
  })

  it('falls back to home when bootstrap does not provide active IDs', async () => {
    const appBootstrap = vi.fn().mockResolvedValue({
      spaces: {},
      sessions: {},
      specDocuments: {},
      activeSpaceId: null,
      activeSessionId: null
    })
    window.kata = { ...window.kata, appBootstrap }

    render(<App />)

    await waitFor(() => {
      expect(appBootstrap).toHaveBeenCalledOnce()
    })
    expect(screen.getByRole('heading', { name: 'Home' })).toBeTruthy()
    expect(screen.queryByRole('tablist', { name: 'Center panel tabs' })).toBeNull()
  })

  it('falls back to home when bootstrap rejects', async () => {
    const appBootstrap = vi.fn().mockRejectedValue(new Error('bootstrap unavailable'))
    window.kata = { ...window.kata, appBootstrap }

    render(<App />)

    await waitFor(() => {
      expect(appBootstrap).toHaveBeenCalledOnce()
      expect(screen.getByRole('heading', { name: 'Home' })).toBeTruthy()
    })
    expect(screen.queryByRole('tablist', { name: 'Center panel tabs' })).toBeNull()
  })

  it('does not update state after unmount if bootstrap resolves late', async () => {
    const deferred = createDeferred<{
      spaces: Record<string, never>
      sessions: Record<string, never>
      specDocuments: Record<string, never>
      activeSpaceId: string | null
      activeSessionId: string | null
    }>()
    const appBootstrap = vi.fn().mockImplementation(() => deferred.promise)
    window.kata = { ...window.kata, appBootstrap }

    const { unmount } = render(<App />)
    unmount()

    deferred.resolve({
      spaces: {},
      sessions: {},
      specDocuments: {},
      activeSpaceId: 'space-test-1',
      activeSessionId: 'session-persisted-1'
    })

    await expect(deferred.promise).resolves.toMatchObject({
      activeSpaceId: 'space-test-1',
      activeSessionId: 'session-persisted-1'
    })
    expect(appBootstrap).toHaveBeenCalledOnce()
  })

  it('renders home view by default on startup', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Home' })).toBeTruthy()
    expect(screen.queryByRole('tablist', { name: 'Center panel tabs' })).toBeNull()
  })

  it('switches from home view to workspace shell and back, wiring activeSpaceId into the shell', async () => {
    const spaceList = vi.fn().mockResolvedValue([testSpace])
    const sessionCreate = vi.fn().mockResolvedValue({ id: 'session-1', spaceId: 'space-test-1', label: 'Chat', createdAt: '2026-01-01T00:00:00.000Z' })
    window.kata = { ...window.kata, spaceList, sessionCreate }

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

    // Session must be created for the opened space
    await waitFor(() => {
      expect(sessionCreate).toHaveBeenCalledWith({ spaceId: 'space-test-1', label: 'Chat' })
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Open Home spaces view' })[0])
    expect(screen.getByRole('heading', { name: 'Home' })).toBeTruthy()
  })

  it('creates a session when opening a space and passes sessionId to AppShell', async () => {
    const spaceList = vi.fn().mockResolvedValue([testSpace])
    const sessionCreate = vi.fn().mockResolvedValue({ id: 'session-abc', spaceId: 'space-test-1', label: 'Chat', createdAt: '2026-01-01T00:00:00.000Z' })
    window.kata = { ...window.kata, spaceList, sessionCreate }

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Test Space')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open selected space' }))

    // Wait for async sessionCreate to resolve and session ID to propagate
    await waitFor(() => {
      expect(sessionCreate).toHaveBeenCalledOnce()
    })
  })

  it('handles sessionCreate failure gracefully without crashing', async () => {
    const spaceList = vi.fn().mockResolvedValue([testSpace])
    const sessionCreate = vi.fn().mockRejectedValue(new Error('IPC unavailable'))
    window.kata = { ...window.kata, spaceList, sessionCreate }

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Test Space')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open selected space' }))

    // AppShell should still render despite session creation failure
    await waitFor(() => {
      expect(screen.getByTestId('app-shell-root')).toBeTruthy()
    })
    expect(sessionCreate).toHaveBeenCalledOnce()
  })

  it('reuses an existing session when reopening a space from Home', async () => {
    const spaceList = vi.fn().mockResolvedValue([testSpace])
    const createdSession = {
      id: 'session-1',
      spaceId: 'space-test-1',
      label: 'Chat',
      createdAt: '2026-01-01T00:00:00.000Z'
    }
    const spaceSetActive = vi.fn().mockResolvedValue({ activeSpaceId: 'space-test-1', activeSessionId: null })
    const sessionListBySpace = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([createdSession])
    const sessionSetActive = vi.fn().mockResolvedValue({
      activeSpaceId: 'space-test-1',
      activeSessionId: 'session-1'
    })
    const sessionCreate = vi.fn().mockResolvedValue(createdSession)
    window.kata = {
      ...window.kata,
      spaceList,
      spaceSetActive,
      sessionListBySpace,
      sessionSetActive,
      sessionCreate
    }

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Test Space')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open selected space' }))
    await waitFor(() => {
      expect(screen.getByTestId('app-shell-root')).toBeTruthy()
      expect(sessionCreate).toHaveBeenCalledTimes(1)
      expect(sessionCreate).toHaveBeenCalledWith({ spaceId: 'space-test-1', label: 'Chat' })
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Open Home spaces view' })[0])
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Home' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open selected space' }))
    await waitFor(() => {
      expect(screen.getByTestId('app-shell-root')).toBeTruthy()
      expect(sessionSetActive).toHaveBeenCalledWith('session-1')
    })

    expect(sessionCreate).toHaveBeenCalledTimes(1)
  })

  it('uses activeSessionId from spaceSetActive when present, skipping session list lookup', async () => {
    const spaceList = vi.fn().mockResolvedValue([testSpace])
    const spaceSetActive = vi.fn().mockResolvedValue({
      activeSpaceId: 'space-test-1',
      activeSessionId: 'session-preexisting'
    })
    const sessionListBySpace = vi.fn()
    const sessionCreate = vi.fn()

    window.kata = {
      ...window.kata,
      spaceList,
      spaceSetActive,
      sessionListBySpace,
      sessionCreate
    }

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Test Space')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open selected space' }))

    await waitFor(() => {
      expect(screen.getByTestId('app-shell-root')).toBeTruthy()
    })

    expect(sessionListBySpace).not.toHaveBeenCalled()
    expect(sessionCreate).not.toHaveBeenCalled()
  })
})
