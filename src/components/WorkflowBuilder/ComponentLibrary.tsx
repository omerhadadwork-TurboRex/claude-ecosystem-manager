import { useState, useMemo } from 'react'
import type { EcosystemNode } from '../../lib/types'
import { CATEGORY_CONFIG } from '../../lib/types'
import type { DragItem } from '../../lib/workflow-types'
import {
  Bot, Puzzle, Cloud, FolderOpen, Plug, Zap, Clock, Rocket, Store, Circle,
  Search, ChevronDown, ChevronRight, GripVertical, X
} from 'lucide-react'

const ICON_MAP: Record<string, React.ElementType> = {
  Bot, Puzzle, Cloud, FolderOpen, Plug, Zap, Clock, Rocket, Store, Circle,
}

interface ComponentLibraryProps {
  allNodes: EcosystemNode[]
  onDragStart: (item: DragItem) => void
  onQuickAdd: (item: DragItem) => void
}

export default function ComponentLibrary({ allNodes, onDragStart, onQuickAdd }: ComponentLibraryProps) {
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // Group nodes by category
  const grouped = useMemo(() => {
    const groups = new Map<string, EcosystemNode[]>()
    for (const node of allNodes) {
      const cat = node.category
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(node)
    }
    return groups
  }, [allNodes])

  // Filter by search
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return grouped
    const q = search.toLowerCase()
    const filtered = new Map<string, EcosystemNode[]>()
    for (const [cat, nodes] of grouped) {
      const matches = nodes.filter(n =>
        n.label.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q)
      )
      if (matches.length > 0) filtered.set(cat, matches)
    }
    return filtered
  }, [grouped, search])

  const toggleCategory = (cat: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const makeDragItem = (node: EcosystemNode): DragItem => ({
    entityId: node.id,
    label: node.label,
    category: node.category,
    description: node.description,
    color: CATEGORY_CONFIG[node.category]?.color || '#666',
    iconName: CATEGORY_CONFIG[node.category]?.icon || 'Circle',
  })

  const handleDragStart = (e: React.DragEvent, node: EcosystemNode) => {
    const item = makeDragItem(node)
    e.dataTransfer.setData('application/workflow-item', JSON.stringify(item))
    e.dataTransfer.effectAllowed = 'copy'

    // Create a small custom drag ghost
    const ghost = document.createElement('div')
    ghost.style.cssText = `
      display:flex; align-items:center; gap:8px; padding:6px 12px;
      background:white; border-radius:12px; border:2px solid ${item.color}40;
      box-shadow:0 4px 12px rgba(0,0,0,0.15); font-family:system-ui;
      position:fixed; top:-200px; left:-200px; z-index:9999; max-width:180px;
    `
    const dot = document.createElement('div')
    dot.style.cssText = `
      width:24px; height:24px; border-radius:8px; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      background:${item.color}18; border:1px solid ${item.color}30;
    `
    dot.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${item.color}" stroke-width="2.5"><circle cx="12" cy="12" r="3"/></svg>`
    const label = document.createElement('span')
    label.style.cssText = 'font-size:11px; font-weight:600; color:#374151; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;'
    label.textContent = item.label
    ghost.appendChild(dot)
    ghost.appendChild(label)
    document.body.appendChild(ghost)

    e.dataTransfer.setDragImage(ghost, 16, 16)

    // Clean up ghost after drag starts
    requestAnimationFrame(() => {
      setTimeout(() => document.body.removeChild(ghost), 0)
    })

    onDragStart(item)
  }

  return (
    <div className="w-64 h-full bg-white border-r border-gray-200 flex flex-col overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <Puzzle size={12} className="text-white" />
          </div>
          <span className="text-xs font-bold text-gray-800 tracking-wide">COMPONENTS</span>
          <span className="ml-auto text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
            {allNodes.length}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search components..."
            className="w-full pl-7 pr-7 py-1.5 text-[11px] rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 outline-none transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Component list */}
      <div className="flex-1 overflow-y-auto">
        {Array.from(filteredGroups.entries()).map(([cat, nodes]) => {
          const cfg = CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG]
          if (!cfg) return null
          const isCollapsed = collapsed.has(cat)
          const CatIcon = ICON_MAP[cfg.icon] || Circle

          return (
            <div key={cat} className="border-b border-gray-50">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                {isCollapsed ? (
                  <ChevronRight size={12} className="text-gray-400" />
                ) : (
                  <ChevronDown size={12} className="text-gray-400" />
                )}
                <div
                  className="w-4 h-4 rounded flex items-center justify-center"
                  style={{ backgroundColor: cfg.color + '18' }}
                >
                  <CatIcon size={10} style={{ color: cfg.color }} />
                </div>
                <span className="text-[11px] font-semibold text-gray-700">{cfg.label}</span>
                <span className="ml-auto text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {nodes.length}
                </span>
              </button>

              {/* Items */}
              {!isCollapsed && (
                <div className="pb-1">
                  {nodes.map(node => {
                    const NodeIcon = ICON_MAP[cfg.icon] || Circle
                    return (
                      <div
                        key={node.id}
                        draggable
                        onDragStart={e => handleDragStart(e, node)}
                        onDoubleClick={() => onQuickAdd(makeDragItem(node))}
                        className="group flex items-center gap-2 mx-2 mb-1 px-2.5 py-2 rounded-xl cursor-grab active:cursor-grabbing
                                   bg-white border border-gray-100 hover:border-gray-200 hover:bg-gray-50 hover:shadow-sm
                                   transition-all duration-150 active:scale-[0.97]"
                        title={`Drag to canvas or double-click to add\n\n${node.description}`}
                      >
                        <GripVertical size={10} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: cfg.color + '12', border: `1px solid ${cfg.color}20` }}
                        >
                          <NodeIcon size={13} style={{ color: cfg.color }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-semibold text-gray-700 truncate leading-tight">
                            {node.label}
                          </div>
                          <div className="text-[9px] text-gray-400 truncate leading-tight mt-0.5">
                            {node.description.slice(0, 60)}{node.description.length > 60 ? '...' : ''}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {filteredGroups.size === 0 && (
          <div className="p-4 text-center">
            <p className="text-xs text-gray-400">No components match</p>
            <p className="text-[10px] text-gray-300 mt-1">Try a different search term</p>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
        <p className="text-[9px] text-gray-400 text-center leading-relaxed">
          <span className="font-semibold">Drag</span> to canvas &nbsp;·&nbsp; <span className="font-semibold">Double-click</span> to quick-add
        </p>
      </div>
    </div>
  )
}
