import { useState, useCallback } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import type { EcosystemNode, EcosystemData } from '../../lib/types'
import { CATEGORY_CONFIG } from '../../lib/types'
import type { Workflow, DragItem } from '../../lib/workflow-types'
import {
  loadWorkflows, saveWorkflow, deleteWorkflow, createEmptyWorkflow
} from '../../lib/workflow-store'
import ComponentLibrary from './ComponentLibrary'
import WorkflowCanvas from './WorkflowCanvas'
import WorkflowToolbar from './WorkflowToolbar'
import WorkflowList from './WorkflowList'
import OptimizerPanel from './OptimizerPanel'
import WorkflowSummary from './WorkflowSummary'
import CreatePanel, { type CreatedEntity } from '../CreatePanel/CreatePanel'
import { Layers, PanelLeftOpen, PanelLeftClose } from 'lucide-react'

interface WorkflowBuilderProps {
  allNodes: EcosystemNode[]
  ecosystemData: EcosystemData
}

export default function WorkflowBuilder({ allNodes, ecosystemData }: WorkflowBuilderProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>(loadWorkflows)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showOptimizer, setShowOptimizer] = useState(false)
  const [isSaved, setIsSaved] = useState(true)
  const [showLeftPanel, setShowLeftPanel] = useState<'library' | 'workflows'>('library')
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [showCreatePanel, setShowCreatePanel] = useState(false)
  const [showSummary, setShowSummary] = useState(false)

  const activeWorkflow = workflows.find(w => w.id === activeId) || null

  const handleCreateNew = useCallback(() => {
    const wf = createEmptyWorkflow()
    setWorkflows(prev => [...prev, wf])
    saveWorkflow(wf)
    setActiveId(wf.id)
    setIsSaved(true)
  }, [])

  const handleSelectWorkflow = useCallback((id: string) => {
    setActiveId(id)
    setShowOptimizer(false)
  }, [])

  const handleDeleteWorkflow = useCallback((id: string) => {
    deleteWorkflow(id)
    setWorkflows(prev => prev.filter(w => w.id !== id))
    if (activeId === id) setActiveId(null)
  }, [activeId])

  const handleWorkflowChange = useCallback((updated: Workflow) => {
    setWorkflows(prev => prev.map(w => w.id === updated.id ? updated : w))
    setIsSaved(false)
  }, [])

  const handleSave = useCallback(() => {
    if (activeWorkflow) {
      // Show summary before saving
      setShowSummary(true)
    }
  }, [activeWorkflow])

  const handleConfirmSave = useCallback((addedSteps: { node: { id: string; label: string; category: string; description: string }; reason: string }[]) => {
    if (!activeWorkflow) return

    let wf = activeWorkflow

    // Add any selected suggestions to the workflow
    if (addedSteps.length > 0) {
      const newSteps = addedSteps.map((s, i) => {
        const config = CATEGORY_CONFIG[s.node.category as keyof typeof CATEGORY_CONFIG]
        return {
          id: `step-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
          entityId: s.node.id,
          label: s.node.label,
          category: s.node.category,
          description: s.node.description,
          color: config?.color || '#666',
          iconName: config?.icon || 'Circle',
          config: { _position: { x: 100 + (wf.steps.length + i) * 260, y: 150 } },
        }
      })
      wf = { ...wf, steps: [...wf.steps, ...newSteps] }
      setWorkflows(prev => prev.map(w => w.id === wf.id ? wf : w))
    }

    saveWorkflow(wf)
    setIsSaved(true)
    setShowSummary(false)
  }, [activeWorkflow])

  const handleDragStart = useCallback((_item: DragItem) => {
    // Could add visual feedback here
  }, [])

  const handleQuickAdd = useCallback((item: DragItem) => {
    if (!activeWorkflow) {
      // Auto-create a new workflow
      const wf = createEmptyWorkflow()
      const step = {
        id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        entityId: item.entityId,
        label: item.label,
        category: item.category,
        description: item.description,
        color: item.color,
        iconName: item.iconName,
        config: { _position: { x: 200, y: 150 } },
      }
      wf.steps.push(step)
      setWorkflows(prev => [...prev, wf])
      saveWorkflow(wf)
      setActiveId(wf.id)
      setIsSaved(true)
      return
    }

    const step = {
      id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      entityId: item.entityId,
      label: item.label,
      category: item.category,
      description: item.description,
      color: item.color,
      iconName: item.iconName,
      config: { _position: { x: 100 + activeWorkflow.steps.length * 260, y: 150 } },
    }

    handleWorkflowChange({
      ...activeWorkflow,
      steps: [...activeWorkflow.steps, step],
    })
  }, [activeWorkflow, handleWorkflowChange])

  // When a new entity is created via the Create panel, add it to the library & optionally to the canvas
  const handleEntityCreated = useCallback((entity: CreatedEntity) => {
    const categoryConfig = CATEGORY_CONFIG[entity.type]
    const newNode: EcosystemNode = {
      id: `${entity.type === 'skill-local' ? 'skill' : entity.type === 'skill-project' ? 'project' : entity.type}:${entity.name}`,
      label: entity.name,
      category: entity.type,
      description: entity.description,
      filePath: entity.type === 'agent'
        ? `~/.claude/agents/${entity.name}/SKILL.md`
        : entity.type === 'skill-local'
        ? `~/.claude/skills/${entity.name}/SKILL.md`
        : entity.type === 'skill-project'
        ? `~/Projects/${entity.config.project || 'unknown'}/.claude/skills/${entity.name}/SKILL.md`
        : entity.type === 'hook'
        ? `~/.claude/settings.json`
        : `~/.claude/scheduled-tasks/${entity.name}/SKILL.md`,
      metadata: entity.config,
    }

    // Also quick-add to canvas if we have an active workflow
    if (activeWorkflow) {
      handleQuickAdd({
        entityId: newNode.id,
        label: newNode.label,
        category: newNode.category,
        description: newNode.description,
        color: categoryConfig?.color || '#666',
        iconName: categoryConfig?.icon || 'Circle',
      })
    }

    setShowCreatePanel(false)
  }, [activeWorkflow, handleQuickAdd])

  const handleDeploy = useCallback(() => {
    if (activeWorkflow) {
      saveWorkflow(activeWorkflow)
      setIsSaved(true)
      // TODO: actual deploy logic
      alert(`✅ Workflow "${activeWorkflow.name}" deployed successfully!`)
    }
  }, [activeWorkflow])

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Workflow toolbar (only when active) */}
        {activeWorkflow && (
          <WorkflowToolbar
            workflow={activeWorkflow}
            onWorkflowChange={handleWorkflowChange}
            onSave={handleSave}
            onOptimize={() => setShowOptimizer(v => !v)}
            onShowCreate={() => setShowCreatePanel(v => !v)}
            isSaved={isSaved}
          />
        )}

        {/* Main area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel toggle strip */}
          <div className="flex flex-col bg-white border-r border-gray-200">
            {/* Panel toggle buttons */}
            <div className="flex flex-col items-center gap-1 p-1.5 border-b border-gray-100">
              <button
                onClick={() => setLeftCollapsed(v => !v)}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                title={leftCollapsed ? 'Expand panel' : 'Collapse panel'}
              >
                {leftCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
              </button>
            </div>
            {/* Tab buttons */}
            <button
              onClick={() => { setShowLeftPanel('library'); setLeftCollapsed(false) }}
              className={`p-2 transition-colors ${showLeftPanel === 'library' && !leftCollapsed ? 'text-indigo-500 bg-indigo-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
              title="Component Library"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
            <button
              onClick={() => { setShowLeftPanel('workflows'); setLeftCollapsed(false) }}
              className={`p-2 transition-colors ${showLeftPanel === 'workflows' && !leftCollapsed ? 'text-indigo-500 bg-indigo-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
              title="Saved Workflows"
            >
              <Layers size={16} />
            </button>
          </div>

          {/* Left panel content */}
          {!leftCollapsed && (
            <>
              {showLeftPanel === 'library' && (
                <ComponentLibrary
                  allNodes={allNodes}
                  onDragStart={handleDragStart}
                  onQuickAdd={handleQuickAdd}
                />
              )}
              {showLeftPanel === 'workflows' && (
                <div className="w-64 h-full bg-white border-r border-gray-200 flex flex-col overflow-hidden">
                  <div className="px-3 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center gap-2">
                      <Layers size={14} className="text-indigo-500" />
                      <span className="text-xs font-bold text-gray-800">WORKFLOWS</span>
                      <span className="ml-auto text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                        {workflows.length}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                    <WorkflowList
                      workflows={workflows}
                      activeId={activeId}
                      onSelect={handleSelectWorkflow}
                      onCreateNew={handleCreateNew}
                      onDelete={handleDeleteWorkflow}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Canvas area */}
          <div className="flex-1 relative">
            {activeWorkflow ? (
              <WorkflowCanvas
                workflow={activeWorkflow}
                onWorkflowChange={handleWorkflowChange}
              />
            ) : (
              <div className="h-full flex items-center justify-center bg-[#fafbfe]">
                <div className="text-center max-w-sm">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center mx-auto mb-5">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round">
                      <rect x="3" y="3" width="7" height="7" rx="1.5" />
                      <rect x="14" y="3" width="7" height="7" rx="1.5" />
                      <rect x="8.5" y="14" width="7" height="7" rx="1.5" />
                      <line x1="6.5" y1="10" x2="6.5" y2="12" />
                      <line x1="6.5" y1="12" x2="12" y2="14" />
                      <line x1="17.5" y1="10" x2="17.5" y2="12" />
                      <line x1="17.5" y1="12" x2="12" y2="14" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-gray-800">Workflow Builder</h2>
                  <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                    Build custom workflows by combining your agents, skills, and plugins.
                    Validate with the optimizer before deploying.
                  </p>
                  <button
                    onClick={handleCreateNew}
                    className="mt-5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
                             bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600
                             shadow-md hover:shadow-lg transition-all"
                  >
                    Create First Workflow
                  </button>
                  <p className="text-[10px] text-gray-400 mt-3">
                    Or select an existing workflow from the left panel
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Create panel */}
          {showCreatePanel && (
            <CreatePanel
              onClose={() => setShowCreatePanel(false)}
              onCreated={handleEntityCreated}
            />
          )}

          {/* Optimizer panel */}
          {showOptimizer && activeWorkflow && (
            <OptimizerPanel
              workflow={activeWorkflow}
              ecosystemData={ecosystemData}
              onClose={() => setShowOptimizer(false)}
              onDeploy={handleDeploy}
              onWorkflowChange={handleWorkflowChange}
            />
          )}
        </div>

        {/* Summary modal before save */}
        {showSummary && activeWorkflow && (
          <WorkflowSummary
            workflow={activeWorkflow}
            allNodes={allNodes}
            allEdges={ecosystemData.edges}
            onConfirmSave={handleConfirmSave}
            onCancel={() => setShowSummary(false)}
          />
        )}
      </div>
    </ReactFlowProvider>
  )
}
