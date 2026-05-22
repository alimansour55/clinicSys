import { describe, it, expect, beforeEach } from 'vitest'
import { readCachedPublicSiteSettings, writeCachedPublicSiteSettings } from './siteSettingsCache.js'

describe('siteSettingsCache', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('returns null when cache empty', () => {
    expect(readCachedPublicSiteSettings()).toBeNull()
  })

  it('writes and reads sanitized settings', () => {
    const settings = {
      footer: { copyrightText: 'Test' },
      branding: { headerLogoUrl: 'https://cdn/prescripto-old.png', altText: 'Prescripto' },
    }
    writeCachedPublicSiteSettings(settings)
    const read = readCachedPublicSiteSettings()
    expect(read.branding.headerLogoUrl).toBeUndefined()
    expect(read.branding.altText).toBe('Clinivo')
  })

  it('falls back to localStorage when session missing', () => {
    const settings = { hero: { title: 'Hello' } }
    localStorage.setItem('clinivo_public_site_settings_local_v3', JSON.stringify(settings))
    expect(readCachedPublicSiteSettings()).toEqual(settings)
  })

  it('purges legacy v1/v2 cache keys on read', () => {
    localStorage.setItem('clinivo_public_site_settings_v2', JSON.stringify({ branding: { altText: 'Prescripto' } }))
    readCachedPublicSiteSettings()
    expect(localStorage.getItem('clinivo_public_site_settings_v2')).toBeNull()
  })
})
