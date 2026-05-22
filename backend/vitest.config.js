import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.js'],
    include: ['**/*.{test,spec}.js'],
    exclude: ['node_modules/**', 'scripts/**', 'test/integration/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: ['controllers/**', 'services/**', 'utils/**', 'middlewares/**'],
      exclude: ['**/*.{test,spec}.js', 'scripts/**'],
    },
  },
})
