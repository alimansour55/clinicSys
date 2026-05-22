import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  INSURANCE_STATUS,
  getInsuranceStatus,
  isInsuranceExpired,
  insuranceStatusLabel,
  insuranceStatusTone,
} from './insuranceVerification.js'

describe('insuranceVerification', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns none when insurance disabled', () => {
    expect(getInsuranceStatus({ enabled: false })).toBe(INSURANCE_STATUS.NONE)
  })

  it('defaults unknown status to pending', () => {
    expect(getInsuranceStatus({ enabled: true })).toBe(INSURANCE_STATUS.PENDING)
  })

  it('detects expired cards', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-21'))
    expect(isInsuranceExpired('2020-01-01')).toBe(true)
    expect(isInsuranceExpired('2030-01-01')).toBe(false)
  })

  it('maps status labels and tones', () => {
    expect(insuranceStatusLabel(INSURANCE_STATUS.APPROVED)).toBe('Approved')
    expect(insuranceStatusTone(INSURANCE_STATUS.PENDING)).toContain('amber')
    expect(insuranceStatusLabel(INSURANCE_STATUS.NONE)).toBe('No insurance')
  })
})
