import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const BASE = '/';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: BASE,
  root: __dirname,
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
    },
    // Visiting http://localhost:5173/ serves the SPA at root.
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
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
});