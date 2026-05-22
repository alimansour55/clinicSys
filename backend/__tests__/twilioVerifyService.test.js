import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isTwilioVerifyConfigured,
  startPhoneVerification,
  checkPhoneVerification,
} from '../services/twilioVerifyService.js'

describe('twilioVerifyService', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('isTwilioVerifyConfigured', () => {
    it('returns false without env vars', () => {
      vi.stubEnv('TWILIO_ACCOUNT_SID', '')
      expect(isTwilioVerifyConfigured()).toBe(false)
    })

    it('returns true when all verify env vars set', () => {
      vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC')
      vi.stubEnv('TWILIO_AUTH_TOKEN', 'tok')
      vi.stubEnv('TWILIO_VERIFY_SERVICE_SID', 'VA')
      expect(isTwilioVerifyConfigured()).toBe(true)
    })
  })

  describe('startPhoneVerification', () => {
    it('posts to Twilio Verify', async () => {
      vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC')
      vi.stubEnv('TWILIO_AUTH_TOKEN', 'tok')
      vi.stubEnv('TWILIO_VERIFY_SERVICE_SID', 'VA')

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'pending' }),
      })

      const result = await startPhoneVerification('01012345678')
      expect(result.status).toBe('pending')
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/Verifications'),
        expect.any(Object)
      )
    })
  })

  describe('checkPhoneVerification', () => {
    it('returns approved when Twilio approves code', async () => {
      vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC')
      vi.stubEnv('TWILIO_AUTH_TOKEN', 'tok')
      vi.stubEnv('TWILIO_VERIFY_SERVICE_SID', 'VA')

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'approved' }),
      })

      const result = await checkPhoneVerification('01012345678', '123456')
      expect(result.approved).toBe(true)
    })

    it('returns not approved on API error', async () => {
      vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC')
      vi.stubEnv('TWILIO_AUTH_TOKEN', 'tok')
      vi.stubEnv('TWILIO_VERIFY_SERVICE_SID', 'VA')

      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Invalid code' }),
      })

      const result = await checkPhoneVerification('01012345678', '000000')
      expect(result.approved).toBe(false)
    })
  })
})
