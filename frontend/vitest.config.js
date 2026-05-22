import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

const baseVite =
  typeof viteConfig === 'function'
    ? viteConfig({ mode: 'test', command: 'serve' })
    : viteConfig

export default mergeConfig(
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
