/**
 * Backup manager — creates backups before any write operation.
 * Stores backups in ~/.claude/.backups/
 */
import fs from 'fs'
import path from 'path'

const MAX_BACKUPS = 20

export interface BackupManifest {
  id: string
  reason: string
  files: string[]
  createdAt: string
}

export function getBackupsDir(claudeDir: string): string {
  return path.join(claudeDir, '.backups')
}

export async function createBackup(
  claudeDir: string,
  filePaths: string[],
  reason: string
): Promise<string> {
  const backupId = new Date().toISOString().replace(/[:.]/g, '-')
  const backupsDir = getBackupsDir(claudeDir)
  const backupDir = path.join(backupsDir, backupId)

  fs.mkdirSync(backupDir, { recursive: true })

  const manifest: BackupManifest = {
    id: backupId,
    reason,
    files: [],
    createdAt: new Date().toISOString(),
  }

  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) continue
    const rel = path.relative(claudeDir, filePath)
    const dest = path.join(backupDir, rel)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(filePath, dest)
    manifest.files.push(rel)
  }

  fs.writeFileSync(
    path.join(backupDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  )

  // Prune old backups
  await pruneOldBackups(backupsDir)

  return backupId
}

export function listBackups(claudeDir: string): BackupManifest[] {
  const backupsDir = getBackupsDir(claudeDir)
  if (!fs.existsSync(backupsDir)) return []

  const backups: BackupManifest[] = []
  for (const dir of fs.readdirSync(backupsDir)) {
    const manifestPath = path.join(backupsDir, dir, 'manifest.json')
    if (!fs.existsSync(manifestPath)) continue
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      backups.push(manifest)
    } catch {}
  }

  return backups.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export async function restoreBackup(
  claudeDir: string,
  backupId: string
): Promise<{ restoredFiles: string[] }> {
  const backupDir = path.join(getBackupsDir(claudeDir), backupId)
  const manifestPath = path.join(backupDir, 'manifest.json')

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Backup ${backupId} not found`)
  }

  const manifest: BackupManifest = JSON.parse(
    fs.readFileSync(manifestPath, 'utf8')
  )

  // Backup current state before restoring (so restore is reversible)
  const currentFiles = manifest.files.map(rel => path.join(claudeDir, rel))
  await createBackup(claudeDir, currentFiles, `Pre-restore backup (restoring ${backupId})`)

  // Restore files
  const restoredFiles: string[] = []
  for (const rel of manifest.files) {
    const src = path.join(backupDir, rel)
    const dest = path.join(claudeDir, rel)
    if (!fs.existsSync(src)) continue
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, dest)
    restoredFiles.push(rel)
  }

  return { restoredFiles }
}

async function pruneOldBackups(backupsDir: string): Promise<void> {
  if (!fs.existsSync(backupsDir)) return

  const dirs = fs.readdirSync(backupsDir).sort().reverse()
  if (dirs.length <= MAX_BACKUPS) return

  for (const dir of dirs.slice(MAX_BACKUPS)) {
    const fullPath = path.join(backupsDir, dir)
    fs.rmSync(fullPath, { recursive: true, force: true })
  }
}
