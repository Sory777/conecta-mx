import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API runs in `wrangler dev` on :8787; Vite proxies /api to it
// so the browser sees a single origin, exactly like production.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: false },
    },
  },
});
