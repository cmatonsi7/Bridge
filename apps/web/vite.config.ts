import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: '../..',
  server: {
    port: 5173,
    // In development the API runs separately; in production Express serves both on one origin.
    proxy: { '/api': 'http://localhost:8080' },
  },
  build: {
    // Sourcemaps on: if something breaks in production again, the browser error points at
    // real source files/lines instead of minified chunk positions.
    sourcemap: true,
    chunkSizeWarningLimit: 900,
    // No manual chunk splitting. This was briefly suspected as the cause of a production
    // crash, but the real cause was an unguarded window.scrollTo call in PublicLayout's
    // navigation effect (see layouts/PublicLayout.tsx). Left reverted anyway since automatic
    // chunking is simpler and the bundle size difference is negligible.
  },
});