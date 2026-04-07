import type { Node, Edge } from '@xyflow/react'

/**
 * Export the current ecosystem/workflow state as a structured text description.
 * This can be shared with Claude to describe what you've built or planned.
 */

interface NodeData {
  label?: string
  category?: string
  categoryLabel?: string
  description?: string
  filePath?: string
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

export function exportEcosystemAsPlan(nodes: Node[], edges: Edge[]): string {
  const lines: string[] = []
  const data = (n: Node) => n.data as NodeData

  // Group nodes by category
  const groups = new Map<string, Node[]>()
  for (const node of nodes) {
    const cat = data(node).categoryLabel || data(node).category || 'unknown'
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat)!.push(node)
  }

  lines.push('# Ecosystem Structure')
  lines.push('')
  lines.push(`**Total:** ${nodes.length} entities, ${edges.length} connections`)
  lines.push(`**Generated:** ${new Date().toLocaleString()}`)
  lines.push('')

  // ── Entities by category ──
  lines.push('## Entities')
  lines.push('')

  for (const [category, catNodes] of groups) {
    lines.push(`### ${category} (${catNodes.length})`)
    lines.push('')
    for (const node of catNodes) {
      const d = data(node)
      lines.push(`- **${d.label}**`)
      if (d.description) lines.push(`  - ${d.description}`)
      if (d.filePath) lines.push(`  - Path: \`${d.filePath}\``)
      if (d.metadata && Object.keys(d.metadata).length > 0) {
        const metaStr = Object.entries(d.metadata)
          .filter(([, v]) => typeof v !== 'function')
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
          .join(', ')
        if (metaStr) lines.push(`  - Metadata: ${metaStr}`)
      }
    }
    lines.push('')
  }

  // ── Connections ──
  if (edges.length > 0) {
    lines.push('## Connections')
    lines.push('')

    const nodeMap = new Map(nodes.map(n => [n.id, data(n).label || n.id]))

    for (const edge of edges) {
      const source = nodeMap.get(edge.source) || edge.source
      const target = nodeMap.get(edge.target) || edge.target
      const relation = (edge.data as { relation?: string })?.relation || edge.label || 'connects to'
      lines.push(`- **${source}** → *${relation}* → **${target}**`)
    }
    lines.push('')
  }

  // ── Summary ──
  lines.push('## Summary')
  lines.push('')
  const catSummary = Array.from(groups.entries())
    .map(([cat, catNodes]) => `${catNodes.length} ${cat}`)
    .join(', ')
  lines.push(`This ecosystem contains: ${catSummary}.`)

  // Connection patterns
  const sourceCount = new Map<string, number>()
  const targetCount = new Map<string, number>()
  for (const edge of edges) {
    sourceCount.set(edge.source, (sourceCount.get(edge.source) || 0) + 1)
    targetCount.set(edge.target, (targetCount.get(edge.target) || 0) + 1)
  }

  const hubs = nodes
    .map(n => ({
      label: data(n).label || n.id,
      out: sourceCount.get(n.id) || 0,
      in: targetCount.get(n.id) || 0,
    }))
    .filter(h => h.out + h.in >= 3)
    .sort((a, b) => (b.out + b.in) - (a.out + a.in))
    .slice(0, 5)

  if (hubs.length > 0) {
    lines.push('')
    lines.push('**Key hubs** (most connected):')
    for (const hub of hubs) {
      lines.push(`- ${hub.label}: ${hub.out} outgoing, ${hub.in} incoming`)
    }
  }

  const orphaned = nodes.filter(n =>
    !sourceCount.has(n.id) && !targetCount.has(n.id) &&
    data(n).category !== 'marketplace'
  )
  if (orphaned.length > 0) {
    lines.push('')
    lines.push(`**Isolated nodes** (${orphaned.length}): ${orphaned.map(n => data(n).label).join(', ')}`)
  }

  return lines.join('\n')
}

export function exportAsJSON(nodes: Node[], edges: Edge[]): string {
  const data = (n: Node) => n.data as NodeData

  const exportData = {
    exportedAt: new Date().toISOString(),
    nodes: nodes.map(n => ({
      id: n.id,
      label: data(n).label,
      category: data(n).category,
      description: data(n).description,
      filePath: data(n).filePath,
      position: n.position,
    })),
    edges: edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      relation: (e.data as { relation?: string })?.relation || e.label,
    })),
  }

  return JSON.stringify(exportData, null, 2)
}
