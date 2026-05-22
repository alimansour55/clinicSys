import { describe, it, expect } from 'vitest'
import {
  LANGUAGE_ROLES,
  DEFAULT_ROLE_LANGUAGE_POLICY,
  normalizeLanguageAvailability,
  legacyAvailabilityToPolicy,
  normalizeRoleLanguagePolicy,
  normalizeLanguagePolicies,
  getAllowedLanguagesFromPolicy,
  getAllowedLanguages,
  getPolicyForRole,
  resolveLanguageForPolicy,
} from '../utils/languageAvailability.js'

describe('languageAvailability', () => {
  describe('normalizeLanguageAvailability', () => {
    it.each([
      ['en', 'en'],
      ['EN', 'en'],
      ['english', 'en'],
      ['ar', 'ar'],
      ['Arabic', 'ar'],
      ['both', 'both'],
      ['', 'both'],
      ['unknown', 'both'],
    ])('maps %j to %j', (input, expected) => {
      expect(normalizeLanguageAvailability(input)).toBe(expected)
    })
  })

  describe('legacyAvailabilityToPolicy', () => {
    it('maps legacy modes to role policies', () => {
      expect(legacyAvailabilityToPolicy('en')).toEqual({ en: true, ar: false })
      expect(legacyAvailabilityToPolicy('ar')).toEqual({ en: false, ar: true })
      expect(legacyAvailabilityToPolicy('both')).toEqual({ en: true, ar: true })
    })
  })

  describe('normalizeRoleLanguagePolicy', () => {
    it('delegates string input to legacy mapping', () => {
      expect(normalizeRoleLanguagePolicy('ar')).toEqual({ en: false, ar: true })
    })

    it('reads boolean and string toggles from input', () => {
      expect(normalizeRoleLanguagePolicy({ en: 'true', ar: '0' })).toEqual({
        en: true,
        ar: false,
      })
      expect(normalizeRoleLanguagePolicy({ en: 'on', ar: '1' })).toEqual({
        en: true,
        ar: true,
      })
    })

    it('falls back to provided defaults for missing keys', () => {
      expect(
        normalizeRoleLanguagePolicy({}, { en: false, ar: true })
      ).toEqual({ en: false, ar: true })
    })

    it('forces en on when both languages would be disabled', () => {
      expect(normalizeRoleLanguagePolicy({ en: false, ar: false })).toEqual({
        en: true,
        ar: false,
      })
    })
  })

  describe('normalizeLanguagePolicies', () => {
    it('builds a policy entry for every role', () => {
      const policies = normalizeLanguagePolicies({ doctor: { en: false, ar: true } }, 'both')

      expect(Object.keys(policies).sort()).toEqual([...LANGUAGE_ROLES].sort())
      expect(policies.doctor).toEqual({ en: false, ar: true })
      expect(policies.patient).toEqual(DEFAULT_ROLE_LANGUAGE_POLICY)
    })
  })

  describe('getAllowedLanguagesFromPolicy', () => {
    it('returns enabled language codes', () => {
      expect(getAllowedLanguagesFromPolicy({ en: true, ar: false })).toEqual(['en'])
      expect(getAllowedLanguagesFromPolicy({ en: true, ar: true })).toEqual(['en', 'ar'])
    })

    it('defaults to en when both are disabled after normalization', () => {
      expect(getAllowedLanguagesFromPolicy({ en: false, ar: false })).toEqual(['en'])
    })
  })

  describe('getAllowedLanguages (deprecated)', () => {
    it('delegates to getAllowedLanguagesFromPolicy', () => {
      expect(getAllowedLanguages({ en: false, ar: true })).toEqual(['ar'])
    })
  })

  describe('getPolicyForRole', () => {
    it('returns role-specific policy with legacy fallback', () => {
      const policy = getPolicyForRole({}, 'doctor', 'ar')
      expect(policy).toEqual({ en: false, ar: true })
    })

    it('falls back to patient for unknown roles', () => {
      const policy = getPolicyForRole({ patient: { en: true, ar: false } }, 'unknown', 'both')
      expect(policy).toEqual({ en: true, ar: false })
    })
  })

  describe('resolveLanguageForPolicy', () => {
    it('keeps stored language when allowed', () => {
      expect(resolveLanguageForPolicy('ar', { en: true, ar: true })).toBe('ar')
      expect(resolveLanguageForPolicy('en', { en: true, ar: false })).toBe('en')
    })

    it('falls back to first allowed language', () => {
      expect(resolveLanguageForPolicy('ar', { en: true, ar: false })).toBe('en')
      expect(resolveLanguageForPolicy('en', { en: false, ar: true })).toBe('ar')
    })
  })
})
