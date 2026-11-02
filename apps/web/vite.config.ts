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
    // No manual chunk splitting: forcing React into its own vendor chunk alongside lazy-loaded
    // routes caused a production-only crash ("n is not a function" inside the React scheduler) —
    // a known failure mode when manualChunks and React.lazy() interact badly. Rollup's automatic
    // chunking is slightly less size-optimal but far more reliable; the bundle is still small.
  },
});