import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import InsuranceStatusBadge from './InsuranceStatusBadge'
import { INSURANCE_STATUS } from '../utils/insuranceVerification'

describe('InsuranceStatusBadge', () => {
  it('renders nothing when insurance is disabled', () => {
    const { container } = render(<InsuranceStatusBadge insurance={{ enabled: false }} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows pending status label', () => {
    render(
      <InsuranceStatusBadge
        insurance={{ enabled: true, verificationStatus: INSURANCE_STATUS.PENDING }}
        t={(s) => s}
      />
    )
    expect(screen.getByText('Pending review')).toBeInTheDocument()
  })

  it('shows approved status label', () => {
    render(
      <InsuranceStatusBadge
        insurance={{ enabled: true, verificationStatus: INSURANCE_STATUS.APPROVED }}
        t={(s) => s}
      />
    )
    expect(screen.getByText('Approved')).toBeInTheDocument()
  })
})
