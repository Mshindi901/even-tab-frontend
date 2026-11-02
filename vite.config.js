import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'https://even-tab-backend.onrender.com',
          changeOrigin: true,
        },
      },
    },
  }
})
