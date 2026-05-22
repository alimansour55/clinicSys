import { describe, it, expect, beforeEach } from 'vitest'
import { readCachedPublicSiteSettings, writeCachedPublicSiteSettings } from './siteSettingsCache.js'

describe('siteSettingsCache', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('round-trips settings through session storage', () => {
    const data = { security: { mfaEnabled: false }, footer: { copyrightText: '© Test' } }
    writeCachedPublicSiteSettings(data)
    expect(readCachedPublicSiteSettings()).toEqual(data)
  })

  it('reads from localStorage when session empty', () => {
    localStorage.setItem('clinivo_public_site_settings_local_v1', JSON.stringify({ branding: {} }))
    expect(readCachedPublicSiteSettings()).toEqual({ branding: {} })
  })
})
