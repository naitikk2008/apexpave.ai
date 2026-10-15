import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Proxy /api calls to the apexpave ai Python backend running on port 8000
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
