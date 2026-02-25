import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { HomeSpacesScreen } from '../../../../src/renderer/components/home/HomeSpacesScreen'

describe('HomeSpacesScreen', () => {
  afterEach(() => {
    cleanup()
  })

  it('toggles create panel active visuals and mode selections', () => {
    render(<HomeSpacesScreen onOpenSpace={() => {}} />)

    fireEvent.click(screen.getByRole('textbox', { name: 'Space prompt' }))
    expect(screen.getByTestId('create-space-panel').getAttribute('data-active')).toBe('true')

    fireEvent.change(screen.getByRole('textbox', { name: 'Space prompt' }), { target: { value: 'Create KAT-65 shell' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add context' }))
    fireEvent.click(screen.getByRole('button', { name: 'Attach web context' }))
    fireEvent.click(screen.getByRole('button', { name: 'Attach timeline context' }))
    fireEvent.click(screen.getByRole('button', { name: 'Attach metrics context' }))
    fireEvent.click(screen.getByRole('button', { name: 'Attach pinned context' }))

    fireEvent.click(screen.getByRole('button', { name: 'Select single-agent mode' }))
    expect(screen.getByRole('button', { name: 'Select single-agent mode' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Select team mode' }))
    expect(screen.getByRole('button', { name: 'Select team mode' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Toggle rapid fire mode' }))
    expect(screen.getByRole('button', { name: 'Toggle rapid fire mode' }).getAttribute('aria-pressed')).toBe('true')

    // Toggle rapid fire off
    fireEvent.click(screen.getByRole('button', { name: 'Toggle rapid fire mode' }))
    expect(screen.getByRole('button', { name: 'Toggle rapid fire mode' }).getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))
    expect(screen.getByText('Create KAT-65 shell')).toBeTruthy()
    expect(screen.getByTestId('create-space-panel').getAttribute('data-active')).toBe('false')
  })

  it('filters spaces by search and archived toggle, and supports row selection', () => {
    render(<HomeSpacesScreen onOpenSpace={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Show archived spaces' }))
    expect(screen.getByText('Archived migration notes')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Search spaces'), { target: { value: 'Wave 1' } })
    expect(screen.getByText('Unblock Wave 1 verification')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Select space Unblock Wave 1 verification' }))
    expect(screen.getByRole('button', { name: 'Select space Unblock Wave 1 verification' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('supports grouped toggle, no-result state, and creates default space for empty prompt', () => {
    render(<HomeSpacesScreen onOpenSpace={() => {}} />)

    const initialRows = screen.getAllByRole('button', { name: /Select space/ }).length
    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))
    expect(screen.getAllByRole('button', { name: /Select space/ })).toHaveLength(initialRows + 1)
    expect(screen.getByText('Untitled space')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Group spaces by repository' }))
    expect(screen.getByText('All spaces')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Search spaces'), { target: { value: 'no-such-space' } })
    expect(screen.getByText('No spaces match your filters.')).toBeTruthy()
  })

  it('binds repo and branch context strip to selected space state', () => {
    render(<HomeSpacesScreen onOpenSpace={() => {}} />)

    const contextStrip = screen.getByTestId('repo-branch-context')
    expect(contextStrip.textContent).toContain('gannonh/kata-cloud')
    expect(contextStrip.textContent).toContain('main')

    fireEvent.click(screen.getByRole('button', { name: 'Select space Left panel parity follow-ups' }))
    expect(contextStrip.textContent).toContain('gannonh/kata-cloud')
    expect(contextStrip.textContent).toContain('feature/left-panel')

    fireEvent.click(screen.getByRole('button', { name: 'Select space Docs and release sync' }))
    expect(contextStrip.textContent).toContain('gannonh/kata-orchestrator')
    expect(contextStrip.textContent).toContain('main')
  })

  it('opens the currently selected space with the correct space ID', () => {
    const onOpenSpace = vi.fn()
    render(<HomeSpacesScreen onOpenSpace={onOpenSpace} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open selected space' }))
    expect(onOpenSpace).toHaveBeenCalledTimes(1)
    // The initial auto-selection is the first non-archived space in mock data
    expect(onOpenSpace.mock.calls[0]?.[0]).toBe('space-wave-1')
  })

  it('disables Open selected space when no non-archived spaces exist', () => {
    const onOpenSpace = vi.fn()
    render(<HomeSpacesScreen onOpenSpace={onOpenSpace} initialSpaces={[]} />)

    const openButton = screen.getByRole('button', { name: 'Open selected space' })
    expect(openButton).toHaveProperty('disabled', true)

    fireEvent.click(openButton)
    expect(onOpenSpace).not.toHaveBeenCalled()
  })

  it('resets selection to first visible space when search filters out the selected space', () => {
    render(<HomeSpacesScreen onOpenSpace={() => {}} />)

    // Select the 'Docs and release sync' space (kata-orchestrator repo)
    fireEvent.click(screen.getByRole('button', { name: 'Select space Docs and release sync' }))
    expect(screen.getByTestId('repo-branch-context').textContent).toContain('gannonh/kata-orchestrator')

    // Search filters to only kata-cloud spaces, hiding the selected space
    fireEvent.change(screen.getByLabelText('Search spaces'), { target: { value: 'kata-cloud' } })

    // Selection should reset to the first visible match (a kata-cloud space)
    expect(screen.getByTestId('repo-branch-context').textContent).toContain('gannonh/kata-cloud')
    // Open selected space should still be enabled
    expect(screen.getByRole('button', { name: 'Open selected space' })).toHaveProperty('disabled', false)
  })

  it('filters spaces by repository name in search', () => {
    render(<HomeSpacesScreen onOpenSpace={() => {}} />)

    fireEvent.change(screen.getByLabelText('Search spaces'), { target: { value: 'kata-orchestrator' } })

    expect(screen.getByText('Docs and release sync')).toBeTruthy()
    expect(screen.queryByText('Unblock Wave 1 verification')).toBeNull()
    expect(screen.queryByText('Left panel parity follow-ups')).toBeNull()
  })

  it('groups spaces with the same repository regardless of casing', () => {
    const casingMismatch = [
      { id: 'a', name: 'Space A', repoUrl: 'https://github.com/MyOrg/my-repo', rootPath: '/tmp/my-repo', repo: 'MyOrg/my-repo', branch: 'main', orchestrationMode: 'team' as const, createdAt: '2026-01-01T00:00:00.000Z', elapsed: '1h', archived: false, status: 'active' as const },
      { id: 'b', name: 'Space B', repoUrl: 'https://github.com/myorg/my-repo', rootPath: '/tmp/my-repo', repo: 'myorg/my-repo', branch: 'feature/x', orchestrationMode: 'team' as const, createdAt: '2026-01-02T00:00:00.000Z', elapsed: '2h', archived: false, status: 'idle' as const }
    ]
    render(<HomeSpacesScreen onOpenSpace={() => {}} initialSpaces={casingMismatch} />)

    expect(screen.getByText('Space A')).toBeTruthy()
    expect(screen.getByText('Space B')).toBeTruthy()

    // Case-insensitive dedup: both spaces should be in a single group (one <ul>)
    expect(screen.getAllByRole('list')).toHaveLength(1)
  })
})
