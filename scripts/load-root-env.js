import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

let loaded = false

/** Repo root (contains .env, frontend/, backend/, admin/). */
export function getRepoRoot() {
  return repoRoot
}

function applyDerivedEnv() {
  if (!process.env.VITE_BACKEND_URL?.trim() && process.env.API_PUBLIC_URL?.trim()) {
    process.env.VITE_BACKEND_URL = process.env.API_PUBLIC_URL.trim()
  }
  if (!process.env.VITE_APP_DISPLAY_NAME?.trim() && process.env.APP_DISPLAY_NAME?.trim()) {
    process.env.VITE_APP_DISPLAY_NAME = process.env.APP_DISPLAY_NAME.trim()
  }
  if (!process.env.PUBLIC_APP_BRAND?.trim() && process.env.APP_DISPLAY_NAME?.trim()) {
    process.env.PUBLIC_APP_BRAND = process.env.APP_DISPLAY_NAME.trim()
  }
}

/**
 * Load monorepo env from repo root.
 * - Always loads `.env` when present.
 * - Also loads `.env.prod` when `production` is true (build / APP_ENV=production / NODE_ENV=production).
 */
export function loadRootEnv(options = {}) {
  if (process.env.NODE_ENV === 'test') {
    return { root: repoRoot, production: false }
  }

  const production =
    options.production ??
    (process.env.APP_ENV === 'production' ||
      process.env.NODE_ENV === 'production' ||
      Boolean(process.env.VERCEL))

  if (options.force) {
    loaded = false
  }

  if (loaded && !options.force) {
    applyDerivedEnv()
    return { root: repoRoot, production }
  }

  const envPath = path.join(repoRoot, '.env')
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, quiet: true })
  }

  if (production) {
    const prodPath = path.join(repoRoot, '.env.prod')
    if (fs.existsSync(prodPath)) {
      dotenv.config({ path: prodPath, override: true, quiet: true })
    }
  }

  applyDerivedEnv()
  loaded = true
  return { root: repoRoot, production }
}
