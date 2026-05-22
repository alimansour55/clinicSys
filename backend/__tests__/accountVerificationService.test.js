import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import {
  generateOtp,
  getOtpExpiryMs,
  isAccountVerified,
  maskEmail,
  maskPhone,
  signVerificationToken,
  buildVerificationStatus,
  markStaffCreatedAccountVerified,
} from '../services/accountVerificationService.js'

vi.mock('../models/userModel.js', () => ({
  default: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}))
vi.mock('../config/nodemailer.js', () => ({
  default: { sendMail: vi.fn().mockResolvedValue({}) },
}))
vi.mock('../services/smsService.js', () => ({
  sendSms: vi.fn().mockResolvedValue({ devMode: true }),
}))
vi.mock('../services/twilioVerifyService.js', () => ({
  isTwilioVerifyConfigured: vi.fn(() => false),
  startPhoneVerification: vi.fn(),
}))

describe('accountVerificationService', () => {
  describe('generateOtp / getOtpExpiryMs', () => {
    it('generates 6-digit OTP', () => {
      const otp = generateOtp()
      expect(otp).toMatch(/^\d{6}$/)
    })

    it('defaults expiry to 10 minutes', () => {
      expect(getOtpExpiryMs()).toBe(10 * 60 * 1000)
    })
  })

  describe('isAccountVerified', () => {
    it('treats legacy users without flags as verified', () => {
      expect(isAccountVerified({ email: 'a@b.com' })).toBe(true)
    })

    it('requires explicit verification when flags exist', () => {
      expect(isAccountVerified({ emailVerified: false, phoneVerified: false })).toBe(false)
      expect(isAccountVerified({ accountVerifiedAt: Date.now() })).toBe(true)
    })
  })

  describe('maskEmail / maskPhone', () => {
    it('masks sensitive contact info', () => {
      expect(maskEmail('alice@example.com')).toBe('al***@example.com')
      expect(maskPhone('01012345678')).toContain('****')
    })
  })

  describe('signVerificationToken', () => {
    it('encodes patient account-verify purpose', () => {
      const token = signVerificationToken('user-id-1')
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      expect(decoded.purpose).toBe('account-verify')
      expect(decoded.id).toBe('user-id-1')
    })
  })

  describe('buildVerificationStatus', () => {
    it('returns masked status payload', () => {
      const status = buildVerificationStatus({
        email: 'user@example.com',
        phone: '01012345678',
        emailVerified: true,
        phoneVerified: false,
      })
      expect(status.emailVerified).toBe(true)
      expect(status.accountVerified).toBe(true)
      expect(status.email).toContain('@')
    })
  })

  describe('markStaffCreatedAccountVerified', () => {
    it('marks both channels verified', () => {
      const fields = markStaffCreatedAccountVerified()
      expect(fields.emailVerified).toBe(true)
      expect(fields.phoneVerified).toBe(true)
      expect(fields.accountVerifiedAt).toBeGreaterThan(0)
    })
  })
})
