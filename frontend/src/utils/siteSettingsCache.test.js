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

  it('writes and reads from session then local storage', () => {
    const settings = { footer: { copyrightText: 'Test' }, branding: { logoUrl: '/logo.png' } }
    writeCachedPublicSiteSettings(settings)
    expect(readCachedPublicSiteSettings()).toEqual(settings)
    expect(JSON.parse(sessionStorage.getItem('clinivo_public_site_settings_v1'))).toEqual(settings)
  })

  it('falls back to localStorage when session missing', () => {
    const settings = { hero: { title: 'Hello' } }
    localStorage.setItem('clinivo_public_site_settings_local_v1', JSON.stringify(settings))
    expect(readCachedPublicSiteSettings()).toEqual(settings)
  })
})
