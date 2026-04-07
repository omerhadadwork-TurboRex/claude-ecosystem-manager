import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist/client',
  },
  server: {
    proxy: {
      '/api/events': {
        target: 'http://localhost:3847',
        // SSE requires no response buffering
        headers: { 'Cache-Control': 'no-transform' },
      },
      '/api': {
        target: 'http://localhost:3847',
      },
    },
  },
})
