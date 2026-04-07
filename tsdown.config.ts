import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: 'esm',
  platform: 'node',
  unbundle: true,
  fixedExtension: false,
  sourcemap: true,
  clean: true,
})
