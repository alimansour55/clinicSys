import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(async ({ command }) => {
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
    plugins,
    server: {
      host: true,
      port: 5174,
      strictPort: true,
    },
  }
})
