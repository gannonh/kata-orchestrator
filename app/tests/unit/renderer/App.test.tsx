import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { App } from '../../../src/renderer/App'

describe('App', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the wave 1 app shell', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Agents' })).toBeTruthy()
    expect(screen.getByRole('tablist', { name: 'Center panel tabs' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Coordinator/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Spec' })).toBeTruthy()
  })

  it('switches from workspace shell to home view and back, wiring activeSpaceId into the shell', () => {
    render(<App />)

    expect(screen.getAllByRole('heading', { name: 'Orchestrator Chat' }).length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByRole('button', { name: 'Open Home spaces view' })[0])
    expect(screen.getByRole('heading', { name: 'Home' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Open selected space' }))
    expect(screen.getAllByRole('heading', { name: 'Orchestrator Chat' }).length).toBeGreaterThan(0)

    // The selected space ID must be threaded into AppShell after navigation
    const shell = screen.getByTestId('app-shell-root')
    expect(shell.getAttribute('data-active-space-id')).toBeTruthy()
    expect(shell.getAttribute('data-active-space-id')).not.toBe('')
  })
})
