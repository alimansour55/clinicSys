import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getMicrosoftOAuthConfig,
  isMicrosoftOAuthConfigured,
  requestDeviceCode,
  pollDeviceCodeToken,
  refreshMicrosoftAccessToken,
} from '../services/microsoftOAuthService.js'

describe('microsoftOAuthService', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('getMicrosoftOAuthConfig / isMicrosoftOAuthConfigured', () => {
    it('reports configured when client id, refresh token, and sender exist', () => {
      vi.stubEnv('MICROSOFT_CLIENT_ID', 'client-id')
      vi.stubEnv('MICROSOFT_REFRESH_TOKEN', 'refresh')
      vi.stubEnv('SENDER_EMAIL', 'mail@test.com')

      expect(isMicrosoftOAuthConfigured()).toBe(true)
      expect(getMicrosoftOAuthConfig().clientId).toBe('client-id')
    })
  })

  describe('requestDeviceCode', () => {
    it('requests device code from Microsoft', async () => {
      vi.stubEnv('MICROSOFT_CLIENT_ID', 'client-id')
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ device_code: 'dc', user_code: 'ABCD', verification_uri: 'https://microsoft.com/devicelogin' }),
      })

      const data = await requestDeviceCode()
      expect(data.device_code).toBe('dc')
    })

    it('throws when client id missing', async () => {
      vi.stubEnv('MICROSOFT_CLIENT_ID', '')
      await expect(requestDeviceCode()).rejects.toThrow(/CLIENT_ID/)
    })
  })

  describe('pollDeviceCodeToken', () => {
    it('returns pending for authorization_pending', async () => {
      vi.stubEnv('MICROSOFT_CLIENT_ID', 'client-id')
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'authorization_pending' }),
      })

      const result = await pollDeviceCodeToken('device-code')
      expect(result.pending).toBe(true)
    })

    it('returns tokens on success', async () => {
      vi.stubEnv('MICROSOFT_CLIENT_ID', 'client-id')
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'at', refresh_token: 'rt' }),
      })

      const result = await pollDeviceCodeToken('device-code')
      expect(result.pending).toBe(false)
      expect(result.access_token).toBe('at')
    })
  })

  describe('refreshMicrosoftAccessToken', () => {
    it('refreshes access token', async () => {
      vi.stubEnv('MICROSOFT_CLIENT_ID', 'client-id')
      vi.stubEnv('MICROSOFT_REFRESH_TOKEN', 'refresh-token')
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'new-access' }),
      })

      const token = await refreshMicrosoftAccessToken()
      expect(token).toBe('new-access')
    })
  })
})
