import type { Workflow } from './workflow-types'

const STORAGE_KEY = 'claude-ecosystem-workflows'

export function loadWorkflows(): Workflow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Workflow[]
  } catch {
    return []
  }
}

export function saveWorkflows(workflows: Workflow[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows))
}

export function saveWorkflow(workflow: Workflow): void {
  const existing = loadWorkflows()
  const idx = existing.findIndex(w => w.id === workflow.id)
  if (idx >= 0) {
    existing[idx] = { ...workflow, updatedAt: new Date().toISOString() }
  } else {
    existing.push(workflow)
  }
  saveWorkflows(existing)
}

export function deleteWorkflow(id: string): void {
  const existing = loadWorkflows()
  saveWorkflows(existing.filter(w => w.id !== id))
}

export function createEmptyWorkflow(name = 'Untitled Workflow'): Workflow {
  return {
    id: `wf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    description: '',
    scope: 'global',
    steps: [],
    connections: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
  }
}
