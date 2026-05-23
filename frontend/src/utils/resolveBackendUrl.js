/**
 * API base URL for Vite apps.
 * - Production build: VITE_BACKEND_URL or same-origin (Vercel /api proxy). Never :4000.
 * - Dev LAN (192.168.x.x): same host, port 4000.
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

/** Hosts that serve the patient app with /api → backend proxy (see frontend/vercel.json). */
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

export function resolveBackendUrl() {
  const fromEnv = import.meta.env.VITE_BACKEND_URL?.trim()
  const fallback = 'http://localhost:4000'

  if (import.meta.env.PROD) {
    // Vercel/Netlify: use same-origin /api proxy (vercel.json) — avoids CORS.
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
