import { useState } from 'react'
import type { NodeCategory } from '../../lib/types'
import { CATEGORY_CONFIG } from '../../lib/types'
import {
  Bot, Puzzle, Cloud, FolderOpen, Plug, Zap, Clock, Rocket, Store, Circle,
  X, Plus, ChevronDown
} from 'lucide-react'

const ICON_MAP: Record<string, React.ElementType> = {
  Bot, Puzzle, Cloud, FolderOpen, Plug, Zap, Clock, Rocket, Store, Circle,
}

type CreatableType = 'agent' | 'skill-local' | 'skill-project' | 'hook' | 'scheduled-task'

const CREATABLE_TYPES: { type: CreatableType; label: string; description: string }[] = [
  { type: 'agent', label: 'Agent', description: 'Create a new automation agent with specialized capabilities' },
  { type: 'skill-local', label: 'Local Skill', description: 'Create a skill available across all projects' },
  { type: 'skill-project', label: 'Project Skill', description: 'Create a skill scoped to a specific project' },
  { type: 'hook', label: 'Hook', description: 'Create an event hook (e.g., on Stop, on Start)' },
  { type: 'scheduled-task', label: 'Scheduled Task', description: 'Create a recurring task with a schedule' },
]

interface CreatePanelProps {
  onClose: () => void
  onCreated: (entity: CreatedEntity) => void
}

export interface CreatedEntity {
  type: CreatableType
  name: string
  description: string
  config: Record<string, string>
}

