import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import type { Workflow } from '../../lib/workflow-types'
import type { OptimizeSummary, OptimizeResult } from '../../lib/workflow-types'
import type { EcosystemData } from '../../lib/types'
import { optimizeWorkflow } from '../../lib/workflow-optimizer'
import {
  X, CheckCircle2, XCircle, AlertTriangle, Lightbulb, Shield,
  BarChart3, Zap, Upload, Wrench, EyeOff, MessageCircle, Send,
  ChevronDown, ChevronUp, Sparkles, ArrowRight
} from 'lucide-react'

interface OptimizerPanelProps {
  workflow: Workflow
  ecosystemData: EcosystemData
  onClose: () => void
  onDeploy: () => void
  onWorkflowChange: (workflow: Workflow) => void
}

const SEVERITY_ICONS = {
  pass: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  suggestion: Lightbulb,
}

const SEVERITY_STYLES = {
  pass: { color: '#10b981', bg: '#ecfdf5', border: '#d1fae5' },
  error: { color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  warning: { color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  suggestion: { color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
}

const GRADE_COLORS: Record<string, string> = {
  A: '#10b981', B: '#22c55e', C: '#f59e0b', D: '#f97316', F: '#ef4444',
}

// ── Chat message type ───────────────────────────────────────────────
interface ChatMessage {
  id: string
  role: 'user' | 'system'
  text: string
  resultId?: string
}

// ── Smart response engine ───────────────────────────────────────────
function generateResponse(question: string, summary: OptimizeSummary, workflow: Workflow): string {
  const q = question.toLowerCase()

  // Score related
  if (q.includes('score') || q.includes('grade') || q.includes('ציון')) {
    return `Your workflow "${workflow.name}" scored **${summary.score}/100 (Grade ${summary.grade})**.\n\n` +
      `Breakdown:\n` +
      `• ${summary.passCount} checks passed ✅\n` +
      `• ${summary.errorCount} errors (−25 pts each) ❌\n` +
      `• ${summary.warningCount} warnings (−10 pts each) ⚠️\n` +
      `• ${summary.suggestionCount} suggestions (−3 pts each) 💡\n\n` +
      (summary.errorCount > 0
        ? `Fix the ${summary.errorCount} error(s) first — they block deployment.`
        : summary.warningCount > 0
        ? `Focus on resolving warnings to boost your score above 90.`
        : `Great job! Your workflow is in good shape.`)
  }

  // Error related
  if (q.includes('error') || q.includes('wrong') || q.includes('fix') || q.includes('שגיאה') || q.includes('תקן')) {
    const errors = summary.results.filter(r => r.severity === 'error')
    if (errors.length === 0) return `No errors found! Your workflow has ${summary.warningCount} warnings and ${summary.suggestionCount} suggestions you might want to address.`
    return `Found **${errors.length} error(s)** that must be fixed:\n\n` +
      errors.map((e, i) => `${i + 1}. **${e.title}**: ${e.message}${e.fixAction ? `\n   → Use the "🔧 ${e.fixLabel}" button to auto-fix.` : ''}`).join('\n\n')
  }

  // Warning related
  if (q.includes('warning') || q.includes('warn') || q.includes('אזהרה')) {
    const warnings = summary.results.filter(r => r.severity === 'warning')
    if (warnings.length === 0) return 'No warnings — nice work!'
    return `Found **${warnings.length} warning(s)**:\n\n` +
      warnings.map((w, i) => `${i + 1}. **${w.title}**: ${w.message}\n   ${w.dismissible ? '→ You can dismiss this if intentional.' : '→ This should be fixed.'}`).join('\n\n')
  }

  // Token related
  if (q.includes('token') || q.includes('cost') || q.includes('expensive') || q.includes('עלות')) {
    const stepCount = workflow.steps.length
    const estimated = stepCount * 2000
    const max = stepCount * 8000
    return `**Token Estimate for "${workflow.name}":**\n\n` +
      `• Steps: ${stepCount}\n` +
      `• Connections: ${workflow.connections.length}\n` +
      `• Est. tokens/run: ~${estimated.toLocaleString()}–${max.toLocaleString()}\n` +
      `• Est. cost/run: ~$${(estimated * 0.000003).toFixed(4)}–$${(max * 0.000015).toFixed(4)}\n\n` +
      (stepCount > 6
        ? `⚠️ This is a large workflow. Consider splitting into sub-workflows to reduce per-run costs.`
        : `✅ Token usage looks reasonable for this workflow size.`)
  }

  // How to fix / improve
  if (q.includes('improve') || q.includes('better') || q.includes('how') || q.includes('שפר') || q.includes('איך')) {
    const priorities: string[] = []
    const errors = summary.results.filter(r => r.severity === 'error')
    const warnings = summary.results.filter(r => r.severity === 'warning')
    const suggestions = summary.results.filter(r => r.severity === 'suggestion')

    if (errors.length > 0) priorities.push(`1. **Fix ${errors.length} error(s)** — these block deployment.`)
    if (warnings.length > 0) priorities.push(`${priorities.length + 1}. **Resolve ${warnings.length} warning(s)** — each one deducts 10 points.`)
    if (suggestions.length > 0) priorities.push(`${priorities.length + 1}. **Consider ${suggestions.length} suggestion(s)** — small improvements, 3 pts each.`)
    if (priorities.length === 0) priorities.push('Your workflow looks great! No immediate improvements needed.')

    return `**Improvement Priorities:**\n\n${priorities.join('\n')}\n\n` +
      `Use the 🔧 auto-fix buttons to quickly resolve issues, or dismiss non-critical alerts if they're intentional.`
  }

  // Specific result question
  for (const result of summary.results) {
    if (q.includes(result.title.toLowerCase()) || q.includes(result.id)) {
      return `**${result.title}** (${result.severity})\n\n${result.explanation}\n\n` +
        (result.fixAction ? `💡 You can use "🔧 ${result.fixLabel}" to auto-fix this.` : '') +
        (result.dismissible ? `\n\nYou can also dismiss this if it's intentional.` : '')
    }
  }

  // Deploy related
  if (q.includes('deploy') || q.includes('ready') || q.includes('ship') || q.includes('לפרוס')) {
    const canDeploy = summary.errorCount === 0 && workflow.steps.length > 0
    return canDeploy
      ? `✅ **Ready to deploy!** Your workflow has no blocking errors. Score: ${summary.score}/100.\n\nClick "Deploy Workflow" to proceed.`
      : `❌ **Not ready.** Fix ${summary.errorCount} error(s) before deploying:\n\n` +
        summary.results.filter(r => r.severity === 'error').map(e => `• ${e.title}: ${e.message}`).join('\n')
  }

  // What is this / explain
  if (q.includes('what') || q.includes('explain') || q.includes('מה')) {
    return `The **Workflow Optimizer** analyzes your workflow structure before deployment. It checks for:\n\n` +
      `• **Structural issues** — disconnected nodes, circular dependencies\n` +
      `• **Missing references** — deleted entities, unnamed workflows\n` +
      `• **Best practices** — agents need skills, hooks need triggers\n` +
      `• **Token efficiency** — warns about large workflows\n` +
      `• **Completeness** — descriptions, tags, project scope\n\n` +
      `Each issue has an **auto-fix** button (🔧) when available, or you can **dismiss** non-critical alerts.`
  }

  // Fallback
  return `I can help you understand your workflow's health. Try asking:\n\n` +
    `• "What's my score?"\n` +
    `• "What errors do I have?"\n` +
    `• "How can I improve?"\n` +
    `• "What about token costs?"\n` +
    `• "Is it ready to deploy?"\n` +
    `• Or click any alert's title to learn more about it.`
}

// ═══════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════

export default function OptimizerPanel({
  workflow, ecosystemData, onClose, onDeploy, onWorkflowChange
}: OptimizerPanelProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'system', text: 'Hi! I can explain any alert, help you understand errors, or advise on improving your workflow. Ask me anything.' },
  ])
  const [chatInput, setChatInput] = useState('')
  const [expandedResult, setExpandedResult] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const summary: OptimizeSummary = useMemo(
    () => optimizeWorkflow(workflow, ecosystemData),
    [workflow, ecosystemData]
  )

  // Filter out dismissed
  const visibleResults = useMemo(
    () => summary.results.filter(r => !dismissed.has(r.id)),
    [summary.results, dismissed]
  )

  const visibleErrors = visibleResults.filter(r => r.severity === 'error').length
  const canDeploy = visibleErrors === 0 && workflow.steps.length > 0

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // ── Auto-fix handler ──────────────────────────────────────────────
  const handleAutoFix = useCallback((result: OptimizeResult) => {
    if (!result.fixAction) return
    let updated = { ...workflow }

    switch (result.fixAction) {
      case 'remove-step': {
        const stepId = result.fixData?.stepId as string
        if (stepId) {
          updated = {
            ...updated,
            steps: updated.steps.filter(s => s.id !== stepId),
            connections: updated.connections.filter(
              c => c.sourceStepId !== stepId && c.targetStepId !== stepId
            ),
          }
        }
        break
      }
      case 'connect-steps': {
        const stepIds = result.fixData?.stepIds as string[]
        if (stepIds && stepIds.length > 0) {
          // Find the last connected step (end of chain)
          const connectedTargets = new Set(updated.connections.map(c => c.targetStepId))
          const connectedSources = new Set(updated.connections.map(c => c.sourceStepId))
          let lastStep = updated.steps.find(s =>
            connectedSources.has(s.id) && !connectedTargets.has(s.id)
          ) || updated.steps.find(s => !stepIds.includes(s.id))

          const newConns = [...updated.connections]
          for (const sid of stepIds) {
            if (lastStep) {
              newConns.push({
                id: `autofix-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                sourceStepId: lastStep.id,
                targetStepId: sid,
                relation: 'invokes',
                label: 'invokes',
              })
            }
            lastStep = updated.steps.find(s => s.id === sid) || lastStep
          }
          updated = { ...updated, connections: newConns }
        }
        break
      }
      case 'remove-duplicate': {
        const removeIds = result.fixData?.removeIds as string[]
        if (removeIds) {
          updated = {
            ...updated,
            steps: updated.steps.filter(s => !removeIds.includes(s.id)),
            connections: updated.connections.filter(
              c => !removeIds.includes(c.sourceStepId) && !removeIds.includes(c.targetStepId)
            ),
          }
        }
        break
      }
      case 'set-scope': {
        updated = { ...updated, scope: 'global', projectName: undefined }
        break
      }
      case 'break-cycle': {
        // Remove the last connection to break the cycle
        if (updated.connections.length > 0) {
          updated = {
            ...updated,
            connections: updated.connections.slice(0, -1),
          }
        }
        break
      }
      case 'add-description':
        // Can't programmatically focus, just add a chat message
        setChatMessages(prev => [...prev, {
          id: `sys-${Date.now()}`,
          role: 'system',
          text: 'Click the workflow name or description field in the toolbar above to edit it.',
        }])
        setShowChat(true)
        return
    }

    onWorkflowChange(updated)

    // Add chat notification
    setChatMessages(prev => [...prev, {
      id: `fix-${Date.now()}`,
      role: 'system',
      text: `✅ Auto-fix applied: **${result.fixLabel}** for "${result.title}".`,
    }])
  }, [workflow, onWorkflowChange])

  // ── Dismiss handler ───────────────────────────────────────────────
  const handleDismiss = useCallback((resultId: string) => {
    setDismissed(prev => new Set(prev).add(resultId))
    const result = summary.results.find(r => r.id === resultId)
    setChatMessages(prev => [...prev, {
      id: `dismiss-${Date.now()}`,
      role: 'system',
      text: `👁️ Dismissed: "${result?.title}". It won't affect your score anymore.`,
    }])
  }, [summary.results])

  // ── Chat send ─────────────────────────────────────────────────────
  const handleSendChat = useCallback(() => {
    const text = chatInput.trim()
    if (!text) return

    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', text }
    const response = generateResponse(text, summary, workflow)
    const sysMsg: ChatMessage = { id: `sys-${Date.now()}`, role: 'system', text: response }

    setChatMessages(prev => [...prev, userMsg, sysMsg])
    setChatInput('')
  }, [chatInput, summary, workflow])

  // ── Ask about a specific result ───────────────────────────────────
  const handleAskAbout = useCallback((result: OptimizeResult) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: `Explain: "${result.title}"`,
      resultId: result.id,
    }
    const sysMsg: ChatMessage = {
      id: `sys-${Date.now()}`,
      role: 'system',
      text: `**${result.title}** (${result.severity})\n\n${result.explanation}` +
        (result.fixAction ? `\n\n🔧 **Auto-fix available:** ${result.fixLabel}` : '') +
        (result.dismissible ? `\n\n👁️ This alert can be dismissed if it's intentional.` : ''),
    }
    setChatMessages(prev => [...prev, userMsg, sysMsg])
    setShowChat(true)
  }, [])

  return (
    <div className="w-[420px] h-full bg-white border-l border-gray-200 flex flex-col shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-sm">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Workflow Optimizer</h3>
              <p className="text-[10px] text-gray-500">Auto-fix · Validate · Chat</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-white/60 text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Score card */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <div className="relative">
            <svg width="64" height="64" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r="30" fill="none" stroke="#f1f5f9" strokeWidth="6" />
              <circle cx="36" cy="36" r="30" fill="none" stroke={GRADE_COLORS[summary.grade]}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${summary.score * 1.885} 188.5`}
                transform="rotate(-90 36 36)"
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-black" style={{ color: GRADE_COLORS[summary.grade] }}>
                {summary.grade}
              </span>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-2xl font-black text-gray-800">
              {summary.score}<span className="text-sm font-medium text-gray-400">/100</span>
            </div>
            <div className="flex items-center gap-2.5 mt-1.5">
              {[
                { icon: CheckCircle2, count: summary.passCount, cls: 'text-green-500' },
                { icon: XCircle, count: summary.errorCount, cls: 'text-red-500' },
                { icon: AlertTriangle, count: summary.warningCount, cls: 'text-amber-500' },
                { icon: Lightbulb, count: summary.suggestionCount, cls: 'text-indigo-500' },
              ].map(({ icon: I, count, cls }, i) => (
                <div key={i} className="flex items-center gap-0.5">
                  <I size={10} className={cls} /><span className="text-[10px] text-gray-500">{count}</span>
                </div>
              ))}
            </div>
            {dismissed.size > 0 && (
              <div className="text-[9px] text-gray-400 mt-1">{dismissed.size} alert(s) dismissed</div>
            )}
          </div>
        </div>
        {/* Stats + auto-fix-all */}
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50 text-[10px] text-gray-500">
            <BarChart3 size={10} />{workflow.steps.length} steps
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50 text-[10px] text-gray-500">
            <Zap size={10} />{workflow.connections.length} connections
          </div>
          {visibleResults.some(r => r.fixAction && r.severity !== 'pass') && (
            <button
              onClick={() => {
                visibleResults
                  .filter(r => r.fixAction && r.severity !== 'pass' && r.fixAction !== 'add-description')
                  .forEach(r => handleAutoFix(r))
              }}
              className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold
                         bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-200
                         hover:from-amber-100 hover:to-orange-100 transition-colors"
            >
              <Sparkles size={10} />Fix All
            </button>
          )}
        </div>
      </div>

      {/* ── Results list ─────────────────────────────────────────── */}
      <div className={`${showChat ? 'flex-1 max-h-[40%]' : 'flex-1'} overflow-y-auto`}>
        {visibleResults.length === 0 ? (
          <div className="p-6 text-center">
            <CheckCircle2 size={24} className="text-green-400 mx-auto mb-2" />
            <p className="text-xs text-gray-500 font-medium">All clear!</p>
            <p className="text-[10px] text-gray-400 mt-1">
              {dismissed.size > 0 ? `${dismissed.size} alerts dismissed` : 'No issues found'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {['error', 'warning', 'suggestion', 'pass'].map(severity => {
              const items = visibleResults.filter(r => r.severity === severity)
              if (items.length === 0) return null
              const style = SEVERITY_STYLES[severity as keyof typeof SEVERITY_STYLES]

              return items.map(result => {
                const SIcon = SEVERITY_ICONS[result.severity]
                const isExpanded = expandedResult === result.id
                return (
                  <div key={result.id} className="px-4 py-2.5 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start gap-2">
                      <div
                        className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: style.bg, border: `1px solid ${style.border}` }}
                      >
                        <SIcon size={11} style={{ color: style.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        {/* Title row */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setExpandedResult(isExpanded ? null : result.id)}
                            className="text-[11px] font-semibold text-gray-800 hover:text-indigo-600 transition-colors text-left"
                          >
                            {result.title}
                          </button>
                          {isExpanded
                            ? <ChevronUp size={10} className="text-gray-400 shrink-0" />
                            : <ChevronDown size={10} className="text-gray-400 shrink-0" />
                          }
                        </div>
                        <p className="text-[10px] text-gray-500 leading-relaxed mt-0.5">{result.message}</p>

                        {/* Expanded explanation */}
                        {isExpanded && (
                          <div className="mt-2 p-2 rounded-lg bg-gray-50 border border-gray-100 text-[10px] text-gray-600 leading-relaxed whitespace-pre-line">
                            {result.explanation}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {result.fixAction && result.severity !== 'pass' && (
                            <button
                              onClick={() => handleAutoFix(result)}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-semibold
                                         bg-indigo-50 text-indigo-600 border border-indigo-200
                                         hover:bg-indigo-100 transition-colors"
                            >
                              <Wrench size={9} />{result.fixLabel}
                            </button>
                          )}
                          {result.dismissible && result.severity !== 'pass' && (
                            <button
                              onClick={() => handleDismiss(result.id)}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-medium
                                         text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                            >
                              <EyeOff size={9} />Ignore
                            </button>
                          )}
                          {result.severity !== 'pass' && (
                            <button
                              onClick={() => handleAskAbout(result)}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-medium
                                         text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                            >
                              <MessageCircle size={9} />Ask
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            })}
          </div>
        )}
      </div>

      {/* ── Chat section ─────────────────────────────────────────── */}
      <div className="border-t border-gray-200">
        {/* Chat toggle */}
        <button
          onClick={() => { setShowChat(v => !v); setTimeout(() => inputRef.current?.focus(), 100) }}
          className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors"
        >
          <MessageCircle size={13} className="text-indigo-500" />
          <span className="text-[11px] font-semibold text-gray-700">Ask the Optimizer</span>
          <ArrowRight size={10} className={`ml-auto text-gray-400 transition-transform ${showChat ? 'rotate-90' : ''}`} />
        </button>

        {showChat && (
          <>
            {/* Chat messages */}
            <div className="h-48 overflow-y-auto px-3 py-2 bg-gray-50/50 space-y-2">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-xl text-[11px] leading-relaxed whitespace-pre-line ${
                      msg.role === 'user'
                        ? 'bg-indigo-500 text-white rounded-br-sm'
                        : 'bg-white text-gray-700 border border-gray-200 rounded-bl-sm shadow-sm'
                    }`}
                  >
                    {msg.text.split('**').map((part, i) =>
                      i % 2 === 0 ? part : <strong key={i}>{part}</strong>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-100 bg-white">
              <input
                ref={inputRef}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                placeholder="Ask about errors, tokens, score..."
                className="flex-1 px-3 py-1.5 text-[11px] rounded-lg border border-gray-200 bg-gray-50
                           focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 outline-none"
              />
              <button
                onClick={handleSendChat}
                disabled={!chatInput.trim()}
                className={`p-1.5 rounded-lg transition-colors ${
                  chatInput.trim()
                    ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                    : 'bg-gray-100 text-gray-300'
                }`}
              >
                <Send size={12} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Deploy footer */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
        <button
          onClick={onDeploy}
          disabled={!canDeploy}
          className={`
            w-full py-2 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
            ${canDeploy
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-md'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          <Upload size={14} />
          {canDeploy ? 'Deploy Workflow' : `Fix ${visibleErrors} error(s) to deploy`}
        </button>
      </div>
    </div>
  )
}
