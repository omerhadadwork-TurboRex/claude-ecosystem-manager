/**
 * Sandbox manager — creates and manages test environment copies.
 * Sandbox lives at ~/.claude/.sandbox/ and mirrors the prod structure.
 */
import fs from 'fs'
import path from 'path'
import { createBackup } from './backup.js'

/** Directories/patterns to exclude from sandbox copy */
const EXCLUDE = ['.backups', '.sandbox', 'plugins/cache', 'node_modules']

/** Directories to copy into sandbox */
const COPY_DIRS = ['skills', 'agents', 'scheduled-tasks']

/** Files to copy into sandbox */
const COPY_FILES = ['settings.json', 'launch.json']

export function getSandboxDir(claudeDir: string): string {
  return path.join(claudeDir, '.sandbox')
}

export function sandboxExists(claudeDir: string): boolean {
  const dir = getSandboxDir(claudeDir)
  return fs.existsSync(dir) && fs.readdirSync(dir).length > 0
}

/**
 * Initialize sandbox by copying prod contents.
 * If sandbox already exists, returns existing path.
 */
export function initSandbox(claudeDir: string): string {
  const sandboxDir = getSandboxDir(claudeDir)

  if (sandboxExists(claudeDir)) {
    return sandboxDir
  }

  fs.mkdirSync(sandboxDir, { recursive: true })

  // Copy directories
  for (const dir of COPY_DIRS) {
    const src = path.join(claudeDir, dir)
    const dest = path.join(sandboxDir, dir)
    if (fs.existsSync(src)) {
      copyDirRecursive(src, dest)
    }
  }

  // Copy files
  for (const file of COPY_FILES) {
    const src = path.join(claudeDir, file)
    const dest = path.join(sandboxDir, file)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest)
    }
  }

  console.log(`  🧪 Sandbox created at ${sandboxDir}`)
  return sandboxDir
}

/**
 * Reset sandbox — delete and re-copy from prod.
 */
export function resetSandbox(claudeDir: string): string {
  const sandboxDir = getSandboxDir(claudeDir)

  if (fs.existsSync(sandboxDir)) {
    fs.rmSync(sandboxDir, { recursive: true, force: true })
  }

  return initSandbox(claudeDir)
}

/**
 * Promote sandbox contents to prod.
 * Creates a backup of prod first, then copies sandbox over prod.
 */
export async function promoteSandbox(claudeDir: string): Promise<{
  success: boolean
  backupId: string
  promotedFiles: string[]
}> {
  const sandboxDir = getSandboxDir(claudeDir)

  if (!sandboxExists(claudeDir)) {
    return { success: false, backupId: '', promotedFiles: [] }
  }

  // Collect all prod files that will be overwritten for backup
  const prodFiles: string[] = []
  for (const dir of COPY_DIRS) {
    const src = path.join(claudeDir, dir)
    if (fs.existsSync(src)) {
      collectFiles(src, prodFiles)
    }
  }
  for (const file of COPY_FILES) {
    const src = path.join(claudeDir, file)
    if (fs.existsSync(src)) {
      prodFiles.push(src)
    }
  }

  // Create backup of prod before overwriting
  const backupId = await createBackup(claudeDir, prodFiles, 'Pre-promote backup')

  // Copy sandbox contents over prod
  const promotedFiles: string[] = []

  for (const dir of COPY_DIRS) {
    const src = path.join(sandboxDir, dir)
    const dest = path.join(claudeDir, dir)
    if (fs.existsSync(src)) {
      // Remove existing prod dir contents (but keep the dir)
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true })
      }
      copyDirRecursive(src, dest)
      collectRelativeFiles(src, sandboxDir, promotedFiles)
    }
  }

  for (const file of COPY_FILES) {
    const src = path.join(sandboxDir, file)
    const dest = path.join(claudeDir, file)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest)
      promotedFiles.push(file)
    }
  }

  // Delete sandbox after successful promotion
  fs.rmSync(sandboxDir, { recursive: true, force: true })

  console.log(`  🚀 Sandbox promoted to prod (${promotedFiles.length} files, backup: ${backupId})`)

  return { success: true, backupId, promotedFiles }
}

// ── Helpers ──────────────────────────────────────────────

function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true })

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (EXCLUDE.some(ex => entry.name === ex || srcPath.includes(ex))) {
      continue
    }

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function collectFiles(dir: string, result: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectFiles(full, result)
    } else {
      result.push(full)
    }
  }
}

function collectRelativeFiles(dir: string, baseDir: string, result: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectRelativeFiles(full, baseDir, result)
    } else {
      result.push(path.relative(baseDir, full))
    }
  }
}
