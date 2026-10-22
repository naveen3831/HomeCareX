import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import compression from 'compression';

const gzipPreview = () => ({
  name: 'gzip-preview',
  configurePreviewServer(server: { middlewares: { use: (fn: unknown) => void } }) {
    server.middlewares.use(compression());
  },
});
export default defineConfig({
   plugins: [
    react(),
    gzipPreview(),
  ],

  resolve: {
    alias: {
      '@': path.resolve(
        import.meta.dirname,
        './src',
      ),
    },
  },

  optimizeDeps: {
    exclude: ["jspdf"],
  },

 
  build: {
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      external: ["jspdf"],
    },
  },


  server: {
    port: 3000,
    open: true,

    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },

  preview: {
    port: 3000,

    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});