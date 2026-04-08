import type { AgentTool } from '@/types'
import { rm, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { isString } from '@/shared/general'

const WORKSPACE_ROOT = process.cwd()

function getRequestedPath(value: unknown) {
  if (!isString(value) || !value.trim()) {
    throw new Error('path 必须是非空字符串。')
  }

  return value.trim()
}

function getBooleanOption(value: unknown, fieldName: string, fallback: boolean) {
  if (value === undefined) {
    return fallback
  }

  if (typeof value !== 'boolean') {
    throw new TypeError(`${fieldName} 必须是布尔值。`)
  }

  return value
}

function resolveWorkspacePath(requestedPath: string) {
  const resolvedPath = path.resolve(WORKSPACE_ROOT, requestedPath)
  const relativePath = path.relative(WORKSPACE_ROOT, resolvedPath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('只允许删除当前工作区内的文件。')
  }

  return {
    resolvedPath,
    relativePath: relativePath || '.',
  }
}

async function pathExists(filePath: string) {
  try {
    await stat(filePath)
    return true
  }
  catch {
    return false
  }
}

export const deleteFileTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'deleteFile',
      description: '删除当前工作区内的单个文件。仅用于明确需要移除某个已有文件时。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '要删除的文件路径，相对当前工作区根目录。',
          },
          ignoreMissing: {
            type: 'boolean',
            description: '可选，文件不存在时是否忽略，默认 false。',
          },
        },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
  execute: async (args) => {
    const requestedPath = getRequestedPath(args.path)
    const ignoreMissing = getBooleanOption(args.ignoreMissing, 'ignoreMissing', false)
    const { resolvedPath, relativePath } = resolveWorkspacePath(requestedPath)
    const existed = await pathExists(resolvedPath)

    if (!existed) {
      if (ignoreMissing) {
        return {
          path: relativePath,
          deleted: false,
          ignoredMissing: true,
        }
      }

      throw new Error(`文件不存在: ${relativePath}`)
    }

    const targetStat = await stat(resolvedPath)

    if (!targetStat.isFile()) {
      throw new Error(`目标不是文件: ${relativePath}`)
    }

    await rm(resolvedPath)

    return {
      path: relativePath,
      deleted: true,
      ignoredMissing: false,
    }
  },
}
