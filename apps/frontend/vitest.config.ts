import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@mujin/map-domain': path.resolve(import.meta.dirname, '../../packages/map-domain/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/components/ui/**', 'src/main.tsx'],
    },
  },
})
