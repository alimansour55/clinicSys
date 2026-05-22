/**
 * API base URL for Vite apps.
 * When you open the app as http://192.168.x.x:5174 on a phone, env localhost:4000
 * would point at the phone — use the same host with the API port instead.
 */
export function resolveBackendUrl() {
  const fromEnv = import.meta.env.VITE_BACKEND_URL?.trim()
  const fallback = 'http://localhost:4000'

  if (typeof window === 'undefined') {
    return fromEnv || fallback
  }

  const { hostname, protocol } = window.location
  const isLocalHost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]'

  if (isLocalHost) {
    return fromEnv || fallback
  }

  let port = '4000'
  if (fromEnv) {
    try {
      port = new URL(fromEnv).port || '4000'
    } catch {
      /* keep default */
    }
  }

  return `${protocol}//${hostname}:${port}`
}
