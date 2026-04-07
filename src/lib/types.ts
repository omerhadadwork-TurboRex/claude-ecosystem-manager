export type NodeCategory =
  | 'agent'
  | 'skill-local'
  | 'skill-remote'
  | 'skill-project'
  | 'plugin'
  | 'hook'
  | 'scheduled-task'
  | 'launch-config'
  | 'marketplace'

export type EdgeRelation =
  | 'invokes'
  | 'delegates-to'
  | 'provides-tools'
  | 'triggers'
  | 'schedules'
  | 'depends-on'

export interface EcosystemNode {
  id: string
  label: string
  category: NodeCategory
  description: string
  filePath: string
  metadata: Record<string, unknown>
  content?: string
  parentId?: string // for group containment
}

export interface EcosystemEdge {
  id: string
  source: string
  target: string
  relation: EdgeRelation
  label?: string
}

export interface EcosystemData {
  nodes: EcosystemNode[]
  edges: EcosystemEdge[]
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info'
  message: string
  nodeId?: string
  ruleId: string
}

export const CATEGORY_CONFIG: Record<NodeCategory, { color: string; label: string; icon: string }> = {
  'agent':          { color: '#9333ea', label: 'Agent',          icon: 'Bot' },
  'skill-local':    { color: '#10b981', label: 'Local Skill',    icon: 'Puzzle' },
  'skill-remote':   { color: '#14b8a6', label: 'Remote Skill',   icon: 'Cloud' },
  'skill-project':  { color: '#f59e0b', label: 'Project Skill',  icon: 'FolderOpen' },
  'plugin':         { color: '#3b82f6', label: 'Plugin',         icon: 'Plug' },
  'hook':           { color: '#f97316', label: 'Hook',           icon: 'Zap' },
  'scheduled-task': { color: '#f43f5e', label: 'Scheduled Task', icon: 'Clock' },
  'launch-config':  { color: '#64748b', label: 'Launch Config',  icon: 'Rocket' },
  'marketplace':    { color: '#6366f1', label: 'Marketplace',    icon: 'Store' },
}
