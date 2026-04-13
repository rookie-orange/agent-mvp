import type { AgentTool } from '@/types'
import { rm, stat } from 'node:fs/promises'
import { getBooleanOption, getRequiredPath } from './args'
import { requestFileMutationApproval } from './approval'
import { createBackup } from './backup-store'
import { pathExists, resolveWorkspacePath } from './workspace'

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
  execute: async (args, context) => {
    const requestedPath = getRequiredPath(args.path)
    const ignoreMissing = getBooleanOption(args.ignoreMissing, 'ignoreMissing', false)
    const { resolvedPath, relativePath } = resolveWorkspacePath(
      requestedPath,
      '只允许删除当前工作区内的文件。',
    )
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

    await requestFileMutationApproval(context, {
      toolName: 'deleteFile',
      summary: `删除文件 ${relativePath}`,
      paths: [relativePath],
    })

    const backup = await createBackup({
      operation: 'deleteFile',
      entries: [
        {
          path: relativePath,
          resolvedPath,
          existed: true,
        },
      ],
    })

    await rm(resolvedPath)

    return {
      path: relativePath,
      deleted: true,
      ignoredMissing: false,
      backup,
    }
  },
}
