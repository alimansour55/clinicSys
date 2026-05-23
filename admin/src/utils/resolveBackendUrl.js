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

function isHostedDeployHostname(hostname) {
  return /\.vercel\.(app|dev)$/.test(hostname) || hostname.endsWith('.netlify.app')
}

/** Hosts that serve the admin app with /api → backend proxy (see admin/vercel.json). */
function usesSameOriginApiProxy(hostname) {
  if (isHostedDeployHostname(hostname)) return true
  return /(^|\.)clinivo\.shop$/.test(hostname)
}

function envPointsToLocalApi(fromEnv) {
  if (!fromEnv) return true
  try {
    const { hostname, port } = new URL(fromEnv)
    if (isLocalHostname(hostname)) return true
    return port === '4000' && !fromEnv.startsWith('https://')
  } catch {
    return true
  }
}

function productionApiFromEnv(fromEnv) {
  if (fromEnv && !envPointsToLocalApi(fromEnv)) {
    return fromEnv.replace(/\/$/, '')
  }
  return null
}

/** True when the login page should show the phone / firewall hint (LAN dev only). */
export function shouldShowMobileApiHint() {
  if (typeof window === 'undefined') return false
  return isPrivateLanHostname(window.location.hostname)
}

export function resolveBackendUrl() {
  const fromEnv = import.meta.env.VITE_BACKEND_URL?.trim()
  const fallback = 'http://localhost:4000'

  if (import.meta.env.PROD) {
    if (typeof window !== 'undefined' && usesSameOriginApiProxy(window.location.hostname)) {
      return window.location.origin
    }
    const api = productionApiFromEnv(fromEnv)
    if (api) return api
    if (typeof window !== 'undefined') {
      return window.location.origin
    }
    return api || fallback
  }

  if (typeof window === 'undefined') {
    return fromEnv || fallback
  }

  const { hostname, protocol } = window.location

  if (isLocalHostname(hostname)) {
    return fromEnv || fallback
  }

  const api = productionApiFromEnv(fromEnv)
  if (api) return api

  if (usesSameOriginApiProxy(hostname)) {
    return window.location.origin
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
