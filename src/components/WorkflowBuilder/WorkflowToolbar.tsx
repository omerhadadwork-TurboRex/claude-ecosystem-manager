import { useState } from 'react'
import type { Workflow, WorkflowScope } from '../../lib/workflow-types'
import {
  Shield, Save, Tag, Globe, FolderOpen, ChevronDown,
  Pencil, X, Check, Plus
} from 'lucide-react'

interface WorkflowToolbarProps {
  workflow: Workflow
  onWorkflowChange: (workflow: Workflow) => void
  onSave: () => void
  onOptimize: () => void
  onShowCreate: () => void
  isSaved: boolean
}

export default function WorkflowToolbar({
  workflow,
  onWorkflowChange,
  onSave,
  onOptimize,
  onShowCreate,
  isSaved,
}: WorkflowToolbarProps) {
  const [editingName, setEditingName] = useState(false)
  const [tempName, setTempName] = useState(workflow.name)
  const [showScopeMenu, setShowScopeMenu] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)

  const saveName = () => {
    onWorkflowChange({ ...workflow, name: tempName.trim() || 'Untitled Workflow' })
    setEditingName(false)
  }

  const setScope = (scope: WorkflowScope, projectName?: string) => {
    onWorkflowChange({ ...workflow, scope, projectName: projectName || undefined })
    setShowScopeMenu(false)
  }

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !workflow.tags.includes(tag)) {
      onWorkflowChange({ ...workflow, tags: [...workflow.tags, tag] })
    }
    setTagInput('')
    setShowTagInput(false)
  }

  const removeTag = (tag: string) => {
    onWorkflowChange({ ...workflow, tags: workflow.tags.filter(t => t !== tag) })
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm">
      {/* Workflow name */}
      <div className="flex items-center gap-2 min-w-0">
        {editingName ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={tempName}
              onChange={e => setTempName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveName()}
              className="px-2 py-1 text-sm font-bold text-gray-800 border border-indigo-300 rounded-lg
                         focus:ring-1 focus:ring-indigo-200 outline-none w-48"
            />
            <button onClick={saveName} className="p-1 text-green-500 hover:bg-green-50 rounded">
              <Check size={14} />
            </button>
            <button onClick={() => setEditingName(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setTempName(workflow.name); setEditingName(true) }}
            className="flex items-center gap-1.5 text-sm font-bold text-gray-800 hover:text-indigo-600 transition-colors truncate max-w-[200px]"
          >
            {workflow.name || 'Untitled Workflow'}
            <Pencil size={11} className="text-gray-400 shrink-0" />
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-200" />

      {/* Scope selector */}
      <div className="relative">
        <button
          onClick={() => setShowScopeMenu(v => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
                     border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          {workflow.scope === 'global' ? (
            <><Globe size={12} className="text-blue-500" /> Global</>
          ) : (
            <><FolderOpen size={12} className="text-amber-500" /> {workflow.projectName || 'Project'}</>
          )}
          <ChevronDown size={11} className="text-gray-400" />
        </button>

        {showScopeMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowScopeMenu(false)} />
            <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
              <button
                onClick={() => setScope('global')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-blue-50 transition-colors text-left"
              >
                <Globe size={14} className="text-blue-500" />
                <div>
                  <div className="text-xs font-semibold text-gray-800">Global</div>
                  <div className="text-[10px] text-gray-400">Available across all projects</div>
                </div>
              </button>
              <div className="border-t border-gray-100" />
              {['my-agency-ops', 'ux ui claude structure'].map(proj => (
                <button
                  key={proj}
                  onClick={() => setScope('project', proj)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-amber-50 transition-colors text-left"
                >
                  <FolderOpen size={14} className="text-amber-500" />
                  <div>
                    <div className="text-xs font-semibold text-gray-800">{proj}</div>
                    <div className="text-[10px] text-gray-400">Project-scoped workflow</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-200" />

      {/* Tags */}
      <div className="flex items-center gap-1.5 overflow-hidden">
        {workflow.tags.map(tag => (
          <span
            key={tag}
            className="group flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-600"
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
            >
              <X size={8} />
            </button>
          </span>
        ))}
        {showTagInput ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              onBlur={addTag}
              placeholder="tag..."
              className="w-16 px-1.5 py-0.5 text-[10px] border border-indigo-300 rounded-full outline-none focus:ring-1 focus:ring-indigo-200"
            />
          </div>
        ) : (
          <button
            onClick={() => setShowTagInput(true)}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] text-gray-400
                       hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <Tag size={9} />
            Add tag
          </button>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Description inline */}
      <input
        value={workflow.description}
        onChange={e => onWorkflowChange({ ...workflow, description: e.target.value })}
        placeholder="Add description..."
        className="w-48 px-2.5 py-1.5 text-[11px] rounded-lg border border-gray-200 bg-gray-50
                   focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 outline-none"
      />

      {/* Divider */}
      <div className="w-px h-6 bg-gray-200" />

      {/* Create new entity */}
      <button
        onClick={onShowCreate}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white
                   bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600
                   shadow-sm transition-all"
      >
        <Plus size={13} />
        Create
      </button>

      {/* Save */}
      <button
        onClick={onSave}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors
          ${isSaved
            ? 'bg-green-50 text-green-600'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
      >
        <Save size={13} />
        {isSaved ? 'Saved' : 'Save'}
      </button>

      {/* Optimize */}
      <button
        onClick={onOptimize}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white
                   bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600
                   shadow-sm transition-all"
      >
        <Shield size={13} />
        Optimize
      </button>
    </div>
  )
}
