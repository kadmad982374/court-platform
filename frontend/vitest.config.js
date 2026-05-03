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
            // PR-1 baseline: thresholds intentionally 0 so the first CI run measures
            // the real number without failing. PR-2 ratchets these up to 60 once we
            // know the baseline. Tracked under findings.md P6-03.
            thresholds: {
                lines: 0,
                branches: 0,
                functions: 0,
                statements: 0,
            },
        },
    },
});
