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
    }
  }

  return undefined
}
