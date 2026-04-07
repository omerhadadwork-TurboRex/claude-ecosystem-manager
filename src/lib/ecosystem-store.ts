import type { Node, Edge } from '@xyflow/react'

const STORAGE_KEY = 'claude-ecosystem-state'
const HISTORY_KEY = 'claude-ecosystem-history'
const MAX_HISTORY = 30

export interface EcosystemSnapshot {
  id: string
  name: string
  timestamp: string
  nodeCount: number
  edgeCount: number
  nodes: Node[]
  edges: Edge[]
}

export interface SavedEcosystemState {
  nodes: Node[]
  edges: Edge[]
  savedAt: string
}

// ── Current state ──────────────────────────────────────────

export function loadSavedState(): SavedEcosystemState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SavedEcosystemState
  } catch {
    return null
  }
}

export function saveCurrentState(nodes: Node[], edges: Edge[]): void {
  const state: SavedEcosystemState = {
    nodes: nodes.map(serializeNode),
    edges: edges.map(serializeEdge),
    savedAt: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// ── Version history ────────────────────────────────────────

export function loadHistory(): EcosystemSnapshot[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    return JSON.parse(raw) as EcosystemSnapshot[]
  } catch {
    return []
  }
}

export function saveToHistory(
  nodes: Node[],
  edges: Edge[],
  name?: string
): EcosystemSnapshot {
  const history = loadHistory()
  const snapshot: EcosystemSnapshot = {
    id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: name || generateSnapshotName(history.length + 1),
    timestamp: new Date().toISOString(),
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes: nodes.map(serializeNode),
    edges: edges.map(serializeEdge),
  }

  history.unshift(snapshot) // newest first

  // Trim to max
  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY
  }

  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  return snapshot
}

export function deleteSnapshot(snapshotId: string): void {
  const history = loadHistory()
  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(history.filter(s => s.id !== snapshotId))
  )
}

export function renameSnapshot(snapshotId: string, newName: string): void {
  const history = loadHistory()
  const snap = history.find(s => s.id === snapshotId)
  if (snap) {
    snap.name = newName
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  }
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY)
}

// ── Helpers ────────────────────────────────────────────────

function generateSnapshotName(index: number): string {
  const now = new Date()
  const time = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `Save #${index} — ${time}`
}

/** Strip non-serializable fields (callbacks, React elements) from node data */
function serializeNode(node: Node): Node {
  const { data, ...rest } = node
  const cleanData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (typeof value !== 'function') {
      cleanData[key] = value
    }
  }
  return { ...rest, data: cleanData }
}

function serializeEdge(edge: Edge): Edge {
  const { data, ...rest } = edge
  if (!data) return edge
  const cleanData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (typeof value !== 'function') {
      cleanData[key] = value
    }
  }
  return { ...rest, data: cleanData }
}
