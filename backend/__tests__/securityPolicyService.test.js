import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  normalizeSecuritySettings,
  isMfaRequiredForProfile,
  validatePasswordAgainstPolicy,
  DEFAULT_SECURITY_SETTINGS,
} from '../services/securityPolicyService.js'

vi.mock('../models/siteSettingModel.js', () => ({
  default: { findOne: vi.fn() },
}))
vi.mock('../models/auditLogModel.js', () => ({
  default: { deleteMany: vi.fn() },
}))

import siteSettingModel from '../models/siteSettingModel.js'

describe('securityPolicyService', () => {
  describe('normalizeSecuritySettings', () => {
    it('clamps password length and login attempts', () => {
      const policy = normalizeSecuritySettings({
        passwordMinLength: 3,
        maxLoginAttempts: 99,
        lockoutMinutes: 0,
      })
      expect(policy.passwordMinLength).toBe(6)
      expect(policy.maxLoginAttempts).toBe(20)
      expect(policy.lockoutMinutes).toBe(1)
    })

    it('parses string booleans', () => {
      const policy = normalizeSecuritySettings({ mfaEnabled: 'true', enforceStrongPasswords: '0' })
      expect(policy.mfaEnabled).toBe(true)
      expect(policy.enforceStrongPasswords).toBe(false)
    })
  })

  describe('isMfaRequiredForProfile', () => {
    const security = normalizeSecuritySettings({
      mfaEnabled: true,
      mfaRequiredForDoctors: true,
    })

    it('requires MFA globally when flag set', () => {
      const global = normalizeSecuritySettings({ mfaRequiredGlobally: true })
      expect(isMfaRequiredForProfile(global, 'patient', {})).toBe(true)
    })

    it('requires MFA per role or admin override on profile', () => {
      expect(isMfaRequiredForProfile(security, 'doctor', {})).toBe(true)
      expect(isMfaRequiredForProfile(security, 'patient', {})).toBe(false)
      expect(isMfaRequiredForProfile(security, 'patient', { mfa: { requiredByAdmin: true } })).toBe(true)
    })
  })

  describe('validatePasswordAgainstPolicy', () => {
    beforeEach(() => {
      siteSettingModel.findOne.mockReturnValue({
        select: vi.fn().mockResolvedValue({ security: DEFAULT_SECURITY_SETTINGS }),
      })
    })

    it('rejects short passwords', async () => {
      const result = await validatePasswordAgainstPolicy('Ab1!')
      expect(result.valid).toBe(false)
      expect(result.message).toMatch(/at least/)
    })

    it('rejects common passwords when enabled', async () => {
      siteSettingModel.findOne.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          security: {
            ...DEFAULT_SECURITY_SETTINGS,
            enforceStrongPasswords: true,
            requireUppercase: false,
            requireLowercase: false,
            requireNumber: false,
            requireSpecialCharacter: false,
            preventCommonPasswords: true,
          },
        }),
      })
      const result = await validatePasswordAgainstPolicy('password')
      expect(result.valid).toBe(false)
      expect(result.message).toMatch(/common/)
    })

    it('accepts strong password', async () => {
      const result = await validatePasswordAgainstPolicy('ClinicSys9!')
      expect(result.valid).toBe(true)
    })

    it('skips complexity when enforceStrongPasswords is off', async () => {
      siteSettingModel.findOne.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          security: { ...DEFAULT_SECURITY_SETTINGS, enforceStrongPasswords: false, passwordMinLength: 6 },
        }),
      })
      const result = await validatePasswordAgainstPolicy('simple6')
      expect(result.valid).toBe(true)
    })
  })
})
