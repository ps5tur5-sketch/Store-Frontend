import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.VITE_DEV_API_TARGET ?? 'http://127.0.0.1:3000',
      '/health': process.env.VITE_DEV_API_TARGET ?? 'http://127.0.0.1:3000',
      '/webhook': process.env.VITE_DEV_API_TARGET ?? 'http://127.0.0.1:3000',
    },
  },
});
