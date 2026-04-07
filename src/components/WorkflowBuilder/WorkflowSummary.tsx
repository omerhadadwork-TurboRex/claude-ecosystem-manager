import { useMemo } from 'react'
import type { Workflow } from '../../lib/workflow-types'
import { CATEGORY_CONFIG } from '../../lib/types'
import {
  Bot, Puzzle, Cloud, FolderOpen, Plug, Zap, Clock, Rocket, Store, Circle,
  X, ArrowRight, Save, FileText, Layers, GitBranch
} from 'lucide-react'

const ICON_MAP: Record<string, React.ElementType> = {
  Bot, Puzzle, Cloud, FolderOpen, Plug, Zap, Clock, Rocket, Store, Circle,
}

interface WorkflowSummaryProps {
  workflow: Workflow
  onConfirmSave: () => void
  onCancel: () => void
}

export default function WorkflowSummary({ workflow, onConfirmSave, onCancel }: WorkflowSummaryProps) {
  // Analyze the workflow
  const analysis = useMemo(() => {
    const steps = workflow.steps
    const connections = workflow.connections

    // Group steps by category
    const byCategory = new Map<string, typeof steps>()
    for (const step of steps) {
      const cat = step.category
      if (!byCategory.has(cat)) byCategory.set(cat, [])
      byCategory.get(cat)!.push(step)
    }

    // Find entry points (nodes with no incoming connections)
    const targetsSet = new Set(connections.map(c => c.targetStepId))
    const sourcesSet = new Set(connections.map(c => c.sourceStepId))
    const entryPoints = steps.filter(s => !targetsSet.has(s.id))
    const endPoints = steps.filter(s => !sourcesSet.has(s.id))

    // Build adjacency for flow description
    const adjacency = new Map<string, string[]>()
    for (const conn of connections) {
      if (!adjacency.has(conn.sourceStepId)) adjacency.set(conn.sourceStepId, [])
      adjacency.get(conn.sourceStepId)!.push(conn.targetStepId)
    }

    // Build flow chains
    const stepMap = new Map(steps.map(s => [s.id, s]))
    const chains: string[][] = []

    function buildChain(startId: string, visited: Set<string>): string[] {
      const chain = [startId]
      visited.add(startId)
      const next = adjacency.get(startId) || []
      for (const nextId of next) {
        if (!visited.has(nextId)) {
          chain.push(...buildChain(nextId, visited))
        }
      }
      return chain
    }

    const globalVisited = new Set<string>()
    for (const entry of entryPoints) {
      if (!globalVisited.has(entry.id)) {
        chains.push(buildChain(entry.id, globalVisited))
      }
    }
    // Catch any disconnected nodes
    for (const step of steps) {
      if (!globalVisited.has(step.id)) {
        chains.push([step.id])
        globalVisited.add(step.id)
      }
    }

    // Generate description
    const generateDescription = (): string => {
      if (steps.length === 0) return 'This workflow is empty.'

      const parts: string[] = []

      // Overview
      parts.push(
        `This workflow contains ${steps.length} component${steps.length > 1 ? 's' : ''} ` +
        `with ${connections.length} connection${connections.length !== 1 ? 's' : ''}.`
      )

      // Entry points
      if (entryPoints.length > 0) {
        const names = entryPoints.map(e => `"${e.label}"`).join(', ')
        parts.push(`It starts from ${names}.`)
      }

      // Flow description
      for (const chain of chains) {
        if (chain.length > 1) {
          const labels = chain.map(id => stepMap.get(id)?.label || id)
          parts.push(`Flow: ${labels.join(' → ')}.`)
        }
      }

      // Endpoints
      if (endPoints.length > 0 && connections.length > 0) {
        const names = endPoints.map(e => `"${e.label}"`).join(', ')
        parts.push(`Final output from ${names}.`)
      }

      return parts.join(' ')
    }

    return {
      byCategory,
      entryPoints,
      endPoints,
      chains,
      stepMap,
      description: generateDescription(),
    }
  }, [workflow])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[560px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                <FileText size={20} className="text-indigo-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Workflow Summary</h2>
                <p className="text-[11px] text-gray-500">{workflow.name}</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-1.5 rounded-lg hover:bg-white/60 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Description */}
          <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
            <p className="text-xs text-gray-700 leading-relaxed">{analysis.description}</p>
          </div>

          {/* Stats */}
          <div className="flex gap-3">
            <div className="flex-1 p-3 bg-gray-50 rounded-xl text-center">
              <div className="text-lg font-bold text-gray-800">{workflow.steps.length}</div>
              <div className="text-[10px] text-gray-500 font-medium">Components</div>
            </div>
            <div className="flex-1 p-3 bg-gray-50 rounded-xl text-center">
              <div className="text-lg font-bold text-gray-800">{workflow.connections.length}</div>
              <div className="text-[10px] text-gray-500 font-medium">Connections</div>
            </div>
            <div className="flex-1 p-3 bg-gray-50 rounded-xl text-center">
              <div className="text-lg font-bold text-gray-800">{analysis.byCategory.size}</div>
              <div className="text-[10px] text-gray-500 font-medium">Categories</div>
            </div>
          </div>

          {/* Flow visualization */}
          {analysis.chains.length > 0 && analysis.chains.some(c => c.length > 1) && (
            <div>
              <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <GitBranch size={12} />
                Flow
              </h3>
              <div className="space-y-2">
                {analysis.chains.filter(c => c.length > 1).map((chain, i) => (
                  <div key={i} className="flex items-center gap-1.5 flex-wrap p-3 bg-gray-50 rounded-xl">
                    {chain.map((stepId, j) => {
                      const step = analysis.stepMap.get(stepId)
                      if (!step) return null
                      const config = CATEGORY_CONFIG[step.category as keyof typeof CATEGORY_CONFIG]
                      const Icon = ICON_MAP[step.iconName || config?.icon || 'Circle'] || Circle
                      return (
                        <div key={stepId} className="flex items-center gap-1.5">
                          {j > 0 && <ArrowRight size={12} className="text-gray-300 shrink-0" />}
                          <div
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium"
                            style={{
                              backgroundColor: (config?.color || '#666') + '15',
                              color: config?.color || '#666',
                            }}
                          >
                            <Icon size={11} />
                            {step.label}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Components by category */}
          <div>
            <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Layers size={12} />
              Components
            </h3>
            <div className="space-y-1.5">
              {workflow.steps.map(step => {
                const config = CATEGORY_CONFIG[step.category as keyof typeof CATEGORY_CONFIG]
                const Icon = ICON_MAP[step.iconName || config?.icon || 'Circle'] || Circle
                return (
                  <div key={step.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: (config?.color || '#666') + '15' }}
                    >
                      <Icon size={14} style={{ color: config?.color || '#666' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-800">{step.label}</span>
                        <span
                          className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: (config?.color || '#666') + '15',
                            color: config?.color || '#666',
                          }}
                        >
                          {config?.label || step.category}
                        </span>
                      </div>
                      {step.description && (
                        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{step.description}</p>
                      )}
                    </div>
                  </div>
                )
              })}

              {workflow.steps.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-xs text-gray-400">No components in this workflow</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600
                       bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmSave}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold
                       text-white bg-gradient-to-r from-indigo-500 to-purple-500
                       hover:from-indigo-600 hover:to-purple-600 shadow-md transition-all"
          >
            <Save size={13} />
            Confirm & Save
          </button>
        </div>
      </div>
    </div>
  )
}
