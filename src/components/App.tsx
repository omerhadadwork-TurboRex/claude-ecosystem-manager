import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import EcosystemGraph from './Graph/EcosystemGraph'
import DetailPanel from './DetailPanel/DetailPanel'
import ValidationPanel from './Validation/ValidationPanel'
import CreatePanel, { type CreatedEntity } from './CreatePanel/CreatePanel'
import Toolbar from './Toolbar/Toolbar'
import WorkflowBuilder from './WorkflowBuilder/WorkflowBuilder'
import VersionHistoryPanel from './VersionHistory/VersionHistoryPanel'
import { useEcosystem } from '../hooks/useEcosystem'
import { validateEcosystem } from '../lib/validation'
import { initSearch, searchNodes } from '../lib/search'
import type { EcosystemNode } from '../lib/types'
import { CATEGORY_CONFIG } from '../lib/types'
import { computeLayout } from '../lib/layout'
import {
  saveCurrentState,
  saveToHistory,
  type EcosystemSnapshot,
} from '../lib/ecosystem-store'
import {
  saveEcosystem as apiSave,
  type EntityChange,
} from '../lib/api-client'
import EcosystemOptimizerPanel from './Optimizer/EcosystemOptimizerPanel'
import ExportPanel from './ExportPanel/ExportPanel'
import {
  Network, Workflow, Layers, Wifi, WifiOff, Loader2
} from 'lucide-react'

