import type { Workflow } from '../../lib/workflow-types'
import {
  Plus, Trash2, Clock, Globe, FolderOpen, Layers, ArrowRight
} from 'lucide-react'

interface WorkflowListProps {
  workflows: Workflow[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreateNew: () => void
  onDelete: (id: string) => void
}

export default function WorkflowList({
  workflows,
  activeId,
  onSelect,
  onCreateNew,
  onDelete,
}: WorkflowListProps) {
  return (
    <div className="space-y-2">
      {/* Create new */}
      <button
        onClick={onCreateNew}
        className="w-full flex items-center gap-2.5 p-3 rounded-xl border-2 border-dashed border-gray-200
                   hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-left group"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center
                        group-hover:from-indigo-200 group-hover:to-purple-200 transition-colors">
          <Plus size={16} className="text-indigo-500" />
        </div>
        <div>
          <div className="text-xs font-bold text-gray-700">New Workflow</div>
          <div className="text-[10px] text-gray-400">Start from scratch</div>
        </div>
      </button>

      {/* Workflow cards */}
      {workflows.map(wf => {
        const isActive = wf.id === activeId
        return (
          <div
            key={wf.id}
            onClick={() => onSelect(wf.id)}
            className={`
              relative group p-3 rounded-xl border-2 cursor-pointer transition-all
              ${isActive
                ? 'border-indigo-400 bg-indigo-50/50 shadow-sm'
                : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
              }
            `}
          >
            <div className="flex items-start gap-2.5">
              <div className={`
                w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                ${isActive ? 'bg-indigo-100' : 'bg-gray-100'}
              `}>
                <Layers size={16} className={isActive ? 'text-indigo-500' : 'text-gray-400'} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-gray-800 truncate">
                  {wf.name || 'Untitled'}
                </div>
                <div className="text-[10px] text-gray-400 truncate mt-0.5">
                  {wf.description || 'No description'}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="flex items-center gap-0.5 text-[9px] text-gray-400">
                    {wf.scope === 'global' ? <Globe size={9} /> : <FolderOpen size={9} />}
                    {wf.scope === 'global' ? 'Global' : wf.projectName || 'Project'}
                  </span>
                  <span className="flex items-center gap-0.5 text-[9px] text-gray-400">
                    <ArrowRight size={9} />
                    {wf.steps.length} steps
                  </span>
                  <span className="flex items-center gap-0.5 text-[9px] text-gray-400">
                    <Clock size={9} />
                    {new Date(wf.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Delete */}
            <button
              onClick={e => { e.stopPropagation(); onDelete(wf.id) }}
              className="absolute top-2 right-2 p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50
                         opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 size={12} />
            </button>

            {/* Tags */}
            {wf.tags.length > 0 && (
              <div className="flex items-center gap-1 mt-2 ml-11">
                {wf.tags.map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-100 text-gray-500">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {workflows.length === 0 && (
        <div className="text-center py-6">
          <Layers size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-400">No workflows yet</p>
          <p className="text-[10px] text-gray-300 mt-1">Create your first workflow above</p>
        </div>
      )}
    </div>
  )
}
