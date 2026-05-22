import { describe, it, expect } from 'vitest'
import {
  patientHeaderLogoClassName,
  patientDrawerLogoClassName,
  patientFooterLogoClassName,
  staffHeaderLogoClassName,
  staffLoginLogoClassName,
} from './brandingLogo.js'

describe('brandingLogo', () => {
  it('exports non-empty Tailwind class strings for each surface', () => {
    for (const cls of [
      patientHeaderLogoClassName,
      patientDrawerLogoClassName,
      patientFooterLogoClassName,
      staffHeaderLogoClassName,
      staffLoginLogoClassName,
    ]) {
      expect(typeof cls).toBe('string')
      expect(cls.length).toBeGreaterThan(10)
      expect(cls).toContain('object-contain')
    }
  })
})
