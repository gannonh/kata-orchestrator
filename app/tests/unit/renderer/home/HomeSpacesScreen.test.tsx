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
    fireEvent.click(screen.getByRole('button', { name: '+ Add context' }))
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

  it('supports grouped toggle, no-result state, and ignores empty create submissions', () => {
    render(<HomeSpacesScreen onOpenSpace={() => {}} />)

    const initialRows = screen.getAllByRole('button', { name: /Select space/ }).length
    fireEvent.click(screen.getByRole('button', { name: 'Create space' }))
    expect(screen.getAllByRole('button', { name: /Select space/ })).toHaveLength(initialRows)

    fireEvent.click(screen.getByRole('button', { name: 'Group spaces by repository' }))
    expect(screen.getByText('All spaces')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Search spaces'), { target: { value: 'no-such-space' } })
    expect(screen.getByText('No spaces match your filters.')).toBeTruthy()
  })

  it('opens the currently selected space', () => {
    const onOpenSpace = vi.fn()
    render(<HomeSpacesScreen onOpenSpace={onOpenSpace} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open selected space' }))
    expect(onOpenSpace).toHaveBeenCalledTimes(1)
    expect(onOpenSpace.mock.calls[0]?.[0]).toBeTypeOf('string')
  })
})
