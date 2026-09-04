import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const BASE = '/';

export default defineConfig({
  base: BASE,
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    open: BASE,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/xevera-portal/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/xevera-portal\/api/, '/api'),
      },
      '/xevera-portal/uploads': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/xevera-portal\/uploads/, '/uploads'),
      },
    },
    // Visiting http://localhost:5173/ redirects to the subpath base.
    // This makes the canonical guest URL http://localhost:5173/xevera-portal/
    // and ensures refresh/bookmarks at that path always load the SPA.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/' || req.url === '') {
          res.statusCode = 302;
          res.setHeader('Location', BASE);
          return res.end();
        }
        next();
      });
    },
  },
  preview: {
    port: 5173,
    open: BASE,
  },
  build: {
    outDir: 'dist',
  },
});