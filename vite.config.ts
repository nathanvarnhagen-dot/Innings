import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Innings',
        short_name: 'Innings',
        description: 'Life, people, and moments',
        theme_color: '#1a1640',
        background_color: '#1a1640',
        display: 'standalone',
        orientation: 'portrait',
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          forms: ['react-hook-form', 'zod', '@hookform/resolvers/zod'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts' },
});
