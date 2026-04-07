import { defineConfig } from 'vitest/config'
import CtrfReporter from '@d2t/vitest-ctrf-json-reporter'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    reporters: process.env.CI
      ? ['verbose', new CtrfReporter({ outputFile: 'ctrf-vitest.json' }), ['json', { outputFile: 'test-results.json' }]]
      : ['verbose']
  }
})
