import { stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

export const WORKSPACE_ROOT = process.cwd()

export function resolveWorkspacePath(requestedPath: string, outOfWorkspaceMessage: string) {
  const resolvedPath = path.resolve(WORKSPACE_ROOT, requestedPath)
  const relativePath = path.relative(WORKSPACE_ROOT, resolvedPath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(outOfWorkspaceMessage)
  }

  return {
    resolvedPath,
    relativePath: relativePath || '.',
  }
}

export async function pathExists(filePath: string) {
  try {
    await stat(filePath)
    return true
  }
  catch {
    return false
  }
}
