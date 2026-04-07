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
import { initSandbox, resetSandbox, promoteSandbox, sandboxExists, getSandboxDir } from './sandbox.js'

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

  // ── Environment state ─────────────────────────────────────
  let activeEnv: 'prod' | 'test' = 'prod'

  function getActiveDir(): string {
    return activeEnv === 'test' ? getSandboxDir(claudeDir) : claudeDir
  }

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

  // ── File watcher — detect external changes to ~/.claude/ ──
  let fsDebounceTimer: ReturnType<typeof setTimeout> | null = null
  let selfWriting = false

  function markSelfWrite() {
    selfWriting = true
    setTimeout(() => { selfWriting = false }, 2000)
  }

  const watchDirs = ['skills', 'agents', 'scheduled-tasks'].map(d => path.join(claudeDir, d))
  const watchFiles = ['settings.json', 'launch.json'].map(f => path.join(claudeDir, f))

  for (const dir of watchDirs) {
    if (fs.existsSync(dir)) {
      try {
        fs.watch(dir, { recursive: true }, (_eventType, filename) => {
          if (selfWriting || !filename) return
          if (fsDebounceTimer) clearTimeout(fsDebounceTimer)
          fsDebounceTimer = setTimeout(() => {
            console.log(`  📂 File change detected: ${dir}/${filename}`)
            ecosystemCache = null
            notifyClients('refresh', {
              timestamp: new Date().toISOString(),
              source: 'file-watcher',
              file: filename,
            })
          }, 500)
        })
      } catch {
        // fs.watch may not be supported on all platforms
      }
    }
  }

  for (const file of watchFiles) {
    if (fs.existsSync(file)) {
      try {
        fs.watch(file, (_eventType) => {
          if (selfWriting) return
          if (fsDebounceTimer) clearTimeout(fsDebounceTimer)
          fsDebounceTimer = setTimeout(() => {
            console.log(`  📂 File change detected: ${file}`)
            ecosystemCache = null
            notifyClients('refresh', {
              timestamp: new Date().toISOString(),
              source: 'file-watcher',
              file: path.basename(file),
            })
          }, 500)
        })
      } catch {}
    }
  }

  console.log(`  👁️  Watching ${watchDirs.length} directories + ${watchFiles.length} config files for changes`)

  // ── Health ───────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', claudeDir, environment: activeEnv, version: '1.0.0' })
  })

  // ── Environment ──────────────────────────────────────────
  app.get('/api/environment', (_req, res) => {
    res.json({
      active: activeEnv,
      sandboxExists: sandboxExists(claudeDir),
    })
  })

  app.post('/api/environment/switch', (req, res) => {
    try {
      const { env } = req.body as { env: 'prod' | 'test' }
      if (env !== 'prod' && env !== 'test') {
        res.status(400).json({ error: 'Invalid env. Use "prod" or "test".' })
        return
      }

      if (env === 'test' && !sandboxExists(claudeDir)) {
        initSandbox(claudeDir)
      }

      activeEnv = env
      ecosystemCache = null
      notifyClients('env-changed', { env: activeEnv, timestamp: new Date().toISOString() })
      res.json({ active: activeEnv, sandboxExists: sandboxExists(claudeDir) })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.post('/api/environment/reset', (_req, res) => {
    try {
      resetSandbox(claudeDir)
      ecosystemCache = null
      notifyClients('env-changed', { env: activeEnv, action: 'reset', timestamp: new Date().toISOString() })
      res.json({ success: true, active: activeEnv })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.post('/api/environment/promote', async (req, res) => {
    try {
      markSelfWrite()
      const result = await promoteSandbox(claudeDir)
      activeEnv = 'prod'
      ecosystemCache = null
      notifyClients('env-changed', { env: 'prod', action: 'promoted', timestamp: new Date().toISOString() })
      res.json({ ...result, active: activeEnv })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  // ── Ecosystem (read) ────────────────────────────────────
  app.get('/api/ecosystem', (_req, res) => {
    try {
      if (!ecosystemCache) {
        ecosystemCache = scanEcosystem(getActiveDir())
      }
      res.json(ecosystemCache)
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.get('/api/ecosystem/refresh', (_req, res) => {
    try {
      ecosystemCache = scanEcosystem(getActiveDir())
      notifyClients('refresh', { timestamp: new Date().toISOString() })
      res.json(ecosystemCache)
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  // ── Nodes (CRUD) ────────────────────────────────────────
  app.put('/api/nodes/:id', async (req, res) => {
    try {
      markSelfWrite()
      const nodeId = decodeURIComponent(req.params.id)
      const result = await updateSkillFile(getActiveDir(), nodeId, req.body)
      ecosystemCache = null
      if (result.success) notifyClients('node-updated', { nodeId })
      res.json(result)
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.post('/api/nodes', async (req, res) => {
    try {
      markSelfWrite()
      const result = await createEntity(getActiveDir(), req.body)
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
      markSelfWrite()
      const nodeId = decodeURIComponent(req.params.id)
      const result = await deleteEntity(getActiveDir(), nodeId)
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
      res.json(listBackups(getActiveDir()))
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.post('/api/backups/:id/restore', async (req, res) => {
    try {
      markSelfWrite()
      const result = await restoreBackup(getActiveDir(), req.params.id)
      ecosystemCache = null
      notifyClients('restored', { backupId: req.params.id })
      res.json(result)
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  // ── Save ecosystem state ────────────────────────────────
  app.post('/api/ecosystem/save', async (req, res) => {
    try {
      markSelfWrite()
      const { nodes, edges, entities } = req.body
      const dir = getActiveDir()
      const results = []

      if (entities && Array.isArray(entities)) {
        for (const entity of entities) {
          if (entity.action === 'create') {
            const r = await createEntity(dir, entity)
            results.push(r)
          } else if (entity.action === 'update') {
            const r = await updateSkillFile(dir, entity.id, entity)
            results.push(r)
          } else if (entity.action === 'delete') {
            const r = await deleteEntity(dir, entity.id)
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
      console.log(`  ├─ Env:     ${activeEnv}`)
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
