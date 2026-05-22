import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getAdminMfaStatus,
  startAdminMfaSetup,
  enableAdminMfa,
  disableAdminMfa,
} from '../controllers/adminController.js'

vi.mock('../models/siteSettingModel.js', () => ({
  default: {
    findOneAndUpdate: vi.fn(),
  },
}))

vi.mock('../services/auditService.js', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../services/mfaService.js', () => ({
  generateMfaSecret: vi.fn(() => 'TESTSECRET123'),
  buildMfaSetupPayload: vi.fn(({ secret, accountName }) => ({
    secret,
    otpauthUrl: `otpauth://totp/Clinivo:${accountName}?secret=${secret}`,
  })),
  verifyTotpCode: vi.fn((secret, code) => secret === 'TESTSECRET123' && code === '123456'),
}))

vi.mock('../services/securityPolicyService.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getSecuritySettings: vi.fn(),
    isMfaRequiredForProfile: vi.fn(() => false),
  }
})

import siteSettingModel from '../models/siteSettingModel.js'
import { getSecuritySettings } from '../services/securityPolicyService.js'

const mockRes = () => {
  const res = {}
  res.json = vi.fn((body) => {
    res.body = body
    return res
  })
  return res
}

describe('admin self-service MFA', () => {
  beforeEach(() => {
    vi.mocked(siteSettingModel.findOneAndUpdate).mockReset()
    vi.mocked(getSecuritySettings).mockReset()
    process.env.ADMIN_EMAIL = 'admin@clinic.test'
  })

  it('returns MFA status for logged-in admin', async () => {
    getSecuritySettings.mockResolvedValue({
      adminMfa: { enabled: true, secret: 'abc' },
      mfaEnabled: true,
      mfaRequiredForAdmins: false,
    })
    const req = { user: { email: 'admin@clinic.test', role: 'admin' } }
    const res = mockRes()
    await getAdminMfaStatus(req, res)
    expect(res.body.success).toBe(true)
    expect(res.body.mfa.enabled).toBe(true)
  })

  it('starts MFA setup and stores secret', async () => {
    siteSettingModel.findOneAndUpdate.mockResolvedValue({})
    const req = { user: { email: 'admin@clinic.test', role: 'admin' } }
    const res = mockRes()
    await startAdminMfaSetup(req, res)
    expect(res.body.success).toBe(true)
    expect(res.body.setup.secret).toBe('TESTSECRET123')
    expect(siteSettingModel.findOneAndUpdate).toHaveBeenCalled()
  })

  it('enables MFA when code is valid', async () => {
    getSecuritySettings.mockResolvedValue({
      adminMfa: { enabled: false, secret: 'TESTSECRET123' },
    })
    siteSettingModel.findOneAndUpdate.mockResolvedValue({})
    const req = { user: { email: 'admin@clinic.test', role: 'admin' }, body: { code: '123456' } }
    const res = mockRes()
    await enableAdminMfa(req, res)
    expect(res.body.success).toBe(true)
  })

  it('rejects disable when MFA is required by policy', async () => {
    const { isMfaRequiredForProfile } = await import('../services/securityPolicyService.js')
    vi.mocked(isMfaRequiredForProfile).mockReturnValue(true)
    getSecuritySettings.mockResolvedValue({
      adminMfa: { enabled: true, secret: 'TESTSECRET123' },
    })
    const req = { user: { email: 'admin@clinic.test', role: 'admin' }, body: { code: '123456' } }
    const res = mockRes()
    await disableAdminMfa(req, res)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toMatch(/required/i)
  })
})
