import { buildGitInspection } from '../git/shared'
import { readWorkspaceFile } from './read'
import { pathExists, resolveWorkspacePath } from './workspace'

function getResultPath(result: Record<string, unknown>, fieldName: string) {
  const value = result[fieldName]

  return typeof value === 'string' ? value : undefined
}

async function existsInWorkspace(requestedPath: string) {
  const { resolvedPath } = resolveWorkspacePath(
    requestedPath,
    '只允许校验当前工作区内的路径。',
  )

  return await pathExists(resolvedPath)
}

async function buildPathStates(paths: string[]) {
  const uniquePaths = [...new Set(paths)]

  return await Promise.all(
    uniquePaths.map(async (requestedPath) => {
      const { resolvedPath, relativePath } = resolveWorkspacePath(
        requestedPath,
        '只允许校验当前工作区内的路径。',
      )
      const exists = await pathExists(resolvedPath)

      if (!exists) {
        return {
          path: relativePath,
          exists: false,
        }
      }

      return {
        path: relativePath,
        exists: true,
        file: await readWorkspaceFile({ path: relativePath }),
      }
    }),
  )
}

export async function buildMutationValidation(toolName: string, result: unknown) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return undefined
  }

  const normalizedResult = result as Record<string, unknown>

  if (toolName === 'writeFile' || toolName === 'replaceInFile' || toolName === 'applyFileEdits') {
    const filePath = getResultPath(normalizedResult, 'path')

    if (!filePath) {
      return undefined
    }

    return {
      kind: 'readback',
      file: await readWorkspaceFile({ path: filePath }),
      git: await buildGitInspection([filePath]),
    }
  }

  if (toolName === 'moveFile') {
    const fromPath = getResultPath(normalizedResult, 'fromPath')
    const toPath = getResultPath(normalizedResult, 'toPath')

    if (!fromPath || !toPath) {
      return undefined
    }

    return {
      kind: 'move-check',
      sourceExists: await existsInWorkspace(fromPath),
      destination: await readWorkspaceFile({ path: toPath }),
      git: await buildGitInspection([fromPath, toPath]),
    }
  }

  if (toolName === 'deleteFile') {
    const filePath = getResultPath(normalizedResult, 'path')

    if (!filePath) {
      return undefined
    }

    return {
      kind: 'delete-check',
      existsAfterDelete: await existsInWorkspace(filePath),
      git: await buildGitInspection([filePath]),
    }
  }

  if (toolName === 'restoreBackup') {
    const affectedPaths = 'affectedPaths' in normalizedResult && Array.isArray(normalizedResult.affectedPaths)
      ? normalizedResult.affectedPaths.filter((value): value is string => typeof value === 'string')
      : []

    if (affectedPaths.length === 0) {
      return undefined
    }

    return {
      kind: 'restore-check',
      states: await buildPathStates(affectedPaths),
      git: await buildGitInspection(affectedPaths),
    }
  }

  return undefined
}
