// ── Workflow Builder Types ──────────────────────────────────────────

export interface WorkflowStep {
  id: string
  entityId: string        // references ecosystem node id (e.g. "skill:brainstorming")
  label: string
  category: string        // NodeCategory mirror
  description: string
  color: string
  iconName: string
  config: Record<string, unknown>
}

export interface WorkflowConnection {
  id: string
  sourceStepId: string
  targetStepId: string
  relation: string
  label?: string
}

export type WorkflowScope = 'global' | 'project'

export interface Workflow {
  id: string
  name: string
  description: string
  scope: WorkflowScope
  projectName?: string    // only if scope === 'project'
  steps: WorkflowStep[]
  connections: WorkflowConnection[]
  createdAt: string
  updatedAt: string
  tags: string[]
}

// ── Optimizer Types ────────────────────────────────────────────────

export type OptimizeSeverity = 'pass' | 'error' | 'warning' | 'suggestion'

export type AutoFixAction = 'remove-step' | 'connect-steps' | 'add-description' | 'set-scope' | 'remove-duplicate' | 'break-cycle'

export interface OptimizeResult {
  id: string
  severity: OptimizeSeverity
  title: string
  message: string
  explanation: string     // detailed explanation for chat
  stepId?: string
  fixAction?: AutoFixAction
  fixLabel?: string       // e.g. "Remove step", "Auto-connect"
  fixData?: Record<string, unknown> // data needed for the fix
  dismissible: boolean    // can user ignore this?
}

export interface OptimizeSummary {
  score: number           // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  results: OptimizeResult[]
  passCount: number
  errorCount: number
  warningCount: number
  suggestionCount: number
}

// ── Drag & Drop ────────────────────────────────────────────────────

export interface DragItem {
  entityId: string
  label: string
  category: string
  description: string
  color: string
  iconName: string
}

// ── Library categories for sidebar ─────────────────────────────────

export interface LibraryCategory {
  key: string
  label: string
  color: string
  icon: string
  items: DragItem[]
}
