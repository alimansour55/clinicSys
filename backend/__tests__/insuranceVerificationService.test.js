import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  INSURANCE_VERIFICATION,
  isInsuranceExpired,
  getEffectiveVerificationStatus,
  attachInsuranceVerification,
  applyVerificationDecision,
  buildInsuranceVisitCheck,
  sanitizeInsuranceForClient,
} from '../services/insuranceVerificationService.js'

describe('insuranceVerificationService', () => {
  describe('isInsuranceExpired', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-21T12:00:00Z'))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('detects past expiry dates', () => {
      expect(isInsuranceExpired('2020-01-01')).toBe(true)
      expect(isInsuranceExpired('2030-12-31')).toBe(false)
      expect(isInsuranceExpired('')).toBe(false)
    })
  })

  describe('getEffectiveVerificationStatus', () => {
    it('returns none when insurance disabled', () => {
      expect(getEffectiveVerificationStatus({ enabled: false })).toBe(INSURANCE_VERIFICATION.NONE)
    })

    it('defaults unknown status to pending', () => {
      expect(getEffectiveVerificationStatus({ enabled: true })).toBe(INSURANCE_VERIFICATION.PENDING)
    })
  })

  describe('attachInsuranceVerification', () => {
    const base = {
      enabled: true,
      provider: 'AXA',
      fullName: 'Patient',
      birthDate: '1990-01-01',
      idNumber: '123',
      expiryDate: '2030-01-01',
    }

    it('resets to pending when patient updates data', () => {
      const result = attachInsuranceVerification(
        { ...base, fullName: 'New Name' },
        { updatedBy: 'patient', existingInsurance: base }
      )
      expect(result.verificationStatus).toBe(INSURANCE_VERIFICATION.PENDING)
    })

    it('auto-approves when receptionist enables insurance without data changes', () => {
      const existing = { ...base, enabled: false }
      const result = attachInsuranceVerification(base, { updatedBy: 'receptionist', existingInsurance: existing })
      expect(result.verificationStatus).toBe(INSURANCE_VERIFICATION.APPROVED)
      expect(result.verifiedBy).toBe('receptionist')
    })
  })

  describe('applyVerificationDecision', () => {
    const insurance = {
      enabled: true,
      expiryDate: '2030-06-01',
      provider: 'AXA',
      fullName: 'P',
      birthDate: '1990-01-01',
      idNumber: '1',
    }

    it('approves valid insurance', () => {
      const result = applyVerificationDecision(insurance, { status: 'approved', verifiedBy: 'admin1' })
      expect(result.verificationStatus).toBe(INSURANCE_VERIFICATION.APPROVED)
    })

    it('requires decline reason', () => {
      expect(() => applyVerificationDecision(insurance, { status: 'declined' })).toThrow(/reason/)
    })

    it('rejects approval when expired', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-21'))
      expect(() =>
        applyVerificationDecision({ ...insurance, expiryDate: '2020-01-01' }, { status: 'approved' })
      ).toThrow(/expired/)
      vi.useRealTimers()
    })
  })

  describe('buildInsuranceVisitCheck', () => {
    it('builds visit check record', () => {
      const check = buildInsuranceVisitCheck({ status: 'approved', checkedBy: 'rec1', note: ' OK ' })
      expect(check.status).toBe('approved')
      expect(check.checkedBy).toBe('rec1')
      expect(check.note).toBe('OK')
    })
  })

  describe('sanitizeInsuranceForClient', () => {
    it('includes expired flag', () => {
      const out = sanitizeInsuranceForClient({
        enabled: true,
        expiryDate: '2020-01-01',
        verificationStatus: 'approved',
      })
      expect(out.enabled).toBe(true)
      expect(out.expired).toBe(true)
    })
  })
})
