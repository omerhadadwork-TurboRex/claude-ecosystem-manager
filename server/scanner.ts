/**
 * Ecosystem scanner — reads ~/.claude/ and builds EcosystemData.
 * Pure function, no side effects.
 */
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

export interface RawNode {
  id: string
  label: string
  category: string
  description: string
  filePath: string
  metadata: Record<string, unknown>
}

export interface RawEdge {
  id: string
  source: string
  target: string
  relation: string
  label?: string
}

export interface ScanResult {
  nodes: RawNode[]
  edges: RawEdge[]
}

export function scanEcosystem(claudeDir: string): ScanResult {
  const HOME = process.env.USERPROFILE || process.env.HOME || ''
  const nodes: RawNode[] = []
  const edges: RawEdge[] = []
  let edgeCounter = 0

  function nextEdgeId() {
    return `e${++edgeCounter}`
  }

  // ── 1. Parse local skills ──────────────────────────────────
  const skillsDir = path.join(claudeDir, 'skills')
  if (fs.existsSync(skillsDir)) {
    for (const name of fs.readdirSync(skillsDir)) {
      const skillFile = path.join(skillsDir, name, 'SKILL.md')
      if (!fs.existsSync(skillFile)) continue
      const raw = fs.readFileSync(skillFile, 'utf8')
      const { data } = matter(raw)
      nodes.push({
        id: `skill:${name}`,
        label: data.name || name,
        category: 'skill-local',
        description: data.description || '',
        filePath: `~/.claude/skills/${name}/SKILL.md`,
        metadata: data.metadata ? { ...data.metadata } : {},
      })
    }
  }

  // ── 2. Parse agents ────────────────────────────────────────
  const agentsDir = path.join(claudeDir, 'agents')
  if (fs.existsSync(agentsDir)) {
    for (const name of fs.readdirSync(agentsDir)) {
      const skillFile = path.join(agentsDir, name, 'SKILL.md')
      if (!fs.existsSync(skillFile)) continue
      const raw = fs.readFileSync(skillFile, 'utf8')
      const { data } = matter(raw)
      nodes.push({
        id: `agent:${name}`,
        label: data.name || name,
        category: 'agent',
        description: data.description || '',
        filePath: `~/.claude/agents/${name}/SKILL.md`,
        metadata: data.metadata ? { ...data.metadata } : {},
      })
    }
  }

  // ── 3. Parse plugins ───────────────────────────────────────
  const marketplacesDir = path.join(claudeDir, 'plugins', 'marketplaces')
  if (fs.existsSync(marketplacesDir)) {
    for (const mkt of fs.readdirSync(marketplacesDir)) {
      const mktDir = path.join(marketplacesDir, mkt)
      nodes.push({
        id: `marketplace:${mkt}`,
        label: mkt,
        category: 'marketplace',
        description: `Plugin marketplace: ${mkt}`,
        filePath: `~/.claude/plugins/marketplaces/${mkt}`,
        metadata: {},
      })
      const extDir = path.join(mktDir, 'external_plugins')
      if (fs.existsSync(extDir)) {
        for (const pluginDir of fs.readdirSync(extDir)) {
          const pluginPath = path.join(extDir, pluginDir)
          if (!fs.statSync(pluginPath).isDirectory()) continue
          let description = `Plugin: ${pluginDir}`
          const metaFile = path.join(pluginPath, 'plugin.json')
          if (fs.existsSync(metaFile)) {
            try {
              const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'))
              description = meta.description || description
            } catch {}
          }
          nodes.push({
            id: `plugin:${pluginDir}`,
            label: pluginDir,
            category: 'plugin',
            description,
            filePath: `~/.claude/plugins/marketplaces/${mkt}/external_plugins/${pluginDir}`,
            metadata: { marketplace: mkt },
          })
          edges.push({
            id: nextEdgeId(),
            source: `marketplace:${mkt}`,
            target: `plugin:${pluginDir}`,
            relation: 'provides-tools',
          })
        }
      }
    }
  }

  // ── 4. Parse remote skills (everything-claude-code) ────────
  const cacheDir = path.join(claudeDir, 'plugins', 'cache', 'everything-claude-code')
  if (fs.existsSync(cacheDir)) {
    function findSkillsDir(dir: string): string | null {
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry)
        if (!fs.statSync(full).isDirectory()) continue
        if (entry === 'skills') return full
        const sub = path.join(full, '.agents', 'skills')
        if (fs.existsSync(sub)) return sub
        const sub2 = path.join(full, 'skills')
        if (fs.existsSync(sub2)) return sub2
      }
      return null
    }
    const remoteSkillsDir = findSkillsDir(cacheDir)
    if (remoteSkillsDir) {
      for (const name of fs.readdirSync(remoteSkillsDir)) {
        const skillPath = path.join(remoteSkillsDir, name)
        if (!fs.statSync(skillPath).isDirectory()) continue
        const skillFile = path.join(skillPath, 'SKILL.md')
        let description = `Remote skill: ${name}`
        if (fs.existsSync(skillFile)) {
          try {
            const { data } = matter(fs.readFileSync(skillFile, 'utf8'))
            description = data.description || description
          } catch {}
        }
        nodes.push({
          id: `remote:${name}`,
          label: name,
          category: 'skill-remote',
          description,
          filePath: skillPath.replace(HOME, '~'),
          metadata: { source: 'everything-claude-code' },
        })
      }
    }
  }

  // ── 5. Parse settings (hooks) ──────────────────────────────
  const settingsFile = path.join(claudeDir, 'settings.json')
  if (fs.existsSync(settingsFile)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'))
      if (settings.hooks) {
        for (const [event] of Object.entries(settings.hooks as Record<string, unknown>)) {
          nodes.push({
            id: `hook:${event.toLowerCase()}`,
            label: `${event} Hook`,
            category: 'hook',
            description: `Hook triggered on ${event} event`,
            filePath: '~/.claude/settings.json',
            metadata: { event },
          })
        }
      }
    } catch {}
  }

  // ── 6. Parse launch.json ───────────────────────────────────
  const launchFile = path.join(claudeDir, 'launch.json')
  if (fs.existsSync(launchFile)) {
    try {
      const launch = JSON.parse(fs.readFileSync(launchFile, 'utf8'))
      if (launch.configurations) {
        for (const cfg of launch.configurations) {
          nodes.push({
            id: `launch:${cfg.name}`,
            label: cfg.name,
            category: 'launch-config',
            description: `${cfg.runtimeExecutable || 'unknown'} server on port ${cfg.port || '?'}`,
            filePath: '~/.claude/launch.json',
            metadata: { port: cfg.port, runtime: cfg.runtimeExecutable },
          })
        }
      }
    } catch {}
  }

  // ── 7. Parse scheduled tasks ───────────────────────────────
  const tasksDir = path.join(claudeDir, 'scheduled-tasks')
  if (fs.existsSync(tasksDir)) {
    for (const name of fs.readdirSync(tasksDir)) {
      const skillFile = path.join(tasksDir, name, 'SKILL.md')
      if (!fs.existsSync(skillFile)) continue
      const raw = fs.readFileSync(skillFile, 'utf8')
      const { data } = matter(raw)
      nodes.push({
        id: `scheduled:${name}`,
        label: name,
        category: 'scheduled-task',
        description: data.description || `Scheduled task: ${name}`,
        filePath: `~/.claude/scheduled-tasks/${name}/SKILL.md`,
        metadata: data.metadata ? { ...data.metadata } : {},
      })
    }
  }

  // ── 8. Parse project-level skills ──────────────────────────
  const projectsDir = path.join(HOME, 'Documents', 'Claude', 'Projects')
  if (fs.existsSync(projectsDir)) {
    for (const project of fs.readdirSync(projectsDir)) {
      const projectSkillsDir = path.join(projectsDir, project, '.claude', 'skills')
      if (!fs.existsSync(projectSkillsDir)) continue
      for (const name of fs.readdirSync(projectSkillsDir)) {
        const skillFile = path.join(projectSkillsDir, name, 'SKILL.md')
        if (!fs.existsSync(skillFile)) continue
        const raw = fs.readFileSync(skillFile, 'utf8')
        const { data } = matter(raw)
        nodes.push({
          id: `project:${name}`,
          label: name,
          category: 'skill-project',
          description: `${data.description || ''} (${project})`,
          filePath: `~/Projects/${project}/.claude/skills/${name}/SKILL.md`,
          metadata: { project, ...((data.metadata as object) || {}) },
        })
      }
    }
  }

  // ── 9. Infer connections ───────────────────────────────────
  const skillNames = new Map<string, string>()
  for (const node of nodes) {
    skillNames.set(node.label.toLowerCase(), node.id)
  }
  if (fs.existsSync(skillsDir)) {
    for (const name of fs.readdirSync(skillsDir)) {
      const skillFile = path.join(skillsDir, name, 'SKILL.md')
      if (!fs.existsSync(skillFile)) continue
      const content = fs.readFileSync(skillFile, 'utf8').toLowerCase()
      const thisId = `skill:${name}`
      for (const [otherLabel, otherId] of skillNames) {
        if (otherId === thisId) continue
        if (otherLabel.length < 4) continue
        if (content.includes(otherLabel)) {
          const exists = edges.some(e => e.source === thisId && e.target === otherId)
          if (!exists) {
            let relation = 'invokes'
            if (otherId.startsWith('agent:')) relation = 'delegates-to'
            else if (content.includes(`depends on ${otherLabel}`) || content.includes(`requires ${otherLabel}`)) {
              relation = 'depends-on'
            }
            edges.push({
              id: nextEdgeId(),
              source: thisId,
              target: otherId,
              relation,
              label: relation === 'delegates-to' ? 'routes to' : undefined,
            })
          }
        }
      }
    }
  }

  // De-duplicate nodes by id
  const uniqueNodes = Array.from(new Map(nodes.map(n => [n.id, n])).values())

  return { nodes: uniqueNodes, edges }
}
