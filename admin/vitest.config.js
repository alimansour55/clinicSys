import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

export default defineConfig(async () => {
  const baseVite = await viteConfig({ mode: 'test', command: 'serve' })
  return mergeConfig(
    baseVite,
    defineConfig({
      test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.js'],
        include: ['src/**/*.{test,spec}.{js,jsx}'],
        exclude: ['node_modules/**', 'dist/**'],
      },
    }),
  )
})
