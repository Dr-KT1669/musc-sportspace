import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./server/tests/setup.ts'],
    fileParallelism: false,
    hookTimeout: 60000,
    testTimeout: 30000,
    poolOptions: { threads: { singleThread: true } },
  },
})
