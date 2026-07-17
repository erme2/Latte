import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createPaneProxyOptions } from './vite-pane-proxy.mjs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/pane': createPaneProxyOptions(env),
      },
    },
  }
})
