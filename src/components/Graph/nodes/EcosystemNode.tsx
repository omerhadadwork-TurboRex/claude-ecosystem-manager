import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  Bot, Puzzle, Cloud, FolderOpen, Plug, Zap, Clock, Rocket, Store, Circle,
  ChevronDown, Trash2
} from 'lucide-react'

const ICON_MAP: Record<string, React.ElementType> = {
  Bot, Puzzle, Cloud, FolderOpen, Plug, Zap, Clock, Rocket, Store, Circle,
}

const CATEGORY_OPTIONS = [
  { key: 'agent',          label: 'Agent',          color: '#9333ea', icon: 'Bot' },
  { key: 'skill-local',    label: 'Local Skill',    color: '#10b981', icon: 'Puzzle' },
  { key: 'skill-remote',   label: 'Remote Skill',   color: '#14b8a6', icon: 'Cloud' },
  { key: 'skill-project',  label: 'Project Skill',  color: '#f59e0b', icon: 'FolderOpen' },
  { key: 'plugin',         label: 'Plugin',         color: '#3b82f6', icon: 'Plug' },
  { key: 'hook',           label: 'Hook',           color: '#f97316', icon: 'Zap' },
  { key: 'scheduled-task', label: 'Scheduled Task', color: '#f43f5e', icon: 'Clock' },
  { key: 'launch-config',  label: 'Launch Config',  color: '#64748b', icon: 'Rocket' },
  { key: 'marketplace',    label: 'Marketplace',    color: '#6366f1', icon: 'Store' },
]

interface EcosystemNodeData {
  label: string
  category: string
  description: string
  color: string
  iconName: string
  categoryLabel: string
  onCategoryChange?: (nodeId: string, newCategory: string, newColor: string, newIcon: string) => void
  onDelete?: (nodeId: string) => void
  [key: string]: unknown
}

function EcosystemNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as EcosystemNodeData
  const { label, description, color, iconName, categoryLabel, category } = nodeData
  const IconComp = ICON_MAP[iconName] || Circle

  const isAgent = category === 'agent'
  const isPlugin = category === 'plugin'
  const isInfra = category === 'hook' || category === 'scheduled-task' || category === 'launch-config'

  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleCategoryClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setShowCategoryMenu(prev => !prev)
  }, [])

  const handleSelectCategory = useCallback((cat: typeof CATEGORY_OPTIONS[number]) => {
    if (nodeData.onCategoryChange) {
      nodeData.onCategoryChange(id, cat.key, cat.color, cat.icon)
    }
    setShowCategoryMenu(false)
  }, [id, nodeData])

  // Close menu on outside click
  useEffect(() => {
    if (!showCategoryMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowCategoryMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showCategoryMenu])

  return (
    <div
      className={`
        group relative bg-white rounded-xl shadow-md
        transition-all duration-150 cursor-pointer
        hover:shadow-lg hover:scale-[1.02]
        ${selected ? 'ring-2 ring-blue-400 shadow-lg shadow-blue-100' : ''}
        ${isAgent ? 'border-2' : 'border'}
      `}
      style={{
        borderColor: selected ? '#60a5fa' : color + '40',
        width: isPlugin ? 180 : 220,
        minHeight: isPlugin ? 52 : 76,
      }}
    >
      {/* Colored top strip */}
      <div
        className="absolute top-0 left-0 right-0 rounded-t-xl"
        style={{ height: 4, backgroundColor: color }}
      />

      {/* Delete button — visible on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          if (nodeData.onDelete) nodeData.onDelete(id)
        }}
        className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full flex items-center justify-center
                   bg-red-500 text-white shadow-md
                   opacity-0 group-hover:opacity-100 hover:bg-red-600
                   transition-all duration-150 z-10 cursor-pointer"
        title="Delete node"
      >
        <Trash2 size={11} />
      </button>

      {/* Content */}
      <div className={`px-3 ${isPlugin ? 'py-2' : 'pt-3 pb-2'}`}>
        {/* Header row */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center rounded-lg shrink-0"
            style={{
              width: isPlugin ? 24 : 28,
              height: isPlugin ? 24 : 28,
              backgroundColor: color + '18',
            }}
          >
            <IconComp size={isPlugin ? 13 : 15} style={{ color }} />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className={`font-semibold truncate ${isPlugin ? 'text-xs' : 'text-sm'}`}
              style={{ color: '#1a1a2e' }}
            >
              {label}
            </div>
          </div>
        </div>

        {/* Category badge with dropdown */}
        {!isPlugin && (
          <div className="mt-1.5 relative" ref={menuRef}>
            <button
              onClick={handleCategoryClick}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md cursor-pointer
                         hover:bg-black/5 transition-colors"
              title="Change category"
            >
              <span
                className="text-[10px] font-semibold"
                style={{ color }}
              >
                {categoryLabel}
              </span>
              <ChevronDown size={9} style={{ color }} className="opacity-60" />
            </button>

            {/* Dropdown menu */}
            {showCategoryMenu && (
              <div
                className="absolute top-full left-0 mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 py-1 overflow-hidden"
                style={{ maxHeight: 260, overflowY: 'auto' }}
              >
                {CATEGORY_OPTIONS.map(cat => {
                  const CatIcon = ICON_MAP[cat.icon] || Circle
                  const isActive = cat.key === category
                  return (
                    <button
                      key={cat.key}
                      onClick={(e) => { e.stopPropagation(); handleSelectCategory(cat) }}
                      className={`
                        w-full flex items-center gap-2 px-3 py-2 text-left transition-colors cursor-pointer
                        ${isActive ? 'bg-gray-50' : 'hover:bg-gray-50'}
                      `}
                    >
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: cat.color + '15' }}
                      >
                        <CatIcon size={12} style={{ color: cat.color }} />
                      </div>
                      <span className="text-[11px] font-semibold text-gray-700">{cat.label}</span>
                      {isActive && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {!isPlugin && description && (
          <p
            className="mt-1 text-[11px] leading-tight text-gray-500 line-clamp-2"
            style={{ maxHeight: 28, overflow: 'hidden' }}
          >
            {description}
          </p>
        )}

        {/* Infrastructure accent */}
        {isInfra && (
          <div className="absolute -top-1 -right-1 w-3 h-3 rotate-45" style={{ backgroundColor: color }} />
        )}
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-white !rounded-full"
        style={{ backgroundColor: color }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !border-2 !border-white !rounded-full"
        style={{ backgroundColor: color }}
      />
    </div>
  )
}

export default memo(EcosystemNodeComponent)
