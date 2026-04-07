/**
 * Writer — writes changes back to ~/.claude/ files.
 * Always creates a backup before writing.
 */
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { createBackup } from './backup.js'

export interface WriteResult {
  success: boolean
  backupId: string
  filesWritten: string[]
  errors: string[]
}

/**
 * Whitelist of paths that can be written to (relative to claudeDir)
 */
const WRITABLE_PATTERNS = [
  /^skills\//,
  /^agents\//,
  /^scheduled-tasks\//,
  /^settings\.json$/,
  /^launch\.json$/,
]

function isWritable(relativePath: string): boolean {
  return WRITABLE_PATTERNS.some(p => p.test(relativePath))
}

/**
 * Update a SKILL.md file's frontmatter and/or content
 */
export async function updateSkillFile(
  claudeDir: string,
  nodeId: string,
  updates: {
    label?: string
    description?: string
    category?: string
    content?: string
    metadata?: Record<string, unknown>
  }
): Promise<WriteResult> {
  const result: WriteResult = {
    success: false,
    backupId: '',
    filesWritten: [],
    errors: [],
  }

  // Resolve node ID to file path
  const filePath = resolveNodePath(claudeDir, nodeId)
  if (!filePath) {
    result.errors.push(`Cannot resolve file path for node: ${nodeId}`)
    return result
  }

  const relativePath = path.relative(claudeDir, filePath)
  if (!isWritable(relativePath)) {
    result.errors.push(`Path not writable: ${relativePath}`)
    return result
  }

  // Create backup
  result.backupId = await createBackup(claudeDir, [filePath], `Update ${nodeId}`)

  try {
    if (filePath.endsWith('.json')) {
      // Handle JSON files (settings.json, launch.json)
      await updateJsonFile(filePath, nodeId, updates)
    } else {
      // Handle SKILL.md files
      await updateMarkdownFile(filePath, updates)
    }
    result.filesWritten.push(relativePath)
    result.success = true
  } catch (err) {
    result.errors.push(`Failed to write: ${(err as Error).message}`)
  }

  return result
}

/**
 * Create a new entity (skill, agent, scheduled task)
 */
export async function createEntity(
  claudeDir: string,
  entity: {
    id: string
    label: string
    category: string
    description: string
    metadata?: Record<string, unknown>
  }
): Promise<WriteResult> {
  const result: WriteResult = {
    success: false,
    backupId: '',
    filesWritten: [],
    errors: [],
  }

  let dirPath: string
  let filePath: string

  const name = entity.label.toLowerCase().replace(/\s+/g, '-')

  switch (entity.category) {
    case 'skill-local':
      dirPath = path.join(claudeDir, 'skills', name)
      filePath = path.join(dirPath, 'SKILL.md')
      break
    case 'agent':
      dirPath = path.join(claudeDir, 'agents', name)
      filePath = path.join(dirPath, 'SKILL.md')
      break
    case 'scheduled-task':
      dirPath = path.join(claudeDir, 'scheduled-tasks', name)
      filePath = path.join(dirPath, 'SKILL.md')
      break
    default:
      result.errors.push(`Cannot create entity of type: ${entity.category}`)
      return result
  }

  if (fs.existsSync(filePath)) {
    result.errors.push(`Entity already exists: ${filePath}`)
    return result
  }

  // No backup needed for new files, but backup the parent dir in case
  result.backupId = await createBackup(claudeDir, [], `Create ${entity.id}`)

  try {
    fs.mkdirSync(dirPath, { recursive: true })

    const frontmatter: Record<string, unknown> = {
      name: entity.label,
      description: entity.description,
    }
    if (entity.metadata) {
      frontmatter.metadata = entity.metadata
    }

    const content = matter.stringify(
      `\n# ${entity.label}\n\n${entity.description}\n`,
      frontmatter
    )

    fs.writeFileSync(filePath, content, 'utf8')
    result.filesWritten.push(path.relative(claudeDir, filePath))
    result.success = true
  } catch (err) {
    result.errors.push(`Failed to create: ${(err as Error).message}`)
  }

  return result
}

/**
 * Delete an entity from the filesystem
 */
export async function deleteEntity(
  claudeDir: string,
  nodeId: string
): Promise<WriteResult> {
  const result: WriteResult = {
    success: false,
    backupId: '',
    filesWritten: [],
    errors: [],
  }

  const filePath = resolveNodePath(claudeDir, nodeId)
  if (!filePath) {
    result.errors.push(`Cannot resolve path for: ${nodeId}`)
    return result
  }

  // For SKILL.md files, delete the entire directory
  const dirToDelete = filePath.endsWith('SKILL.md')
    ? path.dirname(filePath)
    : null

  const pathToBackup = dirToDelete || filePath

  // Collect all files to backup
  const filesToBackup: string[] = []
  if (dirToDelete && fs.existsSync(dirToDelete)) {
    collectFiles(dirToDelete, filesToBackup)
  } else if (fs.existsSync(filePath)) {
    filesToBackup.push(filePath)
  }

  result.backupId = await createBackup(claudeDir, filesToBackup, `Delete ${nodeId}`)

  try {
    if (dirToDelete && fs.existsSync(dirToDelete)) {
      fs.rmSync(dirToDelete, { recursive: true, force: true })
      result.filesWritten.push(path.relative(claudeDir, dirToDelete))
    }
    result.success = true
  } catch (err) {
    result.errors.push(`Failed to delete: ${(err as Error).message}`)
  }

  return result
}

// ── Helpers ──────────────────────────────────────────────────

function resolveNodePath(claudeDir: string, nodeId: string): string | null {
  const [prefix, ...nameParts] = nodeId.split(':')
  const name = nameParts.join(':')

  switch (prefix) {
    case 'skill':
      return path.join(claudeDir, 'skills', name, 'SKILL.md')
    case 'agent':
      return path.join(claudeDir, 'agents', name, 'SKILL.md')
    case 'scheduled':
      return path.join(claudeDir, 'scheduled-tasks', name, 'SKILL.md')
    case 'hook':
      return path.join(claudeDir, 'settings.json')
    case 'launch':
      return path.join(claudeDir, 'launch.json')
    default:
      return null
  }
}

async function updateMarkdownFile(
  filePath: string,
  updates: { label?: string; description?: string; content?: string; metadata?: Record<string, unknown> }
): Promise<void> {
  let raw = ''
  if (fs.existsSync(filePath)) {
    raw = fs.readFileSync(filePath, 'utf8')
  }

  const { data, content } = matter(raw)

  if (updates.label) data.name = updates.label
  if (updates.description) data.description = updates.description
  if (updates.metadata) data.metadata = { ...data.metadata, ...updates.metadata }

  const newContent = updates.content || content
  const output = matter.stringify(newContent, data)

  fs.writeFileSync(filePath, output, 'utf8')
}

async function updateJsonFile(
  filePath: string,
  nodeId: string,
  updates: { label?: string; description?: string; metadata?: Record<string, unknown> }
): Promise<void> {
  const raw = fs.readFileSync(filePath, 'utf8')
  const json = JSON.parse(raw)

  const [prefix, name] = nodeId.split(':')

  if (prefix === 'hook' && json.hooks) {
    // Hook updates would go here
    // For now, just preserve existing hooks
  } else if (prefix === 'launch' && json.configurations) {
    const cfg = json.configurations.find((c: { name: string }) => c.name === name)
    if (cfg && updates.label) {
      cfg.name = updates.label
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8')
}

function collectFiles(dir: string, result: string[]): void {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (fs.statSync(full).isDirectory()) {
      collectFiles(full, result)
    } else {
      result.push(full)
    }
  }
}
