import type { AgentTool } from '@/types'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { isString } from '@/shared/general'

const WORKSPACE_ROOT = process.cwd()

function getRequestedPath(value: unknown, fieldName: string) {
  if (!isString(value) || !value.trim()) {
    throw new Error(`${fieldName} 必须是非空字符串。`)
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
    throw new Error('只允许移动当前工作区内的文件。')
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

export const moveFileTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'moveFile',
      description: '在当前工作区内移动或重命名单个文件。适合重命名文件或调整文件路径。',
      parameters: {
        type: 'object',
        properties: {
          fromPath: {
            type: 'string',
            description: '源文件路径，相对当前工作区根目录。',
          },
          toPath: {
            type: 'string',
            description: '目标文件路径，相对当前工作区根目录。',
          },
          overwrite: {
            type: 'boolean',
            description: '可选，目标文件已存在时是否覆盖，默认 false。',
          },
          createDirectories: {
            type: 'boolean',
            description: '可选，是否自动创建目标父目录，默认 true。',
          },
        },
        required: ['fromPath', 'toPath'],
        additionalProperties: false,
      },
    },
  },
  execute: async (args) => {
    const fromPath = getRequestedPath(args.fromPath, 'fromPath')
    const toPath = getRequestedPath(args.toPath, 'toPath')
    const overwrite = getBooleanOption(args.overwrite, 'overwrite', false)
    const createDirectories = getBooleanOption(args.createDirectories, 'createDirectories', true)
    const from = resolveWorkspacePath(fromPath)
    const to = resolveWorkspacePath(toPath)

    if (from.resolvedPath === to.resolvedPath) {
      throw new Error('源路径和目标路径不能相同。')
    }

    const sourceStat = await stat(from.resolvedPath)

    if (!sourceStat.isFile()) {
      throw new Error(`源目标不是文件: ${from.relativePath}`)
    }

    const destinationExists = await pathExists(to.resolvedPath)

    if (destinationExists && !overwrite) {
      throw new Error(`目标文件已存在，若要覆盖请显式传入 overwrite=true: ${to.relativePath}`)
    }

    if (destinationExists) {
      const destinationStat = await stat(to.resolvedPath)

      if (!destinationStat.isFile()) {
        throw new Error(`目标不是文件: ${to.relativePath}`)
      }

      await rm(to.resolvedPath)
    }

    if (createDirectories) {
      await mkdir(path.dirname(to.resolvedPath), { recursive: true })
    }

    await rename(from.resolvedPath, to.resolvedPath)

    return {
      fromPath: from.relativePath,
      toPath: to.relativePath,
      overwritten: destinationExists,
    }
  },
}
