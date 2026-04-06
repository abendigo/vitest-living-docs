import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/eslint.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
})
