import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    reporters: process.env.CI
      ? ['verbose', ['json', { outputFile: 'test-results.json' }]]
      : ['verbose']
  }
})
