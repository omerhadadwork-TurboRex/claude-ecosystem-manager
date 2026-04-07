import { useState, useRef, useEffect, useCallback } from 'react'
import type { EcosystemNode, EcosystemEdge } from '../../lib/types'
import { CATEGORY_CONFIG } from '../../lib/types'
import {
  Bot, Puzzle, Cloud, FolderOpen, Plug, Zap, Clock, Rocket, Store, Circle,
  X, ArrowRight, ArrowLeft, FileText, MapPin, ChevronDown, Trash2, AlertTriangle,
  Pencil, Check, RotateCcw
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

interface DetailPanelProps {
  node: EcosystemNode | null
  allEdges: EcosystemEdge[]
  allNodes: EcosystemNode[]
  onClose: () => void
  onCategoryChange?: (nodeId: string, newCategory: string, newColor: string, newIcon: string) => void
  onDeleteNode?: (nodeId: string) => void
  onUpdateNode?: (nodeId: string, updates: { label?: string; description?: string }) => void
}

export default function DetailPanel({ node, allEdges, allNodes, onClose, onCategoryChange, onDeleteNode, onUpdateNode }: DetailPanelProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [isEditingDesc, setIsEditingDesc] = useState(false)
  const [editLabel, setEditLabel] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const labelInputRef = useRef<HTMLInputElement>(null)
  const descInputRef = useRef<HTMLTextAreaElement>(null)

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

  // Reset state when node changes
  useEffect(() => {
    setShowCategoryMenu(false)
    setShowDeleteConfirm(false)
    setIsEditingLabel(false)
    setIsEditingDesc(false)
    if (node) {
      setEditLabel(node.label)
      setEditDesc(node.description)
    }
  }, [node?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus when editing starts
  useEffect(() => {
    if (isEditingLabel) labelInputRef.current?.focus()
  }, [isEditingLabel])
  useEffect(() => {
    if (isEditingDesc) descInputRef.current?.focus()
  }, [isEditingDesc])

  const handleSaveLabel = useCallback(() => {
    if (node && onUpdateNode && editLabel.trim() && editLabel !== node.label) {
      onUpdateNode(node.id, { label: editLabel.trim() })
    }
    setIsEditingLabel(false)
  }, [node, editLabel, onUpdateNode])

  const handleSaveDesc = useCallback(() => {
    if (node && onUpdateNode && editDesc !== node.description) {
      onUpdateNode(node.id, { description: editDesc })
    }
    setIsEditingDesc(false)
  }, [node, editDesc, onUpdateNode])

  const handleSelectCategory = useCallback((cat: typeof CATEGORY_OPTIONS[number]) => {
    if (node && onCategoryChange) {
      onCategoryChange(node.id, cat.key, cat.color, cat.icon)
    }
    setShowCategoryMenu(false)
  }, [node, onCategoryChange])

  if (!node) return null

  const config = CATEGORY_CONFIG[node.category]
  const IconComp = ICON_MAP[config?.icon || 'Circle'] || Circle

  // Find connections
  const outgoing = allEdges.filter(e => e.source === node.id)
  const incoming = allEdges.filter(e => e.target === node.id)
  const nodeMap = new Map(allNodes.map(n => [n.id, n]))

  return (
    <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 overflow-visible relative z-20" style={{ borderTop: `3px solid ${config.color}` }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-lg"
              style={{ backgroundColor: config.color + '18' }}
            >
              <IconComp size={18} style={{ color: config.color }} />
            </div>
            <div className="flex-1 min-w-0">
              {/* Editable label */}
              {isEditingLabel ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={labelInputRef}
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveLabel()
                      if (e.key === 'Escape') { setEditLabel(node.label); setIsEditingLabel(false) }
                    }}
                    className="text-sm font-bold text-gray-900 border border-purple-300 rounded px-1.5 py-0.5 w-full
                               outline-none focus:ring-2 focus:ring-purple-200"
                  />
                  <button onClick={handleSaveLabel} className="p-0.5 text-green-500 hover:text-green-600">
                    <Check size={14} />
                  </button>
                  <button onClick={() => { setEditLabel(node.label); setIsEditingLabel(false) }}
                    className="p-0.5 text-gray-400 hover:text-gray-600">
                    <RotateCcw size={12} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 group/label">
                  <h3 className="text-sm font-bold text-gray-900 truncate">{node.label}</h3>
                  {onUpdateNode && (
                    <button
                      onClick={() => { setEditLabel(node.label); setIsEditingLabel(true) }}
                      className="p-0.5 text-gray-300 hover:text-gray-500 opacity-0 group-hover/label:opacity-100 transition-opacity"
                      title="Edit name"
                    >
                      <Pencil size={11} />
                    </button>
                  )}
                </div>
              )}
              {/* Clickable category badge with dropdown */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowCategoryMenu(v => !v)}
                  className="flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-md cursor-pointer
                             hover:bg-black/5 transition-colors"
                  title="Change category"
                >
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color: config.color }}
                  >
                    {config.label}
                  </span>
                  <ChevronDown size={10} style={{ color: config.color }} className="opacity-60" />
                </button>

                {showCategoryMenu && (
                  <div
                    className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 py-1 overflow-hidden"
                    style={{ maxHeight: 300, overflowY: 'auto' }}
                  >
                    {CATEGORY_OPTIONS.map(cat => {
                      const CatIcon = ICON_MAP[cat.icon] || Circle
                      const isActive = cat.key === node.category
                      return (
                        <button
                          key={cat.key}
                          onClick={() => handleSelectCategory(cat)}
                          className={`
                            w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors cursor-pointer
                            ${isActive ? 'bg-gray-50' : 'hover:bg-gray-50'}
                          `}
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: cat.color + '15' }}
                          >
                            <CatIcon size={14} style={{ color: cat.color }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-700">{cat.label}</span>
                          {isActive && (
                            <div className="ml-auto w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Description */}
        <div className="px-4 py-3 border-b border-gray-50">
          {isEditingDesc ? (
            <div className="space-y-2">
              <textarea
                ref={descInputRef}
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setEditDesc(node.description); setIsEditingDesc(false) }
                }}
                rows={4}
                className="w-full text-xs text-gray-600 leading-relaxed border border-purple-300 rounded-lg px-2.5 py-2
                           outline-none focus:ring-2 focus:ring-purple-200 resize-y"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={handleSaveDesc}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold
                             text-white bg-purple-500 hover:bg-purple-600 rounded-md transition-colors"
                >
                  <Check size={10} />
                  Save
                </button>
                <button
                  onClick={() => { setEditDesc(node.description); setIsEditingDesc(false) }}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold
                             text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="group/desc relative">
              {node.description ? (
                <p className="text-xs text-gray-600 leading-relaxed pr-6">{node.description}</p>
              ) : (
                <p className="text-xs text-gray-400 italic pr-6">No description</p>
              )}
              {onUpdateNode && (
                <button
                  onClick={() => { setEditDesc(node.description); setIsEditingDesc(true) }}
                  className="absolute top-0 right-0 p-1 text-gray-300 hover:text-gray-500
                             opacity-0 group-hover/desc:opacity-100 transition-opacity"
                  title="Edit description"
                >
                  <Pencil size={11} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* File path */}
        <div className="px-4 py-2.5 border-b border-gray-50 flex items-center gap-2">
          <MapPin size={12} className="text-gray-400 shrink-0" />
          <span className="text-[11px] text-gray-400 font-mono truncate">{node.filePath}</span>
        </div>

        {/* Metadata */}
        {Object.keys(node.metadata).length > 0 && (
          <div className="px-4 py-3 border-b border-gray-50">
            <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Metadata
            </h4>
            <div className="space-y-1">
              {Object.entries(node.metadata).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2 text-xs">
                  <span className="text-gray-400 font-mono shrink-0">{key}:</span>
                  <span className="text-gray-700">
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outgoing connections */}
        {outgoing.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-50">
            <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <ArrowRight size={12} />
              Outgoing ({outgoing.length})
            </h4>
            <div className="space-y-1.5">
              {outgoing.map(edge => {
                const target = nodeMap.get(edge.target)
                const targetConfig = target ? CATEGORY_CONFIG[target.category] : null
                return (
                  <div key={edge.id} className="flex items-center gap-2 text-xs rounded-md p-1.5 hover:bg-gray-50">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: targetConfig?.color || '#999' }}
                    />
                    <span className="text-gray-800 font-medium">{target?.label || edge.target}</span>
                    <span className="text-gray-400 text-[10px] ml-auto">{edge.relation}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Incoming connections */}
        {incoming.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-50">
            <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <ArrowLeft size={12} />
              Incoming ({incoming.length})
            </h4>
            <div className="space-y-1.5">
              {incoming.map(edge => {
                const source = nodeMap.get(edge.source)
                const sourceConfig = source ? CATEGORY_CONFIG[source.category] : null
                return (
                  <div key={edge.id} className="flex items-center gap-2 text-xs rounded-md p-1.5 hover:bg-gray-50">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: sourceConfig?.color || '#999' }}
                    />
                    <span className="text-gray-800 font-medium">{source?.label || edge.source}</span>
                    <span className="text-gray-400 text-[10px] ml-auto">{edge.relation}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* No connections */}
        {outgoing.length === 0 && incoming.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-gray-400">No connections</p>
            <p className="text-[10px] text-gray-300 mt-1">
              Drag from a handle to create one
            </p>
          </div>
        )}

        {/* Delete section */}
        {onDeleteNode && (
          <div className="px-4 py-4 border-t border-gray-100 mt-auto">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg
                           text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100
                           border border-red-200/60 transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
                Delete from Ecosystem
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-red-600 font-medium">
                  <AlertTriangle size={13} />
                  <span>This will remove the node and all its connections</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onDeleteNode(node.id)
                      setShowDeleteConfirm(false)
                    }}
                    className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold
                               text-white bg-red-500 hover:bg-red-600
                               transition-colors cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold
                               text-gray-600 bg-gray-100 hover:bg-gray-200
                               transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
