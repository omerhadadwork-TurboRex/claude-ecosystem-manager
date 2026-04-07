import { useState, useMemo, useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import {
  X, FileText, Copy, Check, Download, Code, RefreshCw, Clock
} from 'lucide-react'
import { exportEcosystemAsPlan, exportAsJSON } from '../../lib/export-plan'

type ExportFormat = 'markdown' | 'json'

interface ExportPanelProps {
  nodes: Node[]
  edges: Edge[]
  onClose: () => void
  onSync: () => void
  lastSyncTime?: string | null
}

export default function ExportPanel({ nodes, edges, onClose, onSync, lastSyncTime }: ExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>('markdown')
  const [copied, setCopied] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const exportText = useMemo(() => {
    if (format === 'markdown') return exportEcosystemAsPlan(nodes, edges)
    return exportAsJSON(nodes, edges)
  }, [nodes, edges, format])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(exportText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [exportText])

  const handleDownload = useCallback(() => {
    const ext = format === 'markdown' ? 'md' : 'json'
    const blob = new Blob([exportText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ecosystem-plan.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }, [exportText, format])

  const handleSync = useCallback(() => {
    setSyncing(true)
    onSync()
    setTimeout(() => setSyncing(false), 2000)
  }, [onSync])

  return (
    <div className="w-[420px] h-full bg-white border-l border-gray-200 flex flex-col shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100" style={{ borderTop: '3px solid #8b5cf6' }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-sm">
              <FileText size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Export & Sync</h3>
              <p className="text-[10px] text-gray-500">Share diagrams · Sync from system</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Sync section ───────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
              <RefreshCw size={12} className="text-blue-500" />
              Sync from System
            </h4>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Re-scan <code className="bg-gray-100 px-1 rounded text-[9px]">~/.claude/</code> to update the map
            </p>
            {lastSyncTime && (
              <p className="text-[9px] text-gray-400 mt-0.5 flex items-center gap-1">
                <Clock size={8} />
                Last sync: {lastSyncTime}
              </p>
            )}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer
              ${syncing
                ? 'bg-blue-100 text-blue-500'
                : 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'
              }
            `}
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>

        <div className="mt-2 p-2 rounded-lg bg-white/80 border border-gray-200/60">
          <p className="text-[10px] text-gray-500 leading-relaxed">
            <strong>How it works:</strong> Runs <code className="bg-gray-100 px-1 rounded text-[9px]">npm run extract</code> to
            scan your skills, agents, plugins, hooks, and scheduled tasks. The map updates with the real state of your system.
          </p>
        </div>
      </div>

      {/* ── Export section ──────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h4 className="text-xs font-semibold text-gray-800 flex items-center gap-1.5 mb-2">
          <FileText size={12} className="text-violet-500" />
          Export Diagram
        </h4>
        <p className="text-[10px] text-gray-500 mb-3">
          Copy the diagram structure to share with Claude or save as a file.
        </p>

        {/* Format toggle */}
        <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg w-fit mb-3">
          <button
            onClick={() => setFormat('markdown')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
              format === 'markdown'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={11} />
            Markdown
          </button>
          <button
            onClick={() => setFormat('json')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
              format === 'json'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Code size={11} />
            JSON
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className={`
              flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold
              transition-all cursor-pointer
              ${copied
                ? 'bg-green-100 text-green-600 border border-green-200'
                : 'bg-violet-500 text-white hover:bg-violet-600 shadow-sm'
              }
            `}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold
                       text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <Download size={13} />
            Download
          </button>
        </div>
      </div>

      {/* ── Preview ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 py-2 border-b border-gray-50 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Preview</span>
          <span className="text-[9px] text-gray-400">{exportText.length.toLocaleString()} chars</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <pre className="px-4 py-3 text-[10px] leading-relaxed text-gray-600 font-mono whitespace-pre-wrap break-words">
            {exportText}
          </pre>
        </div>
      </div>
    </div>
  )
}
