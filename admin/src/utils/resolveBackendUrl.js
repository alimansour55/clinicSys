/**
 * API base URL for Vite apps.
 * - Production (Vercel, custom domain): use VITE_BACKEND_URL from the build.
 * - LAN mobile dev (http://192.168.x.x:5174): same host, API port 4000.
 */
function isLocalHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

function isPrivateLanHostname(hostname) {
  return (
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  )
}

function envPointsToLocalApi(fromEnv) {
  if (!fromEnv) return true
  try {
    return isLocalHostname(new URL(fromEnv).hostname)
  } catch {
    return true
  }
}

/** True when the login page should show the phone / firewall hint (LAN dev only). */
export function shouldShowMobileApiHint() {
  if (typeof window === 'undefined') return false
  return isPrivateLanHostname(window.location.hostname)
}

export function resolveBackendUrl() {
  const fromEnv = import.meta.env.VITE_BACKEND_URL?.trim()
  const fallback = 'http://localhost:4000'

  if (typeof window === 'undefined') {
    return fromEnv || fallback
  }

  const { hostname, protocol } = window.location

  if (isLocalHostname(hostname)) {
    return fromEnv || fallback
  }

  if (fromEnv && !envPointsToLocalApi(fromEnv)) {
    return fromEnv
  }

  if (isPrivateLanHostname(hostname)) {
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

  return fromEnv || fallback
}
