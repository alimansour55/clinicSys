import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  normalizeAdminProfile,
  parseAdminProfileUpdate,
  patchAdminProfile,
} from '../services/adminProfileService.js'

vi.mock('../models/siteSettingModel.js', () => ({
  default: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}))

vi.mock('../services/securityPolicyService.js', () => ({
  getSecuritySettings: vi.fn().mockResolvedValue({
    adminMfa: { enabled: false, secret: '' },
  }),
}))

import siteSettingModel from '../models/siteSettingModel.js'

describe('adminProfileService', () => {
  beforeEach(() => {
    vi.mocked(siteSettingModel.findOne).mockReset()
    vi.mocked(siteSettingModel.findOneAndUpdate).mockReset()
  })

  it('normalizes admin profile fields', () => {
    expect(
      normalizeAdminProfile({ name: '  Ali  ', phone: '01012345678', bio: 'x'.repeat(600) })
    ).toMatchObject({
      name: 'Ali',
      phone: '01012345678',
      bio: 'x'.repeat(500),
    })
  })

  it('validates egypt phone on update', () => {
    const bad = parseAdminProfileUpdate({ phone: '19999999999' })
    expect(bad.error).toMatch(/valid Egyptian/i)

    const ok = parseAdminProfileUpdate({ phone: '01012345678' })
    expect(ok.update.phone).toBe('01012345678')
  })

  it('patches profile in site settings', async () => {
    vi.mocked(siteSettingModel.findOne).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ adminProfile: { name: 'Old' } }),
      }),
    })
    vi.mocked(siteSettingModel.findOneAndUpdate).mockResolvedValue({})

    const result = await patchAdminProfile({ name: 'New Name', phone: '' })
    expect(result.name).toBe('New Name')
    expect(siteSettingModel.findOneAndUpdate).toHaveBeenCalled()
  })
})
