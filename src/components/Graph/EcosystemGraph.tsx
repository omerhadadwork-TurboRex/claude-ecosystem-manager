import { useCallback, useEffect } from 'react'
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
import EcosystemNodeComponent from './nodes/EcosystemNode'
import EcosystemEdgeComponent from './edges/EcosystemEdge'

const nodeTypes: NodeTypes = {
  ecosystem: EcosystemNodeComponent,
}

const edgeTypes: EdgeTypes = {
  'ecosystem-edge': EcosystemEdgeComponent,
}

interface EcosystemGraphProps {
  initialNodes: Node[]
  initialEdges: Edge[]
  onNodeClick: (nodeId: string) => void
  onCategoryChange?: (nodeId: string, newCategory: string, newColor: string, newIcon: string) => void
}

export default function EcosystemGraph({
  initialNodes,
  initialEdges,
  onNodeClick,
  onCategoryChange,
}: EcosystemGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Sync when parent changes nodes/edges (search highlighting, filtering, re-layout)
  useEffect(() => {
    setNodes(initialNodes)
  }, [initialNodes, setNodes])

  useEffect(() => {
    setEdges(initialEdges)
  }, [initialEdges, setEdges])

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        rfAddEdge(
          {
            ...params,
            type: 'ecosystem-edge',
            animated: true,
            style: { stroke: '#9333ea', strokeWidth: 1.5 },
            label: 'new connection',
          },
          eds
        )
      )
    },
    [setEdges]
  )

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick(node.id)
    },
    [onNodeClick]
  )

  const handlePaneClick = useCallback(() => {
    onNodeClick('')
  }, [onNodeClick])

  // Handle edge deletion from custom edge button or keyboard
  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    const deletedIds = new Set(deletedEdges.map(e => e.id))
    setEdges(eds => eds.filter(e => !deletedIds.has(e.id)))
  }, [setEdges])

  const minimapNodeColor = useCallback((node: Node) => {
    return (node.data as { color?: string })?.color || '#999'
  }, [])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={handleNodeClick}
      onPaneClick={handlePaneClick}
      onEdgesDelete={onEdgesDelete}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.05}
      maxZoom={2.5}
      snapToGrid
      snapGrid={[16, 16]}
      deleteKeyCode="Delete"
      className="bg-[var(--color-canvas-bg)]"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1.5}
        color="var(--color-canvas-dots)"
      />
      <Controls position="bottom-left" />
      <MiniMap
        position="bottom-right"
        nodeColor={minimapNodeColor}
        maskColor="rgba(0,0,0,0.08)"
        zoomable
        pannable
        style={{ width: 160, height: 100, borderRadius: 12, cursor: 'grab' }}
      />
    </ReactFlow>
  )
}
