import { describe, it, expect } from 'vitest'
import { DEFAULT_GLOBAL_VISIT_FEES, normalizeGlobalVisitFees } from './globalVisitFees.js'

describe('globalVisitFees', () => {
  it('exports defaults', () => {
    expect(DEFAULT_GLOBAL_VISIT_FEES).toEqual({
      enabled: false,
      examinationFee: 0,
      consultationFee: 0,
    })
  })

  it('normalizes and clamps fees', () => {
    expect(
      normalizeGlobalVisitFees({ enabled: true, examinationFee: 150, consultationFee: 80 })
    ).toEqual({ enabled: true, examinationFee: 150, consultationFee: 80 })
    expect(normalizeGlobalVisitFees({ examinationFee: -10 }).examinationFee).toBe(0)
  })

  it('coerces enabled flag', () => {
    expect(normalizeGlobalVisitFees({ enabled: 'true' }).enabled).toBe(true)
    expect(normalizeGlobalVisitFees({ enabled: 0 }).enabled).toBe(false)
  })
})
