import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toE164, sendSms } from '../services/smsService.js'

describe('smsService', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('toE164', () => {
    it('converts Egyptian domestic numbers', () => {
      expect(toE164('01012345678')).toBe('+201012345678')
      expect(toE164('201012345678')).toBe('+201012345678')
    })
  })

  describe('sendSms', () => {
    it('logs in dev mode when Twilio not configured', async () => {
      vi.stubEnv('TWILIO_ACCOUNT_SID', '')
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const result = await sendSms({ to: '01012345678', body: 'Test message' })

      expect(result).toEqual({ delivered: false, devMode: true })
      expect(logSpy).toHaveBeenCalled()
      logSpy.mockRestore()
    })

    it('calls Twilio API when configured', async () => {
      vi.stubEnv('TWILIO_ACCOUNT_SID', 'ACtest')
      vi.stubEnv('TWILIO_AUTH_TOKEN', 'token')
      vi.stubEnv('TWILIO_PHONE_NUMBER', '+15550001')

      global.fetch.mockResolvedValue({ ok: true, text: async () => '{}' })

      const result = await sendSms({ to: '01012345678', body: 'Hello' })

      expect(result.delivered).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.twilio.com'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('throws on invalid phone', async () => {
      await expect(sendSms({ to: '', body: 'x' })).rejects.toThrow(/Invalid phone/)
    })
  })
})
