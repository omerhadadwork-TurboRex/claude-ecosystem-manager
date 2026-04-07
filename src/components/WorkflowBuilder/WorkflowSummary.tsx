import { useState, useMemo } from 'react'
import type { Workflow } from '../../lib/workflow-types'
import type { EcosystemNode, EcosystemEdge } from '../../lib/types'
import { CATEGORY_CONFIG } from '../../lib/types'
import {
  Bot, Puzzle, Cloud, FolderOpen, Plug, Zap, Clock, Rocket, Store, Circle,
  X, Save, ChevronRight, Plus, Sparkles, Check
} from 'lucide-react'

const ICON_MAP: Record<string, React.ElementType> = {
  Bot, Puzzle, Cloud, FolderOpen, Plug, Zap, Clock, Rocket, Store, Circle,
}

interface WorkflowSummaryProps {
  workflow: Workflow
  allNodes: EcosystemNode[]
  allEdges: EcosystemEdge[]
  onConfirmSave: (addedSteps: SuggestedSkill[]) => void
  onCancel: () => void
}

interface SuggestedSkill {
  node: EcosystemNode
  reason: string
}

// ── Keyword matching for smart suggestions ─────────────────
const KEYWORD_MAP: Record<string, string[]> = {
  debug:       ['systematic-debugging'],
  test:        ['test-driven-development', 'verification-before-completion'],
  verify:      ['verification-before-completion'],
  review:      ['requesting-code-review', 'receiving-code-review'],
  plan:        ['writing-plans', 'brainstorming'],
  deploy:      ['finishing-a-development-branch'],
  build:       ['executing-plans', 'subagent-driven-development'],
  implement:   ['executing-plans', 'subagent-driven-development'],
  worktree:    ['using-git-worktrees'],
  parallel:    ['dispatching-parallel-agents'],
  automat:     ['n8n-orchestrator'],
  workflow:    ['n8n-orchestrator'],
  n8n:         ['n8n-orchestrator'],
  skill:       ['writing-skills'],
  branch:      ['using-git-worktrees', 'finishing-a-development-branch'],
  code:        ['requesting-code-review'],
}

