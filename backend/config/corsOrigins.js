/**
 * Production frontends allowed to call the API cross-origin.
 * Merged with CORS_ORIGINS from env (comma-separated, no trailing slashes).
 * Add your staff/admin Vercel URL to CORS_ORIGINS on Vercel when you deploy admin.
 */
export const PRODUCTION_CORS_ORIGINS = [
  'https://clinic-sys-m878.vercel.app',
  'https://admin-zeta-one-45.vercel.app',
  'https://www.clinivo.shop',
  'https://clinivo.shop',
  'https://admin.clinivo.shop',
]

function parseOrigins(value) {
  return String(value || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

function isProductionRuntime() {
  return (
    process.env.APP_ENV === 'production' ||
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.VERCEL)
  )
}

/** Value for express/cors `origin` option. */
export function getCorsOriginConfig() {
  const fromEnv = parseOrigins(process.env.CORS_ORIGINS)

  if (!isProductionRuntime()) {
    return fromEnv.length > 0 ? fromEnv : true
  }

  const merged = [...new Set([...PRODUCTION_CORS_ORIGINS, ...fromEnv])]
  return merged.length > 0 ? merged : true
}
