import Fuse from 'fuse.js'
import type { EcosystemNode } from './types'

let fuseInstance: Fuse<EcosystemNode> | null = null

export function initSearch(nodes: EcosystemNode[]) {
  fuseInstance = new Fuse(nodes, {
    keys: ['label', 'description', 'category'],
    threshold: 0.3,
    includeScore: true,
  })
}

export function searchNodes(query: string): string[] {
  if (!fuseInstance || !query.trim()) return []
  const results = fuseInstance.search(query)
  return results.map(r => r.item.id)
}
