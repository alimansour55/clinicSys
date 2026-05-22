const SESSION_KEY = 'clinivo_public_site_settings_v3'
const LOCAL_KEY = 'clinivo_public_site_settings_local_v3'

export function readCachedPublicSiteSettings () {
  if (typeof window === 'undefined') return null
  try {
    const sessionRaw = sessionStorage.getItem(SESSION_KEY)
    if (sessionRaw) {
      const parsed = JSON.parse(sessionRaw)
      if (parsed && typeof parsed === 'object') return parsed
    }
    const localRaw = localStorage.getItem(LOCAL_KEY)
    if (localRaw) {
      const parsed = JSON.parse(localRaw)
      if (parsed && typeof parsed === 'object') return parsed
    }
  } catch (_) {}
  return null
}

export function writeCachedPublicSiteSettings (settings) {
  if (typeof window === 'undefined' || !settings || typeof settings !== 'object') return
  const serialized = JSON.stringify(settings)
  try {
    sessionStorage.setItem(SESSION_KEY, serialized)
  } catch (_) {}
  try {
    localStorage.setItem(LOCAL_KEY, serialized)
  } catch (_) {}
}
