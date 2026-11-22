import { defineConfig } from 'vite';

/**
 * Library build: one ES module with a self-registering <agent-chat>.
 * Dev/preview serve demo/index.html for the Playwright e2e.
 */
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'agent-chat.js',
    },
    rollupOptions: {
      output: {
        // Keep the public API tidy; everything else is inlined.
        codeSplitting: false,
      },
    },
    target: 'es2022',
    minify: 'esbuild',
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
});
