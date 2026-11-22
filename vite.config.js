import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Two pages: the landing page (index.html, built with the taste-skill kit in public/kit) and the app (app.html, React).
export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: {
    outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 900, // the world map loads on demand
    rollupOptions: { input: { main: resolve('client/index.html'), app: resolve('client/app.html') } },
  },
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
});
