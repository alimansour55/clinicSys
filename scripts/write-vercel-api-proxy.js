/**
 * Writes vercel.json rewrites so /api/* on the patient/staff host proxies to the real API.
 * Run before `vite build`; reads API_PUBLIC_URL or VITE_BACKEND_URL from the environment.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadRootEnv } from './load-root-env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const appDir = process.argv[2]
if (!appDir || !['frontend', 'admin'].includes(appDir)) {
  console.error('Usage: node scripts/write-vercel-api-proxy.js <frontend|admin>')
  process.exit(1)
}

loadRootEnv({ production: true, force: true })

const apiBase = (process.env.API_PUBLIC_URL || process.env.VITE_BACKEND_URL || '').trim().replace(/\/$/, '')
const outPath = path.join(repoRoot, appDir, 'vercel.json')

if (!apiBase || apiBase.includes('localhost')) {
  const fallback = {
    rewrites: [{ source: '/(.*)', destination: '/' }],
  }
  fs.writeFileSync(outPath, `${JSON.stringify(fallback, null, 2)}\n`)
  console.warn(
    `[${appDir}] No production API URL — vercel.json has no /api proxy. Set API_PUBLIC_URL or VITE_BACKEND_URL in Vercel env vars.`,
  )
  process.exit(0)
}

const vercel = {
  rewrites: [
    { source: '/api/(.*)', destination: `${apiBase}/api/$1` },
    { source: '/(.*)', destination: '/' },
  ],
}

fs.writeFileSync(outPath, `${JSON.stringify(vercel, null, 2)}\n`)
console.log(`[${appDir}] Wrote API proxy → ${apiBase}`)
