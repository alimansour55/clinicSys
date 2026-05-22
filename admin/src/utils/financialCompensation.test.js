import { describe, it, expect } from 'vitest'
import { normalizeFinancialCompensation, describeCompensationAttribution } from './financialCompensation.js'

describe('financialCompensation', () => {
  it('normalizes JSON string and modes', () => {
    const parsed = normalizeFinancialCompensation('{"mode":"hybrid","percentage":20,"fixedSalary":500}')
    expect(parsed.mode).toBe('hybrid')
    expect(parsed.percentage).toBe(20)
    expect(parsed.percentageEnabled).toBe(true)
  })

  it('describes fixed monthly salary', () => {
    const result = describeCompensationAttribution(1000, { mode: 'fixed', fixedSalary: 3000 })
    expect(result.isFixedMonthly).toBe(true)
    expect(result.doctorAttributed).toBe(3000)
  })

  it('describes hybrid compensation', () => {
    const result = describeCompensationAttribution(2000, { mode: 'hybrid', percentage: 10, fixedSalary: 500 })
    expect(result.isHybrid).toBe(true)
    expect(result.revenueSharePart).toBe(200)
    expect(result.fixedMonthlyPart).toBe(500)
    expect(result.doctorAttributed).toBe(700)
  })

  it('returns empty hybrid guidance when unset', () => {
    const result = describeCompensationAttribution(1000, { mode: 'hybrid' })
    expect(result.label).toMatch(/not set/)
  })
})
