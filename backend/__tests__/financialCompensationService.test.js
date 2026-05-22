import { describe, it, expect } from 'vitest'
import {
  normalizeFinancialCompensation,
  describeCompensationAttribution,
  defaultFinancialCompensation,
} from '../services/financialCompensationService.js'

describe('financialCompensationService', () => {
  describe('normalizeFinancialCompensation', () => {
    it('parses JSON string input', () => {
      const result = normalizeFinancialCompensation('{"mode":"hybrid","percentage":20,"fixedSalary":1000}')
      expect(result.mode).toBe('hybrid')
      expect(result.percentage).toBe(20)
      expect(result.fixedSalary).toBe(1000)
      expect(result.percentageEnabled).toBe(true)
    })

    it('defaults invalid mode to percentage', () => {
      expect(normalizeFinancialCompensation({ mode: 'other' }).mode).toBe('percentage')
    })

    it('clamps percentage to 0–100', () => {
      expect(normalizeFinancialCompensation({ percentage: 150 }).percentage).toBe(100)
    })
  })

  describe('describeCompensationAttribution', () => {
    it('describes fixed monthly salary', () => {
      const result = describeCompensationAttribution(5000, { mode: 'fixed', fixedSalary: 3000 })
      expect(result.isFixedMonthly).toBe(true)
      expect(result.doctorAttributed).toBe(3000)
      expect(result.clinicAttributed).toBeNull()
    })

    it('describes percentage of revenue', () => {
      const result = describeCompensationAttribution(1000, { mode: 'percentage', percentage: 25 })
      expect(result.doctorAttributed).toBe(250)
      expect(result.clinicAttributed).toBe(750)
      expect(result.percentageApplied).toBe(25)
    })

    it('combines hybrid percentage and fixed parts', () => {
      const result = describeCompensationAttribution(2000, {
        mode: 'hybrid',
        percentage: 10,
        fixedSalary: 500,
      })
      expect(result.isHybrid).toBe(true)
      expect(result.revenueSharePart).toBe(200)
      expect(result.fixedMonthlyPart).toBe(500)
      expect(result.doctorAttributed).toBe(700)
    })

    it('returns empty hybrid guidance when unset', () => {
      const result = describeCompensationAttribution(1000, { mode: 'hybrid' })
      expect(result.label).toMatch(/not set/)
      expect(result.doctorAttributed).toBe(0)
    })
  })

  it('defaultFinancialCompensation matches percentage mode', () => {
    expect(defaultFinancialCompensation()).toEqual({
      mode: 'percentage',
      percentageEnabled: false,
      percentage: 0,
      fixedSalary: 0,
    })
  })
})
