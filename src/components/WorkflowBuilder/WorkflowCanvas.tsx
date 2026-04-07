import { useCallback, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge as rfAddEdge,
  type Connection,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import WorkflowNodeComponent from './WorkflowNode'
import WorkflowEdgeComponent from './WorkflowEdge'
import type { Workflow, DragItem } from '../../lib/workflow-types'

const nodeTypes: NodeTypes = {
  'workflow-step': WorkflowNodeComponent,
}

const edgeTypes: EdgeTypes = {
  'workflow-edge': WorkflowEdgeComponent,
}

interface WorkflowCanvasProps {
  workflow: Workflow
  onWorkflowChange: (workflow: Workflow) => void
}

export default function WorkflowCanvas({ workflow, onWorkflowChange }: WorkflowCanvasProps) {
  // Delete a step and its connections
  const handleDeleteStep = useCallback((stepId: string) => {
    onWorkflowChange({
      ...workflow,
      steps: workflow.steps.filter(s => s.id !== stepId),
      connections: workflow.connections.filter(
        c => c.sourceStepId !== stepId && c.targetStepId !== stepId
      ),
    })
  }, [workflow, onWorkflowChange])

  // Change category of a step
  const handleChangeCategory = useCallback((stepId: string, newCategory: string, newColor: string, newIcon: string) => {
    onWorkflowChange({
      ...workflow,
      steps: workflow.steps.map(s =>
        s.id === stepId
          ? { ...s, category: newCategory, color: newColor, iconName: newIcon }
          : s
      ),
    })
  }, [workflow, onWorkflowChange])

  // Convert workflow steps → React Flow nodes
  const initialNodes: Node[] = useMemo(() =>
    workflow.steps.map((step, i) => ({
      id: step.id,
      type: 'workflow-step',
      position: step.config._position as { x: number; y: number } || { x: 100 + (i % 4) * 260, y: 80 + Math.floor(i / 4) * 160 },
      data: {
        label: step.label,
        category: step.category,
        description: step.description,
        color: step.color,
        iconName: step.iconName,
        stepIndex: i,
        onDelete: handleDeleteStep,
        onChangeCategory: handleChangeCategory,
      },
      draggable: true,
    })),
    [workflow.steps, handleDeleteStep, handleChangeCategory]
  )

  const initialEdges: Edge[] = useMemo(() =>
    workflow.connections.map(conn => ({
      id: conn.id,
      source: conn.sourceStepId,
      target: conn.targetStepId,
      type: 'workflow-edge',
      label: conn.label || conn.relation,
      style: { stroke: '#6366f1', strokeWidth: 2 },
    })),
    [workflow.connections]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Sync back
  useEffect(() => { setNodes(initialNodes) }, [initialNodes, setNodes])
  useEffect(() => { setEdges(initialEdges) }, [initialEdges, setEdges])

  // New connection
  const onConnect = useCallback((params: Connection) => {
    setEdges(eds => rfAddEdge({
      ...params,
      id: `wc-${Date.now()}`,
      type: 'workflow-edge',
      label: 'invokes',
      style: { stroke: '#6366f1', strokeWidth: 2 },
    }, eds))

    // Persist connection
    const newConn = {
      id: `wc-${Date.now()}`,
      sourceStepId: params.source!,
      targetStepId: params.target!,
      relation: 'invokes',
      label: 'invokes',
    }
    onWorkflowChange({
      ...workflow,
      connections: [...workflow.connections, newConn],
    })
  }, [workflow, onWorkflowChange, setEdges])

  // Handle drag-drop from component library
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData('application/workflow-item')
    if (!raw) return

    const item: DragItem = JSON.parse(raw)
    const bounds = (e.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect()
    if (!bounds) return

    const position = {
      x: e.clientX - bounds.left - 100,
      y: e.clientY - bounds.top - 40,
    }

    const stepId = `step-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
    const newStep = {
      id: stepId,
      entityId: item.entityId,
      label: item.label,
      category: item.category,
      description: item.description,
      color: item.color,
      iconName: item.iconName,
      config: { _position: position },
    }

    onWorkflowChange({
      ...workflow,
      steps: [...workflow.steps, newStep],
    })
  }, [workflow, onWorkflowChange])

  // Node position change & node delete via keyboard
  const handleNodesChange: typeof onNodesChange = useCallback((changes) => {
    onNodesChange(changes)

    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        const stepIdx = workflow.steps.findIndex(s => s.id === change.id)
        if (stepIdx >= 0) {
          const updated = [...workflow.steps]
          updated[stepIdx] = {
            ...updated[stepIdx],
            config: { ...updated[stepIdx].config, _position: change.position },
          }
          onWorkflowChange({ ...workflow, steps: updated })
        }
      }
      // Handle node deletion via Delete key
      if (change.type === 'remove') {
        handleDeleteStep(change.id)
      }
    }
  }, [workflow, onWorkflowChange, onNodesChange, handleDeleteStep])

  // Delete edge
  const handleEdgesChange: typeof onEdgesChange = useCallback((changes) => {
    onEdgesChange(changes)
    for (const change of changes) {
      if (change.type === 'remove') {
        onWorkflowChange({
          ...workflow,
          connections: workflow.connections.filter(c => c.id !== change.id),
        })
      }
    }
  }, [workflow, onWorkflowChange, onEdgesChange])

  // Handle edge deletion from custom edge button or keyboard
  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    const deletedIds = new Set(deletedEdges.map(e => e.id))
    onWorkflowChange({
      ...workflow,
      connections: workflow.connections.filter(c => !deletedIds.has(c.id)),
    })
  }, [workflow, onWorkflowChange])

  const minimapNodeColor = useCallback((node: Node) => {
    return (node.data as { color?: string })?.color || '#6366f1'
  }, [])

  return (
    <div className="flex-1 h-full" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        minZoom={0.1}
        maxZoom={3}
        snapToGrid
        snapGrid={[16, 16]}
        deleteKeyCode="Delete"
        className="bg-[#fafbfe]"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.2}
          color="#e2e5f0"
        />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          nodeColor={minimapNodeColor}
          maskColor="rgba(99,102,241,0.08)"
          zoomable
          pannable
          style={{ width: 160, height: 100, borderRadius: 12, cursor: 'grab' }}
        />

        {/* Empty state overlay */}
        {workflow.steps.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="text-center">
              <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="8.5" y="14" width="7" height="7" rx="1.5" />
                  <line x1="6.5" y1="10" x2="6.5" y2="12" />
                  <line x1="6.5" y1="12" x2="12" y2="14" />
                  <line x1="17.5" y1="10" x2="17.5" y2="12" />
                  <line x1="17.5" y1="12" x2="12" y2="14" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-600">Drop components here</p>
              <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
                Drag from the left sidebar or double-click a component to add it
              </p>
            </div>
          </div>
        )}
      </ReactFlow>
    </div>
  )
}