type AppView = 'ecosystem' | 'workflow'
type SidePanel = 'detail' | 'validation' | 'create' | 'optimizer' | 'history' | 'export' | null

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('ecosystem')
  const ecosystem = useEcosystem()
  const [sidePanel, setSidePanel] = useState<SidePanel>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const initialSnapshotRef = useRef<string>('')
  const pendingChangesRef = useRef<EntityChange[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const data = ecosystem.rawData

  // Helper to queue a change for the next Save
  const queueChange = useCallback((change: EntityChange) => {
    // Remove any previous change for the same ID+action (latest wins)
    pendingChangesRef.current = [
      ...pendingChangesRef.current.filter(c => !(c.id === change.id && c.action === change.action)),
      change,
    ]
    // If we delete something we previously created (in the same session), cancel both
    if (change.action === 'delete') {
      const wasCreated = pendingChangesRef.current.find(c => c.id === change.id && c.action === 'create')
      if (wasCreated) {
        pendingChangesRef.current = pendingChangesRef.current.filter(c => c.id !== change.id)
      }
    }
    setPendingCount(pendingChangesRef.current.length)
  }, [])

  // Validation
  const validationIssues = useMemo(() => validateEcosystem(data), [data])

  // Initialize search
  useMemo(() => initSearch(data.nodes), [data.nodes])

  // Handlers
  const handleNodeClick = useCallback((nodeId: string) => {
    if (!nodeId) {
      ecosystem.setSelectedNodeId(null)
      if (sidePanel === 'detail') setSidePanel(null)
      return
    }
    ecosystem.setSelectedNodeId(nodeId)
    setSidePanel('detail')
  }, [ecosystem, sidePanel])

  const handleShowValidation = useCallback(() => {
    setSidePanel(prev => prev === 'validation' ? null : 'validation')
  }, [])

  const handleShowCreate = useCallback(() => {
    setSidePanel(prev => prev === 'create' ? null : 'create')
  }, [])

  const handleShowOptimizer = useCallback(() => {
    setSidePanel(prev => prev === 'optimizer' ? null : 'optimizer')
  }, [])

  const handleShowHistory = useCallback(() => {
    setSidePanel(prev => prev === 'history' ? null : 'history')
  }, [])

  const handleShowExport = useCallback(() => {
    setSidePanel(prev => prev === 'export' ? null : 'export')
  }, [])

  const handleSync = useCallback(async () => {
    if (ecosystem.isLive) {
      // Server is running — use API to refresh
      await ecosystem.refresh()
    } else {
      alert(
        'Server not running. To sync from your system:\n\n' +
        '1. Run: npm run dev:server\n' +
        '2. Refresh this page\n\n' +
        'Or run: npm run extract\n' +
        'to update the static data.'
      )
    }
  }, [ecosystem])

  // Track unsaved changes
  useEffect(() => {
    const currentSnap = JSON.stringify({
      nodeIds: ecosystem.nodes.map(n => n.id).sort(),
      edgeIds: ecosystem.edges.map(e => e.id).sort(),
      nodeData: ecosystem.nodes.map(n => ({ id: n.id, cat: (n.data as Record<string, unknown>).category, pos: n.position })),
    })
    if (!initialSnapshotRef.current) {
      initialSnapshotRef.current = currentSnap
      return
    }
    setHasUnsavedChanges(currentSnap !== initialSnapshotRef.current)
  }, [ecosystem.nodes, ecosystem.edges])

  const handleSave = useCallback(async () => {
    setIsSaving(true)

    // Always save to localStorage (works offline)
    saveCurrentState(ecosystem.nodes, ecosystem.edges)
    saveToHistory(ecosystem.nodes, ecosystem.edges)

    // If server is live, flush pending changes to disk
    if (ecosystem.isLive && pendingChangesRef.current.length > 0) {
      const changes = [...pendingChangesRef.current]
      try {
        const result = await apiSave(changes)
        console.log(`Saved ${changes.length} changes to disk:`, result)
        pendingChangesRef.current = []
        setPendingCount(0)
      } catch (err) {
        console.error('API save failed:', err)
        alert(
          `Failed to save ${changes.length} changes to disk.\n` +
          `Changes are saved locally but NOT written to files.\n\n` +
          `Error: ${(err as Error).message}`
        )
      }
    } else if (ecosystem.isLive) {
      // No pending changes — just acknowledge
      console.log('No pending changes to write to disk')
    }

    setHasUnsavedChanges(false)
    initialSnapshotRef.current = JSON.stringify({
      nodeIds: ecosystem.nodes.map(n => n.id).sort(),
      edgeIds: ecosystem.edges.map(e => e.id).sort(),
      nodeData: ecosystem.nodes.map(n => ({ id: n.id, cat: (n.data as Record<string, unknown>).category, pos: n.position })),
    })
    setTimeout(() => setIsSaving(false), 1500)
  }, [ecosystem.nodes, ecosystem.edges, ecosystem.isLive])

  const handleRestore = useCallback((snapshot: EcosystemSnapshot) => {
    ecosystem.setNodes(snapshot.nodes)
    ecosystem.setEdges(snapshot.edges)
    setSidePanel(null)
    initialSnapshotRef.current = JSON.stringify({
      nodeIds: snapshot.nodes.map(n => n.id).sort(),
      edgeIds: snapshot.edges.map(e => e.id).sort(),
      nodeData: snapshot.nodes.map(n => ({ id: n.id, cat: (n.data as Record<string, unknown>).category, pos: n.position })),
    })
    setHasUnsavedChanges(false)
  }, [ecosystem])

  const handleAutoLayout = useCallback(() => {
    const laid = computeLayout(ecosystem.nodes, ecosystem.edges, 'LR')
    ecosystem.setNodes(laid)
  }, [ecosystem])

  const handleClosePanel = useCallback(() => {
    setSidePanel(null)
    ecosystem.setSelectedNodeId(null)
  }, [ecosystem])

  const handleEntityCreated = useCallback(async (entity: CreatedEntity) => {
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

    // Queue create for next Save
    queueChange({
      action: 'create',
      id: newNode.id,
      label: newNode.label,
      category: newNode.category,
      description: newNode.description,
      metadata: newNode.metadata,
    })

    const newFlowNode = {
      id: newNode.id,
      type: 'ecosystem' as const,
      position: { x: 100, y: 100 },
      data: {
        label: newNode.label,
        category: newNode.category,
        description: newNode.description,
        filePath: newNode.filePath,
        metadata: newNode.metadata,
        color: categoryConfig?.color || '#666',
        iconName: categoryConfig?.icon || 'Circle',
        categoryLabel: categoryConfig?.label || newNode.category,
      },
      draggable: true,
      selected: true,
    }

    ecosystem.setNodes(prev => [...prev, newFlowNode])
    ecosystem.setSelectedNodeId(newNode.id)
    setSidePanel('detail')
  }, [ecosystem])

  // Update node (label, description)
  const handleUpdateNode = useCallback((nodeId: string, updates: { label?: string; description?: string }) => {
    // Update the React Flow node data
    ecosystem.setNodes(prev => prev.map(n =>
      n.id === nodeId
        ? {
            ...n,
            data: {
              ...n.data,
              ...(updates.label ? { label: updates.label } : {}),
              ...(updates.description !== undefined ? { description: updates.description } : {}),
            },
          }
        : n
    ))

    // Queue update for next Save
    queueChange({
      action: 'update',
      id: nodeId,
      ...updates,
    })
  }, [ecosystem, queueChange])

  // Category change handler
  const handleCategoryChange = useCallback((nodeId: string, newCategory: string, newColor: string, newIcon: string) => {
    const categoryConfig = CATEGORY_CONFIG[newCategory as keyof typeof CATEGORY_CONFIG]
    ecosystem.setNodes(prev => prev.map(n =>
      n.id === nodeId
        ? {
            ...n,
            data: {
              ...n.data,
              category: newCategory,
              color: newColor,
              iconName: newIcon,
              categoryLabel: categoryConfig?.label || newCategory,
              onCategoryChange: handleCategoryChange,
            },
          }
        : n
    ))

    // Queue update for next Save
    queueChange({
      action: 'update',
      id: nodeId,
      category: newCategory,
    })
  }, [ecosystem, queueChange])

  // Delete node handler
  const handleDeleteNode = useCallback((nodeId: string) => {
    ecosystem.setNodes(prev => prev.filter(n => n.id !== nodeId))
    ecosystem.setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId))
    if (ecosystem.selectedNodeId === nodeId) {
      ecosystem.setSelectedNodeId(null)
      setSidePanel(null)
    }

    // Queue delete for next Save
    queueChange({
      action: 'delete',
      id: nodeId,
    })
  }, [ecosystem, queueChange])

  // Search highlighting
  const displayNodes = useMemo(() => {
    const baseNodes = ecosystem.nodes.map(n => ({
      ...n,
      data: { ...n.data, onCategoryChange: handleCategoryChange, onDelete: handleDeleteNode },
    }))
    if (!ecosystem.searchQuery.trim()) return baseNodes
    const matchIds = new Set(searchNodes(ecosystem.searchQuery))
    return baseNodes.map(n => ({
      ...n,
      style: {
        ...n.style,
        opacity: matchIds.has(n.id) ? 1 : 0.2,
        transition: 'opacity 0.2s ease',
      },
    }))
  }, [ecosystem.nodes, ecosystem.searchQuery, handleCategoryChange])

  // Loading state
  if (ecosystem.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-purple-500" />
          <p className="text-sm text-gray-500">Loading ecosystem...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* ── Global Navigation Tabs ─────────────────────────────── */}
      <div className="flex items-center bg-white border-b border-gray-200 px-4">
        {/* Logo */}
        <div className="flex items-center gap-2 pr-4 py-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">CE</span>
          </div>
        </div>

        {/* View tabs */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setActiveView('ecosystem')}
            className={`
              flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2
              ${activeView === 'ecosystem'
                ? 'text-purple-600 border-purple-500 bg-purple-50/50'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
              }
            `}
          >
            <Network size={14} />
            Ecosystem Map
          </button>
          <button
            onClick={() => setActiveView('workflow')}
            className={`
              flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2
              ${activeView === 'workflow'
                ? 'text-indigo-600 border-indigo-500 bg-indigo-50/50'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
              }
            `}
          >
            <Workflow size={14} />
            Workflow Builder
          </button>
        </div>

        {/* Right side info */}
        <div className="ml-auto flex items-center gap-3 text-[10px] text-gray-400">
          {/* Live/Offline indicator */}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${
            ecosystem.isLive
              ? 'bg-green-50 text-green-600'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {ecosystem.isLive ? <Wifi size={10} /> : <WifiOff size={10} />}
            <span className="font-medium">{ecosystem.isLive ? 'Live' : 'Offline'}</span>
          </div>
          <Layers size={10} />
          <span>{data.nodes.length} entities</span>
          <span>·</span>
          <span>{data.edges.length} connections</span>
        </div>
      </div>

      {/* ── View Content ───────────────────────────────────────── */}
      {activeView === 'ecosystem' ? (
        <ReactFlowProvider>
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Toolbar */}
            <Toolbar
              filters={ecosystem.filters}
              onToggleFilter={ecosystem.toggleFilter}
              searchQuery={ecosystem.searchQuery}
              onSearchChange={ecosystem.setSearchQuery}
              validationIssues={validationIssues}
              onShowValidation={handleShowValidation}
              onAutoLayout={handleAutoLayout}
              onShowCreate={handleShowCreate}
              onShowOptimizer={handleShowOptimizer}
              onSave={handleSave}
              onShowHistory={handleShowHistory}
              onShowExport={handleShowExport}
              isSaving={isSaving}
              hasUnsavedChanges={hasUnsavedChanges}
              pendingCount={pendingCount}
              isLive={ecosystem.isLive}
            />

            {/* Main area */}
            <div className="flex flex-1 overflow-hidden">
              {/* Graph canvas */}
              <div className="flex-1 relative">
                <EcosystemGraph
                  initialNodes={displayNodes}
                  initialEdges={ecosystem.edges}
                  onNodeClick={handleNodeClick}
                />

                {/* Status bar */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-sm border border-gray-200 flex items-center gap-3 text-[10px] text-gray-500">
                  <span>{ecosystem.nodes.length} nodes</span>
                  <span className="text-gray-300">|</span>
                  <span>{ecosystem.edges.length} connections</span>
                  <span className="text-gray-300">|</span>
                  <span>Drag handles to connect • Click node for details</span>
                </div>
              </div>

              {/* Side panels */}
              {sidePanel === 'detail' && (
                <DetailPanel
                  node={ecosystem.selectedNode}
                  allEdges={data.edges}
                  allNodes={data.nodes}
                  onClose={handleClosePanel}
                  onCategoryChange={handleCategoryChange}
                  onDeleteNode={handleDeleteNode}
                  onUpdateNode={handleUpdateNode}
                />
              )}
              {sidePanel === 'validation' && (
                <ValidationPanel
                  issues={validationIssues}
                  allNodes={data.nodes}
                  onClose={handleClosePanel}
                  onSelectNode={(nodeId) => {
                    ecosystem.setSelectedNodeId(nodeId)
                    setSidePanel('detail')
                  }}
                />
              )}
              {sidePanel === 'create' && (
                <CreatePanel
                  onClose={handleClosePanel}
                  onCreated={handleEntityCreated}
                />
              )}
              {sidePanel === 'optimizer' && (
                <EcosystemOptimizerPanel
                  ecosystemData={data}
                  validationIssues={validationIssues}
                  onClose={handleClosePanel}
                  onSelectNode={(nodeId) => {
                    ecosystem.setSelectedNodeId(nodeId)
                    setSidePanel('detail')
                  }}
                />
              )}
              {sidePanel === 'history' && (
                <VersionHistoryPanel
                  onClose={handleClosePanel}
                  onRestore={handleRestore}
                />
              )}
              {sidePanel === 'export' && (
                <ExportPanel
                  nodes={ecosystem.nodes}
                  edges={ecosystem.edges}
                  onClose={handleClosePanel}
                  onSync={handleSync}
                />
              )}
            </div>
          </div>
        </ReactFlowProvider>
      ) : (
        <div className="flex-1 overflow-hidden">
          <WorkflowBuilder
            allNodes={data.nodes}
            ecosystemData={data}
          />
        </div>
      )}
    </div>
  )
}
