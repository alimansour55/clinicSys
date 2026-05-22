import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { getRepoRoot, loadRootEnv } from '../scripts/load-root-env.js'

const repoRoot = getRepoRoot()

// https://vite.dev/config/
export default defineConfig(async ({ command, mode }) => {
  loadRootEnv({ production: mode === 'production' })

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
    root: '.',
    envDir: repoRoot,
    plugins,
    server: {
      host: true,
      port: 5174,
      strictPort: true,
    },
  }
})
