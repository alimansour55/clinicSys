import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  INSURANCE_STATUS,
  getInsuranceStatus,
  isInsuranceExpired,
  insuranceStatusLabel,
  insuranceStatusTone,
  visitCheckLabel,
} from './insuranceVerification.js'

describe('insuranceVerification', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('maps insurance status', () => {
    expect(getInsuranceStatus({ enabled: false })).toBe(INSURANCE_STATUS.NONE)
    expect(getInsuranceStatus({ enabled: true, verificationStatus: 'approved' })).toBe(
      INSURANCE_STATUS.APPROVED
    )
  })

  it('detects expiry', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-21'))
    expect(isInsuranceExpired('2020-01-01')).toBe(true)
  })

  it('labels visit check for reception desk', () => {
    expect(visitCheckLabel({ status: 'approved' })).toBe('Verified for visit')
    expect(visitCheckLabel({ status: 'declined' })).toBe('Declined for visit')
    expect(insuranceStatusTone(INSURANCE_STATUS.PENDING)).toContain('amber')
    expect(insuranceStatusLabel(INSURANCE_STATUS.APPROVED)).toBe('Approved')
  })
})
