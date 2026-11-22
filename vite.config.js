import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 900 }, // the world map loads on demand
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
});
