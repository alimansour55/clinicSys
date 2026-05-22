import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { getRepoRoot } from '../scripts/load-root-env.js'
import { loadRootEnvForVite } from '../scripts/vite-env.js'

const repoRoot = getRepoRoot()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(async ({ command, mode }) => {
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

  const plugins = [react(), tailwindcss()]

  if (command === 'serve') {
    const { printMobileAccessBanner } = await import('./scripts/lan-ip.js')
    plugins.push({
      name: 'clinivo-mobile-hint',
      configureServer() {
        return () =>
          printMobileAccessBanner({ patientPort: 5173, staffPort: 5174, apiPort: 4000 })
      },
    })
  }

  return {
    root: __dirname,
    envDir: repoRoot,
    define,
    plugins,
    server: {
      host: true,
      port: 5174,
      strictPort: true,
    },
  }
})
