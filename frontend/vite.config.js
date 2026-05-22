import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { getRepoRoot, loadRootEnv } from '../scripts/load-root-env.js'
import { printMobileAccessBanner } from '../scripts/lan-ip.js'

const repoRoot = getRepoRoot()

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  loadRootEnv({ production: mode === 'production' })

  return {
    root: '.',
    envDir: repoRoot,
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
