import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The build output (dist/site) is the folder that gets published; api/build.mjs bundles the Worker next to it.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist/site', emptyOutDir: true, sourcemap: false, target: 'es2020', assetsInlineLimit: 0 },
  server: { proxy: { '/api': 'http://localhost:8795' } },
});
