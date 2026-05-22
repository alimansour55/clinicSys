import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/integration/setup.js'],
    include: ['test/integration/**/*.integration.test.js'],
    exclude: ['node_modules/**'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    maxWorkers: 1,
  },
})
