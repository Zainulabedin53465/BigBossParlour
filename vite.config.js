import { defineConfig } from 'vite';

// While developing, /api calls go to the live counter server (npm run live, port 8787).
const api = { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true } };

export default defineConfig({
  // Relative base so the built site works on GitHub Pages
  // (in a sub-folder or on a custom domain) without changes.
  base: './',
  server: {
    // host: true lets your Android phone open the dev server over Wi-Fi.
    host: true,
    port: 5173,
    strictPort: false,
    proxy: api
  },
  preview: { proxy: api },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900
  }
});
