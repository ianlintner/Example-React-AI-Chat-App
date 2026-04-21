import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2019',
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'CatHerdingChat',
      formats: ['iife'],
      // Emit under `embed/` so the prod deploy (`dist/**` copied to the
      // backend's `public/` dir) serves both the JS bundle and
      // `callback.html` from `/embed/...`. Matches the OAuth2 client's
      // registered redirect URIs.
      fileName: () => 'embed/cat-herding-chat.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        extend: true,
      },
    },
  },
  // `assets/` holds static files (callback.html) that must ship alongside the
  // JS bundle. `demo/` is dev-only and excluded from the build via its own
  // path (Vite's publicDir copies everything under it verbatim).
  publicDir: 'assets',
  server: {
    port: 5199,
    open: '/demo/index.html',
  },
});
