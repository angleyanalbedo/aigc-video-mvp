import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:3001'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/uploads': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/outputs': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/ws': {
          target: proxyTarget.replace(/^http/, 'ws'),
          ws: true,
          changeOrigin: true
        }
      }
    }
  }
})
