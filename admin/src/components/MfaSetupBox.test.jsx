import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import MfaSetupBox from './MfaSetupBox'
import QRCode from 'qrcode'

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn() },
}))

describe('MfaSetupBox', () => {
  beforeEach(() => {
    vi.mocked(QRCode.toDataURL).mockReset()
  })

  it('renders verify mode without setup details', () => {
    render(<MfaSetupBox mode='verify' />)
    expect(screen.getByText('Authenticator verification')).toBeInTheDocument()
    expect(screen.queryByText('Manual setup key')).not.toBeInTheDocument()
  })

  it('renders setup secret and QR after generation', async () => {
    vi.mocked(QRCode.toDataURL).mockResolvedValue('data:image/png;base64,qr')
    render(
      <MfaSetupBox mode='setup' setup={{ secret: 'MYSECRET', otpauthUrl: 'otpauth://totp/Clinic' }} />
    )
    expect(screen.getByText('MYSECRET')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('img', { name: /authenticator setup qr code/i })).toHaveAttribute(
        'src',
        'data:image/png;base64,qr'
      )
    })
  })

  it('shows fallback when QR fails', async () => {
    vi.mocked(QRCode.toDataURL).mockRejectedValue(new Error('fail'))
    render(<MfaSetupBox mode='setup' setup={{ secret: 'KEY', otpauthUrl: 'otpauth://x' }} />)
    await waitFor(() => {
      expect(screen.getByText(/QR code image could not load/i)).toBeInTheDocument()
    })
  })
})
