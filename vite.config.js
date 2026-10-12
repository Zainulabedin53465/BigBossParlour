import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built site works on GitHub Pages
  // (in a sub-folder or on a custom domain) without changes.
  base: './',
  server: {
    // host: true lets your Android phone open the dev server over Wi-Fi.
    host: true,
    port: 5173,
    strictPort: false
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 700
  }
});
