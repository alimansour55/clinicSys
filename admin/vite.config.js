import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const monorepoRoot = path.resolve(__dirname, '..')

function resolveEnvDir() {
  if (fs.existsSync(path.join(monorepoRoot, '.env.example'))) return monorepoRoot
  return __dirname
}

function resolveApiUrl(mode, envDir) {
  const fileEnv = loadEnv(mode, envDir, '')
  return (
    process.env.VITE_BACKEND_URL ||
    process.env.API_PUBLIC_URL ||
    fileEnv.VITE_BACKEND_URL ||
    fileEnv.API_PUBLIC_URL ||
    ''
  ).trim()
}

export default defineConfig(async ({ command, mode }) => {
  const envDir = resolveEnvDir()
  const apiUrl = resolveApiUrl(mode, envDir)

  const define =
    mode === 'production'
      ? {
          'import.meta.env.VITE_BACKEND_URL': JSON.stringify(
            apiUrl && !apiUrl.includes('localhost') ? apiUrl : '',
          ),
        }
      : {}

  const plugins = [react(), tailwindcss()]

  if (command === 'serve') {
    try {
      const { printMobileAccessBanner } = await import('./scripts/lan-ip.js')
      plugins.push({
        name: 'clinivo-mobile-hint',
        configureServer() {
          return () =>
            printMobileAccessBanner({ patientPort: 5173, staffPort: 5174, apiPort: 4000 })
        },
      })
    } catch {
      /* optional dev hint */
    }
  }

  return {
    root: __dirname,
    envDir,
    define,
    plugins,
    server: {
      host: true,
      port: 5174,
      strictPort: true,
    },
  }
})
