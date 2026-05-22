import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import InsuranceVerificationPanel from './InsuranceVerificationPanel'
import { INSURANCE_STATUS } from '../utils/insuranceVerification'

const t = (s) => s

const enabledInsurance = {
  enabled: true,
  verificationStatus: INSURANCE_STATUS.PENDING,
  expiryDate: '2030-12-31',
}

describe('InsuranceVerificationPanel', () => {
  it('renders nothing when insurance is disabled', () => {
    const { container } = render(<InsuranceVerificationPanel insurance={{ enabled: false }} t={t} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders verification header and status', () => {
    render(<InsuranceVerificationPanel insurance={enabledInsurance} t={t} />)
    expect(screen.getByText('Insurance verification')).toBeInTheDocument()
    expect(screen.getByText('Pending review')).toBeInTheDocument()
  })

  it('calls onVerify with approved status', async () => {
    const onVerify = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <InsuranceVerificationPanel insurance={enabledInsurance} onVerify={onVerify} t={t} />
    )
    const scope = within(container)
    fireEvent.click(scope.getByRole('button', { name: /^approve insurance$/i }))
    await waitFor(() =>
      expect(onVerify).toHaveBeenCalledWith({ status: INSURANCE_STATUS.APPROVED, declineReason: '' })
    )
  })

  it('requires decline reason before declining profile insurance', async () => {
    const onVerify = vi.fn()
    const { container } = render(
      <InsuranceVerificationPanel insurance={enabledInsurance} onVerify={onVerify} t={t} />
    )
    const scope = within(container)
    fireEvent.click(scope.getByRole('button', { name: /^decline insurance$/i }))
    expect(onVerify).not.toHaveBeenCalled()
    fireEvent.change(scope.getByPlaceholderText(/decline reason/i), {
      target: { value: 'Invalid card' },
    })
    fireEvent.click(scope.getByRole('button', { name: /^decline insurance$/i }))
    await waitFor(() =>
      expect(onVerify).toHaveBeenCalledWith({
        status: INSURANCE_STATUS.DECLINED,
        declineReason: 'Invalid card',
      })
    )
  })

  it('supports visit-level approve action', async () => {
    const onVerify = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <InsuranceVerificationPanel
        insurance={enabledInsurance}
        onVerify={onVerify}
        showVisitActions
        visitCheck={{ status: 'pending' }}
        t={t}
      />
    )
    fireEvent.click(within(container).getByRole('button', { name: /^approve for this visit$/i }))
    await waitFor(() =>
      expect(onVerify).toHaveBeenCalledWith(
        expect.objectContaining({ visitStatus: 'approved' })
      )
    )
  })
})
