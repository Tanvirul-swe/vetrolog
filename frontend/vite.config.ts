import path from "path"
import http from "http"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, Plugin } from "vite"

function apiProxyFallbackPlugin(): Plugin {
  let isBackendUp = false
  let lastCheck = 0

  const pingBackend = async (): Promise<boolean> => {
    const now = Date.now()
    if (now - lastCheck < 3000) return isBackendUp
    lastCheck = now
    return new Promise((resolve) => {
      const req = http.request(
        { hostname: '127.0.0.1', port: 8787, path: '/api/adb/devices', method: 'GET', timeout: 300 },
        () => {
          isBackendUp = true
          resolve(true)
        }
      )
      req.on('error', () => {
        isBackendUp = false
        resolve(false)
      })
      req.on('timeout', () => {
        req.destroy()
        isBackendUp = false
        resolve(false)
      })
      req.end()
    })
  }

  return {
    name: 'api-proxy-fallback',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api')) {
          return next()
        }
        const available = await pingBackend()
        if (available) {
          return next()
        }
        // If standalone web backend is not active, return clean fallback JSON
        res.setHeader('Content-Type', 'application/json')
        if (req.url.includes('/is-running')) {
          res.end(JSON.stringify({ isRunning: false }))
        } else {
          res.end(JSON.stringify([]))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), apiProxyFallbackPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        bypass: async (req, res) => {
          const isUp = await pingBackend()
          if (isUp) {
            return undefined
          }
          res.setHeader('Content-Type', 'application/json')
          if (req.url?.includes('/is-running')) {
            res.end(JSON.stringify({ isRunning: false }))
          } else {
            res.end(JSON.stringify([]))
          }
          return req.url
        },
      },
    },
  },
})