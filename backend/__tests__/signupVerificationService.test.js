import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import {
  verifySignupProof,
  sendSignupEmailVerification,
  confirmSignupEmailVerification,
} from '../services/signupVerificationService.js'

vi.mock('../models/userModel.js', () => ({
  default: { findOne: vi.fn() },
}))
vi.mock('../models/signupVerificationModel.js', () => ({
  default: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}))
vi.mock('../config/nodemailer.js', () => ({
  default: { sendMail: vi.fn().mockResolvedValue({}) },
}))
vi.mock('../utils/emailUtils.js', () => ({
  normalizeEmail: (e) => String(e || '').trim().toLowerCase(),
  findOneByEmail: vi.fn(),
}))
vi.mock('../services/authThrottleService.js', () => ({
  consumeQuota: vi.fn().mockResolvedValue(true),
  getLockMinutes: vi.fn().mockResolvedValue(0),
  recordFailure: vi.fn().mockResolvedValue({ attemptsLeft: 4, locked: false }),
  clearFailures: vi.fn().mockResolvedValue(),
}))
vi.mock('../services/twilioVerifyService.js', () => ({
  isTwilioVerifyConfigured: vi.fn(() => false),
  startPhoneVerification: vi.fn(),
  checkPhoneVerification: vi.fn(),
}))

import { findOneByEmail } from '../utils/emailUtils.js'
import signupVerificationModel from '../models/signupVerificationModel.js'

describe('signupVerificationService', () => {
  beforeEach(() => {
    vi.mocked(findOneByEmail).mockReset()
    vi.mocked(signupVerificationModel.findOne).mockReset()
    vi.mocked(signupVerificationModel.findOneAndUpdate).mockReset()
  })

  describe('verifySignupProof', () => {
    it('validates email proof token', () => {
      const email = 'newuser@example.com'
      const token = jwt.sign(
        { purpose: 'signup-email', value: email, role: 'signup-proof' },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      )
      expect(verifySignupProof(token, 'signup-email', email)).toBe(true)
      expect(verifySignupProof(token, 'signup-phone', email)).toBe(false)
    })
  })

  describe('sendSignupEmailVerification', () => {
    it('never returns a proof without a code, even for a record already verified', async () => {
      findOneByEmail.mockResolvedValue(null)
      signupVerificationModel.findOne.mockResolvedValue({ verified: true })

      const result = await sendSignupEmailVerification('user@example.com')
      expect(result.verificationToken).toBeUndefined()
      expect(result.otpExpiresInMinutes).toBeGreaterThan(0)
    })

    it('answers a registered email exactly like a new one, and sends no code', async () => {
      findOneByEmail.mockResolvedValue(null)
      signupVerificationModel.findOne.mockResolvedValue(null)
      const fresh = await sendSignupEmailVerification('new@example.com')

      findOneByEmail.mockResolvedValue({ _id: 'existing' })
      signupVerificationModel.findOneAndUpdate.mockClear()
      const known = await sendSignupEmailVerification('taken@example.com')

      expect(known).toEqual(fresh)
      expect(signupVerificationModel.findOneAndUpdate.mock.calls[0][1].otp).toBe('')
    })

    it('enforces resend cooldown', async () => {
      findOneByEmail.mockResolvedValue(null)
      signupVerificationModel.findOne.mockResolvedValue({ verified: false, otpSentAt: Date.now() })

      await expect(sendSignupEmailVerification('user@example.com')).rejects.toMatchObject({
        code: 'RESEND_COOLDOWN',
      })
    })
  })

  describe('confirmSignupEmailVerification', () => {
    it('confirms OTP and returns verification token', async () => {
      signupVerificationModel.findOne.mockResolvedValue({
        otp: '123456',
        otpExpireAt: Date.now() + 60000,
      })
      signupVerificationModel.findOneAndUpdate.mockResolvedValue({})

      const result = await confirmSignupEmailVerification('user@example.com', '123456')
      expect(result.verificationToken).toBeTruthy()
      expect(result.message).toMatch(/verified/i)
    })
  })
})
