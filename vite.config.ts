import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist/public'
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    // Same-origin /api in dev so Better Auth cookies work like production.
    proxy: {
      '/api': {
        target: 'http://localhost:8789',
        changeOrigin: false
      }
    }
  }
})