import { useState, useCallback, useRef, useEffect } from 'react'
import {
  X, History, RotateCcw, Trash2, Pencil, Check, Clock,
  ChevronDown, ChevronRight, AlertTriangle
} from 'lucide-react'
import type { EcosystemSnapshot } from '../../lib/ecosystem-store'
import {
  loadHistory,
  deleteSnapshot,
  renameSnapshot,
  clearHistory,
} from '../../lib/ecosystem-store'

interface VersionHistoryPanelProps {
  onClose: () => void
  onRestore: (snapshot: EcosystemSnapshot) => void
}

export default function VersionHistoryPanel({ onClose, onRestore }: VersionHistoryPanelProps) {
  const [snapshots, setSnapshots] = useState<EcosystemSnapshot[]>(() => loadHistory())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null)
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const editInputRef = useRef<HTMLInputElement>(null)

  // Focus input when editing
  useEffect(() => {
    if (editingId) editInputRef.current?.focus()
  }, [editingId])

  const handleDelete = useCallback((id: string) => {
    deleteSnapshot(id)
    setSnapshots(loadHistory())
  }, [])

  const handleRename = useCallback((id: string) => {
    if (editName.trim()) {
      renameSnapshot(id, editName.trim())
      setSnapshots(loadHistory())
    }
    setEditingId(null)
    setEditName('')
  }, [editName])

  const handleRestore = useCallback((snapshot: EcosystemSnapshot) => {
    onRestore(snapshot)
    setConfirmRestoreId(null)
  }, [onRestore])

  const handleClearAll = useCallback(() => {
    clearHistory()
    setSnapshots([])
    setConfirmClearAll(false)
  }, [])

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()

    const time = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })

    if (isToday) return `Today, ${time}`
    if (isYesterday) return `Yesterday, ${time}`
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`
  }

  const getTimeDiff = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-100" style={{ borderTop: '3px solid #6366f1' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50">
              <History size={16} className="text-indigo-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Version History</h3>
              <p className="text-[10px] text-gray-400">
                {snapshots.length} saved version{snapshots.length !== 1 ? 's' : ''}
              </p>
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

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto">
        {snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <History size={20} className="text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-400">No saved versions yet</p>
            <p className="text-[11px] text-gray-300 mt-1">
              Click "Save" in the toolbar to create your first version
            </p>
          </div>
        ) : (
          <div className="py-1">
            {snapshots.map((snap, idx) => {
              const isExpanded = expandedId === snap.id
              const isConfirmRestore = confirmRestoreId === snap.id

              return (
                <div
                  key={snap.id}
                  className={`
                    border-b border-gray-50 transition-colors
                    ${isExpanded ? 'bg-gray-50/50' : 'hover:bg-gray-50/30'}
                  `}
                >
                  {/* Main row */}
                  <div
                    className="flex items-center gap-2 px-4 py-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : snap.id)}
                  >
                    {/* Expand icon */}
                    <div className="shrink-0 text-gray-300">
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </div>

                    {/* Version info */}
                    <div className="flex-1 min-w-0">
                      {editingId === snap.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            ref={editInputRef}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRename(snap.id)
                              if (e.key === 'Escape') { setEditingId(null); setEditName('') }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-semibold text-gray-800 bg-white border border-indigo-300 rounded px-1.5 py-0.5 outline-none ring-1 ring-indigo-200 w-full"
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRename(snap.id) }}
                            className="p-0.5 text-indigo-500 hover:text-indigo-700"
                          >
                            <Check size={12} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="text-xs font-semibold text-gray-800 truncate">
                            {snap.name}
                            {idx === 0 && (
                              <span className="ml-1.5 text-[9px] font-medium text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                                latest
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                              <Clock size={9} />
                              {getTimeDiff(snap.timestamp)}
                            </span>
                            <span className="text-[10px] text-gray-300">·</span>
                            <span className="text-[10px] text-gray-400">
                              {snap.nodeCount} nodes, {snap.edgeCount} edges
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded actions */}
                  {isExpanded && (
                    <div className="px-4 pb-3 pt-0 ml-5">
                      <div className="text-[10px] text-gray-400 mb-2">
                        {formatDate(snap.timestamp)}
                      </div>

                      {isConfirmRestore ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-[11px] text-amber-600 font-medium">
                            <AlertTriangle size={12} />
                            <span>This will replace your current graph</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRestore(snap) }}
                              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold
                                         text-white bg-indigo-500 hover:bg-indigo-600 transition-colors cursor-pointer"
                            >
                              <RotateCcw size={11} />
                              Confirm Restore
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmRestoreId(null) }}
                              className="px-2 py-1.5 rounded-lg text-[11px] font-semibold
                                         text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmRestoreId(snap.id) }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold
                                       text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60
                                       transition-colors cursor-pointer"
                          >
                            <RotateCcw size={11} />
                            Restore
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingId(snap.id)
                              setEditName(snap.name)
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100
                                       transition-colors cursor-pointer"
                            title="Rename"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(snap.id) }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50
                                       transition-colors cursor-pointer"
                            title="Delete version"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer — Clear all */}
      {snapshots.length > 0 && (
        <div className="p-3 border-t border-gray-100">
          {confirmClearAll ? (
            <div className="space-y-2">
              <p className="text-[11px] text-red-500 font-medium text-center">
                Delete all {snapshots.length} saved versions?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleClearAll}
                  className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold
                             text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer"
                >
                  Delete All
                </button>
                <button
                  onClick={() => setConfirmClearAll(false)}
                  className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold
                             text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClearAll(true)}
              className="w-full text-center text-[11px] text-gray-400 hover:text-red-500 transition-colors cursor-pointer py-1"
            >
              Clear all history
            </button>
          )}
        </div>
      )}
    </div>
  )
}
