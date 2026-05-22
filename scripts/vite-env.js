import path from 'path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { getRepoRoot } from './load-root-env.js'

/** Load root `.env` / `.env.prod` for Vite (uses repo-root dotenv). */
export function loadRootEnvForVite(mode) {
  const repoRoot = getRepoRoot()
  const require = createRequire(pathToFileURL(path.join(repoRoot, 'package.json')))
  const dotenv = require('dotenv')

  dotenv.config({ path: path.join(repoRoot, '.env'), quiet: true })
  if (mode === 'production') {
    dotenv.config({ path: path.join(repoRoot, '.env.prod'), override: true, quiet: true })
  }

  if (!process.env.VITE_BACKEND_URL?.trim() && process.env.API_PUBLIC_URL?.trim()) {
    process.env.VITE_BACKEND_URL = process.env.API_PUBLIC_URL.trim()
  }
  if (!process.env.VITE_APP_DISPLAY_NAME?.trim() && process.env.APP_DISPLAY_NAME?.trim()) {
    process.env.VITE_APP_DISPLAY_NAME = process.env.APP_DISPLAY_NAME.trim()
  }
}
