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

const statsMock = () => ({
  name: 'stats-mock',
  configureServer(server: { middlewares: { use: (path: string, fn: (req: unknown, res: { setHeader: (k: string, v: string) => void; end: (c: string) => void }) => void) => void } }) {
    server.middlewares.use('/api/stats', (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify([
        { id: "STAT001", icon: "calendar", title: "Easy Booking", description: "Find and book the service you need with ease." },
        { id: "STAT002", icon: "clock", title: "Flexible Scheduling", description: "Choose a convenient time for your service." },
        { id: "STAT003", icon: "home", title: "Home Convenience", description: "Get the services you need at your doorstep." },
        { id: "STAT004", icon: "sparkles", title: "Simple Experience", description: "Manage your home service journey in one place." },
      ]));
    });
  },
});

export default defineConfig({
   plugins: [
    react(),
    gzipPreview(),
    statsMock(),
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
    open: false,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Permissions-Policy': 'accelerometer=*, gyroscope=*, magnetometer=*, focus-without-user-activation=*',
    },

    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },

  preview: {
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },

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
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // jsdom page tests (typing into forms, waiting for lists) are slow under parallel load; the 5 s default
    // caused false failures that pass when the file is run alone.
    testTimeout: 20000,
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
  },
});
