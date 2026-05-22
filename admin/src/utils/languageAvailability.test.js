import { describe, it, expect } from 'vitest'
import {
  normalizeLanguagePolicies,
  getStaffLoginLanguagePolicy,
  getPolicyForRole,
  resolveLanguageForPolicy,
} from './languageAvailability.js'

describe('languageAvailability', () => {
  it('builds per-role policies from legacy mode', () => {
    const policies = normalizeLanguagePolicies({}, 'ar')
    expect(policies.patient).toEqual({ en: false, ar: true })
    expect(policies.admin.en).toBe(false)
  })

  it('getStaffLoginLanguagePolicy unions role flags', () => {
    const policy = getStaffLoginLanguagePolicy(
      { patient: { en: true, ar: false }, doctor: { en: true, ar: true } },
      'both'
    )
    expect(policy).toEqual({ en: true, ar: true })
  })

  it('resolveLanguageForPolicy falls back when disabled', () => {
    expect(resolveLanguageForPolicy('ar', { en: true, ar: false })).toBe('en')
    expect(getPolicyForRole({}, 'doctor', 'en').en).toBe(true)
  })
})
