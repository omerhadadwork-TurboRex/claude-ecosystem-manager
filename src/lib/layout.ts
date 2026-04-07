import dagre from '@dagrejs/dagre'
import type { Node, Edge } from '@xyflow/react'

const NODE_WIDTH = 220
const NODE_HEIGHT = 90
const PLUGIN_WIDTH = 180
const PLUGIN_HEIGHT = 56

export function computeLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'LR'
): Node[] {
  // Separate connected vs disconnected
  const connectedNodeIds = new Set<string>()
  for (const edge of edges) {
    connectedNodeIds.add(edge.source)
    connectedNodeIds.add(edge.target)
  }

  const connectedNodes = nodes.filter(n => connectedNodeIds.has(n.id))
  const disconnectedNodes = nodes.filter(n => !connectedNodeIds.has(n.id))

  // Layout connected nodes with dagre
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: direction,
    nodesep: 40,
    ranksep: 140,
    marginx: 40,
    marginy: 40,
  })

  for (const node of connectedNodes) {
    const isPlugin = (node.data as { category?: string })?.category === 'plugin'
    g.setNode(node.id, {
      width: isPlugin ? PLUGIN_WIDTH : NODE_WIDTH,
      height: isPlugin ? PLUGIN_HEIGHT : NODE_HEIGHT,
    })
  }

  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  }

  dagre.layout(g)

  const layoutedConnected = connectedNodes.map((node) => {
    const pos = g.node(node.id)
    if (!pos) return node
    const isPlugin = (node.data as { category?: string })?.category === 'plugin'
    return {
      ...node,
      position: {
        x: pos.x - (isPlugin ? PLUGIN_WIDTH : NODE_WIDTH) / 2,
        y: pos.y - (isPlugin ? PLUGIN_HEIGHT : NODE_HEIGHT) / 2,
      },
    }
  })

  // Bounding box of connected graph
  let maxX = 0
  for (const node of layoutedConnected) {
    maxX = Math.max(maxX, node.position.x + NODE_WIDTH)
  }

  // Place disconnected nodes in a compact grid to the RIGHT of the connected graph
  const byCategory = new Map<string, Node[]>()
  for (const node of disconnectedNodes) {
    const cat = (node.data as { category?: string })?.category || 'other'
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push(node)
  }

  const layoutedDisconnected: Node[] = []
  let gridStartX = maxX + 120
  let gridY = 40
  const COLS = 3
  const COL_GAP = 200
  const ROW_GAP = 100

  for (const [_cat, catNodes] of byCategory) {
    catNodes.forEach((node, i) => {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      layoutedDisconnected.push({
        ...node,
        position: {
          x: gridStartX + col * COL_GAP,
          y: gridY + row * ROW_GAP,
        },
      })
    })
    gridY += Math.ceil(catNodes.length / COLS) * ROW_GAP + 40
  }

  return [...layoutedConnected, ...layoutedDisconnected]
}

export { NODE_WIDTH, NODE_HEIGHT }
