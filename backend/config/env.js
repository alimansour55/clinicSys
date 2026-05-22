import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(backendRoot, '..')

function applyDerivedEnv() {
  if (!process.env.VITE_BACKEND_URL?.trim() && process.env.API_PUBLIC_URL?.trim()) {
    process.env.VITE_BACKEND_URL = process.env.API_PUBLIC_URL.trim()
  }
  if (!process.env.PUBLIC_APP_BRAND?.trim() && process.env.APP_DISPLAY_NAME?.trim()) {
    process.env.PUBLIC_APP_BRAND = process.env.APP_DISPLAY_NAME.trim()
  }
}

/** Load .env files locally. On Vercel, env vars come from the project dashboard only. */
export function loadBackendEnv() {
  if (process.env.NODE_ENV === 'test') return

  const production =
    process.env.APP_ENV === 'production' ||
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.VERCEL)

  if (process.env.VERCEL) {
    applyDerivedEnv()
    return
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
}

loadBackendEnv()
