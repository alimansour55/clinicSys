import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { printMobileAccessBanner } from './scripts/lan-ip.js'

// https://vite.dev/config/
export default defineConfig({
  root: '.',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'clinivo-mobile-hint',
      configureServer() {
        return () => printMobileAccessBanner({ patientPort: 5173, staffPort: 5174, apiPort: 4000 })
      },
    },
  ],
  server: {
    host: true,
    port: 5174,
    strictPort: true,
  },
})
