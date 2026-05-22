import { describe, expect, it } from 'vitest'
import {
  isLegacyPrescriptoBranding,
  resolveHeaderLogoUrl,
  resolveLogoAltText,
  sanitizeLegacyBrandingInSiteSettings,
} from './siteSettingsBranding'

describe('siteSettingsBranding', () => {
  it('detects legacy Prescripto branding', () => {
    expect(isLegacyPrescriptoBranding('Prescripto Logo')).toBe(true)
    expect(isLegacyPrescriptoBranding('https://cdn.example/prescripto-logo.png')).toBe(true)
    expect(isLegacyPrescriptoBranding('Clinivo')).toBe(false)
  })

  it('strips legacy logo URLs from cached settings', () => {
    const sanitized = sanitizeLegacyBrandingInSiteSettings({
      branding: {
        altText: 'Prescripto',
        headerLogoUrl: 'https://res.cloudinary.com/old/prescripto.png',
      },
    })
    expect(sanitized.branding.altText).toBe('Clinivo')
    expect(sanitized.branding.headerLogoUrl).toBeUndefined()
  })

  it('resolveHeaderLogoUrl returns null for legacy URLs', () => {
    expect(
      resolveHeaderLogoUrl({
        branding: { headerLogoUrl: 'https://cdn/prescripto-logo.png' },
      }),
    ).toBeNull()
    expect(
      resolveHeaderLogoUrl({
        branding: { headerLogoUrl: 'https://cdn/clinivo.png' },
      }),
    ).toBe('https://cdn/clinivo.png')
  })

  it('resolveLogoAltText replaces legacy alt text', () => {
    expect(resolveLogoAltText({ branding: { altText: 'Prescripto' } })).toBe('Clinivo')
    expect(resolveLogoAltText({ branding: { altText: 'Clinivo Clinic' } })).toBe('Clinivo Clinic')
  })
})
