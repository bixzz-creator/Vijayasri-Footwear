import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: '../../',
  server: {
    port: 5173,
  },
  build: {
    // Raise chunk size warning limit — our app is data-heavy
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Manual chunks to improve caching & Core Web Vitals
        manualChunks: (id) => {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'animation';
          }
          if (id.includes('node_modules/lenis') || id.includes('node_modules/gsap')) {
            return 'scroll';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'icons';
          }
          if (id.includes('node_modules/@supabase')) {
            return 'supabase';
          }
          if (id.includes('packages/database') || id.includes('packages/shared') || id.includes('packages/ui')) {
            return 'vijayasri-core';
          }
        }
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'lenis'],
  },
})
