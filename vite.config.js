import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Dev-only: serve the Vercel-style serverless functions in api/ during
// `npm run dev`. Plain Vite doesn't run them (only Vercel / `vercel dev` do),
// which otherwise leaves /api/field returning nothing locally. This adapts a
// Node request/response to the (req, res) handler signature the functions use.
function devApiPlugin() {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next()

        const url = new URL(req.url, 'http://localhost')
        const name = url.pathname.replace(/^\/api\//, '').replace(/\/+$/, '')
        const modPath = resolve(process.cwd(), 'api', `${name}.js`)
        if (!name || !existsSync(modPath)) return next()

        // Parse a JSON body for POST/PUT.
        let body
        if (req.method === 'POST' || req.method === 'PUT') {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const raw = Buffer.concat(chunks).toString('utf8')
          try { body = raw ? JSON.parse(raw) : {} } catch { body = raw }
        }

        // Minimal Vercel-style req/res shims.
        const vreq = Object.assign(req, {
          query: Object.fromEntries(url.searchParams),
          body,
        })
        const vres = {
          statusCode: 200,
          status(code) { this.statusCode = code; return this },
          setHeader: (k, v) => res.setHeader(k, v),
          json(obj) {
            res.statusCode = this.statusCode
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(obj))
            return this
          },
          send(data) {
            res.statusCode = this.statusCode
            res.end(typeof data === 'string' ? data : JSON.stringify(data))
            return this
          },
        }

        try {
          const mod = await server.ssrLoadModule(modPath)
          await mod.default(vreq, vres)
        } catch (err) {
          server.config.logger.error(`[dev-api] ${name} failed: ${err.message}`)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), devApiPlugin()],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuild: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
})
