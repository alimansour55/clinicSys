import { sanitizeLegacyBrandingInSiteSettings } from './siteSettingsBranding.js'

const SESSION_KEY = 'clinivo_public_site_settings_v3'
const LOCAL_KEY = 'clinivo_public_site_settings_local_v3'

const LEGACY_CACHE_KEYS = [
  'clinivo_public_site_settings_v1',
  'clinivo_public_site_settings_local_v1',
  'clinivo_public_site_settings_v2',
  'clinivo_public_site_settings_local_v2',
]

function purgeLegacyCacheKeys() {
  if (typeof window === 'undefined') return
  for (const key of LEGACY_CACHE_KEYS) {
    try {
      sessionStorage.removeItem(key)
      localStorage.removeItem(key)
    } catch (_) {}
  }
}

function parseAndSanitize(raw) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return sanitizeLegacyBrandingInSiteSettings(parsed)
  } catch (_) {
    return null
  }
}

export function readCachedPublicSiteSettings() {
  if (typeof window === 'undefined') return null
  purgeLegacyCacheKeys()
  try {
    const fromSession = parseAndSanitize(sessionStorage.getItem(SESSION_KEY))
    if (fromSession) return fromSession
    return parseAndSanitize(localStorage.getItem(LOCAL_KEY))
  } catch (_) {
    return null
  }
}

export function writeCachedPublicSiteSettings(settings) {
  if (typeof window === 'undefined' || !settings || typeof settings !== 'object') return
  const sanitized = sanitizeLegacyBrandingInSiteSettings(settings)
  const serialized = JSON.stringify(sanitized)
  try {
    sessionStorage.setItem(SESSION_KEY, serialized)
  } catch (_) {}
  try {
    localStorage.setItem(LOCAL_KEY, serialized)
  } catch (_) {}
}
