import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getResolvedInsuranceProviders,
  assertValidInsuranceProvider,
  DEFAULT_INSURANCE_PROVIDERS,
} from '../services/insuranceProvidersService.js'

vi.mock('../models/siteSettingModel.js', () => ({
  default: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}))

import siteSettingModel from '../models/siteSettingModel.js'

describe('insuranceProvidersService', () => {
  beforeEach(() => {
    vi.mocked(siteSettingModel.findOne).mockReset()
    vi.mocked(siteSettingModel.create).mockReset()
  })

  it('returns custom list when configured', async () => {
    siteSettingModel.findOne.mockResolvedValue({
      insuranceProviders: ['Custom Insurer', 'Custom Insurer', ''],
    })

    const list = await getResolvedInsuranceProviders()
    expect(list).toEqual(['Custom Insurer'])
  })

  it('falls back to defaults when list empty', async () => {
    siteSettingModel.findOne.mockResolvedValue({ insuranceProviders: [] })

    const list = await getResolvedInsuranceProviders()
    expect(list).toEqual(DEFAULT_INSURANCE_PROVIDERS)
  })

  it('creates settings doc when missing', async () => {
    siteSettingModel.findOne.mockResolvedValue(null)
    siteSettingModel.create.mockResolvedValue({ insuranceProviders: [] })

    await getResolvedInsuranceProviders()
    expect(siteSettingModel.create).toHaveBeenCalled()
  })

  describe('assertValidInsuranceProvider', () => {
    it('throws for empty or unknown provider', async () => {
      siteSettingModel.findOne.mockResolvedValue({ insuranceProviders: ['AXA Egypt'] })
      await expect(assertValidInsuranceProvider('')).rejects.toThrow(/select/)
      await expect(assertValidInsuranceProvider('Unknown Co')).rejects.toThrow(/Invalid/)
    })

    it('returns trimmed valid provider name', async () => {
      siteSettingModel.findOne.mockResolvedValue({ insuranceProviders: ['AXA Egypt'] })
      await expect(assertValidInsuranceProvider('  AXA Egypt  ')).resolves.toBe('AXA Egypt')
    })
  })
})
