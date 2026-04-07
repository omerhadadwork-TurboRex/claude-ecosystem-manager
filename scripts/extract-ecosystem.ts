/**
 * Extract ecosystem data from ~/.claude/ config files
 * Run with: npm run extract
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import matter from 'gray-matter'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const HOME = process.env.USERPROFILE || process.env.HOME || ''
const CLAUDE_DIR = path.join(HOME, '.claude')

interface RawNode {
  id: string
  label: string
  category: string
  description: string
  filePath: string
  metadata: Record<string, unknown>
}

interface RawEdge {
  id: string
  source: string
  target: string
  relation: string
  label?: string
}

const nodes: RawNode[] = []
const edges: RawEdge[] = []
let edgeCounter = 0

function nextEdgeId() {
  return `e${++edgeCounter}`
}

// ── 1. Parse local skills ────────────────────────────────────
function parseSkills() {
  const skillsDir = path.join(CLAUDE_DIR, 'skills')
  if (!fs.existsSync(skillsDir)) return

  for (const name of fs.readdirSync(skillsDir)) {
    const skillFile = path.join(skillsDir, name, 'SKILL.md')
    if (!fs.existsSync(skillFile)) continue

    const raw = fs.readFileSync(skillFile, 'utf8')
    const { data, content } = matter(raw)

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

// ── 2. Parse agents ──────────────────────────────────────────
function parseAgents() {
  const agentsDir = path.join(CLAUDE_DIR, 'agents')
  if (!fs.existsSync(agentsDir)) return

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

// ── 3. Parse plugins ─────────────────────────────────────────
function parsePlugins() {
  const marketplacesDir = path.join(CLAUDE_DIR, 'plugins', 'marketplaces')
  if (!fs.existsSync(marketplacesDir)) return

  for (const mkt of fs.readdirSync(marketplacesDir)) {
    const mktDir = path.join(marketplacesDir, mkt)

    // Add marketplace node
    nodes.push({
      id: `marketplace:${mkt}`,
      label: mkt,
      category: 'marketplace',
      description: `Plugin marketplace: ${mkt}`,
      filePath: `~/.claude/plugins/marketplaces/${mkt}`,
      metadata: {},
    })

    // Check for external_plugins
    const extDir = path.join(mktDir, 'external_plugins')
    if (fs.existsSync(extDir)) {
      for (const pluginDir of fs.readdirSync(extDir)) {
        const pluginPath = path.join(extDir, pluginDir)
        if (!fs.statSync(pluginPath).isDirectory()) continue

        // Try to read plugin metadata
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

        // Connect marketplace to plugin
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

// ── 4. Parse remote skills (everything-claude-code) ──────────
function parseRemoteSkills() {
  const cacheDir = path.join(CLAUDE_DIR, 'plugins', 'cache', 'everything-claude-code')
  if (!fs.existsSync(cacheDir)) return

  // Find skills directory recursively
  function findSkillsDir(dir: string): string | null {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (!fs.statSync(full).isDirectory()) continue
      if (entry === 'skills') return full
      // Check one level deeper
      const sub = path.join(full, '.agents', 'skills')
      if (fs.existsSync(sub)) return sub
      const sub2 = path.join(full, 'skills')
      if (fs.existsSync(sub2)) return sub2
    }
    return null
  }

  const skillsDir = findSkillsDir(cacheDir)
  if (!skillsDir) return

  for (const name of fs.readdirSync(skillsDir)) {
    const skillPath = path.join(skillsDir, name)
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

// ── 5. Parse settings (hooks) ────────────────────────────────
function parseSettings() {
  const settingsFile = path.join(CLAUDE_DIR, 'settings.json')
  if (!fs.existsSync(settingsFile)) return

  try {
    const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'))

    // Extract hooks
    if (settings.hooks) {
      for (const [event, hookConfig] of Object.entries(settings.hooks as Record<string, unknown>)) {
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

// ── 6. Parse launch.json ─────────────────────────────────────
function parseLaunchConfigs() {
  const launchFile = path.join(CLAUDE_DIR, 'launch.json')
  if (!fs.existsSync(launchFile)) return

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

// ── 7. Parse scheduled tasks ─────────────────────────────────
function parseScheduledTasks() {
  const tasksDir = path.join(CLAUDE_DIR, 'scheduled-tasks')
  if (!fs.existsSync(tasksDir)) return

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

// ── 8. Infer connections ─────────────────────────────────────
function inferConnections() {
  const skillNames = new Map<string, string>() // label -> id
  for (const node of nodes) {
    skillNames.set(node.label.toLowerCase(), node.id)
  }

  // Scan each skill's content for references to other skills
  const skillsDir = path.join(CLAUDE_DIR, 'skills')
  if (!fs.existsSync(skillsDir)) return

  for (const name of fs.readdirSync(skillsDir)) {
    const skillFile = path.join(skillsDir, name, 'SKILL.md')
    if (!fs.existsSync(skillFile)) continue

    const content = fs.readFileSync(skillFile, 'utf8').toLowerCase()
    const thisId = `skill:${name}`

    for (const [otherLabel, otherId] of skillNames) {
      if (otherId === thisId) continue
      if (otherLabel.length < 4) continue // skip very short names

      // Check if this skill references the other
      if (content.includes(otherLabel)) {
        // Avoid duplicates
        const exists = edges.some(e => e.source === thisId && e.target === otherId)
        if (!exists) {
          // Determine relation type
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

// ── Parse project-level skills ───────────────────────────────
function parseProjectSkills() {
  const projectsDir = path.join(HOME, 'Documents', 'Claude', 'Projects')
  if (!fs.existsSync(projectsDir)) return

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

// ── Main ─────────────────────────────────────────────────────
function main() {
  console.log('Extracting ecosystem data from', CLAUDE_DIR)

  parseSkills()
  parseAgents()
  parsePlugins()
  parseRemoteSkills()
  parseSettings()
  parseLaunchConfigs()
  parseScheduledTasks()
  parseProjectSkills()
  inferConnections()

  // De-duplicate nodes by id
  const uniqueNodes = Array.from(new Map(nodes.map(n => [n.id, n])).values())

  const output = { nodes: uniqueNodes, edges }
  const outPath = path.join(__dirname, '..', 'src', 'data', 'ecosystem-data.json')

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2))

  console.log(`Done! ${uniqueNodes.length} nodes, ${edges.length} edges → ${outPath}`)
}

main()
