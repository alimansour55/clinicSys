import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { getRepoRoot } from '../scripts/load-root-env.js'
import { loadRootEnvForVite } from '../scripts/vite-env.js'
import { printMobileAccessBanner } from '../scripts/lan-ip.js'

const repoRoot = getRepoRoot()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  loadRootEnvForVite(mode)
  const env = loadEnv(mode, repoRoot, '')
  const apiUrl = (env.VITE_BACKEND_URL || env.API_PUBLIC_URL || '').trim()

  const define =
    mode === 'production'
      ? {
          'import.meta.env.VITE_BACKEND_URL': JSON.stringify(
            apiUrl && !apiUrl.includes('localhost') ? apiUrl : '',
          ),
        }
      : {}

  return {
    root: __dirname,
    envDir: repoRoot,
    define,
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'clinivo-mobile-hint',
        configureServer() {
          return () =>
            printMobileAccessBanner({ patientPort: 5173, staffPort: 5174, apiPort: 4000 })
        },
      },
    ],
    server: {
      host: true,
      port: 5173,
      strictPort: false,
    },
  }
})
