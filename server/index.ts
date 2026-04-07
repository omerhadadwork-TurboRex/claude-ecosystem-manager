/**
 * Express server — serves the API and static frontend.
 */
import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { scanEcosystem } from './scanner.js'
import { createBackup, listBackups, restoreBackup } from './backup.js'
import { updateSkillFile, createEntity, deleteEntity } from './writer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface ServerOptions {
  port: number
  claudeDir: string
}

// In-memory cache for ecosystem data
let ecosystemCache: ReturnType<typeof scanEcosystem> | null = null

export function startServer(options: ServerOptions): Promise<ReturnType<typeof express.prototype.listen>> {
  const { port, claudeDir } = options
  const app = express()

  app.use(express.json({ limit: '10mb' }))

  // ── SSE for live updates ─────────────────────────────────
  const sseClients = new Set<express.Response>()

  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    sseClients.add(res)
    req.on('close', () => sseClients.delete(res))
  })

  function notifyClients(event: string, data?: unknown) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data || {})}\n\n`
    for (const client of sseClients) {
      client.write(msg)
    }
  }

  // ── Health ───────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', claudeDir, version: '1.0.0' })
  })

  // ── Ecosystem (read) ────────────────────────────────────
  app.get('/api/ecosystem', (_req, res) => {
    try {
      if (!ecosystemCache) {
        ecosystemCache = scanEcosystem(claudeDir)
      }
      res.json(ecosystemCache)
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.get('/api/ecosystem/refresh', (_req, res) => {
    try {
      ecosystemCache = scanEcosystem(claudeDir)
      notifyClients('refresh', { timestamp: new Date().toISOString() })
      res.json(ecosystemCache)
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  // ── Nodes (CRUD) ────────────────────────────────────────
  app.put('/api/nodes/:id', async (req, res) => {
    try {
      const nodeId = decodeURIComponent(req.params.id)
      const result = await updateSkillFile(claudeDir, nodeId, req.body)
      ecosystemCache = null // Invalidate cache
      if (result.success) notifyClients('node-updated', { nodeId })
      res.json(result)
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.post('/api/nodes', async (req, res) => {
    try {
      const result = await createEntity(claudeDir, req.body)
      ecosystemCache = null
      if (result.success) notifyClients('node-created', { entity: req.body })
      res.json(result)
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.delete('/api/nodes/:id', async (req, res) => {
    try {
      const confirm = req.headers['x-confirm-delete']
      if (confirm !== 'true') {
        res.status(400).json({ error: 'Missing X-Confirm-Delete header' })
        return
      }
      const nodeId = decodeURIComponent(req.params.id)
      const result = await deleteEntity(claudeDir, nodeId)
      ecosystemCache = null
      if (result.success) notifyClients('node-deleted', { nodeId })
      res.json(result)
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  // ── Backups ─────────────────────────────────────────────
  app.get('/api/backups', (_req, res) => {
    try {
      res.json(listBackups(claudeDir))
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.post('/api/backups/:id/restore', async (req, res) => {
    try {
      const result = await restoreBackup(claudeDir, req.params.id)
      ecosystemCache = null
      notifyClients('restored', { backupId: req.params.id })
      res.json(result)
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  // ── Save ecosystem state (graph positions + edges) ──────
  app.post('/api/ecosystem/save', async (req, res) => {
    try {
      const { nodes, edges, entities } = req.body
      const results = []

      // Write entity changes to files
      if (entities && Array.isArray(entities)) {
        for (const entity of entities) {
          if (entity.action === 'create') {
            const r = await createEntity(claudeDir, entity)
            results.push(r)
          } else if (entity.action === 'update') {
            const r = await updateSkillFile(claudeDir, entity.id, entity)
            results.push(r)
          } else if (entity.action === 'delete') {
            const r = await deleteEntity(claudeDir, entity.id)
            results.push(r)
          }
        }
      }

      ecosystemCache = null
      notifyClients('saved', { timestamp: new Date().toISOString() })

      res.json({
        success: true,
        results,
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  // ── Serve static frontend (production) ──────────────────
  const clientDir = path.join(__dirname, '..', 'dist', 'client')
  app.use(express.static(clientDir))

  // SPA fallback
  app.get('{*path}', (_req, res) => {
    const indexPath = path.join(clientDir, 'index.html')
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath)
    } else {
      res.status(404).json({
        error: 'Frontend not built. Run: npm run build',
        hint: 'For development, use: npm run dev',
      })
    }
  })

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`\n  ✦ Claude Ecosystem Manager`)
      console.log(`  ├─ Server:  http://localhost:${port}`)
      console.log(`  ├─ Claude:  ${claudeDir}`)
      console.log(`  └─ API:     http://localhost:${port}/api/health\n`)
      resolve(server)
    })
  })
}

// Direct execution
if (process.argv[1] && process.argv[1].includes('server')) {
  const HOME = process.env.USERPROFILE || process.env.HOME || ''
  startServer({
    port: parseInt(process.env.PORT || '3847'),
    claudeDir: path.join(HOME, '.claude'),
  })
}
