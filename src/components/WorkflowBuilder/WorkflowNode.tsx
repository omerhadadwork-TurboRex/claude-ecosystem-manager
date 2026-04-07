import { memo, useCallback, useState, useRef, useEffect } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  Bot, Puzzle, Cloud, FolderOpen, Plug, Zap, Clock, Rocket, Store, Circle,
  GripVertical, Trash2, ChevronDown
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

interface WorkflowNodeData {
  label: string
  category: string
  description: string
  color: string
  iconName: string
  stepIndex: number
  onDelete?: (nodeId: string) => void
  onChangeCategory?: (nodeId: string, newCategory: string, newColor: string, newIcon: string) => void
  [key: string]: unknown
}

function WorkflowNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as WorkflowNodeData
  const IconComp = ICON_MAP[d.iconName] || Circle
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (d.onDelete) {
      d.onDelete(id)
    }
  }, [id, d])

  const handleCategoryClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setShowCategoryMenu(prev => !prev)
  }, [])

  const handleSelectCategory = useCallback((cat: typeof CATEGORY_OPTIONS[number]) => {
    if (d.onChangeCategory) {
      d.onChangeCategory(id, cat.key, cat.color, cat.icon)
    }
    setShowCategoryMenu(false)
  }, [id, d])

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

  const currentCatLabel = CATEGORY_OPTIONS.find(c => c.key === d.category)?.label
    || d.category.replace(/-/g, ' ').replace('skill ', '')

  return (
    <div
      className={`
        group relative bg-white rounded-2xl border-2 transition-all duration-200 cursor-grab active:cursor-grabbing
        hover:shadow-xl hover:scale-[1.03]
        ${selected ? 'ring-2 ring-blue-400 shadow-xl shadow-blue-100/50' : 'shadow-lg'}
      `}
      style={{
        borderColor: selected ? '#60a5fa' : d.color + '50',
        width: 200,
        minHeight: 80,
      }}
    >
      {/* Gradient top bar */}
      <div
        className="absolute top-0 left-0 right-0 rounded-t-2xl"
        style={{
          height: 5,
          background: `linear-gradient(90deg, ${d.color}, ${d.color}88)`,
        }}
      />

      {/* Step number badge */}
      <div
        className="absolute -top-2.5 -left-2.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md"
        style={{ backgroundColor: d.color }}
      >
        {(d.stepIndex ?? 0) + 1}
      </div>

      {/* Delete button — visible on hover */}
      <button
        onClick={handleDelete}
        className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full flex items-center justify-center
                   bg-red-500 text-white shadow-md
                   opacity-0 group-hover:opacity-100 hover:bg-red-600
                   transition-all duration-150 z-10 cursor-pointer"
        title="Delete step"
      >
        <Trash2 size={11} />
      </button>

      {/* Drag grip */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-40 transition-opacity">
        <GripVertical size={14} className="text-gray-400" />
      </div>

      {/* Content */}
      <div className="px-3 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-xl shrink-0"
            style={{
              width: 36,
              height: 36,
              backgroundColor: d.color + '15',
              border: `1px solid ${d.color}25`,
            }}
          >
            <IconComp size={18} style={{ color: d.color }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-gray-800 truncate leading-tight">
              {d.label}
            </div>

            {/* Clickable category badge with dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={handleCategoryClick}
                className="flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 -ml-1.5 rounded-md cursor-pointer
                           hover:bg-black/5 transition-colors"
                title="Change category"
              >
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: d.color }}
                >
                  {currentCatLabel}
                </span>
                <ChevronDown size={9} style={{ color: d.color }} className="opacity-60" />
              </button>

              {/* Dropdown menu */}
              {showCategoryMenu && (
                <div
                  className="absolute top-full left-0 mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 py-1 overflow-hidden"
                  style={{ maxHeight: 260, overflowY: 'auto' }}
                >
                  {CATEGORY_OPTIONS.map(cat => {
                    const CatIcon = ICON_MAP[cat.icon] || Circle
                    const isActive = cat.key === d.category
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
          </div>
        </div>
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !border-[3px] !border-white !rounded-full !shadow-md"
        style={{ backgroundColor: d.color }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !border-[3px] !border-white !rounded-full !shadow-md"
        style={{ backgroundColor: d.color }}
      />
    </div>
  )
}

export default memo(WorkflowNodeComponent)
