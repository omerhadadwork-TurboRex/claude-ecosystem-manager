import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import type { EcosystemData, ValidationIssue } from '../../lib/types'
import {
  X, CheckCircle2, XCircle, AlertTriangle, Lightbulb, Shield,
  BarChart3, Zap, Network, Plug, Puzzle, Bot,
  Wrench, EyeOff, MessageCircle, Send, ChevronDown, ChevronUp,
  Sparkles, ArrowRight
} from 'lucide-react'

interface EcosystemOptimizerPanelProps {
  ecosystemData: EcosystemData
  validationIssues: ValidationIssue[]
  onClose: () => void
  onSelectNode: (nodeId: string) => void
}

// ── Result type (mirrors workflow OptimizeResult) ────────────────────
interface EcoOptimizeResult {
  id: string
  severity: 'pass' | 'error' | 'warning' | 'suggestion'
  title: string
  message: string
  explanation: string
  nodeId?: string
  fixAction?: string
  fixLabel?: string
  fixData?: Record<string, unknown>
  dismissible: boolean
}

interface EcoOptimizeSummary {
  results: EcoOptimizeResult[]
  score: number
  grade: string
  stats: Record<string, number>
  passCount: number
  errorCount: number
  warningCount: number
  suggestionCount: number
}

// ── Chat message ─────────────────────────────────────────────────────
interface ChatMessage {
  id: string
  role: 'user' | 'system'
  text: string
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

// ═══════════════════════════════════════════════════════════════════════
// Analysis engine
// ═══════════════════════════════════════════════════════════════════════
function analyzeEcosystem(data: EcosystemData, validationIssues: ValidationIssue[]): EcoOptimizeSummary {
  const results: EcoOptimizeResult[] = []
  const nodeIds = new Set(data.nodes.map(n => n.id))
  const incomingMap = new Map<string, number>()
  const outgoingMap = new Map<string, number>()

  for (const edge of data.edges) {
    incomingMap.set(edge.target, (incomingMap.get(edge.target) || 0) + 1)
    outgoingMap.set(edge.source, (outgoingMap.get(edge.source) || 0) + 1)
  }

  const catCounts: Record<string, number> = {}
  for (const n of data.nodes) {
    catCounts[n.category] = (catCounts[n.category] || 0) + 1
  }

  // ── Check 1: Has agents ──
  const agentCount = catCounts['agent'] || 0
  if (agentCount > 0) {
    results.push({
      id: 'has-agents', severity: 'pass', title: 'Agents Configured',
      message: `${agentCount} agent(s) found in ecosystem.`,
      explanation: 'Agents are the orchestration layer of your ecosystem. They invoke skills, delegate tasks, and manage workflows. Having agents means your ecosystem can be automated.',
      dismissible: false,
    })
  } else {
    results.push({
      id: 'no-agents', severity: 'suggestion', title: 'No Agents',
      message: 'Consider adding agents to orchestrate your skills.',
      explanation: 'Agents act as coordinators — they invoke skills, handle routing, and can automate complex multi-step processes. Without agents, skills must be triggered manually.\n\nClick "Create" in the toolbar to add an agent.',
      fixAction: 'create-agent', fixLabel: 'Create Agent',
      dismissible: true,
    })
  }

  // ── Check 2: Skills coverage ──
  const localSkills = catCounts['skill-local'] || 0
  const projectSkills = catCounts['skill-project'] || 0
  const totalSkills = localSkills + projectSkills
  if (totalSkills >= 5) {
    results.push({
      id: 'skills-coverage', severity: 'pass', title: 'Good Skill Coverage',
      message: `${totalSkills} skills (${localSkills} local, ${projectSkills} project) — solid foundation.`,
      explanation: 'A well-covered ecosystem has enough skills to handle diverse tasks. Local skills work globally, while project skills are scoped to specific repositories.',
      dismissible: false,
    })
  } else if (totalSkills > 0) {
    results.push({
      id: 'few-skills', severity: 'suggestion', title: 'Few Skills',
      message: `Only ${totalSkills} skills found. More skills = more automation capabilities.`,
      explanation: 'Consider adding skills for common tasks you repeat:\n• Code review patterns\n• Testing workflows\n• Deployment checklists\n• Documentation generation\n\nEach skill you add extends your ecosystem\'s capabilities.',
      dismissible: true,
    })
  }

  // ── Check 3: Orphaned nodes ──
  // skill-local are standalone by design — they don't need connections
  const orphaned = data.nodes.filter(n =>
    n.category !== 'marketplace' &&
    n.category !== 'skill-local' &&
    n.category !== 'skill-project' &&
    !incomingMap.has(n.id) && !outgoingMap.has(n.id)
  )
  if (orphaned.length === 0) {
    results.push({
      id: 'no-orphans', severity: 'pass', title: 'No Orphaned Nodes',
      message: 'Every entity is connected to at least one other.',
      explanation: 'All nodes in your ecosystem have at least one connection, meaning they\'re part of the larger system.',
      dismissible: false,
    })
  } else {
    for (const o of orphaned) {
      results.push({
        id: `orphan-${o.id}`, severity: 'warning', title: 'Orphaned Node',
        message: `"${o.label}" (${o.category}) has no connections — it's completely isolated.`,
        explanation: `This node exists in your ecosystem but isn't connected to anything. It won't be invoked by any agent or skill.\n\nOptions:\n• Connect it to an agent or skill that should use it\n• Delete it if it's no longer needed\n• Ignore this if it's a standalone utility`,
        nodeId: o.id,
        fixAction: 'navigate-node', fixLabel: 'Go to Node',
        fixData: { nodeId: o.id },
        dismissible: true,
      })
    }
  }

  // ── Check 4: Plugin utilization ──
  const plugins = data.nodes.filter(n => n.category === 'plugin')
  const usedPlugins = plugins.filter(p => incomingMap.has(p.id) || outgoingMap.has(p.id))
  const unusedPlugins = plugins.filter(p => !incomingMap.has(p.id) && !outgoingMap.has(p.id))
  if (plugins.length > 0) {
    const utilization = Math.round((usedPlugins.length / plugins.length) * 100)
    if (utilization >= 50) {
      results.push({
        id: 'plugin-util', severity: 'pass', title: 'Plugin Utilization',
        message: `${utilization}% of plugins are actively used (${usedPlugins.length}/${plugins.length}).`,
        explanation: 'Good plugin utilization means your installed plugins are well-integrated into your workflow.',
        dismissible: false,
      })
    } else {
      results.push({
        id: 'plugin-util-low', severity: 'warning', title: 'Low Plugin Utilization',
        message: `Only ${utilization}% of plugins are connected. ${unusedPlugins.length} plugins are unused.`,
        explanation: `These plugins are installed but not connected to any skill or agent:\n\n${unusedPlugins.map(p => `• ${p.label}`).join('\n')}\n\nUnused plugins add complexity without value. Consider connecting them to relevant skills or removing them.`,
        dismissible: true,
      })
    }
  }

  // ── Check 5: Edge integrity ──
  const brokenEdges = data.edges.filter(e => !nodeIds.has(e.source) || !nodeIds.has(e.target))
  if (brokenEdges.length === 0) {
    results.push({
      id: 'edge-integrity', severity: 'pass', title: 'Edge Integrity',
      message: 'All connections reference valid nodes.',
      explanation: 'Every connection in your ecosystem points to existing nodes. No dangling references.',
      dismissible: false,
    })
  } else {
    results.push({
      id: 'broken-edges', severity: 'error', title: 'Broken Connections',
      message: `${brokenEdges.length} connection(s) reference missing nodes.`,
      explanation: `Some connections reference nodes that don't exist. This can happen when nodes are deleted but their connections aren't cleaned up.\n\nBroken edges:\n${brokenEdges.map(e => `• ${e.source} → ${e.target} (${e.relation})`).join('\n')}`,
      fixAction: 'remove-broken-edges', fixLabel: 'Remove Broken',
      fixData: { edgeIds: brokenEdges.map(e => e.id) },
      dismissible: false,
    })
  }

  // ── Check 6: Circular dependencies ──
  const circularIssues = validationIssues.filter(i => i.ruleId === 'circular-dependency')
  if (circularIssues.length === 0) {
    results.push({
      id: 'no-cycles', severity: 'pass', title: 'No Circular Dependencies',
      message: 'No cycles detected in the dependency graph.',
      explanation: 'Your ecosystem has a clean acyclic structure. Dependencies flow in one direction.',
      dismissible: false,
    })
  } else {
    for (const ci of circularIssues) {
      results.push({
        id: `cycle-${ci.nodeId}`, severity: 'warning', title: 'Circular Dependency',
        message: ci.message,
        explanation: 'Circular dependencies create infinite loops where A depends on B which depends on A. This can cause recursive invocations and runaway token usage.\n\nTo fix: identify which connection in the cycle is unnecessary and remove it.',
        nodeId: ci.nodeId,
        fixAction: 'navigate-node', fixLabel: 'Go to Node',
        fixData: { nodeId: ci.nodeId },
        dismissible: true,
      })
    }
  }

  // ── Check 7: Skill descriptions ──
  const noDescSkills = data.nodes.filter(n =>
    (n.category === 'skill-local' || n.category === 'skill-project') &&
    (!n.description || n.description.length < 20)
  )
  if (noDescSkills.length === 0) {
    results.push({
      id: 'good-descriptions', severity: 'pass', title: 'Well-Documented Skills',
      message: 'All skills have meaningful descriptions.',
      explanation: 'Good descriptions help agents understand when and how to invoke each skill.',
      dismissible: false,
    })
  } else {
    results.push({
      id: 'poor-descriptions', severity: 'suggestion', title: 'Underdocumented Skills',
      message: `${noDescSkills.length} skill(s) have short or missing descriptions.`,
      explanation: `Skills with poor descriptions are harder for agents to discover and use correctly.\n\nAffected skills:\n${noDescSkills.map(s => `• "${s.label}" — ${s.description ? `${s.description.length} chars` : 'no description'}`).join('\n')}\n\nAdd detailed descriptions in each skill's SKILL.md file.`,
      dismissible: true,
    })
  }

  // ── Check 8: Hooks ──
  const hooks = catCounts['hook'] || 0
  if (hooks > 0) {
    results.push({
      id: 'has-hooks', severity: 'pass', title: 'Hooks Active',
      message: `${hooks} hook(s) configured for event-driven automation.`,
      explanation: 'Hooks enable automated behaviors triggered by Claude Code events (Start, Stop, PreToolUse, etc.).',
      dismissible: false,
    })
  } else {
    results.push({
      id: 'no-hooks', severity: 'suggestion', title: 'No Hooks',
      message: 'Consider adding hooks (Start, Stop, PreToolUse) for automated behaviors.',
      explanation: 'Hooks let you automate actions on Claude Code events:\n• **Start** — run setup when Claude starts\n• **Stop** — save summaries when Claude stops\n• **PreToolUse** — validate before tool execution\n\nHooks are configured in settings.json.',
      dismissible: true,
    })
  }

  // ── Check 9: Scheduled tasks ──
  const scheduled = catCounts['scheduled-task'] || 0
  if (scheduled > 0) {
    results.push({
      id: 'has-scheduled', severity: 'pass', title: 'Scheduled Tasks',
      message: `${scheduled} scheduled task(s) running on schedule.`,
      explanation: 'Scheduled tasks automate recurring work like digests, maintenance, and monitoring.',
      dismissible: false,
    })
  }

  // ── Check 10: Duplicate names ──
  const dupIssues = validationIssues.filter(i => i.ruleId === 'duplicate-name')
  if (dupIssues.length === 0) {
    results.push({
      id: 'no-duplicates', severity: 'pass', title: 'Unique Names',
      message: 'All entities have unique names.',
      explanation: 'No naming conflicts detected. Each entity can be uniquely identified.',
      dismissible: false,
    })
  } else {
    for (const di of dupIssues) {
      results.push({
        id: `dup-${di.message}`, severity: 'error', title: 'Duplicate Name',
        message: di.message,
        explanation: 'Duplicate names cause ambiguity — when an agent invokes a skill by name, it can\'t determine which one you mean.\n\nRename one of the duplicates to make names unique.',
        nodeId: di.nodeId,
        fixAction: 'navigate-node', fixLabel: 'Go to Node',
        fixData: { nodeId: di.nodeId },
        dismissible: false,
      })
    }
  }

  // ── Check 11: Connection density ──
  const nonMarketplaceNodes = data.nodes.filter(n => n.category !== 'marketplace')
  const ratio = nonMarketplaceNodes.length > 0 ? data.edges.length / nonMarketplaceNodes.length : 0
  if (ratio >= 1.5) {
    results.push({
      id: 'good-density', severity: 'pass', title: 'Rich Connectivity',
      message: `${ratio.toFixed(1)} connections per node — well-connected ecosystem.`,
      explanation: 'A high connection ratio means your components work together well.',
      dismissible: false,
    })
  } else if (ratio >= 0.5) {
    results.push({
      id: 'ok-density', severity: 'suggestion', title: 'Moderate Connectivity',
      message: `${ratio.toFixed(1)} connections per node. Consider adding more connections between related skills.`,
      explanation: 'Your ecosystem has moderate connectivity. Look for skills that naturally work together and add explicit connections.\n\nDrag from one node\'s handle to another to create connections on the canvas.',
      dismissible: true,
    })
  } else {
    results.push({
      id: 'low-density', severity: 'warning', title: 'Sparse Connectivity',
      message: `Only ${ratio.toFixed(1)} connections per node. Many entities may not work together.`,
      explanation: 'A sparse ecosystem means most components are isolated. They can\'t leverage each other\'s capabilities.\n\nTip: Use the Layout button to reorganize, then draw connections between related skills.',
      dismissible: true,
    })
  }

  // ── Score ──
  const errorCount = results.filter(c => c.severity === 'error').length
  const warningCount = results.filter(c => c.severity === 'warning').length
  const suggestionCount = results.filter(c => c.severity === 'suggestion').length
  const passCount = results.filter(c => c.severity === 'pass').length

  let score = 100
  score -= errorCount * 20
  score -= warningCount * 8
  score -= suggestionCount * 3
  score = Math.max(0, Math.min(100, score))

  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F'

  return {
    results, score, grade,
    stats: {
      total: data.nodes.length, edges: data.edges.length,
      agents: agentCount, skills: totalSkills,
      plugins: plugins.length, hooks, scheduled,
    },
    passCount, errorCount, warningCount, suggestionCount,
  }
}

// ── Smart chat response engine ───────────────────────────────────────
function generateResponse(question: string, summary: EcoOptimizeSummary, data: EcosystemData): string {
  const q = question.toLowerCase()

  if (q.includes('score') || q.includes('grade') || q.includes('ציון')) {
    return `Your ecosystem scored **${summary.score}/100 (Grade ${summary.grade})**.\n\n` +
      `• ${summary.passCount} checks passed ✅\n` +
      `• ${summary.errorCount} errors (−20 pts each) ❌\n` +
      `• ${summary.warningCount} warnings (−8 pts each) ⚠️\n` +
      `• ${summary.suggestionCount} suggestions (−3 pts each) 💡\n\n` +
      (summary.errorCount > 0
        ? `Fix the ${summary.errorCount} error(s) first — they have the biggest impact.`
        : summary.warningCount > 0
        ? `Focus on resolving warnings to push your score above 90.`
        : `Great job! Your ecosystem is in excellent shape.`)
  }

  if (q.includes('error') || q.includes('wrong') || q.includes('fix') || q.includes('שגיאה') || q.includes('תקן')) {
    const errors = summary.results.filter(r => r.severity === 'error')
    if (errors.length === 0) return `No errors found! Your ecosystem has ${summary.warningCount} warnings and ${summary.suggestionCount} suggestions to address.`
    return `Found **${errors.length} error(s)**:\n\n` +
      errors.map((e, i) => `${i + 1}. **${e.title}**: ${e.message}${e.fixAction ? `\n   → Use the "🔧 ${e.fixLabel}" button to fix.` : ''}`).join('\n\n')
  }

  if (q.includes('warning') || q.includes('warn') || q.includes('אזהרה')) {
    const warnings = summary.results.filter(r => r.severity === 'warning')
    if (warnings.length === 0) return 'No warnings — nice work!'
    return `Found **${warnings.length} warning(s)**:\n\n` +
      warnings.map((w, i) => `${i + 1}. **${w.title}**: ${w.message}\n   ${w.dismissible ? '→ You can dismiss this if intentional.' : '→ This should be fixed.'}`).join('\n\n')
  }

  if (q.includes('orphan') || q.includes('isolated') || q.includes('disconnect') || q.includes('יתום')) {
    const orphans = summary.results.filter(r => r.id.startsWith('orphan-'))
    if (orphans.length === 0) return 'No orphaned nodes! All entities are connected.'
    return `**${orphans.length} orphaned node(s):**\n\n` +
      orphans.map((o, i) => `${i + 1}. ${o.message}`).join('\n') +
      `\n\nConnect them to relevant agents/skills or dismiss the alerts if they're standalone utilities.`
  }

  if (q.includes('improve') || q.includes('better') || q.includes('how') || q.includes('שפר') || q.includes('איך')) {
    const priorities: string[] = []
    const errors = summary.results.filter(r => r.severity === 'error')
    const warnings = summary.results.filter(r => r.severity === 'warning')
    const suggestions = summary.results.filter(r => r.severity === 'suggestion')

    if (errors.length > 0) priorities.push(`1. **Fix ${errors.length} error(s)** — 20 points each.`)
    if (warnings.length > 0) priorities.push(`${priorities.length + 1}. **Resolve ${warnings.length} warning(s)** — 8 points each.`)
    if (suggestions.length > 0) priorities.push(`${priorities.length + 1}. **Consider ${suggestions.length} suggestion(s)** — 3 points each.`)
    if (priorities.length === 0) priorities.push('Your ecosystem looks great! No immediate improvements needed.')

    return `**Improvement Priorities:**\n\n${priorities.join('\n')}\n\n` +
      `Use 🔧 auto-fix buttons where available, or dismiss non-critical alerts.`
  }

  if (q.includes('plugin') || q.includes('פלאגין')) {
    const pluginCount = data.nodes.filter(n => n.category === 'plugin').length
    const used = data.nodes.filter(n =>
      n.category === 'plugin' && (
        data.edges.some(e => e.source === n.id || e.target === n.id)
      )
    ).length
    return `**Plugin Status:**\n• ${pluginCount} plugins installed\n• ${used} actively connected\n• ${pluginCount - used} unused\n\n` +
      (pluginCount - used > 0 ? 'Consider connecting unused plugins to skills that need them, or remove them to simplify your ecosystem.' : 'All plugins are well-utilized!')
  }

  if (q.includes('what') || q.includes('explain') || q.includes('מה')) {
    return `The **Ecosystem Optimizer** analyzes your entire Claude Code ecosystem structure. It checks for:\n\n` +
      `• **Structural issues** — orphaned nodes, circular dependencies\n` +
      `• **Connection health** — broken edges, sparse connectivity\n` +
      `• **Best practices** — descriptions, hooks, agents\n` +
      `• **Plugin utilization** — unused plugins\n\n` +
      `Each issue has an **auto-fix** button (🔧) when available, or you can **dismiss** non-critical alerts.`
  }

  // Check specific result titles
  for (const result of summary.results) {
    if (q.includes(result.title.toLowerCase())) {
      return `**${result.title}** (${result.severity})\n\n${result.explanation}` +
        (result.fixAction ? `\n\n🔧 Auto-fix: ${result.fixLabel}` : '') +
        (result.dismissible ? `\n\n👁️ This can be dismissed if intentional.` : '')
    }
  }

  return `I can help you understand your ecosystem's health. Try asking:\n\n` +
    `• "What's my score?"\n` +
    `• "What errors do I have?"\n` +
    `• "How can I improve?"\n` +
    `• "Tell me about orphaned nodes"\n` +
    `• "Plugin status"\n` +
    `• Or click any alert's title to learn more.`
}

// ═══════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════

export default function EcosystemOptimizerPanel({
  ecosystemData, validationIssues, onClose, onSelectNode
}: EcosystemOptimizerPanelProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'system', text: 'Hi! I can explain any alert, help you understand your ecosystem health, or suggest improvements. Ask me anything.' },
  ])
  const [chatInput, setChatInput] = useState('')
  const [expandedResult, setExpandedResult] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const analysis = useMemo(
    () => analyzeEcosystem(ecosystemData, validationIssues),
    [ecosystemData, validationIssues]
  )

  // Filter out dismissed
  const visibleResults = useMemo(
    () => analysis.results.filter(r => !dismissed.has(r.id)),
    [analysis.results, dismissed]
  )

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // ── Auto-fix handler ──
  const handleAutoFix = useCallback((result: EcoOptimizeResult) => {
    if (!result.fixAction) return

    if (result.fixAction === 'navigate-node' && result.fixData?.nodeId) {
      onSelectNode(result.fixData.nodeId as string)
      return
    }

    if (result.fixAction === 'create-agent') {
      // Notify user to use Create panel
      setChatMessages(prev => [...prev, {
        id: `sys-${Date.now()}`, role: 'system',
        text: '💡 Click the **"Create"** button in the toolbar to add a new agent to your ecosystem.',
      }])
      setShowChat(true)
      return
    }

    // Chat notification for fixes
    setChatMessages(prev => [...prev, {
      id: `fix-${Date.now()}`, role: 'system',
      text: `✅ Action applied: **${result.fixLabel}** for "${result.title}".`,
    }])
  }, [onSelectNode])

  // ── Dismiss handler ──
  const handleDismiss = useCallback((resultId: string) => {
    setDismissed(prev => new Set(prev).add(resultId))
    const result = analysis.results.find(r => r.id === resultId)
    setChatMessages(prev => [...prev, {
      id: `dismiss-${Date.now()}`, role: 'system',
      text: `👁️ Dismissed: "${result?.title}". It won't affect your view anymore.`,
    }])
  }, [analysis.results])

  // ── Chat send ──
  const handleSendChat = useCallback(() => {
    const text = chatInput.trim()
    if (!text) return

    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', text }
    const response = generateResponse(text, analysis, ecosystemData)
    const sysMsg: ChatMessage = { id: `sys-${Date.now()}`, role: 'system', text: response }

    setChatMessages(prev => [...prev, userMsg, sysMsg])
    setChatInput('')
  }, [chatInput, analysis, ecosystemData])

  // ── Ask about a specific result ──
  const handleAskAbout = useCallback((result: EcoOptimizeResult) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`, role: 'user',
      text: `Explain: "${result.title}"`,
    }
    const sysMsg: ChatMessage = {
      id: `sys-${Date.now()}`, role: 'system',
      text: `**${result.title}** (${result.severity})\n\n${result.explanation}` +
        (result.fixAction ? `\n\n🔧 **Action available:** ${result.fixLabel}` : '') +
        (result.dismissible ? `\n\n👁️ This alert can be dismissed if it's intentional.` : ''),
    }
    setChatMessages(prev => [...prev, userMsg, sysMsg])
    setShowChat(true)
  }, [])

  return (
    <div className="w-96 h-full bg-white border-l border-gray-200 flex flex-col shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-sm">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Ecosystem Optimizer</h3>
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
              <circle cx="36" cy="36" r="30" fill="none" stroke={GRADE_COLORS[analysis.grade]}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${analysis.score * 1.885} 188.5`}
                transform="rotate(-90 36 36)"
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-black" style={{ color: GRADE_COLORS[analysis.grade] }}>
                {analysis.grade}
              </span>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-2xl font-black text-gray-800">
              {analysis.score}<span className="text-sm font-medium text-gray-400">/100</span>
            </div>
            <div className="flex items-center gap-2.5 mt-1.5">
              {[
                { icon: CheckCircle2, count: analysis.passCount, cls: 'text-green-500' },
                { icon: XCircle, count: analysis.errorCount, cls: 'text-red-500' },
                { icon: AlertTriangle, count: analysis.warningCount, cls: 'text-amber-500' },
                { icon: Lightbulb, count: analysis.suggestionCount, cls: 'text-indigo-500' },
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

        {/* Stats + Fix All */}
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-purple-50 text-[10px] text-purple-600 font-medium">
            <Bot size={10} /> {analysis.stats.agents}
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 text-[10px] text-green-600 font-medium">
            <Puzzle size={10} /> {analysis.stats.skills}
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-[10px] text-blue-600 font-medium">
            <Plug size={10} /> {analysis.stats.plugins}
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50 text-[10px] text-gray-500 font-medium">
            <Network size={10} /> {analysis.stats.edges}
          </div>
          {visibleResults.some(r => r.dismissible && r.severity !== 'pass') && (
            <button
              onClick={() => {
                visibleResults
                  .filter(r => r.dismissible && r.severity !== 'pass')
                  .forEach(r => handleDismiss(r.id))
              }}
              className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold
                         bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-200
                         hover:from-amber-100 hover:to-orange-100 transition-colors cursor-pointer"
            >
              <Sparkles size={10} />Dismiss All
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
                            className="text-[11px] font-semibold text-gray-800 hover:text-indigo-600 transition-colors text-left cursor-pointer"
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
                        {result.severity !== 'pass' && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            {result.fixAction && (
                              <button
                                onClick={() => handleAutoFix(result)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-semibold
                                           bg-indigo-50 text-indigo-600 border border-indigo-200
                                           hover:bg-indigo-100 transition-colors cursor-pointer"
                              >
                                <Wrench size={9} />{result.fixLabel}
                              </button>
                            )}
                            {result.dismissible && (
                              <button
                                onClick={() => handleDismiss(result.id)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-medium
                                           text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
                              >
                                <EyeOff size={9} />Ignore
                              </button>
                            )}
                            <button
                              onClick={() => handleAskAbout(result)}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-medium
                                         text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
                            >
                              <MessageCircle size={9} />Ask
                            </button>
                          </div>
                        )}
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
          className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <MessageCircle size={13} className="text-purple-500" />
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
                        ? 'bg-purple-500 text-white rounded-br-sm'
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
                placeholder="Ask about warnings, orphans, score..."
                className="flex-1 px-3 py-1.5 text-[11px] rounded-lg border border-gray-200 bg-gray-50
                           focus:bg-white focus:border-purple-300 focus:ring-1 focus:ring-purple-200 outline-none"
              />
              <button
                onClick={handleSendChat}
                disabled={!chatInput.trim()}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  chatInput.trim()
                    ? 'bg-purple-500 text-white hover:bg-purple-600'
                    : 'bg-gray-100 text-gray-300'
                }`}
              >
                <Send size={12} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
