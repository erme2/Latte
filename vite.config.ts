import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/pane': {
          target: env.VITE_PANE_PROXY_TARGET ?? 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
          headers: env.VITE_PANE_PROXY_HOST
            ? {
                Host: env.VITE_PANE_PROXY_HOST,
              }
            : undefined,
          rewrite: (path) => path.replace(/^\/pane/, ''),
        },
      },
    },
  }
})
