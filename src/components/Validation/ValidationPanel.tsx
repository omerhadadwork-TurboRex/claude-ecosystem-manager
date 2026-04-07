import type { ValidationIssue, EcosystemNode } from '../../lib/types'
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react'

interface ValidationPanelProps {
  issues: ValidationIssue[]
  allNodes: EcosystemNode[]
  onClose: () => void
  onSelectNode: (nodeId: string) => void
}

const SEVERITY_CONFIG = {
  error: { icon: AlertCircle, color: '#ef4444', bg: '#fef2f2', label: 'Error' },
  warning: { icon: AlertTriangle, color: '#f59e0b', bg: '#fffbeb', label: 'Warning' },
  info: { icon: Info, color: '#3b82f6', bg: '#eff6ff', label: 'Info' },
}

export default function ValidationPanel({ issues, allNodes, onClose, onSelectNode }: ValidationPanelProps) {
  const nodeMap = new Map(allNodes.map(n => [n.id, n]))
  const errors = issues.filter(i => i.severity === 'error')
  const warnings = issues.filter(i => i.severity === 'warning')
  const infos = issues.filter(i => i.severity === 'info')

  return (
    <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Validation</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {issues.length} issue{issues.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
        >
          <X size={16} />
        </button>
      </div>

      {/* Summary badges */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-50">
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-600">
          {errors.length} errors
        </span>
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-600">
          {warnings.length} warnings
        </span>
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-600">
          {infos.length} info
        </span>
      </div>

      {/* Issues list */}
      <div className="flex-1 overflow-y-auto">
        {issues.length === 0 ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-2">
              <span className="text-green-500 text-lg">✓</span>
            </div>
            <p className="text-sm text-gray-600 font-medium">All checks passed</p>
            <p className="text-xs text-gray-400 mt-1">Your ecosystem looks healthy</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {issues.map((issue, i) => {
              const cfg = SEVERITY_CONFIG[issue.severity]
              const SeverityIcon = cfg.icon
              const relatedNode = issue.nodeId ? nodeMap.get(issue.nodeId) : null

              return (
                <div
                  key={i}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => issue.nodeId && onSelectNode(issue.nodeId)}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: cfg.bg }}
                    >
                      <SeverityIcon size={12} style={{ color: cfg.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-700 leading-relaxed">{issue.message}</p>
                      {relatedNode && (
                        <span className="text-[10px] text-gray-400 font-mono mt-0.5 block">
                          → {relatedNode.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
