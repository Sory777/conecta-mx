import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const API = process.env.VITE_API_TARGET ?? 'http://localhost:8787';

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: API, changeOrigin: false },
      '/ws': { target: API.replace('http', 'ws'), ws: true },
    },
    fs: { allow: ['..'] },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
});
