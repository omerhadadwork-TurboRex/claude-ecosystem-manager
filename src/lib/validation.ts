import type { EcosystemData, ValidationIssue } from './types'

export function validateEcosystem(data: EcosystemData): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const nodeIds = new Set(data.nodes.map(n => n.id))
  const incomingEdges = new Map<string, number>()
  const outgoingEdges = new Map<string, number>()

  // Count edges
  for (const edge of data.edges) {
    incomingEdges.set(edge.target, (incomingEdges.get(edge.target) || 0) + 1)
    outgoingEdges.set(edge.source, (outgoingEdges.get(edge.source) || 0) + 1)
  }

  // Check for missing edge targets
  for (const edge of data.edges) {
    if (!nodeIds.has(edge.source)) {
      issues.push({
        severity: 'error',
        message: `Edge references missing source node: ${edge.source}`,
        ruleId: 'missing-source',
      })
    }
    if (!nodeIds.has(edge.target)) {
      issues.push({
        severity: 'error',
        message: `Edge references missing target node: ${edge.target}`,
        nodeId: edge.source,
        ruleId: 'missing-target',
      })
    }
  }

  // Skills (local and project) are standalone by design — they don't need connections
  // skill-local: standalone utilities
  // skill-project: scoped to their project directory, the connection is implicit

  // Check for agents without orchestrators
  for (const node of data.nodes) {
    if (node.category === 'agent') {
      const hasIncoming = incomingEdges.has(node.id)
      if (!hasIncoming) {
        issues.push({
          severity: 'info',
          message: `Agent "${node.label}" has no orchestrator routing to it`,
          nodeId: node.id,
          ruleId: 'agent-no-orchestrator',
        })
      }
    }
  }

  // Check for unused plugins
  for (const node of data.nodes) {
    if (node.category === 'plugin') {
      const hasOut = outgoingEdges.has(node.id)
      const hasIn = incomingEdges.has(node.id)
      if (!hasOut && !hasIn) {
        issues.push({
          severity: 'info',
          message: `Plugin "${node.label}" is installed but not referenced by any skill`,
          nodeId: node.id,
          ruleId: 'unused-plugin',
        })
      }
    }
  }

  // Check for circular dependencies (simple cycle detection)
  const adjacency = new Map<string, string[]>()
  for (const edge of data.edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, [])
    adjacency.get(edge.source)!.push(edge.target)
  }

  const visited = new Set<string>()
  const inStack = new Set<string>()

  function dfs(nodeId: string): boolean {
    visited.add(nodeId)
    inStack.add(nodeId)
    for (const neighbor of adjacency.get(nodeId) || []) {
      if (inStack.has(neighbor)) {
        issues.push({
          severity: 'warning',
          message: `Circular dependency detected involving "${nodeId}" and "${neighbor}"`,
          nodeId: nodeId,
          ruleId: 'circular-dependency',
        })
        return true
      }
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true
      }
    }
    inStack.delete(nodeId)
    return false
  }

  for (const node of data.nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id)
    }
  }

  // Check duplicate names
  const nameCount = new Map<string, string[]>()
  for (const node of data.nodes) {
    const key = node.label.toLowerCase()
    if (!nameCount.has(key)) nameCount.set(key, [])
    nameCount.get(key)!.push(node.id)
  }
  for (const [name, ids] of nameCount) {
    if (ids.length > 1) {
      issues.push({
        severity: 'error',
        message: `Duplicate name "${name}" found in: ${ids.join(', ')}`,
        ruleId: 'duplicate-name',
      })
    }
  }

  return issues
}
