import { useState, useCallback, useEffect, useRef } from 'react'
import type { NodeCategory } from '../../lib/types'
import { CATEGORY_CONFIG } from '../../lib/types'
import { Search, X, AlertTriangle, Layout, Plus, Shield, Save, History, Check, Share2 } from 'lucide-react'
import type { ValidationIssue } from '../../lib/types'

interface ToolbarProps {
  filters: Set<NodeCategory>
  onToggleFilter: (category: NodeCategory) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  validationIssues: ValidationIssue[]
  onShowValidation: () => void
  onAutoLayout: () => void
  onShowCreate: () => void
  onShowOptimizer: () => void
  onSave: () => void
  onShowHistory: () => void
  onShowExport: () => void
  isSaving?: boolean
  hasUnsavedChanges?: boolean
  pendingCount?: number
  isLive?: boolean
}

const categories = Object.entries(CATEGORY_CONFIG) as [NodeCategory, typeof CATEGORY_CONFIG[NodeCategory]][]

export default function Toolbar({
  filters,
  onToggleFilter,
  searchQuery,
  onSearchChange,
  validationIssues,
  onShowValidation,
  onAutoLayout,
  onShowCreate,
  onShowOptimizer,
  onSave,
  onShowHistory,
  onShowExport,
  isSaving = false,
  hasUnsavedChanges = false,
  pendingCount = 0,
  isLive = false,
}: ToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const errorCount = validationIssues.filter(i => i.severity === 'error').length
  const warnCount = validationIssues.filter(i => i.severity === 'warning').length

  // Keyboard shortcut: / to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm">
      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search nodes... ( / )"
          className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-200 outline-none transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-200" />

      {/* Filter chips */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {categories.map(([key, cfg]) => {
          const isHidden = filters.has(key)
          return (
            <button
              key={key}
              onClick={() => onToggleFilter(key)}
              className={`
                flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium
                transition-all whitespace-nowrap
                ${isHidden
                  ? 'bg-gray-100 text-gray-400 opacity-50'
                  : 'text-gray-700 hover:bg-gray-100'
                }
              `}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: isHidden ? '#ccc' : cfg.color }}
              />
              {cfg.label}
            </button>
          )
        })}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-200" />

      {/* Actions */}
      <button
        onClick={onAutoLayout}
        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
        title="Auto-layout"
      >
        <Layout size={13} />
        Layout
      </button>

      {/* Create button */}
      <button
        onClick={onShowCreate}
        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-white rounded-md bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 transition-colors shadow-sm"
      >
        <Plus size={13} />
        Create
      </button>

      {/* Optimize button */}
      <button
        onClick={onShowOptimizer}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-white
                   bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600
                   shadow-sm transition-all"
      >
        <Shield size={13} />
        Optimize
      </button>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-200" />

      {/* Save button */}
      <button
        onClick={onSave}
        disabled={isSaving}
        className={`
          flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition-all
          ${isSaving
            ? 'bg-green-100 text-green-600 cursor-default'
            : hasUnsavedChanges
            ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm ring-1 ring-emerald-400/30'
            : 'text-gray-600 hover:bg-gray-100'
          }
        `}
        title={hasUnsavedChanges ? 'Save changes (unsaved changes)' : 'Save current state'}
      >
        {isSaving ? <Check size={13} /> : <Save size={13} />}
        {isSaving ? 'Saved!' : 'Save'}
        {pendingCount > 0 && !isSaving && isLive && (
          <span className="ml-0.5 px-1.5 py-0.5 bg-white/20 rounded text-[9px] font-bold">
            {pendingCount}
          </span>
        )}
        {hasUnsavedChanges && !isSaving && (
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        )}
      </button>

      {/* History button */}
      <button
        onClick={onShowHistory}
        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
        title="Version history"
      >
        <History size={13} />
        History
      </button>

      {/* Export & Sync button */}
      <button
        onClick={onShowExport}
        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
        title="Export diagram & sync from system"
      >
        <Share2 size={13} />
        Export
      </button>

      {/* Validation badge */}
      <button
        onClick={onShowValidation}
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors
          ${errorCount > 0
            ? 'bg-red-50 text-red-600 hover:bg-red-100'
            : warnCount > 0
            ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
            : 'bg-green-50 text-green-600 hover:bg-green-100'
          }
        `}
      >
        <AlertTriangle size={13} />
        {errorCount > 0
          ? `${errorCount} error${errorCount > 1 ? 's' : ''}`
          : warnCount > 0
          ? `${warnCount} warning${warnCount > 1 ? 's' : ''}`
          : 'All good'
        }
      </button>
    </div>
  )
}
