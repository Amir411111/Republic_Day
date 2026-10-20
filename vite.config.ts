import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// content/ is served as static root, so card images live at /images/<file>
export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: 'content',
  // MapLibre starts a Web Worker via new Worker(new URL(...)); esbuild pre-bundling
  // rewrites that URL and the map never fires `load`. Leaving it unbundled keeps it intact.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  worker: { format: 'es' },
});
