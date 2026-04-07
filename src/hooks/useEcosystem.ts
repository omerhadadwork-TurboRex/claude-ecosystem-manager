import { useState, useCallback, useMemo, useEffect } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { EcosystemData, EcosystemNode, EcosystemEdge, NodeCategory } from '../lib/types'
import { CATEGORY_CONFIG } from '../lib/types'
import { computeLayout } from '../lib/layout'
import { fetchEcosystem, refreshEcosystem, subscribeToEvents } from '../lib/api-client'
// Fallback: static JSON for when server is not running
import staticData from '../data/ecosystem-data.json'

const EDGE_STYLE_MAP: Record<string, React.CSSProperties> = {
  'invokes':       { stroke: '#10b981', strokeWidth: 2 },
  'delegates-to':  { stroke: '#9333ea', strokeWidth: 2.5 },
  'provides-tools':{ stroke: '#3b82f6', strokeWidth: 1.5, strokeDasharray: '6 3' },
  'triggers':      { stroke: '#f97316', strokeWidth: 2 },
  'schedules':     { stroke: '#f43f5e', strokeWidth: 2, strokeDasharray: '4 4' },
  'depends-on':    { stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '3 3' },
}

function toFlowNodes(nodes: EcosystemNode[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: 'ecosystem',
    position: { x: 0, y: 0 },
    data: {
      label: n.label,
      category: n.category,
      description: n.description,
      filePath: n.filePath,
      metadata: n.metadata,
      color: CATEGORY_CONFIG[n.category]?.color || '#666',
      iconName: CATEGORY_CONFIG[n.category]?.icon || 'Circle',
      categoryLabel: CATEGORY_CONFIG[n.category]?.label || n.category,
    },
    parentId: n.parentId,
    draggable: true,
  }))
}

function toFlowEdges(edges: EcosystemEdge[]): Edge[] {
  return edges.map((e) => {
    const edgeStyle = EDGE_STYLE_MAP[e.relation] || { stroke: '#999', strokeWidth: 1.5 }
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'ecosystem-edge',
      animated: e.relation === 'invokes' || e.relation === 'delegates-to',
      label: e.label || e.relation,
      style: edgeStyle,
      data: { relation: e.relation, color: edgeStyle.stroke },
    }
  })
}

export function useEcosystem() {
  const [rawData, setRawData] = useState<EcosystemData>(staticData as EcosystemData)
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [filters, setFilters] = useState<Set<NodeCategory>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load ecosystem data from the API (fallback to static JSON)
  const loadData = useCallback(async (data?: EcosystemData) => {
    const ecosystemData = data || rawData
    const flowNodes = toFlowNodes(ecosystemData.nodes)
    const flowEdges = toFlowEdges(ecosystemData.edges)
    const laid = computeLayout(flowNodes, flowEdges, 'LR')
    setNodes(laid)
    setEdges(flowEdges)
    setRawData(ecosystemData)
    setIsLoading(false)
  }, [rawData])

  // Try to connect to the API on mount
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const data = await fetchEcosystem()
        if (cancelled) return
        setIsLive(true)
        setError(null)
        loadData(data)
      } catch {
        // Server not running — use static data
        if (cancelled) return
        setIsLive(false)
        loadData(staticData as EcosystemData)
      }
    }

    init()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to SSE events for live updates
  useEffect(() => {
    if (!isLive) return

    const unsubscribe = subscribeToEvents(async (event) => {
      if (event === 'refresh' || event === 'node-updated' || event === 'node-created' || event === 'node-deleted' || event === 'saved' || event === 'restored') {
        try {
          const data = await fetchEcosystem()
          loadData(data)
        } catch {}
      }
    })

    return unsubscribe
  }, [isLive, loadData])

  // Manual refresh
  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await refreshEcosystem()
      setIsLive(true)
      setError(null)
      loadData(data)
    } catch (err) {
      setError((err as Error).message)
      setIsLoading(false)
    }
  }, [loadData])

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null
    return rawData.nodes.find(n => n.id === selectedNodeId) || null
  }, [selectedNodeId, rawData.nodes])

  const filteredNodes = useMemo(() => {
    if (filters.size === 0) return nodes
    return nodes.filter(n => !filters.has(n.data.category as NodeCategory))
  }, [nodes, filters])

  const filteredEdges = useMemo(() => {
    const visibleIds = new Set(filteredNodes.map(n => n.id))
    return edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target))
  }, [edges, filteredNodes])

  const toggleFilter = useCallback((category: NodeCategory) => {
    setFilters(prev => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }, [])

  const addEdge = useCallback((source: string, target: string, relation: string) => {
    const newEdge: EcosystemEdge = {
      id: `e-custom-${Date.now()}`,
      source,
      target,
      relation: relation as EcosystemEdge['relation'],
      label: relation,
    }
    setEdges(prev => [...prev, ...toFlowEdges([newEdge])])
  }, [])

  const removeEdge = useCallback((edgeId: string) => {
    setEdges(prev => prev.filter(e => e.id !== edgeId))
  }, [])

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
    allNodes: rawData.nodes,
    rawData,
    setNodes,
    setEdges,
    selectedNode,
    selectedNodeId,
    setSelectedNodeId,
    filters,
    toggleFilter,
    searchQuery,
    setSearchQuery,
    addEdge,
    removeEdge,
    // New API-powered features
    isLoading,
    isLive,
    error,
    refresh,
  }
}
