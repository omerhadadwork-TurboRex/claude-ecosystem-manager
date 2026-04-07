import type { Workflow, OptimizeResult, OptimizeSummary } from './workflow-types'
import type { EcosystemData } from './types'

/**
 * Workflow Optimizer – validates a workflow before deployment.
 * Returns a score (0-100), grade, and detailed results with
 * auto-fix actions, explanations, and dismissibility.
 */
export function optimizeWorkflow(
  workflow: Workflow,
  ecosystemData: EcosystemData
): OptimizeSummary {
  const results: OptimizeResult[] = []
  const nodeIds = new Set(ecosystemData.nodes.map(n => n.id))

  // ── Rule 1: Non-empty workflow ────────────────────────────────────
  if (workflow.steps.length === 0) {
    results.push({
      id: 'empty-workflow',
      severity: 'error',
      title: 'Empty Workflow',
      message: 'Workflow has no steps. Add at least one component to the canvas.',
      explanation: 'A workflow needs at least one step to be functional. Drag components from the left sidebar onto the canvas to build your workflow. Each step represents an agent, skill, plugin, or hook that will execute as part of the pipeline.',
      dismissible: false,
    })
  }

  // ── Rule 2: Workflow needs a name ─────────────────────────────────
  if (!workflow.name.trim() || workflow.name === 'Untitled Workflow') {
    results.push({
      id: 'no-name',
      severity: 'error',
      title: 'Missing Name',
      message: 'Give your workflow a descriptive name before deploying.',
      explanation: 'A meaningful name helps identify the workflow\'s purpose. Click the workflow name in the toolbar to edit it. Good names describe what the workflow does, e.g. "Content Review Pipeline" or "Deploy & Test Automation".',
      fixAction: 'add-description',
      fixLabel: 'Focus name field',
      dismissible: false,
    })
  }

  // ── Rule 3: Disconnected steps ────────────────────────────────────
  const connectedStepIds = new Set<string>()
  for (const conn of workflow.connections) {
    connectedStepIds.add(conn.sourceStepId)
    connectedStepIds.add(conn.targetStepId)
  }
  const disconnectedSteps = workflow.steps.filter(
    step => workflow.steps.length > 1 && !connectedStepIds.has(step.id)
  )
  for (const step of disconnectedSteps) {
    results.push({
      id: `disconnected-${step.id}`,
      severity: 'warning',
      title: 'Disconnected Step',
      message: `"${step.label}" is not connected to any other step. It won't be reachable in the workflow.`,
      explanation: `The step "${step.label}" is floating on its own without any connections. In a workflow, steps need to be connected to define execution order. You can:\n• Drag from the right handle of another step to this step's left handle\n• Or remove it if it's not needed\n\nDisconnected steps won't execute as part of the workflow pipeline and may indicate an incomplete design.`,
      stepId: step.id,
      fixAction: 'remove-step',
      fixLabel: 'Remove step',
      fixData: { stepId: step.id },
      dismissible: true,
    })
  }

  // Auto-connect suggestion if there are disconnected steps
  if (disconnectedSteps.length > 0 && workflow.connections.length > 0) {
    results.push({
      id: 'auto-connect-suggestion',
      severity: 'suggestion',
      title: 'Auto-Connect Available',
      message: `${disconnectedSteps.length} step(s) can be auto-connected to the workflow chain.`,
      explanation: `The optimizer can automatically connect disconnected steps to the end of the current workflow chain. This creates a linear pipeline where each step invokes the next. You can then rearrange connections manually if needed.`,
      fixAction: 'connect-steps',
      fixLabel: 'Auto-connect all',
      fixData: { stepIds: disconnectedSteps.map(s => s.id) },
      dismissible: true,
    })
  }

  // ── Rule 4: Entry point ───────────────────────────────────────────
  if (workflow.steps.length > 0) {
    const hasIncoming = new Set(workflow.connections.map(c => c.targetStepId))
    const entryPoints = workflow.steps.filter(s => !hasIncoming.has(s.id))
    if (entryPoints.length === 0) {
      results.push({
        id: 'no-entry-point',
        severity: 'error',
        title: 'No Entry Point',
        message: 'Every step has incoming connections — no clear starting point.',
        explanation: 'A workflow needs at least one step with no incoming connections to serve as the entry point (where execution begins). Currently all steps have incoming connections, which likely means there\'s a circular dependency. Break one connection to create a clear starting point.',
        fixAction: 'break-cycle',
        fixLabel: 'Break first cycle',
        dismissible: false,
      })
    }
    if (entryPoints.length > 1 && workflow.connections.length > 0) {
      results.push({
        id: 'multiple-entries',
        severity: 'suggestion',
        title: 'Multiple Entry Points',
        message: `Found ${entryPoints.length} entry points: ${entryPoints.map(s => `"${s.label}"`).join(', ')}. Consider if this is intentional.`,
        explanation: `Your workflow has ${entryPoints.length} starting points. This is fine for parallel workflows where multiple branches run independently, but could be a mistake if you intended a single linear pipeline. Entry points: ${entryPoints.map(s => s.label).join(', ')}.`,
        dismissible: true,
      })
    }
  }

  // ── Rule 5: Circular dependency ───────────────────────────────────
  {
    const adj = new Map<string, string[]>()
    for (const conn of workflow.connections) {
      if (!adj.has(conn.sourceStepId)) adj.set(conn.sourceStepId, [])
      adj.get(conn.sourceStepId)!.push(conn.targetStepId)
    }
    const visited = new Set<string>()
    const inStack = new Set<string>()
    let hasCycle = false

    function dfs(id: string): boolean {
      visited.add(id)
      inStack.add(id)
      for (const neighbor of adj.get(id) || []) {
        if (inStack.has(neighbor)) return true
        if (!visited.has(neighbor) && dfs(neighbor)) return true
      }
      inStack.delete(id)
      return false
    }

    for (const step of workflow.steps) {
      if (!visited.has(step.id) && dfs(step.id)) { hasCycle = true; break }
    }

    if (hasCycle) {
      results.push({
        id: 'circular-dependency',
        severity: 'warning',
        title: 'Circular Dependency',
        message: 'A cycle was detected in the workflow. This could cause infinite loops at runtime.',
        explanation: 'Circular dependencies occur when Step A → Step B → Step C → Step A, creating an infinite loop. This is dangerous because:\n• It can consume unlimited tokens/resources\n• It will never finish executing\n• It can crash the runtime\n\nTo fix: identify which connection creates the loop and remove it, or add a conditional exit point.',
        fixAction: 'break-cycle',
        fixLabel: 'Break cycle',
        dismissible: true,
      })
    }
  }

  // ── Rule 6: Referenced entities exist ──────────────────────────────
  for (const step of workflow.steps) {
    if (!nodeIds.has(step.entityId)) {
      results.push({
        id: `missing-entity-${step.id}`,
        severity: 'error',
        title: 'Missing Entity',
        message: `"${step.label}" references "${step.entityId}" which doesn't exist in the ecosystem.`,
        explanation: `This step references an entity (${step.entityId}) that no longer exists in your ecosystem. This could happen if:\n• The original skill/agent was deleted\n• The entity was renamed\n• It was created in a different project scope\n\nRemove this step or recreate the missing entity.`,
        stepId: step.id,
        fixAction: 'remove-step',
        fixLabel: 'Remove step',
        fixData: { stepId: step.id },
        dismissible: false,
      })
    }
  }

  // ── Rule 7: Duplicate steps ───────────────────────────────────────
  const entityCounts = new Map<string, number>()
  for (const step of workflow.steps) {
    entityCounts.set(step.entityId, (entityCounts.get(step.entityId) || 0) + 1)
  }
  for (const [entityId, count] of entityCounts) {
    if (count > 1) {
      const step = workflow.steps.find(s => s.entityId === entityId)
      const dupeSteps = workflow.steps.filter(s => s.entityId === entityId)
      results.push({
        id: `duplicate-${entityId}`,
        severity: 'suggestion',
        title: 'Duplicate Component',
        message: `"${step?.label}" appears ${count} times. Consider if you need multiple instances.`,
        explanation: `The component "${step?.label}" is used ${count} times in this workflow. While sometimes intentional (e.g., running the same skill with different inputs), duplicates often indicate:\n• Accidental double-add\n• A step that should be reused via connections instead\n\nIf intentional, you can dismiss this. Otherwise, remove the extra instance(s).`,
        fixAction: 'remove-duplicate',
        fixLabel: 'Remove duplicates',
        fixData: { keepId: dupeSteps[0]?.id, removeIds: dupeSteps.slice(1).map(s => s.id) },
        dismissible: true,
      })
    }
  }

  // ── Rule 8: Project scope needs project name ──────────────────────
  if (workflow.scope === 'project' && !workflow.projectName?.trim()) {
    results.push({
      id: 'project-scope-no-name',
      severity: 'error',
      title: 'Missing Project Name',
      message: 'Workflow is scoped to a project but no project name is specified.',
      explanation: 'You selected "Project" scope but didn\'t specify which project. Click the scope selector in the toolbar and choose a specific project, or switch to "Global" scope if this workflow should be available everywhere.',
      fixAction: 'set-scope',
      fixLabel: 'Set to Global',
      dismissible: false,
    })
  }

  // ── Rule 9: Agent without skills ──────────────────────────────────
  for (const step of workflow.steps) {
    if (step.category === 'agent') {
      const hasOutgoing = workflow.connections.some(c => c.sourceStepId === step.id)
      if (!hasOutgoing) {
        results.push({
          id: `agent-no-skills-${step.id}`,
          severity: 'warning',
          title: 'Agent Without Skills',
          message: `Agent "${step.label}" has no outgoing connections to skills.`,
          explanation: `An agent is an orchestrator that delegates work to skills. Without outgoing connections, the agent "${step.label}" has nothing to delegate to. Connect it to skills or other components by dragging from its right handle to skill left handles.\n\nThis reduces the agent's effectiveness and wastes tokens since it will try to work without the specialized capabilities that skills provide.`,
          stepId: step.id,
          dismissible: true,
        })
      }
    }
  }

  // ── Rule 10: Hook without trigger ─────────────────────────────────
  for (const step of workflow.steps) {
    if (step.category === 'hook') {
      const hasIncoming = workflow.connections.some(c => c.targetStepId === step.id)
      if (!hasIncoming) {
        results.push({
          id: `hook-no-trigger-${step.id}`,
          severity: 'suggestion',
          title: 'Hook Without Trigger',
          message: `Hook "${step.label}" has no incoming trigger connection.`,
          explanation: `Hooks are event-driven components that activate when triggered. Without an incoming connection, this hook won't be triggered by the workflow. If it's triggered by an external event (like a git push or file change), you can dismiss this. Otherwise, connect a step to trigger it.`,
          stepId: step.id,
          dismissible: true,
        })
      }
    }
  }

  // ── Rule 11: Description ──────────────────────────────────────────
  if (workflow.description.trim().length < 10 && workflow.steps.length > 0) {
    results.push({
      id: 'short-description',
      severity: 'suggestion',
      title: 'Short Description',
      message: 'Add a meaningful description to help others understand this workflow\'s purpose.',
      explanation: 'A good description helps teammates (and your future self) understand what this workflow does, when to use it, and what to expect. Aim for 1-2 sentences that describe the workflow\'s purpose and output.',
      fixAction: 'add-description',
      fixLabel: 'Focus description',
      dismissible: true,
    })
  }

  // ── Rule 12: Token efficiency ─────────────────────────────────────
  if (workflow.steps.length > 6) {
    results.push({
      id: 'large-workflow',
      severity: 'warning',
      title: 'Large Workflow — Token Risk',
      message: `${workflow.steps.length} steps may consume significant tokens. Consider splitting into sub-workflows.`,
      explanation: `A workflow with ${workflow.steps.length} steps means each execution invokes multiple agents/skills, each consuming tokens. This can be expensive and slow. Consider:\n• Breaking into smaller, focused sub-workflows\n• Using parallel execution where steps are independent\n• Removing steps that could be handled by existing skill chains\n\nEstimated token impact: ~${workflow.steps.length * 2000}-${workflow.steps.length * 8000} tokens per run.`,
      dismissible: true,
    })
  }

  // ── Rule 13: Skills without agents (no orchestrator) ──────────────
  {
    const agentSteps = workflow.steps.filter(s => s.category === 'agent')
    const skillSteps = workflow.steps.filter(s => s.category === 'skill-local' || s.category === 'skill-project')
    if (skillSteps.length > 2 && agentSteps.length === 0) {
      results.push({
        id: 'skills-no-agent',
        severity: 'suggestion',
        title: 'No Orchestrator Agent',
        message: `${skillSteps.length} skills but no agent to orchestrate them. Consider adding an agent as entry point.`,
        explanation: `Your workflow has ${skillSteps.length} skills but no agent to coordinate them. While skills can invoke each other directly, an agent provides:\n• Intelligent routing between skills\n• Error handling and fallback logic\n• Context management across steps\n• Better debugging visibility\n\nAdd an agent as the first step and connect it to your skills.`,
        dismissible: true,
      })
    }
  }

  // ── Passes ────────────────────────────────────────────────────────
  if (workflow.steps.length > 0 && results.filter(r => r.severity === 'error').length === 0) {
    results.push({
      id: 'valid-structure',
      severity: 'pass',
      title: 'Valid Structure',
      message: 'Workflow has a valid node/edge structure.',
      explanation: 'All structural checks passed — nodes and edges form a valid graph.',
      dismissible: false,
    })
  }
  if (workflow.name.trim() && workflow.name !== 'Untitled Workflow') {
    results.push({
      id: 'has-name',
      severity: 'pass',
      title: 'Named Workflow',
      message: 'Workflow has a descriptive name.',
      explanation: 'Good job naming your workflow!',
      dismissible: false,
    })
  }
  if (workflow.tags.length > 0) {
    results.push({
      id: 'has-tags',
      severity: 'pass',
      title: 'Tagged',
      message: `Workflow is tagged with: ${workflow.tags.join(', ')}`,
      explanation: 'Tags help organize and find workflows.',
      dismissible: false,
    })
  }
  if (workflow.steps.length > 0 && disconnectedSteps.length === 0 && workflow.connections.length > 0) {
    results.push({
      id: 'fully-connected',
      severity: 'pass',
      title: 'Fully Connected',
      message: 'All steps are connected — no orphaned nodes.',
      explanation: 'Every step in the workflow is reachable through connections.',
      dismissible: false,
    })
  }

  // ── Calculate Score ───────────────────────────────────────────────
  const errorCount = results.filter(r => r.severity === 'error').length
  const warningCount = results.filter(r => r.severity === 'warning').length
  const suggestionCount = results.filter(r => r.severity === 'suggestion').length
  const passCount = results.filter(r => r.severity === 'pass').length

  let score = 100
  score -= errorCount * 25
  score -= warningCount * 10
  score -= suggestionCount * 3
  score = Math.max(0, Math.min(100, score))

  const grade: OptimizeSummary['grade'] =
    score >= 90 ? 'A' :
    score >= 75 ? 'B' :
    score >= 60 ? 'C' :
    score >= 40 ? 'D' : 'F'

  return {
    score,
    grade,
    results,
    passCount,
    errorCount,
    warningCount,
    suggestionCount,
  }
}