export default function CreatePanel({ onClose, onCreated }: CreatePanelProps) {
  const [selectedType, setSelectedType] = useState<CreatableType | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerWhen, setTriggerWhen] = useState('')
  const [modes, setModes] = useState('')
  const [schedule, setSchedule] = useState('')
  const [hookEvent, setHookEvent] = useState('Stop')
  const [hookCommand, setHookCommand] = useState('')
  const [project, setProject] = useState('')
  const [showTypeSelector, setShowTypeSelector] = useState(true)

  const handleCreate = () => {
    if (!selectedType || !name.trim()) return

    const config: Record<string, string> = {}
    if (triggerWhen) config.triggerWhen = triggerWhen
    if (modes) config.modes = modes
    if (schedule) config.schedule = schedule
    if (hookEvent) config.hookEvent = hookEvent
    if (hookCommand) config.hookCommand = hookCommand
    if (project) config.project = project

    onCreated({
      type: selectedType,
      name: name.trim(),
      description: description.trim(),
      config,
    })
  }

  const typeConfig = selectedType ? CATEGORY_CONFIG[selectedType] : null
  const TypeIcon = typeConfig ? ICON_MAP[typeConfig.icon] || Circle : Circle

  return (
    <div className="w-96 h-full bg-white border-l border-gray-200 flex flex-col shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Plus size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Create New Entity</h3>
              <p className="text-[10px] text-gray-500">Build agents, skills, hooks & tasks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-white/60 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Type selector */}
        {showTypeSelector ? (
          <div className="p-4">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-3">
              Choose Type
            </label>
            <div className="space-y-2">
              {CREATABLE_TYPES.map(({ type, label, description: desc }) => {
                const cfg = CATEGORY_CONFIG[type]
                const Icon = ICON_MAP[cfg.icon] || Circle
                const isSelected = selectedType === type
                return (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedType(type)
                      setShowTypeSelector(false)
                    }}
                    className={`
                      w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all
                      ${isSelected
                        ? 'border-blue-400 bg-blue-50 shadow-sm'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: cfg.color + '15' }}
                    >
                      <Icon size={18} style={{ color: cfg.color }} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{label}</div>
                      <div className="text-[11px] text-gray-500 leading-tight">{desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Selected type badge */}
            <button
              onClick={() => setShowTypeSelector(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              {typeConfig && (
                <div
                  className="w-5 h-5 rounded flex items-center justify-center"
                  style={{ backgroundColor: typeConfig.color + '15' }}
                >
                  <TypeIcon size={12} style={{ color: typeConfig.color }} />
                </div>
              )}
              <span className="text-xs font-medium text-gray-700">{typeConfig?.label}</span>
              <ChevronDown size={12} className="text-gray-400" />
            </button>

            {/* Name */}
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., my-custom-agent"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-blue-300 focus:ring-1 focus:ring-blue-200 outline-none"
              />
              <p className="text-[10px] text-gray-400 mt-1">Use kebab-case (e.g., my-skill-name)</p>
            </div>

            {/* Description */}
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Description *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this do? When should it be used?"
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-blue-300 focus:ring-1 focus:ring-blue-200 outline-none resize-none"
              />
            </div>

            {/* Type-specific fields */}
            {(selectedType === 'agent' || selectedType === 'skill-local' || selectedType === 'skill-project') && (
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                  Trigger / When to Use
                </label>
                <textarea
                  value={triggerWhen}
                  onChange={(e) => setTriggerWhen(e.target.value)}
                  placeholder="When should this be activated? What user requests trigger it?"
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-blue-300 focus:ring-1 focus:ring-blue-200 outline-none resize-none"
                />
              </div>
            )}

            {selectedType === 'agent' && (
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                  Modes (comma-separated)
                </label>
                <input
                  type="text"
                  value={modes}
                  onChange={(e) => setModes(e.target.value)}
                  placeholder="e.g., BUILD, DEBUG, OPTIMIZE"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-blue-300 focus:ring-1 focus:ring-blue-200 outline-none"
                />
              </div>
            )}

            {selectedType === 'skill-project' && (
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                  Project Name
                </label>
                <input
                  type="text"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  placeholder="e.g., my-agency-ops"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-blue-300 focus:ring-1 focus:ring-blue-200 outline-none"
                />
              </div>
            )}

            {selectedType === 'hook' && (
              <>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                    Event
                  </label>
                  <select
                    value={hookEvent}
                    onChange={(e) => setHookEvent(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-blue-300 focus:ring-1 focus:ring-blue-200 outline-none"
                  >
                    <option value="Stop">Stop</option>
                    <option value="Start">Start</option>
                    <option value="PreToolUse">PreToolUse</option>
                    <option value="PostToolUse">PostToolUse</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                    Command
                  </label>
                  <input
                    type="text"
                    value={hookCommand}
                    onChange={(e) => setHookCommand(e.target.value)}
                    placeholder="e.g., powershell -Command ..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-blue-300 focus:ring-1 focus:ring-blue-200 outline-none"
                  />
                </div>
              </>
            )}

            {selectedType === 'scheduled-task' && (
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                  Schedule
                </label>
                <input
                  type="text"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  placeholder="e.g., Every Monday at 9:00 AM"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-blue-300 focus:ring-1 focus:ring-blue-200 outline-none"
                />
              </div>
            )}

            {/* Preview */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-2">
                Will be created at
              </label>
              <p className="text-[11px] text-gray-600 font-mono break-all">
                {selectedType === 'agent' && `~/.claude/agents/${name || '...'}/SKILL.md`}
                {selectedType === 'skill-local' && `~/.claude/skills/${name || '...'}/SKILL.md`}
                {selectedType === 'skill-project' && `~/Projects/${project || '...'}/..claude/skills/${name || '...'}/SKILL.md`}
                {selectedType === 'hook' && `~/.claude/settings.json (hooks.${hookEvent})`}
                {selectedType === 'scheduled-task' && `~/.claude/scheduled-tasks/${name || '...'}/SKILL.md`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer with create button */}
      {!showTypeSelector && (
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={handleCreate}
            disabled={!name.trim() || !description.trim()}
            className={`
              w-full py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2
              ${name.trim() && description.trim()
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 shadow-md'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            <Plus size={16} />
            Create {typeConfig?.label}
          </button>
          <p className="text-[10px] text-gray-400 text-center mt-2">
            Creates the file and adds the node to the canvas
          </p>
        </div>
      )}
    </div>
  )
}
