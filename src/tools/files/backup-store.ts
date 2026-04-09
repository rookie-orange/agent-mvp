import { createHash, randomUUID } from 'node:crypto'
import { chmod, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getNonEmptyString } from './args'
import { pathExists, resolveWorkspacePath, WORKSPACE_ROOT } from './workspace'

interface BackupEntryInput {
  path: string
  resolvedPath: string
  existed: boolean
}

interface BackupSnapshot {
  path: string
  existed: boolean
  mode?: number
  contentFile?: string
}

interface BackupRecord {
  version: 1
  id: string
  createdAt: string
  workspaceRoot: string
  operation: string
  snapshots: BackupSnapshot[]
}

interface CreateBackupInput {
  operation: string
  entries: BackupEntryInput[]
}

interface RestoreBackupInput {
  backupId: string
}

export interface BackupSummary {
  id: string
  createdAt: string
  operation: string
  affectedPaths: string[]
}

export interface RestoredPathSummary {
  path: string
  action: 'restored' | 'recreated' | 'removed' | 'unchanged'
}

export interface RestoreBackupSummary {
  backupId: string
  sourceOperation: string
  createdAt: string
  restoredAt: string
  affectedPaths: string[]
  restoredPaths: RestoredPathSummary[]
  restoredCount: number
}

function getWorkspaceBackupRoot() {
  const workspaceHash = createHash('sha256')
    .update(WORKSPACE_ROOT)
    .digest('hex')
    .slice(0, 16)

  return path.join(os.tmpdir(), 'agent-mvp-backups', workspaceHash)
}

function getBackupDirectory(backupId: string) {
  return path.join(getWorkspaceBackupRoot(), backupId)
}

function getMetadataPath(backupId: string) {
  return path.join(getBackupDirectory(backupId), 'metadata.json')
}

function dedupeEntries(entries: BackupEntryInput[]) {
  const deduped = new Map<string, BackupEntryInput>()

  for (const entry of entries) {
    deduped.set(entry.path, entry)
  }

  return [...deduped.values()]
}

async function readBackupRecord(backupId: string) {
  const metadataPath = getMetadataPath(backupId)
  const rawContent = await readFile(metadataPath, 'utf8')
  const parsed = JSON.parse(rawContent) as BackupRecord

  if (parsed.workspaceRoot !== WORKSPACE_ROOT) {
    throw new Error('该备份不属于当前工作区，无法恢复。')
  }

  return parsed
}

export async function createBackup({
  operation,
  entries,
}: CreateBackupInput): Promise<BackupSummary> {
  const normalizedEntries = dedupeEntries(entries)
  const backupId = randomUUID()
  const createdAt = new Date().toISOString()
  const backupDirectory = getBackupDirectory(backupId)
  const filesDirectory = path.join(backupDirectory, 'files')

  await mkdir(filesDirectory, { recursive: true })

  try {
    const snapshots: BackupSnapshot[] = []

    for (let index = 0; index < normalizedEntries.length; index += 1) {
      const entry = normalizedEntries[index]

      if (!entry) {
        continue
      }

      if (!entry.existed) {
        snapshots.push({
          path: entry.path,
          existed: false,
        })
        continue
      }

      const fileStat = await stat(entry.resolvedPath)

      if (!fileStat.isFile()) {
        throw new Error(`目标不是文件: ${entry.path}`)
      }

      const contentFile = `files/${index}.bin`
      const content = await readFile(entry.resolvedPath)

      await writeFile(path.join(backupDirectory, contentFile), content)

      snapshots.push({
        path: entry.path,
        existed: true,
        mode: fileStat.mode,
        contentFile,
      })
    }

    const record: BackupRecord = {
      version: 1,
      id: backupId,
      createdAt,
      workspaceRoot: WORKSPACE_ROOT,
      operation,
      snapshots,
    }

    await writeFile(getMetadataPath(backupId), JSON.stringify(record, null, 2), 'utf8')

    return {
      id: backupId,
      createdAt,
      operation,
      affectedPaths: snapshots.map(snapshot => snapshot.path),
    }
  }
  catch (error) {
    await rm(backupDirectory, { recursive: true, force: true })
    throw error
  }
}

export async function restoreBackup({
  backupId: rawBackupId,
}: RestoreBackupInput): Promise<RestoreBackupSummary> {
  const backupId = getNonEmptyString(rawBackupId, 'backupId')
  const record = await readBackupRecord(backupId)
  const backupDirectory = getBackupDirectory(backupId)
  const restoredPaths: RestoredPathSummary[] = []

  for (const snapshot of record.snapshots) {
    const { resolvedPath, relativePath } = resolveWorkspacePath(
      snapshot.path,
      '只允许恢复当前工作区内的文件。',
    )
    const currentExists = await pathExists(resolvedPath)

    if (snapshot.existed) {
      if (!snapshot.contentFile) {
        throw new Error(`备份损坏，缺少内容文件: ${relativePath}`)
      }

      if (currentExists) {
        const currentStat = await stat(resolvedPath)

        if (!currentStat.isFile()) {
          throw new Error(`恢复失败，当前路径不是文件: ${relativePath}`)
        }
      }

      const content = await readFile(path.join(backupDirectory, snapshot.contentFile))

      await mkdir(path.dirname(resolvedPath), { recursive: true })
      await writeFile(resolvedPath, content)

      if (snapshot.mode !== undefined) {
        await chmod(resolvedPath, snapshot.mode)
      }

      restoredPaths.push({
        path: relativePath,
        action: currentExists ? 'restored' : 'recreated',
      })
      continue
    }

    if (!currentExists) {
      restoredPaths.push({
        path: relativePath,
        action: 'unchanged',
      })
      continue
    }

    const currentStat = await stat(resolvedPath)

    if (!currentStat.isFile()) {
      throw new Error(`恢复失败，当前路径不是文件: ${relativePath}`)
    }

    await rm(resolvedPath)

    restoredPaths.push({
      path: relativePath,
      action: 'removed',
    })
  }

  return {
    backupId: record.id,
    sourceOperation: record.operation,
    createdAt: record.createdAt,
    restoredAt: new Date().toISOString(),
    affectedPaths: record.snapshots.map(snapshot => snapshot.path),
    restoredPaths,
    restoredCount: restoredPaths.length,
  }
}