export default function WorkflowSummary({ workflow, allNodes, allEdges, onConfirmSave, onCancel }: WorkflowSummaryProps) {
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set())

  // ── Analyze the workflow ──────────────────────────────────
  const analysis = useMemo(() => {
    const steps = workflow.steps
    const connections = workflow.connections
    const stepMap = new Map(steps.map(s => [s.id, s]))
    const existingEntityIds = new Set(steps.map(s => s.entityId))

    // Build adjacency
    const targetsSet = new Set(connections.map(c => c.targetStepId))
    const adjacency = new Map<string, string[]>()
    for (const conn of connections) {
      if (!adjacency.has(conn.sourceStepId)) adjacency.set(conn.sourceStepId, [])
      adjacency.get(conn.sourceStepId)!.push(conn.targetStepId)
    }

    // Find entry points (no incoming)
    const entryPoints = steps.filter(s => !targetsSet.has(s.id))

    // Build ordered step list following flow
    const orderedSteps: typeof steps = []
    const visited = new Set<string>()

    function walk(stepId: string) {
      if (visited.has(stepId)) return
      visited.add(stepId)
      const step = stepMap.get(stepId)
      if (step) orderedSteps.push(step)
      for (const nextId of adjacency.get(stepId) || []) {
        walk(nextId)
      }
    }

    for (const entry of entryPoints) walk(entry.id)
    // Catch disconnected
    for (const step of steps) {
      if (!visited.has(step.id)) orderedSteps.push(step)
    }

    // ── Generate step explanations ────────────────────────
    const stepExplanations = orderedSteps.map((step, i) => {
      const incomingConns = connections.filter(c => c.targetStepId === step.id)
      const outgoingConns = connections.filter(c => c.sourceStepId === step.id)
      const sources = incomingConns.map(c => stepMap.get(c.sourceStepId)?.label).filter(Boolean)
      const targets = outgoingConns.map(c => stepMap.get(c.targetStepId)?.label).filter(Boolean)

      let explanation = step.description || ''

      // Add flow context
      if (sources.length > 0 && targets.length > 0) {
        explanation += explanation ? ' ' : ''
        explanation += `Receives input from ${sources.join(', ')} and passes output to ${targets.join(', ')}.`
      } else if (sources.length > 0) {
        explanation += explanation ? ' ' : ''
        explanation += `Receives input from ${sources.join(', ')}.`
      } else if (targets.length > 0 && i === 0) {
        explanation += explanation ? ' ' : ''
        explanation += `Entry point — passes output to ${targets.join(', ')}.`
      }

      if (outgoingConns.length === 0 && connections.length > 0 && i === orderedSteps.length - 1) {
        explanation += explanation ? ' ' : ''
        explanation += 'This is the final step in the flow.'
      }

      return { step, index: i + 1, explanation }
    })

    // ── Smart suggestions ─────────────────────────────────
    // 1. From keyword matching on all step descriptions
    const allText = steps.map(s => `${s.label} ${s.description}`).join(' ').toLowerCase()
    const suggestedLabels = new Set<string>()
    for (const [keyword, skillNames] of Object.entries(KEYWORD_MAP)) {
      if (allText.includes(keyword)) {
        for (const name of skillNames) suggestedLabels.add(name)
      }
    }

    // 2. From edges — skills that agents/skills in the workflow reference
    for (const step of steps) {
      const relatedEdges = allEdges.filter(e => e.source === step.entityId || e.target === step.entityId)
      for (const edge of relatedEdges) {
        const relatedId = edge.source === step.entityId ? edge.target : edge.source
        const relatedNode = allNodes.find(n => n.id === relatedId)
        if (relatedNode && !existingEntityIds.has(relatedNode.id)) {
          suggestedLabels.add(relatedNode.label)
        }
      }
    }

    const suggestions: SuggestedSkill[] = []
    for (const label of suggestedLabels) {
      const node = allNodes.find(n => n.label === label || n.id === `skill:${label}`)
      if (!node) continue
      if (existingEntityIds.has(node.id)) continue // Already in workflow

      // Generate reason
      let reason = ''
      // Check if it's referenced by an agent in the workflow
      const referencedBy = steps.find(s => {
        return allEdges.some(e =>
          (e.source === s.entityId && e.target === node.id) ||
          (e.target === s.entityId && e.source === node.id)
        )
      })
      if (referencedBy) {
        reason = `Used by "${referencedBy.label}" in your ecosystem`
      } else {
        // Keyword match reason
        for (const [keyword, skillNames] of Object.entries(KEYWORD_MAP)) {
          if (skillNames.includes(label) && allText.includes(keyword)) {
            reason = `Recommended based on "${keyword}" in your workflow`
            break
          }
        }
      }
      if (!reason) reason = 'May complement this workflow'

      suggestions.push({ node, reason })
    }

    // ── One-line overview ─────────────────────────────────
    const overview = (() => {
      if (steps.length === 0) return 'This workflow is empty. Add components to get started.'
      const entryLabels = entryPoints.map(e => e.label)
      const categoryLabels = [...new Set(steps.map(s => {
        const cfg = CATEGORY_CONFIG[s.category as keyof typeof CATEGORY_CONFIG]
        return cfg?.label || s.category
      }))]
      return `Workflow with ${steps.length} step${steps.length > 1 ? 's' : ''} (${categoryLabels.join(', ')})` +
        (entryLabels.length > 0 ? `, starting from "${entryLabels[0]}"` : '') + '.'
    })()

    return { stepExplanations, suggestions, overview }
  }, [workflow, allNodes, allEdges])

  const toggleSuggestion = (nodeId: string) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const handleConfirm = () => {
    const added = analysis.suggestions.filter(s => selectedSuggestions.has(s.node.id))
    onConfirmSave(added)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
         onClick={onCancel}>
      <div
        className="w-[520px] max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden
                   border border-gray-200/60"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[13px] font-bold text-gray-900">{workflow.name}</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">{analysis.overview}</p>
            </div>
            <button
              onClick={onCancel}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Steps */}
          <div className="px-5 py-4">
            <div className="space-y-0">
              {analysis.stepExplanations.map(({ step, index, explanation }, i) => {
                const config = CATEGORY_CONFIG[step.category as keyof typeof CATEGORY_CONFIG]
                const Icon = ICON_MAP[step.iconName || config?.icon || 'Circle'] || Circle
                const isLast = i === analysis.stepExplanations.length - 1

                return (
                  <div key={step.id} className="flex gap-3">
                    {/* Timeline */}
                    <div className="flex flex-col items-center">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: (config?.color || '#666') + '15' }}
                      >
                        <Icon size={13} style={{ color: config?.color || '#666' }} />
                      </div>
                      {!isLast && (
                        <div className="w-px flex-1 min-h-[16px] bg-gray-200 my-1" />
                      )}
                    </div>

                    {/* Content */}
                    <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-4'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400">STEP {index}</span>
                        <span className="text-xs font-semibold text-gray-900">{step.label}</span>
                        <span
                          className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: (config?.color || '#666') + '12',
                            color: config?.color || '#666',
                          }}
                        >
                          {config?.label || step.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed mt-1">{explanation}</p>
                    </div>
                  </div>
                )
              })}

              {workflow.steps.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">
                  No steps in this workflow yet.
                </p>
              )}
            </div>
          </div>

          {/* ── Suggestions ───────────────────────────────── */}
          {analysis.suggestions.length > 0 && (
            <div className="px-5 py-4 border-t border-gray-100 bg-amber-50/30">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={13} className="text-amber-500" />
                <span className="text-[11px] font-bold text-gray-700">Recommended additions</span>
                <span className="text-[10px] text-gray-400">Based on your workflow</span>
              </div>

              <div className="space-y-1.5">
                {analysis.suggestions.map(({ node, reason }) => {
                  const config = CATEGORY_CONFIG[node.category]
                  const Icon = ICON_MAP[config?.icon || 'Circle'] || Circle
                  const isSelected = selectedSuggestions.has(node.id)

                  return (
                    <button
                      key={node.id}
                      onClick={() => toggleSuggestion(node.id)}
                      className={`
                        w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all cursor-pointer
                        ${isSelected
                          ? 'bg-white ring-2 ring-indigo-300 shadow-sm'
                          : 'bg-white/60 hover:bg-white hover:shadow-sm'
                        }
                      `}
                    >
                      {/* Checkbox */}
                      <div className={`
                        w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all
                        ${isSelected
                          ? 'bg-indigo-500 border-indigo-500'
                          : 'border-gray-300'
                        }
                      `}>
                        {isSelected && <Check size={10} className="text-white" />}
                      </div>

                      {/* Icon */}
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                        style={{ backgroundColor: (config?.color || '#666') + '15' }}
                      >
                        <Icon size={11} style={{ color: config?.color || '#666' }} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold text-gray-800">{node.label}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{reason}</div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {selectedSuggestions.size > 0 && (
                <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-indigo-600 font-medium">
                  <Plus size={10} />
                  {selectedSuggestions.size} skill{selectedSuggestions.size > 1 ? 's' : ''} will be added to the workflow
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        <div className="px-5 py-3.5 border-t border-gray-100 flex items-center gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-xl text-[11px] font-semibold text-gray-600
                       bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-semibold
                       text-white bg-indigo-500 hover:bg-indigo-600 shadow-sm transition-all"
          >
            <Save size={12} />
            Save Workflow
          </button>
        </div>
      </div>
    </div>
  )
}
