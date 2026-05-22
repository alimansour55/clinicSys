import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import SignupInlineVerify from './SignupInlineVerify'
import { toast } from 'react-toastify'

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

describe('SignupInlineVerify', () => {
  const onVerified = vi.fn()
  const canSend = vi.fn(() => true)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows verified state when already verified', () => {
    render(
      <SignupInlineVerify
        label='Email'
        verified
        onVerified={onVerified}
        canSend={canSend}
        onSendCode={vi.fn()}
        onConfirmCode={vi.fn()}
      />
    )
    expect(screen.getByText('Email verified')).toBeInTheDocument()
  })

  it('sends code and shows OTP entry on success', async () => {
    const onSendCode = vi.fn().mockResolvedValue({ success: true, message: 'Code sent' })
    render(
      <SignupInlineVerify
        label='Phone'
        verified={false}
        onVerified={onVerified}
        canSend={canSend}
        onSendCode={onSendCode}
        onConfirmCode={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /verify now/i }))
    await waitFor(() => expect(onSendCode).toHaveBeenCalled())
    expect(toast.success).toHaveBeenCalledWith('Code sent')
    expect(screen.getByText(/6-digit code/i)).toBeInTheDocument()
  })

  it('confirms code and calls onVerified', async () => {
    const onSendCode = vi.fn().mockResolvedValue({ success: true, message: 'Sent' })
    const onConfirmCode = vi.fn().mockResolvedValue({
      success: true,
      verificationToken: 'tok-1',
      message: 'Verified',
    })
    const { container } = render(
      <SignupInlineVerify
        label='Email'
        verified={false}
        onVerified={onVerified}
        canSend={canSend}
        onSendCode={onSendCode}
        onConfirmCode={onConfirmCode}
      />
    )
    const scope = within(container)
    fireEvent.click(scope.getByRole('button', { name: /verify now/i }))
    await waitFor(() => scope.getByText(/6-digit code/i))

    const inputs = container.querySelectorAll('input[type="text"]')
    '123456'.split('').forEach((digit, i) => {
      fireEvent.input(inputs[i], { target: { value: digit } })
    })
    fireEvent.click(scope.getByRole('button', { name: /^confirm code$/i }))

    await waitFor(() => expect(onConfirmCode).toHaveBeenCalledWith('123456'))
    expect(onVerified).toHaveBeenCalledWith('tok-1', 'Verified')
  })
})
