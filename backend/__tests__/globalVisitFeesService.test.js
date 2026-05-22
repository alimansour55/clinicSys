import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  normalizeVisitFeeType,
  normalizeGlobalVisitFees,
  resolveVisitFeeAmount,
  hasDoctorCustomVisitFees,
  getGlobalVisitFeesSettings,
  DEFAULT_GLOBAL_VISIT_FEES,
} from '../services/globalVisitFeesService.js'

vi.mock('../models/siteSettingModel.js', () => ({
  default: {
    findOne: vi.fn(),
  },
}))

import siteSettingModel from '../models/siteSettingModel.js'

describe('globalVisitFeesService', () => {
  describe('normalizeVisitFeeType', () => {
    it.each([
      ['examination', 'examination'],
      ['consultation', 'consultation'],
      ['istishara', 'consultation'],
      ['استشارة', 'consultation'],
      ['', 'examination'],
    ])('maps %j → %j', (input, expected) => {
      expect(normalizeVisitFeeType(input)).toBe(expected)
    })
  })

  describe('normalizeGlobalVisitFees', () => {
    it('clamps negative fees to zero', () => {
      expect(normalizeGlobalVisitFees({ enabled: true, examinationFee: -5, consultationFee: 80 })).toEqual({
        enabled: true,
        examinationFee: 0,
        consultationFee: 80,
      })
    })
  })

  describe('resolveVisitFeeAmount', () => {
    const doctor = { fees: 400 }

    it('uses doctor examination fee when global disabled', () => {
      expect(resolveVisitFeeAmount(doctor, 'examination', DEFAULT_GLOBAL_VISIT_FEES)).toBe(400)
    })

    it('derives consultation as 75% of examination when global disabled', () => {
      expect(resolveVisitFeeAmount(doctor, 'consultation', DEFAULT_GLOBAL_VISIT_FEES)).toBe(300)
    })

    it('uses global fees when enabled and doctor has no custom fees', () => {
      const global = { enabled: true, examinationFee: 100, consultationFee: 75 }
      expect(resolveVisitFeeAmount({ fees: '' }, 'examination', global)).toBe(100)
      expect(resolveVisitFeeAmount({ fees: '' }, 'consultation', global)).toBe(75)
    })

    it('doctor custom fees override global when set', () => {
      const global = { enabled: true, examinationFee: 100, consultationFee: 75 }
      expect(resolveVisitFeeAmount(doctor, 'examination', global)).toBe(400)
      expect(resolveVisitFeeAmount(doctor, 'consultation', global)).toBe(300)
      expect(hasDoctorCustomVisitFees(doctor)).toBe(true)
      expect(hasDoctorCustomVisitFees({ fees: '' })).toBe(false)
    })
  })

  describe('getGlobalVisitFeesSettings', () => {
    beforeEach(() => {
      vi.mocked(siteSettingModel.findOne).mockReset()
    })

    it('loads and normalizes from site settings', async () => {
      siteSettingModel.findOne.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({ globalVisitFees: { enabled: true, examinationFee: 50, consultationFee: 40 } }),
        }),
      })
      const settings = await getGlobalVisitFeesSettings()
      expect(settings).toEqual({ enabled: true, examinationFee: 50, consultationFee: 40 })
    })
  })
})
