/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  // Build de un solo archivo HTML: se abre en cualquier navegador sin servidor.
  plugins: [react(), viteSingleFile()],
  base: './',
  test: {
    include: ['src/**/*.test.ts'],
  },
});
