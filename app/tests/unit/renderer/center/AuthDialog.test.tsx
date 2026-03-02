import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthDialog } from '../../../../src/renderer/components/center/AuthDialog'

const mockAuthLogin = vi.fn().mockResolvedValue(true)
const mockAuthLogout = vi.fn().mockResolvedValue(true)

beforeEach(() => {
  ;(window as any).kata = {
    authLogin: mockAuthLogin,
    authLogout: mockAuthLogout
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  delete (window as any).kata
})

describe('AuthDialog', () => {
  it('renders with Anthropic and OpenAI login options', () => {
    render(
      <AuthDialog
        open={true}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText(/anthropic/i)).toBeDefined()
    expect(screen.getByText(/openai/i)).toBeDefined()
  })

  it('clicking Anthropic triggers authLogin', () => {
    render(
      <AuthDialog
        open={true}
        onClose={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText(/anthropic/i))

    expect(mockAuthLogin).toHaveBeenCalledWith('anthropic')
  })

  it('clicking OpenAI triggers authLogin', () => {
    render(
      <AuthDialog
        open={true}
        onClose={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText(/openai/i))

    expect(mockAuthLogin).toHaveBeenCalledWith('openai')
  })

  it('cancel button closes dialog without action', () => {
    const onClose = vi.fn()

    render(
      <AuthDialog
        open={true}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByText(/cancel/i))

    expect(onClose).toHaveBeenCalled()
    expect(mockAuthLogin).not.toHaveBeenCalled()
  })

  it('handles authLogin rejection without crashing', async () => {
    mockAuthLogin.mockRejectedValueOnce(new Error('auth failed'))

    render(
      <AuthDialog
        open={true}
        onClose={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText(/anthropic/i))

    await waitFor(() => {
      expect(mockAuthLogin).toHaveBeenCalledWith('anthropic')
    })
  })

  it('does not render when open is false', () => {
    const { container } = render(
      <AuthDialog
        open={false}
        onClose={vi.fn()}
      />
    )

    expect(container.innerHTML).toBe('')
  })
})
