/**
 * API client — all communication with the Express server.
 * In dev mode, Vite proxy forwards /api to the server.
 * In production, same origin serves both.
 */

import type { EcosystemData } from './types'

const API_BASE = ''

// ── Ecosystem ─────────────────────────────────────────────

export async function fetchEcosystem(): Promise<EcosystemData> {
  const res = await fetch(`${API_BASE}/api/ecosystem`)
  if (!res.ok) throw new Error(`Failed to fetch ecosystem: ${res.status}`)
  return res.json()
}

export async function refreshEcosystem(): Promise<EcosystemData> {
  const res = await fetch(`${API_BASE}/api/ecosystem/refresh`)
  if (!res.ok) throw new Error(`Failed to refresh: ${res.status}`)
  return res.json()
}

// ── Nodes ─────────────────────────────────────────────────

export async function updateNode(
  nodeId: string,
  updates: {
    label?: string
    description?: string
    category?: string
    content?: string
    metadata?: Record<string, unknown>
  }
) {
  const res = await fetch(`${API_BASE}/api/nodes/${encodeURIComponent(nodeId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error(`Failed to update node: ${res.status}`)
  return res.json()
}

export async function createNode(entity: {
  id: string
  label: string
  category: string
  description: string
  metadata?: Record<string, unknown>
}) {
  const res = await fetch(`${API_BASE}/api/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entity),
  })
  if (!res.ok) throw new Error(`Failed to create node: ${res.status}`)
  return res.json()
}

export async function deleteNode(nodeId: string) {
  const res = await fetch(`${API_BASE}/api/nodes/${encodeURIComponent(nodeId)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-Confirm-Delete': 'true',
    },
  })
  if (!res.ok) throw new Error(`Failed to delete node: ${res.status}`)
  return res.json()
}

// ── Save ──────────────────────────────────────────────────

export interface EntityChange {
  action: 'create' | 'update' | 'delete'
  id: string
  label?: string
  category?: string
  description?: string
  metadata?: Record<string, unknown>
}

export async function saveEcosystem(changes: EntityChange[]) {
  const res = await fetch(`${API_BASE}/api/ecosystem/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entities: changes }),
  })
  if (!res.ok) throw new Error(`Failed to save: ${res.status}`)
  return res.json()
}

// ── Backups ───────────────────────────────────────────────

export async function fetchBackups() {
  const res = await fetch(`${API_BASE}/api/backups`)
  if (!res.ok) throw new Error(`Failed to fetch backups: ${res.status}`)
  return res.json()
}

export async function restoreBackup(backupId: string) {
  const res = await fetch(`${API_BASE}/api/backups/${backupId}/restore`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(`Failed to restore: ${res.status}`)
  return res.json()
}

// ── Environment ──────────────────────────────────────────

export type EnvType = 'prod' | 'test'

export interface EnvState {
  active: EnvType
  sandboxExists: boolean
}

export async function fetchEnvironment(): Promise<EnvState> {
  const res = await fetch(`${API_BASE}/api/environment`)
  if (!res.ok) throw new Error(`Failed to fetch environment`)
  return res.json()
}

export async function switchEnvironment(env: EnvType): Promise<EnvState> {
  const res = await fetch(`${API_BASE}/api/environment/switch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ env }),
  })
  if (!res.ok) throw new Error(`Failed to switch environment`)
  return res.json()
}

export async function resetTestEnvironment(): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/environment/reset`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(`Failed to reset sandbox`)
  return res.json()
}

export async function promoteToProduction(): Promise<{
  success: boolean
  backupId: string
  promotedFiles: string[]
}> {
  const res = await fetch(`${API_BASE}/api/environment/promote`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(`Failed to promote`)
  return res.json()
}

// ── Health ────────────────────────────────────────────────

export async function checkHealth(): Promise<{
  status: string
  claudeDir: string
  environment: EnvType
  version: string
}> {
  const res = await fetch(`${API_BASE}/api/health`)
  if (!res.ok) throw new Error(`Server not responding`)
  return res.json()
}

// ── SSE (live updates) ────────────────────────────────────

export function subscribeToEvents(
  onEvent: (event: string, data: unknown) => void
): () => void {
  const source = new EventSource(`${API_BASE}/api/events`)

  source.addEventListener('refresh', (e) => {
    onEvent('refresh', JSON.parse(e.data))
  })
  source.addEventListener('node-updated', (e) => {
    onEvent('node-updated', JSON.parse(e.data))
  })
  source.addEventListener('node-created', (e) => {
    onEvent('node-created', JSON.parse(e.data))
  })
  source.addEventListener('node-deleted', (e) => {
    onEvent('node-deleted', JSON.parse(e.data))
  })
  source.addEventListener('saved', (e) => {
    onEvent('saved', JSON.parse(e.data))
  })
  source.addEventListener('restored', (e) => {
    onEvent('restored', JSON.parse(e.data))
  })
  source.addEventListener('env-changed', (e) => {
    onEvent('env-changed', JSON.parse(e.data))
  })

  return () => source.close()
}
