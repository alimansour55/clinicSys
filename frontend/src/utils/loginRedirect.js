/*
 * Sending a patient to log in and back again. `next` only ever holds a path on this site, so a
 * crafted link cannot use the login page to send someone elsewhere (no open redirect).
 */

const BASE = 'https://clinivo.invalid'
/* Pages that make no sense to return to after logging in. */
const NO_RETURN = /^\/(login|account-verify|email-verify|otp-verify|reset-password)(\/|$)/

/** A same-site relative path from `?next=`, or null when it is missing or unsafe. */
export const safeNextPath = (raw) => {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  // Must be a plain absolute path: not "//host", not "/\host", no scheme, no control characters.
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  if ([...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return null
  let url
  try {
    url = new URL(value, BASE)
  } catch {
    return null
  }
  if (url.origin !== BASE) return null
  if (NO_RETURN.test(url.pathname)) return null
  return `${url.pathname}${url.search}${url.hash}`
}

/** `/login?mode=login&next=...` for the given return path (a location or a string). */
export const loginPath = (next, mode = 'login') => {
  const target = typeof next === 'string' ? next : next ? `${next.pathname || ''}${next.search || ''}${next.hash || ''}` : ''
  const safe = safeNextPath(target)
  const params = new URLSearchParams({ mode })
  if (safe && safe !== '/') params.set('next', safe)
  return `/login?${params.toString()}`
}
