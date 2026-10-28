import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  
  plugins: [react()],
  build: { outDir: process.env.OUT, emptyOutDir: true, cssCodeSplit: false, assetsInlineLimit: 100000000, chunkSizeWarningLimit: 5000,
    rollupOptions: { output: { inlineDynamicImports: true } } },
});
