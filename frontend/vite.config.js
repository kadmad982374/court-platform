var _a;
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
// Phase 8 — frontend foundation. Dev server proxies /api to backend.
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: (_a = process.env.VITE_BACKEND_URL) !== null && _a !== void 0 ? _a : 'http://localhost:8080',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
});
