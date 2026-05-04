import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
      ],
      // PR-2 ratchet: thresholds set ~5pp below the measured baseline (lines
      // 40.15 / branches 80.97 / functions 70.81 / statements 40.15) so CI
      // catches real regressions without false alarms on minor fluctuations.
      // PR-3+ will ratchet again as untested pages get covered.
      thresholds: {
        lines: 38,
        branches: 70,
        functions: 60,
        statements: 38,
      },
    },
  },
});

