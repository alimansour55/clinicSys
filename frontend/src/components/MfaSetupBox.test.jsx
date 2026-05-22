import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import MfaSetupBox from './MfaSetupBox'
import { renderWithLanguage } from '../test/renderWithLanguage'
import QRCode from 'qrcode'

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn() },
}))

describe('MfaSetupBox', () => {
  beforeEach(() => {
    vi.mocked(QRCode.toDataURL).mockReset()
  })

  it('renders verify mode instructions', () => {
    renderWithLanguage(<MfaSetupBox mode='verify' />)
    expect(screen.getByText('Authenticator verification')).toBeInTheDocument()
    expect(screen.queryByText('Manual setup key')).not.toBeInTheDocument()
  })

  it('renders setup mode with secret and QR image', async () => {
    vi.mocked(QRCode.toDataURL).mockResolvedValue('data:image/png;base64,qr')
    renderWithLanguage(
      <MfaSetupBox
        mode='setup'
        setup={{ secret: 'SECRETKEY', otpauthUrl: 'otpauth://totp/Test' }}
      />
    )
    expect(screen.getByText('Scan the QR code')).toBeInTheDocument()
    expect(screen.getByText('SECRETKEY')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('img', { name: /authenticator setup qr code/i })).toHaveAttribute(
        'src',
        'data:image/png;base64,qr'
      )
    })
  })

  it('shows manual key fallback when QR generation fails', async () => {
    vi.mocked(QRCode.toDataURL).mockRejectedValue(new Error('fail'))
    renderWithLanguage(
      <MfaSetupBox mode='setup' setup={{ secret: 'ABC', otpauthUrl: 'otpauth://x' }} />
    )
    await waitFor(() => {
      expect(screen.getByText(/QR code could not load/i)).toBeInTheDocument()
    })
    expect(screen.getByText('ABC')).toBeInTheDocument()
  })
})
